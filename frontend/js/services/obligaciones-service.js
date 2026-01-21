/**
 * Servicio de Obligaciones
 * Maneja toda la lógica de negocio relacionada con obligaciones
 */
class ObligacionesService {
    constructor(dataAdapter) {
        this.dataAdapter = dataAdapter;
    }

    /**
     * Obtener todas las obligaciones
     */
    async getAll(filters = {}) {
        try {
            const obligaciones = await this.dataAdapter.getObligaciones(filters);

            // Enriquecer con información calculada
            return obligaciones.map(obl => this.enrichObligacion(obl));
        } catch (error) {
            console.error('Error al obtener obligaciones:', error);
            throw error;
        }
    }

    /**
     * Obtener una obligación por ID
     */
    async getById(id) {
        try {
            const obligacion = await this.dataAdapter.getObligacion(id);
            if (!obligacion) {
                throw new Error(`Obligación ${id} no encontrada`);
            }
            return this.enrichObligacion(obligacion);
        } catch (error) {
            console.error(`Error al obtener obligación ${id}:`, error);
            throw error;
        }
    }

    /**
     * Enriquecer obligación con información calculada
     */
    enrichObligacion(obligacion) {
        // Usar "Días para vencer" del Excel si existe, sino calcular desde fecha_limite
        let diasRestantes = null;
        if (obligacion.dias_para_vencer_excel !== null && obligacion.dias_para_vencer_excel !== undefined) {
            diasRestantes = obligacion.dias_para_vencer_excel;
        } else {
            diasRestantes = Utils.getDaysUntil(obligacion.fecha_limite);
        }

        const criticidad = Utils.getCriticidad(
            diasRestantes,
            obligacion.reglas_alertamiento
        );

        return {
            ...obligacion,
            dias_restantes: diasRestantes,
            criticidad: criticidad,
            requiere_envio: diasRestantes !== null && diasRestantes <= (obligacion.reglas_alertamiento?.critica || 5),
            en_ventana: diasRestantes !== null && diasRestantes > (obligacion.reglas_alertamiento?.critica || 5) &&
                diasRestantes <= (obligacion.reglas_alertamiento?.alerta1 || 30)
        };
    }

    /**
     * Filtrar obligaciones
     */
    async filter(filters) {
        const obligaciones = await this.getAll();

        let filtered = [...obligaciones];

        if (filters.area) {
            filtered = filtered.filter(obl => obl.area === filters.area);
        }

        if (filters.periodicidad) {
            filtered = filtered.filter(obl => obl.periodicidad === filters.periodicidad);
        }

        if (filters.estatus) { // Changed from 'estado' to 'estatus' to match UI/Controller
            filtered = filtered.filter(obl => obl.estatus === filters.estatus);
        } else if (filters.estado) { // Fallback for old 'estado' property
            filtered = filtered.filter(obl => obl.estado === filters.estado);
        }

        if (filters.sub_estatus) {
            filtered = filtered.filter(obl => String(obl.sub_estatus).toLowerCase() === String(filters.sub_estatus).toLowerCase());
        }

        if (filters.criticidad) {
            filtered = filtered.filter(obl => obl.criticidad.nivel === filters.criticidad);
        }

        if (filters.id) {
            const idLower = filters.id.toLowerCase();
            filtered = filtered.filter(obl =>
                String(obl.id).toLowerCase().includes(idLower)
            );
        }

        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filtered = filtered.filter(obl =>
                String(obl.id).toLowerCase().includes(searchLower) ||
                String(obl.regulador || '').toLowerCase().includes(searchLower) ||
                String(obl.descripcion || obl.nombre || '').toLowerCase().includes(searchLower) ||
                String(obl.area || '').toLowerCase().includes(searchLower)
            );
        }

        return filtered;
    }

    /**
     * Pausar obligación
     */
    async pausar(id, motivo = '') {
        try {
            // Obtener obligación actual para guardar estado anterior
            const obligacionActual = await this.dataAdapter.getObligacion(id);
            const estatusAnterior = obligacionActual?.estatus || 'activa';
            
            const obligacion = await this.dataAdapter.updateObligacionEstado(id, 'pausada');

            // Registrar en bitácora
            if (window.BitacoraService) {
                try {
                    const bitacoraService = new BitacoraService(this.dataAdapter);
                    await bitacoraService.registrarEvento(
                        id,
                        'pausar',
                        'Pausar seguimiento',
                        motivo ? `Seguimiento pausado. Motivo: ${motivo}` : 'Seguimiento pausado',
                        { estatus: estatusAnterior },
                        { estatus: 'pausada', motivo: motivo },
                        null
                    );
                } catch (bitacoraError) {
                    console.warn('Error al registrar en bitácora:', bitacoraError);
                }
            }

            // Registrar en auditoría
            const user = await this.dataAdapter.getCurrentUser();
            await this.dataAdapter.saveAuditoria({
                usuario: user.nombre,
                accion: 'Pausó obligación',
                contexto: {
                    obligacion_id: id,
                    motivo: motivo
                },
                ip: Utils.getUserIP()
            });

            return obligacion;
        } catch (error) {
            console.error(`Error al pausar obligación ${id}:`, error);
            throw error;
        }
    }

    /**
     * Reanudar obligación
     */
    async reanudar(id) {
        try {
            // Obtener obligación actual para guardar estado anterior
            const obligacionActual = await this.dataAdapter.getObligacion(id);
            const estatusAnterior = obligacionActual?.estatus || 'pausada';
            
            const obligacion = await this.dataAdapter.updateObligacionEstado(id, 'activa');

            // Registrar en bitácora
            if (window.BitacoraService) {
                try {
                    const bitacoraService = new BitacoraService(this.dataAdapter);
                    await bitacoraService.registrarEvento(
                        id,
                        'reanudar',
                        'Reanudar seguimiento',
                        'El seguimiento ha sido reanudado',
                        { estatus: estatusAnterior },
                        { estatus: 'activa' },
                        null
                    );
                } catch (bitacoraError) {
                    console.warn('Error al registrar en bitácora:', bitacoraError);
                }
            }

            // Registrar en auditoría
            const user = await this.dataAdapter.getCurrentUser();
            await this.dataAdapter.saveAuditoria({
                usuario: user.nombre,
                accion: 'Reanudó obligación',
                contexto: {
                    obligacion_id: id
                },
                ip: Utils.getUserIP()
            });

            return obligacion;
        } catch (error) {
            console.error(`Error al reanudar obligación ${id}:`, error);
            throw error;
        }
    }

    /**
     * Marcar como atendida
     */
    async marcarAtendida(id) {
        try {
            // Obtener obligación actual para guardar estado anterior
            const obligacionActual = await this.dataAdapter.getObligacion(id);
            const estatusAnterior = obligacionActual?.estatus || 'activa';
            
            const obligacion = await this.dataAdapter.updateObligacionEstado(id, 'atendida');

            // Registrar en bitácora
            if (window.BitacoraService) {
                try {
                    const bitacoraService = new BitacoraService(this.dataAdapter);
                    await bitacoraService.registrarEvento(
                        id,
                        'marcar_atendida',
                        'Marcar como atendida',
                        'La obligación ha sido marcada como atendida. El seguimiento se ha detenido.',
                        { estatus: estatusAnterior },
                        { estatus: 'atendida' },
                        null
                    );
                } catch (bitacoraError) {
                    console.warn('Error al registrar en bitácora:', bitacoraError);
                }
            }

            // Registrar en auditoría
            const user = await this.dataAdapter.getCurrentUser();
            await this.dataAdapter.saveAuditoria({
                usuario: user.nombre,
                accion: 'Marcó obligación como atendida',
                contexto: {
                    obligacion_id: id
                },
                ip: Utils.getUserIP()
            });

            return obligacion;
        } catch (error) {
            console.error(`Error al marcar obligación ${id} como atendida:`, error);
            throw error;
        }
    }

    /**
     * Obtener obligaciones por número de alerta según las nuevas reglas
     * @param {number} numeroAlerta - Número de alerta (1, 2, 3, o 4)
     * @returns {Promise<Array>} Array de obligaciones que están en esa alerta
     */
    async getObligacionesPorAlerta(numeroAlerta) {
        try {
            // Obtener solo obligaciones activas
            const obligaciones = await this.getAll({ estado: 'activa' });

            // Filtrar obligaciones que están en la alerta especificada
            const obligacionesEnAlerta = obligaciones.filter(obl => {
                const alertas = Utils.getAlertaSegunReglas(obl);
                if (!alertas) return false;

                switch (numeroAlerta) {
                    case 1:
                        return alertas.alerta1;
                    case 2:
                        return alertas.alerta2;
                    case 3:
                        return alertas.alerta3;
                    case 4:
                        return alertas.alerta4;
                    default:
                        return false;
                }
            });

            return obligacionesEnAlerta;
        } catch (error) {
            console.error(`Error al obtener obligaciones por alerta ${numeroAlerta}:`, error);
            throw error;
        }
    }

    /**
     * Obtener estadísticas
     */
    async getEstadisticas() {
        const obligaciones = await this.getAll();

        return {
            total: obligaciones.length,
            activas: obligaciones.filter(obl => obl.estatus === 'activa').length,
            pausadas: obligaciones.filter(obl => obl.estatus === 'pausada').length,
            atendidas: obligaciones.filter(obl => obl.estatus === 'atendida').length,
            criticas: obligaciones.filter(obl => obl.criticidad.nivel === 'critica').length,
            en_ventana: obligaciones.filter(obl => obl.criticidad.nivel === 'ventana').length
        };
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.ObligacionesService = ObligacionesService;
}
