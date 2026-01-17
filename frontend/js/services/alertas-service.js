/**
 * Servicio de Alertas
 * Maneja el cálculo y gestión de alertas
 */
class AlertasService {
    constructor(dataAdapter) {
        this.dataAdapter = dataAdapter;
    }

    /**
     * Calcular alertas del día
     */
    async calcularAlertasDelDia() {
        try {
            const alertas = await this.dataAdapter.calcularAlertas();
            
            // Registrar en auditoría
            const user = await this.dataAdapter.getCurrentUser();
            await this.dataAdapter.saveAuditoria({
                usuario: user.nombre,
                accion: 'Calculó alertas del día',
                contexto: {
                    cantidad: alertas.length
                },
                ip: Utils.getUserIP()
            });
            
            return alertas;
        } catch (error) {
            console.error('Error al calcular alertas:', error);
            throw error;
        }
    }

    /**
     * Obtener alertas pendientes
     */
    async getPendientes() {
        try {
            return await this.dataAdapter.getAlertas({ estado: 'pendiente' });
        } catch (error) {
            console.error('Error al obtener alertas pendientes:', error);
            throw error;
        }
    }

    /**
     * Obtener alertas por obligación
     */
    async getByObligacion(obligacionId) {
        try {
            return await this.dataAdapter.getAlertas({ obligacion_id: obligacionId });
        } catch (error) {
            console.error(`Error al obtener alertas de obligación ${obligacionId}:`, error);
            throw error;
        }
    }

    /**
     * Marcar alerta como enviada
     */
    async marcarEnviada(id) {
        try {
            return await this.dataAdapter.updateAlertaEstado(id, 'enviada');
        } catch (error) {
            console.error(`Error al marcar alerta ${id} como enviada:`, error);
            throw error;
        }
    }

    /**
     * Obtener estadísticas de alertas
     */
    async getEstadisticas() {
        try {
            const alertas = await this.dataAdapter.getAlertas();
            
            return {
                total: alertas.length,
                pendientes: alertas.filter(a => a.estado === 'pendiente').length,
                enviadas: alertas.filter(a => a.estado === 'enviada').length,
                por_tipo: {
                    '1ra Alerta': alertas.filter(a => a.tipo === '1ra Alerta').length,
                    '2da Alerta': alertas.filter(a => a.tipo === '2da Alerta').length,
                    'Crítica': alertas.filter(a => a.tipo === 'Crítica').length
                }
            };
        } catch (error) {
            console.error('Error al obtener estadísticas de alertas:', error);
            throw error;
        }
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.AlertasService = AlertasService;
}
