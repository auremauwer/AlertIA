/**
 * Servicio de Envíos
 * Maneja la creación y gestión de envíos de correos
 */
class EnviosService {
    constructor(dataAdapter) {
        this.dataAdapter = dataAdapter;
    }

    /**
     * Crear envío de correos
     */
    async createEnvio(alertasSeleccionadas) {
        try {
            const user = await this.dataAdapter.getCurrentUser();
            const config = await this.dataAdapter.getConfiguracion();
            
            // Preparar datos del envío
            const envio = {
                fecha: new Date().toISOString(),
                usuario: user.nombre,
                usuario_email: user.email,
                correos_enviados: alertasSeleccionadas.length,
                alertas: alertasSeleccionadas.map(a => a.id),
                estado: 'completado',
                remitente: config.remitente,
                nombre_remitente: config.nombre_remitente,
                cc_global: config.cc_global || []
            };
            
            // Guardar envío
            const envioGuardado = await this.dataAdapter.createEnvio(envio);
            
            // Marcar alertas como enviadas
            for (const alerta of alertasSeleccionadas) {
                await this.dataAdapter.updateAlertaEstado(alerta.id, 'enviada');
            }
            
            // Registrar en auditoría
            await this.dataAdapter.saveAuditoria({
                usuario: user.nombre,
                accion: 'Ejecutó envío manual',
                contexto: {
                    envio_id: envioGuardado.id,
                    correos_enviados: envio.correos_enviados,
                    alertas: alertasSeleccionadas.map(a => a.id)
                },
                ip: Utils.getUserIP()
            });
            
            return envioGuardado;
        } catch (error) {
            console.error('Error al crear envío:', error);
            throw error;
        }
    }

    /**
     * Obtener todos los envíos
     */
    async getAll(filters = {}) {
        try {
            return await this.dataAdapter.getEnvios(filters);
        } catch (error) {
            console.error('Error al obtener envíos:', error);
            throw error;
        }
    }

    /**
     * Obtener envío por ID
     */
    async getById(id) {
        try {
            return await this.dataAdapter.getEnvio(id);
        } catch (error) {
            console.error(`Error al obtener envío ${id}:`, error);
            throw error;
        }
    }

    /**
     * Obtener envíos del día
     */
    async getDelDia() {
        try {
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const hoyStr = hoy.toISOString();
            
            const envios = await this.dataAdapter.getEnvios();
            return envios.filter(e => {
                const fechaEnvio = new Date(e.fecha);
                fechaEnvio.setHours(0, 0, 0, 0);
                return fechaEnvio.toISOString() === hoyStr;
            });
        } catch (error) {
            console.error('Error al obtener envíos del día:', error);
            throw error;
        }
    }

    /**
     * Obtener estadísticas de envíos
     */
    async getEstadisticas() {
        try {
            const envios = await this.dataAdapter.getEnvios();
            const enviosHoy = await this.getDelDia();
            
            const totalCorreos = envios.reduce((sum, e) => sum + (e.correos_enviados || 0), 0);
            const correosHoy = enviosHoy.reduce((sum, e) => sum + (e.correos_enviados || 0), 0);
            
            return {
                total_envios: envios.length,
                envios_hoy: enviosHoy.length,
                total_correos: totalCorreos,
                correos_hoy: correosHoy,
                exitosos: envios.filter(e => e.estado === 'completado').length,
                fallidos: envios.filter(e => e.estado === 'fallido').length
            };
        } catch (error) {
            console.error('Error al obtener estadísticas de envíos:', error);
            throw error;
        }
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.EnviosService = EnviosService;
}
