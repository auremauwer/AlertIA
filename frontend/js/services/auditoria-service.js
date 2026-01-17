/**
 * Servicio de Auditoría
 * Maneja el registro y consulta de eventos de auditoría
 */
class AuditoriaService {
    constructor(dataAdapter) {
        this.dataAdapter = dataAdapter;
    }

    /**
     * Registrar evento de auditoría
     */
    async registrarEvento(accion, contexto = {}) {
        try {
            const user = await this.dataAdapter.getCurrentUser();
            
            const evento = {
                usuario: user.nombre,
                usuario_email: user.email,
                accion: accion,
                contexto: contexto,
                ip: Utils.getUserIP(),
                fecha: new Date().toISOString()
            };
            
            return await this.dataAdapter.saveAuditoria(evento);
        } catch (error) {
            console.error('Error al registrar evento de auditoría:', error);
            throw error;
        }
    }

    /**
     * Obtener eventos de auditoría
     */
    async getEventos(filters = {}) {
        try {
            // Filtrar solo eventos de Fase 1
            const eventosPermitidos = [
                'Ejecutó envío manual',
                'Pausó obligación',
                'Reanudó obligación',
                'Marcó obligación como atendida',
                'Calculó alertas del día',
                'Agregó comentario',
                'Modificó configuración'
            ];
            
            let eventos = await this.dataAdapter.getAuditoria(filters);
            
            // Filtrar solo eventos permitidos en Fase 1
            eventos = eventos.filter(e => 
                eventosPermitidos.some(perm => e.accion.includes(perm))
            );
            
            return eventos;
        } catch (error) {
            console.error('Error al obtener eventos de auditoría:', error);
            throw error;
        }
    }

    /**
     * Buscar eventos
     */
    async buscar(query) {
        try {
            const eventos = await this.getEventos();
            const queryLower = query.toLowerCase();
            
            return eventos.filter(e => 
                e.usuario.toLowerCase().includes(queryLower) ||
                e.accion.toLowerCase().includes(queryLower) ||
                (e.ip && e.ip.includes(queryLower))
            );
        } catch (error) {
            console.error('Error al buscar eventos:', error);
            throw error;
        }
    }

    /**
     * Obtener eventos por usuario
     */
    async getByUsuario(usuario) {
        try {
            return await this.getEventos({ usuario });
        } catch (error) {
            console.error(`Error al obtener eventos de usuario ${usuario}:`, error);
            throw error;
        }
    }

    /**
     * Obtener eventos recientes
     */
    async getRecientes(limit = 10) {
        try {
            const eventos = await this.getEventos();
            return eventos.slice(0, limit);
        } catch (error) {
            console.error('Error al obtener eventos recientes:', error);
            throw error;
        }
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.AuditoriaService = AuditoriaService;
}
