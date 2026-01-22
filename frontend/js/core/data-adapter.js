/**
 * Data Adapter
 * Capa de abstracción que permite cambiar entre LocalStorage y API REST
 * El mismo código frontend funciona con ambos backends
 */
class DataAdapter {
    constructor() {
        // Detectar entorno y crear instancia apropiada
        if (ENV.USE_LOCAL_STORAGE) {
            this.storage = new LocalStorageManager();
            if (ENV.DEBUG) {
                console.log('📦 Usando LocalStorage (modo local)');
            }
        } else {
            this.storage = new APIClient(ENV.API_BASE_URL);
            if (ENV.DEBUG) {
                console.log('🌐 Usando API REST (modo producción)');
            }
        }
    }

    // ========== Métodos para Obligaciones ==========

    async getObligaciones(filters = {}) {
        // En producción, usar localStorage como fallback si la API falla
        if (!ENV.USE_LOCAL_STORAGE) {
            try {
                return await this.storage.getObligaciones(filters);
            } catch (error) {
                console.warn('API de obligaciones no disponible, usando localStorage:', error);
                const localStorageManager = new LocalStorageManager();
                return localStorageManager.getObligaciones(filters);
            }
        }
        return this.storage.getObligaciones(filters);
    }

    async getObligacion(id) {
        return this.storage.getObligacion(id);
    }

    async saveObligacion(obligacion) {
        // En producción, usar localStorage como fallback si la API falla
        if (!ENV.USE_LOCAL_STORAGE) {
            try {
                return await this.storage.saveObligacion(obligacion);
            } catch (error) {
                console.warn('API de obligaciones no disponible, usando localStorage:', error);
                const localStorageManager = new LocalStorageManager();
                return localStorageManager.saveObligacion(obligacion);
            }
        }
        return this.storage.saveObligacion(obligacion);
    }

    async saveAllObligaciones(obligaciones) {
        // En producción, usar localStorage como fallback si la API falla
        if (!ENV.USE_LOCAL_STORAGE) {
            try {
                if (this.storage.saveAllObligaciones) {
                    return await this.storage.saveAllObligaciones(obligaciones);
                } else {
                    // Si no tiene saveAllObligaciones, guardar una por una
                    let saved = 0;
                    for (const obligacion of obligaciones) {
                        try {
                            await this.storage.saveObligacion(obligacion);
                            saved++;
                        } catch (error) {
                            console.error(`Error al guardar obligación ${obligacion.id}:`, error);
                        }
                    }
                    return saved;
                }
            } catch (error) {
                console.warn('API de obligaciones no disponible, usando localStorage:', error);
                const localStorageManager = new LocalStorageManager();
                return localStorageManager.saveAllObligaciones(obligaciones);
            }
        }
        if (this.storage.saveAllObligaciones) {
            return this.storage.saveAllObligaciones(obligaciones);
        }
        // Fallback for API client if implemented differently
        console.warn('saveAllObligaciones no soportado en este storage backend');
        return 0;
    }

    async updateObligacionEstado(id, estado) {
        return this.storage.updateObligacionEstado(id, estado);
    }

    async deleteObligacion(id) {
        if (this.storage.deleteObligacion) {
            return this.storage.deleteObligacion(id);
        }
        throw new Error('deleteObligacion no está implementado en este storage backend');
    }

    // ========== Métodos para Alertas ==========

    async getAlertas(filters = {}) {
        return this.storage.getAlertas(filters);
    }

    async calcularAlertas() {
        if (this.storage.calcularAlertas) {
            return this.storage.calcularAlertas();
        }
        // Si es LocalStorage, calcular localmente
        return this._calcularAlertasLocal();
    }

    async saveAlerta(alerta) {
        return this.storage.saveAlerta(alerta);
    }

    async updateAlertaEstado(id, estado) {
        return this.storage.updateAlertaEstado(id, estado);
    }

    /**
     * Calcular alertas localmente (para LocalStorage)
     */
    async _calcularAlertasLocal() {
        const obligaciones = await this.getObligaciones();
        const activas = obligaciones.filter(obl => obl.estado === 'activa');
        const alertas = [];
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        for (const obligacion of activas) {
            const fechaLimite = new Date(obligacion.fecha_limite);
            fechaLimite.setHours(0, 0, 0, 0);
            const diasRestantes = Math.ceil((fechaLimite - hoy) / (1000 * 60 * 60 * 24));

            const reglas = obligacion.reglas_alertamiento || {
                alerta1: 30,
                alerta2: 10,
                critica: 5
            };

            let tipoAlerta = null;
            if (diasRestantes <= reglas.critica && diasRestantes > 0) {
                tipoAlerta = 'Crítica';
            } else if (diasRestantes <= reglas.alerta2 && diasRestantes > 0) {
                tipoAlerta = '2da Alerta';
            } else if (diasRestantes <= reglas.alerta1 && diasRestantes > 0) {
                tipoAlerta = '1ra Alerta';
            }

            if (tipoAlerta) {
                // Verificar si ya se envió hoy
                const alertasExistentes = await this.getAlertas({
                    obligacion_id: obligacion.id
                });

                const hoyStr = hoy.toISOString().split('T')[0];
                const yaEnviadaHoy = alertasExistentes.some(a => {
                    if (a.fecha_envio) {
                        return a.fecha_envio.split('T')[0] === hoyStr && a.tipo === tipoAlerta;
                    }
                    return false;
                });

                if (!yaEnviadaHoy) {
                    alertas.push({
                        obligacion_id: obligacion.id,
                        tipo: tipoAlerta,
                        fecha_calculo: new Date().toISOString(),
                        estado: 'pendiente',
                        obligacion: obligacion
                    });
                }
            }
        }

        // Guardar alertas calculadas
        for (const alerta of alertas) {
            await this.saveAlerta(alerta);
        }

        return alertas;
    }

    // ========== Métodos para Envíos ==========

    async getEnvios(filters = {}) {
        return this.storage.getEnvios(filters);
    }

    async getEnvio(id) {
        return this.storage.getEnvio(id);
    }

    async createEnvio(envio) {
        if (this.storage.createEnvio) {
            return this.storage.createEnvio(envio);
        }
        // Si es LocalStorage, guardar localmente
        return this.storage.saveEnvio(envio);
    }

    // ========== Métodos para Auditoría ==========

    async getAuditoria(filters = {}) {
        // En producción, usar localStorage como fallback si la API falla
        if (!ENV.USE_LOCAL_STORAGE) {
            try {
                return await this.storage.getAuditoria(filters);
            } catch (error) {
                console.warn('API de auditoría no disponible, usando localStorage:', error);
                const localStorageManager = new LocalStorageManager();
                return localStorageManager.getAuditoria(filters);
            }
        }
        return this.storage.getAuditoria(filters);
    }

    async saveAuditoria(evento) {
        // En producción, usar localStorage como fallback si la API falla
        if (!ENV.USE_LOCAL_STORAGE) {
            try {
                return await this.storage.saveAuditoria(evento);
            } catch (error) {
                console.warn('API de auditoría no disponible, usando localStorage:', error);
                const localStorageManager = new LocalStorageManager();
                return localStorageManager.saveAuditoria(evento);
            }
        }
        return this.storage.saveAuditoria(evento);
    }

    // ========== Métodos para Configuración ==========

    async getConfiguracion() {
        // En producción, usar localStorage como fallback si la API falla
        if (!ENV.USE_LOCAL_STORAGE) {
            try {
                return await this.storage.getConfiguracion();
            } catch (error) {
                console.warn('API de configuración no disponible, usando localStorage:', error);
                const localStorageManager = new LocalStorageManager();
                return localStorageManager.getConfiguracion();
            }
        }
        return this.storage.getConfiguracion();
    }

    async saveConfiguracion(config) {
        // En producción, usar localStorage como fallback si la API falla
        if (!ENV.USE_LOCAL_STORAGE) {
            try {
                return await this.storage.saveConfiguracion(config);
            } catch (error) {
                console.warn('API de configuración no disponible, usando localStorage:', error);
                const localStorageManager = new LocalStorageManager();
                return localStorageManager.saveConfiguracion(config);
            }
        }
        return this.storage.saveConfiguracion(config);
    }

    // ========== Métodos para Usuarios ==========

    async getCurrentUser() {
        if (this.storage.getCurrentUser) {
            return this.storage.getCurrentUser();
        }
        // Para API, podría venir del token JWT
        return {
            nombre: 'Admin Usuario',
            email: 'admin@alertia.com',
            rol: 'Administrador',
            area: 'Administración'
        };
    }

    async setCurrentUser(user) {
        if (this.storage.setCurrentUser) {
            return this.storage.setCurrentUser(user);
        }
        // Para API, guardar en sessionStorage como fallback
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('currentUser', JSON.stringify(user));
        }
        return user;
    }
}

// Crear instancia global
let dataAdapter = null;

// Inicializar cuando se cargue el script
if (typeof window !== 'undefined') {
    // Esperar a que ENV esté disponible
    if (window.ENV) {
        dataAdapter = new DataAdapter();
        window.dataAdapter = dataAdapter;
    } else {
        // Si ENV no está cargado, esperar a DOMContentLoaded
        document.addEventListener('DOMContentLoaded', () => {
            if (window.ENV) {
                dataAdapter = new DataAdapter();
                window.dataAdapter = dataAdapter;
            }
        });
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.DataAdapter = DataAdapter;
}
