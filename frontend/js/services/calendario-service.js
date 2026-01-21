/**
 * Servicio de Calendario de Notificaciones
 * Maneja el cálculo, guardado y carga de calendarios de notificaciones desde archivos
 */
class CalendarioService {
    constructor(fileStorageService = null) {
        this.fileStorageService = fileStorageService;
    }

    /**
     * Generar hash simple de las reglas para detectar cambios
     * @param {object} obligacion - Obligación con reglas de alertamiento
     * @returns {string} - Hash de las reglas
     */
    generarHashReglas(obligacion) {
        const reglas = obligacion.reglas_alertamiento || {};
        const datos = {
            fecha_limite: obligacion.fecha_limite || obligacion.fecha_limite_original || '',
            regla_1_vez: reglas.regla_1_vez || '',
            regla_semanal: reglas.regla_semanal || '',
            regla_saltado: reglas.regla_saltado || '',
            regla_diaria: reglas.regla_diaria || ''
        };
        
        // Generar hash simple usando JSON.stringify
        const str = JSON.stringify(datos);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convertir a 32bit integer
        }
        return hash.toString(36);
    }

    /**
     * Parsea una fecha desde string DD/MM/YYYY o YYYY-MM-DD a Date
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
     * Prioridad: 4TA (Diaria) > 3ER (Saltado) > 2DA (Semanal) > 1ER (1 Vez)
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
     * Determinar tipo de regla para una fecha
     */
    determinarTipoRegla(fecha, a1, a2, a3, a4) {
        const fechaTime = fecha.getTime();
        
        // Verificar si es diaria (a4)
        if (a4) {
            const a4Time = a4.getTime();
            const diff = fechaTime - a4Time;
            if (diff >= 0 && diff % (86400000) === 0) {
                return 'diaria';
            }
        }
        
        // Verificar si es saltado (a3, cada 2 días)
        if (a3) {
            const a3Time = a3.getTime();
            const diff = fechaTime - a3Time;
            if (diff >= 0 && diff % (86400000 * 2) === 0) {
                return 'saltado';
            }
        }
        
        // Verificar si es semanal (a2)
        if (a2) {
            const a2Time = a2.getTime();
            const diff = fechaTime - a2Time;
            if (diff >= 0 && diff % (86400000 * 7) === 0) {
                return 'semanal';
            }
        }
        
        // Verificar si es 1 vez (a1)
        if (a1 && fechaTime === a1.getTime()) {
            return '1_vez';
        }
        
        return 'desconocido';
    }

    /**
     * Cargar calendario desde archivo
     * @param {string} obligacionId - ID de la obligación
     * @returns {Promise<object|null>} - Calendario guardado o null si no existe
     */
    async cargarCalendarioDesdeArchivo(obligacionId) {
        if (!this.fileStorageService) {
            if (window.FileStorageService) {
                this.fileStorageService = new FileStorageService();
                await this.fileStorageService.init();
            } else {
                return null;
            }
        }

        const path = `obligaciones/${obligacionId}/calendario.json`;
        
        try {
            const contenido = await this.fileStorageService.readTextFile(path);
            if (!contenido || contenido.trim() === '') {
                return null;
            }
            
            return JSON.parse(contenido);
        } catch (error) {
            if (error.message && error.message.includes('no encontrado')) {
                return null;
            }
            console.warn(`[Calendario] Error al cargar calendario desde archivo ${path}:`, error);
            return null;
        }
    }

    /**
     * Guardar calendario en archivo
     * @param {string} obligacionId - ID de la obligación
     * @param {Array<Date>} fechas - Array de fechas calculadas
     * @param {object} obligacion - Obligación con reglas
     * @returns {Promise<string>} - Ruta del archivo guardado
     */
    async guardarCalendarioEnArchivo(obligacionId, fechas, obligacion) {
        if (!this.fileStorageService) {
            if (window.FileStorageService) {
                this.fileStorageService = new FileStorageService();
                await this.fileStorageService.init();
            } else {
                throw new Error('FileStorageService no disponible');
            }
        }

        const reglas = obligacion.reglas_alertamiento || {};
        const reglasHash = this.generarHashReglas(obligacion);
        
        const calendarioData = {
            fechas: fechas.map(f => f.toISOString().split('T')[0]), // YYYY-MM-DD
            reglasHash: reglasHash,
            fechaCalculo: new Date().toISOString(),
            fecha_limite: obligacion.fecha_limite || obligacion.fecha_limite_original || '',
            reglas: {
                regla_1_vez: reglas.regla_1_vez || '',
                regla_semanal: reglas.regla_semanal || '',
                regla_saltado: reglas.regla_saltado || '',
                regla_diaria: reglas.regla_diaria || ''
            }
        };

        const path = `obligaciones/${obligacionId}/calendario.json`;
        const contenido = JSON.stringify(calendarioData, null, 2);
        
        await this.fileStorageService.saveFile('calendario.json', contenido, `obligaciones/${obligacionId}`, 'application/json');
        
        console.log(`[Calendario] Calendario guardado en archivo: ${path}`);
        return path;
    }

    /**
     * Verificar si necesita recalcular el calendario
     * @param {object} obligacion - Obligación actual
     * @param {object} calendarioGuardado - Calendario cargado desde archivo
     * @returns {boolean} - true si necesita recalcular
     */
    necesitaRecalcular(obligacion, calendarioGuardado) {
        if (!calendarioGuardado) {
            return true; // No existe calendario guardado
        }

        const hashActual = this.generarHashReglas(obligacion);
        return hashActual !== calendarioGuardado.reglasHash;
    }

    /**
     * Calcular calendario para una obligación
     * @param {object} obligacion - Obligación
     * @returns {Promise<Array<Date>>} - Array de fechas calculadas
     */
    async calcularCalendario(obligacion) {
        // Parsear fecha límite
        const deadline = this.parseFecha(obligacion.fecha_limite || obligacion.fecha_limite_original);
        if (!deadline) {
            console.warn(`[Calendario] Obligación ${obligacion.id} sin fecha límite válida`);
            return [];
        }

        // Obtener fechas de reglas de alertamiento
        const reglas = obligacion.reglas_alertamiento || {};
        const a1 = this.parseFecha(reglas.regla_1_vez);      // 1 Vez
        const a2 = this.parseFecha(reglas.regla_semanal);    // Semanal
        const a3 = this.parseFecha(reglas.regla_saltado);     // Saltado (cada 2 días)
        const a4 = this.parseFecha(reglas.regla_diaria);     // Diaria

        // Generar calendario con prioridad: 4TA (Diaria) > 3ER (Saltado) > 2DA (Semanal) > 1ER (1 Vez)
        const fechas = this.generateScheduleForRow(a1, a2, a3, a4, deadline);
        
        return fechas;
    }

    /**
     * Calcular y guardar calendario si es necesario
     * @param {string} obligacionId - ID de la obligación
     * @param {object} obligacion - Obligación
     * @returns {Promise<Array<Date>>} - Array de fechas calculadas
     */
    async calcularYGuardarCalendario(obligacionId, obligacion) {
        try {
            // Cargar calendario existente
            const calendarioGuardado = await this.cargarCalendarioDesdeArchivo(obligacionId);
            
            // Verificar si necesita recalcular
            if (!this.necesitaRecalcular(obligacion, calendarioGuardado)) {
                console.log(`[Calendario] Calendario para ${obligacionId} está actualizado, usando versión guardada`);
                // Convertir fechas guardadas de vuelta a Date objects
                return calendarioGuardado.fechas.map(f => this.parseFecha(f));
            }

            // Calcular nuevo calendario
            console.log(`[Calendario] Calculando nuevo calendario para ${obligacionId}`);
            const fechas = await this.calcularCalendario(obligacion);
            
            // Guardar en archivo
            if (fechas.length > 0) {
                await this.guardarCalendarioEnArchivo(obligacionId, fechas, obligacion);
            }
            
            return fechas;
        } catch (error) {
            console.error(`[Calendario] Error al calcular y guardar calendario para ${obligacionId}:`, error);
            // En caso de error, intentar calcular sin guardar
            return await this.calcularCalendario(obligacion);
        }
    }

    /**
     * Obtener calendario (cargar desde archivo o calcular si no existe)
     * @param {string} obligacionId - ID de la obligación
     * @param {object} obligacion - Obligación
     * @returns {Promise<Array<Date>>} - Array de fechas
     */
    async obtenerCalendario(obligacionId, obligacion) {
        return await this.calcularYGuardarCalendario(obligacionId, obligacion);
    }
}

// Exportar servicio
if (typeof window !== 'undefined') {
    window.CalendarioService = CalendarioService;
}
