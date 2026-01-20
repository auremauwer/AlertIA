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
                // #region agent log
                console.log('[DEBUG] config-service saveConfiguracion: cc_global type =', typeof config.cc_global, 'isArray =', Array.isArray(config.cc_global));
                // #endregion
                // Si cc_global ya es un array, validar directamente
                // Si es un string, usar validateEmails para convertirlo a array
                if (Array.isArray(config.cc_global)) {
                    // Validar cada email del array
                    const invalid = config.cc_global.filter(e => !Utils.isValidEmail(e));
                    if (invalid.length > 0) {
                        throw new Error(`Emails inválidos en CC: ${invalid.join(', ')}`);
                    }
                    // cc_global ya es un array válido, mantenerlo
                    // #region agent log
                    console.log('[DEBUG] config-service: cc_global is array, validated successfully');
                    // #endregion
                } else {
                    // Es un string, convertir a array
                    const validation = Utils.validateEmails(config.cc_global);
                    if (!validation.valid) {
                        throw new Error(`Emails inválidos en CC: ${validation.invalid.join(', ')}`);
                    }
                    config.cc_global = validation.emails;
                    // #region agent log
                    console.log('[DEBUG] config-service: cc_global was string, converted to array');
                    // #endregion
                }
            }
            
            // Guardar configuración
            // #region agent log
            console.log('[DEBUG] config-service: About to call dataAdapter.saveConfiguracion, config.total_filas_excel =', config.total_filas_excel);
            // #endregion
            const configGuardada = await this.dataAdapter.saveConfiguracion(config);
            // #region agent log
            console.log('[DEBUG] config-service: After saveConfiguracion, configGuardada.total_filas_excel =', configGuardada?.total_filas_excel);
            // #endregion
            
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
