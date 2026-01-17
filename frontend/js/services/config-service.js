/**
 * Servicio de Configuración
 * Maneja la configuración del sistema
 */
class ConfigService {
    constructor(dataAdapter) {
        this.dataAdapter = dataAdapter;
        this.remitentesAutorizados = [
            'alertia-noreply@alertia.com',
            'alertas@empresa.com',
            'notificaciones@empresa.com',
            'noreply@empresa.com'
        ];
    }

    /**
     * Obtener configuración actual
     */
    async getConfiguracion() {
        try {
            return await this.dataAdapter.getConfiguracion();
        } catch (error) {
            console.error('Error al obtener configuración:', error);
            throw error;
        }
    }

    /**
     * Guardar configuración
     */
    async saveConfiguracion(config) {
        try {
            // Validar remitente
            if (config.remitente && !this.remitentesAutorizados.includes(config.remitente)) {
                throw new Error('El remitente no está en la lista autorizada');
            }
            
            // Validar emails CC
            if (config.cc_global) {
                const validation = Utils.validateEmails(config.cc_global);
                if (!validation.valid) {
                    throw new Error(`Emails inválidos en CC: ${validation.invalid.join(', ')}`);
                }
                config.cc_global = validation.emails;
            }
            
            // Guardar configuración
            const configGuardada = await this.dataAdapter.saveConfiguracion(config);
            
            // Registrar en auditoría
            const user = await this.dataAdapter.getCurrentUser();
            await this.dataAdapter.saveAuditoria({
                usuario: user.nombre,
                accion: 'Modificó configuración',
                contexto: {
                    cambios: Object.keys(config)
                },
                ip: Utils.getUserIP()
            });
            
            return configGuardada;
        } catch (error) {
            console.error('Error al guardar configuración:', error);
            throw error;
        }
    }

    /**
     * Obtener lista de remitentes autorizados
     */
    getRemitentesAutorizados() {
        return [...this.remitentesAutorizados];
    }

    /**
     * Validar remitente
     */
    isRemitenteAutorizado(remitente) {
        return this.remitentesAutorizados.includes(remitente);
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.ConfigService = ConfigService;
}
