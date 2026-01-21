/**
 * Servicio de Recordatorios
 * Maneja la generación, verificación y envío de recordatorios automáticos basados en el calendario de notificaciones
 */
class RecordatoriosService {
    constructor(dataAdapter, obligacionesService = null) {
        this.dataAdapter = dataAdapter;
        this.obligacionesService = obligacionesService;
    }

    /**
     * Parsear fecha desde string DD/MM/YYYY o YYYY-MM-DD a Date
     */
    parseFecha(fechaStr) {
        if (!fechaStr) return null;
        
        // Si es string DD/MM/YYYY
        if (typeof fechaStr === 'string' && fechaStr.includes('/')) {
            const parts = fechaStr.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1; // Mes es 0-based
                const year = parseInt(parts[2], 10);
                if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                    return new Date(Date.UTC(year, month, day));
                }
            }
        }
        
        // Si es string YYYY-MM-DD
        if (typeof fechaStr === 'string' && fechaStr.includes('-')) {
            const date = new Date(fechaStr + 'T00:00:00Z');
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
        
        // Si ya es Date
        if (fechaStr instanceof Date && !isNaN(fechaStr.getTime())) {
            return fechaStr;
        }
        
        return null;
    }

    /**
     * Genera rango de fechas desde start hasta end (inclusive) avanzando stepDays
     */
    genRange(start, end, stepDays) {
        const fechas = [];
        let cur = new Date(start);
        const endDate = new Date(end);
        
        while (cur <= endDate) {
            fechas.push(new Date(cur));
            cur = new Date(cur);
            cur.setUTCDate(cur.getUTCDate() + stepDays);
        }
        
        return fechas;
    }

    /**
     * Obtiene la fecha mínima no nula
     */
    minNonNull(...dates) {
        const clean = dates.filter(d => d !== null && d !== undefined);
        return clean.length > 0 ? new Date(Math.min(...clean.map(d => d.getTime()))) : null;
    }

    /**
     * Genera el calendario de fechas para una obligación aplicando prioridad
     * Prioridad: Diaria > Saltado > Semanal > 1 Vez
     * (Misma lógica que generateScheduleForRow en obligaciones-controller.js)
     */
    generateScheduleForRow(a1, a2, a3, a4, deadline) {
        if (!deadline) return [];
        
        const fechas = [];
        
        // 4TA (diaria): desde a4 hasta deadline (inclusive)
        if (a4 && a4 <= deadline) {
            fechas.push(...this.genRange(a4, deadline, 1));
        }
        
        // 3ER (cada 2 días): desde a3 hasta min(a4-1, deadline)
        if (a3 && a3 <= deadline) {
            const a4Minus1 = a4 ? new Date(a4.getTime() - 86400000) : null; // a4 - 1 día
            const upper = this.minNonNull(a4Minus1, deadline) || deadline;
            if (a3 <= upper) {
                fechas.push(...this.genRange(a3, upper, 2));
            }
        }
        
        // 2DA (semanal): desde a2 hasta min(a3-1, a4-1, deadline)
        if (a2 && a2 <= deadline) {
            const a3Minus1 = a3 ? new Date(a3.getTime() - 86400000) : null;
            const a4Minus1 = a4 ? new Date(a4.getTime() - 86400000) : null;
            const upper = this.minNonNull(a3Minus1, a4Minus1, deadline) || deadline;
            if (a2 <= upper) {
                fechas.push(...this.genRange(a2, upper, 7));
            }
        }
        
        // 1ER (única): sólo si queda antes del arranque de cualquier alerta de mayor prioridad
        if (a1 && a1 <= deadline) {
            const cutoff = this.minNonNull(a2, a3, a4);
            if (!cutoff) {
                fechas.push(a1);
            } else {
                if (a1 < cutoff) {
                    fechas.push(a1);
                }
            }
        }
        
        // Unificar y ordenar (y asegurar <= deadline)
        const fechasUnicas = [...new Set(fechas.map(f => f.getTime()))]
            .map(t => new Date(t))
            .filter(f => f <= deadline)
            .sort((a, b) => a.getTime() - b.getTime());
        
        return fechasUnicas;
    }

    /**
     * Determinar tipo de recordatorio basado en la fecha y las reglas
     */
    determinarTipoRecordatorio(fecha, a1, a2, a3, a4) {
        const fechaTime = fecha.getTime();
        
        // Verificar si la fecha corresponde a alguna regla específica
        if (a4 && Math.abs(fechaTime - a4.getTime()) < 86400000) {
            // Si está cerca de a4, es diaria
            return 'diaria';
        }
        if (a3 && Math.abs(fechaTime - a3.getTime()) < 86400000) {
            // Si está cerca de a3, es saltado
            return 'saltado';
        }
        if (a2 && Math.abs(fechaTime - a2.getTime()) < 86400000) {
            // Si está cerca de a2, es semanal
            return 'semanal';
        }
        if (a1 && Math.abs(fechaTime - a1.getTime()) < 86400000) {
            // Si está cerca de a1, es 1_vez
            return '1_vez';
        }
        
        // Determinar por el patrón de fechas
        // Si es cada día desde a4, es diaria
        if (a4 && fecha >= a4) {
            return 'diaria';
        }
        // Si es cada 2 días desde a3, es saltado
        if (a3 && fecha >= a3) {
            const diasDesdeA3 = Math.floor((fechaTime - a3.getTime()) / (86400000));
            if (diasDesdeA3 % 2 === 0) {
                return 'saltado';
            }
        }
        // Si es cada 7 días desde a2, es semanal
        if (a2 && fecha >= a2) {
            const diasDesdeA2 = Math.floor((fechaTime - a2.getTime()) / (86400000));
            if (diasDesdeA2 % 7 === 0) {
                return 'semanal';
            }
        }
        
        // Por defecto
        return '1_vez';
    }

    /**
     * Generar recordatorios desde calendario para una obligación
     * @param {object} obligacion - Obligación para la cual generar recordatorios
     * @returns {Promise<Array>} Array de recordatorios generados
     */
    async generarRecordatoriosDesdeCalendario(obligacion) {
        try {
            // Parsear fecha límite
            const deadline = this.parseFecha(obligacion.fecha_limite || obligacion.fecha_limite_original);
            if (!deadline) {
                console.warn(`[Recordatorios] Obligación ${obligacion.id} sin fecha límite válida`);
                return [];
            }

            // Obtener fechas de reglas de alertamiento
            const reglas = obligacion.reglas_alertamiento || {};
            const a1 = this.parseFecha(reglas.regla_1_vez);      // 1 Vez
            const a2 = this.parseFecha(reglas.regla_semanal);    // Semanal
            const a3 = this.parseFecha(reglas.regla_saltado);    // Saltado (cada 2 días)
            const a4 = this.parseFecha(reglas.regla_diaria);     // Diaria

            // Generar fechas usando la misma lógica que el calendario
            const fechas = this.generateScheduleForRow(a1, a2, a3, a4, deadline);

            // Crear recordatorios para cada fecha
            const recordatorios = fechas.map(fecha => {
                const tipo = this.determinarTipoRecordatorio(fecha, a1, a2, a3, a4);
                return {
                    fecha: fecha.toISOString().split('T')[0], // YYYY-MM-DD
                    tipo: tipo,
                    enviado: false,
                    fecha_envio: null,
                    intentos: 0,
                    error: null
                };
            });

            // Inicializar array de recordatorios si no existe
            if (!obligacion.recordatorios_programados || !Array.isArray(obligacion.recordatorios_programados)) {
                obligacion.recordatorios_programados = [];
            }

            // Combinar con recordatorios existentes (evitar duplicados)
            const recordatoriosExistentes = obligacion.recordatorios_programados;
            const fechasExistentes = new Set(recordatoriosExistentes.map(r => r.fecha));

            // Agregar solo recordatorios nuevos
            const nuevosRecordatorios = recordatorios.filter(r => !fechasExistentes.has(r.fecha));
            obligacion.recordatorios_programados = [...recordatoriosExistentes, ...nuevosRecordatorios];

            // Ordenar por fecha
            obligacion.recordatorios_programados.sort((a, b) => 
                new Date(a.fecha) - new Date(b.fecha)
            );

            // Guardar obligación actualizada
            obligacion.updated_at = new Date().toISOString();
            await this.dataAdapter.saveObligacion(obligacion);

            console.log(`[Recordatorios] Generados ${nuevosRecordatorios.length} recordatorios para obligación ${obligacion.id}`);
            return nuevosRecordatorios;
        } catch (error) {
            console.error('[Recordatorios] Error al generar recordatorios:', error);
            throw error;
        }
    }

    /**
     * Verificar recordatorios pendientes para el día actual
     * @returns {Promise<Array>} Array de recordatorios que deben enviarse hoy
     */
    async verificarRecordatoriosPendientes() {
        try {
            // Obtener todas las obligaciones activas
            const obligacionesService = this.obligacionesService || new ObligacionesService(this.dataAdapter);
            const todasObligaciones = await obligacionesService.getAll();
            
            // Filtrar solo obligaciones activas (no pausadas ni atendidas)
            const obligacionesActivas = todasObligaciones.filter(obl => 
                obl.estatus !== 'pausada' && obl.estatus !== 'atendida'
            );

            // Fecha actual (solo fecha, sin hora)
            const hoy = new Date();
            hoy.setUTCHours(0, 0, 0, 0);
            const hoyISO = hoy.toISOString().split('T')[0]; // YYYY-MM-DD

            const recordatoriosPendientes = [];

            for (const obligacion of obligacionesActivas) {
                if (!obligacion.recordatorios_programados || !Array.isArray(obligacion.recordatorios_programados)) {
                    continue;
                }

                // Buscar recordatorios para hoy que no se hayan enviado
                const recordatoriosHoy = obligacion.recordatorios_programados.filter(r => 
                    r.fecha === hoyISO && !r.enviado
                );

                recordatoriosHoy.forEach(recordatorio => {
                    recordatoriosPendientes.push({
                        obligacion: obligacion,
                        recordatorio: recordatorio
                    });
                });
            }

            console.log(`[Recordatorios] Encontrados ${recordatoriosPendientes.length} recordatorios pendientes para hoy`);
            return recordatoriosPendientes;
        } catch (error) {
            console.error('[Recordatorios] Error al verificar recordatorios pendientes:', error);
            return [];
        }
    }

    /**
     * Enviar recordatorios pendientes del día
     * @returns {Promise<object>} Estadísticas de envío
     */
    async enviarRecordatoriosPendientes() {
        try {
            const recordatoriosPendientes = await this.verificarRecordatoriosPendientes();
            
            const estadisticas = {
                total: recordatoriosPendientes.length,
                enviados: 0,
                fallidos: 0,
                errores: []
            };

            for (const { obligacion, recordatorio } of recordatoriosPendientes) {
                try {
                    // Enviar recordatorio
                    if (window.NotificacionesService) {
                        const notificacionesService = new NotificacionesService(this.dataAdapter);
                        await notificacionesService.enviarRecordatorioEvidencia(
                            obligacion.id,
                            recordatorio.fecha,
                            obligacion.area
                        );
                    }

                    // Marcar como enviado
                    recordatorio.enviado = true;
                    recordatorio.fecha_envio = new Date().toISOString();
                    recordatorio.intentos++;

                    // Registrar en bitácora
                    if (window.BitacoraService) {
                        const bitacoraService = new BitacoraService(this.dataAdapter);
                        await bitacoraService.registrarEvento(
                            obligacion.id,
                            'recordatorio_enviado',
                            'Recordatorio enviado',
                            `Recordatorio ${recordatorio.tipo} enviado a área ${obligacion.area}`,
                            null,
                            { recordatorio: recordatorio },
                            null
                        );
                    }

                    // Guardar obligación actualizada
                    obligacion.updated_at = new Date().toISOString();
                    await this.dataAdapter.saveObligacion(obligacion);

                    estadisticas.enviados++;
                } catch (error) {
                    console.error(`[Recordatorios] Error al enviar recordatorio para ${obligacion.id}:`, error);
                    recordatorio.intentos++;
                    recordatorio.error = error.message;
                    estadisticas.fallidos++;
                    estadisticas.errores.push({
                        obligacionId: obligacion.id,
                        error: error.message
                    });

                    // Guardar intento fallido
                    obligacion.updated_at = new Date().toISOString();
                    await this.dataAdapter.saveObligacion(obligacion);
                }
            }

            console.log(`[Recordatorios] Enviados ${estadisticas.enviados} de ${estadisticas.total} recordatorios`);
            return estadisticas;
        } catch (error) {
            console.error('[Recordatorios] Error al enviar recordatorios pendientes:', error);
            throw error;
        }
    }

    /**
     * Reprogramar recordatorios para una obligación
     * @param {string} obligacionId - ID de la obligación
     * @returns {Promise<Array>} Nuevos recordatorios generados
     */
    async reprogramarRecordatorios(obligacionId) {
        try {
            const obligacion = await this.dataAdapter.getObligacion(obligacionId);
            if (!obligacion) {
                throw new Error(`Obligación ${obligacionId} no encontrada`);
            }

            // Limpiar recordatorios existentes no enviados
            obligacion.recordatorios_programados = obligacion.recordatorios_programados.filter(r => r.enviado);

            // Generar nuevos recordatorios
            const nuevosRecordatorios = await this.generarRecordatoriosDesdeCalendario(obligacion);

            console.log(`[Recordatorios] Reprogramados ${nuevosRecordatorios.length} recordatorios para obligación ${obligacionId}`);
            return nuevosRecordatorios;
        } catch (error) {
            console.error('[Recordatorios] Error al reprogramar recordatorios:', error);
            throw error;
        }
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.RecordatoriosService = RecordatoriosService;
}
