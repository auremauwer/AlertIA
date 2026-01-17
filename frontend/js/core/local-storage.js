/**
 * LocalStorage Manager
 * Gestiona el almacenamiento local de datos (desarrollo)
 */
class LocalStorageManager {
    constructor() {
        this.storagePrefix = 'alertia_';
        this.init();
    }

    /**
     * Inicializar almacenamiento
     */
    init() {
        // Verificar si LocalStorage está disponible
        if (!this.isAvailable()) {
            console.error('LocalStorage no está disponible');
            return;
        }

        // Inicializar estructuras si no existen
        this.ensureDataStructure();
    }

    /**
     * Verificar si LocalStorage está disponible
     */
    isAvailable() {
        try {
            const test = '__localStorage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Asegurar que existan las estructuras de datos básicas
     */
    ensureDataStructure() {
        const keys = [
            'obligaciones',
            'alertas_calculadas',
            'envios',
            'auditoria',
            'configuracion',
            'usuarios'
        ];

        keys.forEach(key => {
            if (!this.get(key)) {
                this.set(key, key === 'configuracion' ? {} : []);
            }
        });
    }

    /**
     * Obtener valor del LocalStorage
     */
    get(key) {
        try {
            const item = localStorage.getItem(this.storagePrefix + key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.error(`Error al leer ${key}:`, e);
            return null;
        }
    }

    /**
     * Guardar valor en LocalStorage
     */
    set(key, value) {
        try {
            localStorage.setItem(this.storagePrefix + key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error(`Error al guardar ${key}:`, e);
            return false;
        }
    }

    /**
     * Eliminar valor del LocalStorage
     */
    remove(key) {
        try {
            localStorage.removeItem(this.storagePrefix + key);
            return true;
        } catch (e) {
            console.error(`Error al eliminar ${key}:`, e);
            return false;
        }
    }

    /**
     * Limpiar todo el almacenamiento de la aplicación
     */
    clear() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.storagePrefix)) {
                    localStorage.removeItem(key);
                }
            });
            return true;
        } catch (e) {
            console.error('Error al limpiar almacenamiento:', e);
            return false;
        }
    }

    // ========== Métodos específicos para Obligaciones ==========

    async getObligaciones(filters = {}) {
        let obligaciones = this.get('obligaciones') || [];

        if (filters.estado) {
            obligaciones = obligaciones.filter(obl => obl.estado === filters.estado);
        }

        return obligaciones;
    }

    async getObligacion(id) {
        const obligaciones = await this.getObligaciones();
        return obligaciones.find(obl => obl.id === id) || null;
    }

    async saveObligacion(obligacion) {
        const obligaciones = await this.getObligaciones();
        const index = obligaciones.findIndex(obl => obl.id === obligacion.id);

        if (index >= 0) {
            obligaciones[index] = { ...obligaciones[index], ...obligacion };
        } else {
            obligaciones.push(obligacion);
        }

        this.set('obligaciones', obligaciones);
        return obligacion;
    }

    async saveAllObligaciones(obligaciones) {
        this.set('obligaciones', obligaciones);
        return obligaciones.length;
    }

    async updateObligacionEstado(id, estado) {
        const obligacion = await this.getObligacion(id);
        if (!obligacion) {
            throw new Error(`Obligación ${id} no encontrada`);
        }

        obligacion.estado = estado;
        obligacion.updated_at = new Date().toISOString();

        return this.saveObligacion(obligacion);
    }

    // ========== Métodos específicos para Alertas ==========

    async getAlertas(filters = {}) {
        let alertas = this.get('alertas_calculadas') || [];

        if (filters.estado) {
            alertas = alertas.filter(a => a.estado === filters.estado);
        }
        if (filters.obligacion_id) {
            alertas = alertas.filter(a => a.obligacion_id === filters.obligacion_id);
        }
        if (filters.tipo) {
            alertas = alertas.filter(a => a.tipo === filters.tipo);
        }

        return alertas;
    }

    async saveAlerta(alerta) {
        const alertas = this.get('alertas_calculadas') || [];

        // Generar ID si no existe
        if (!alerta.id) {
            alerta.id = `ALT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }

        alerta.fecha_calculo = alerta.fecha_calculo || new Date().toISOString();
        alerta.estado = alerta.estado || 'pendiente';

        alertas.push(alerta);
        this.set('alertas_calculadas', alertas);

        return alerta;
    }

    async updateAlertaEstado(id, estado) {
        const alertas = this.get('alertas_calculadas') || [];
        const index = alertas.findIndex(a => a.id === id);

        if (index >= 0) {
            alertas[index].estado = estado;
            alertas[index].fecha_envio = estado === 'enviada' ? new Date().toISOString() : null;
            this.set('alertas_calculadas', alertas);
            return alertas[index];
        }

        throw new Error(`Alerta ${id} no encontrada`);
    }

    // ========== Métodos específicos para Envíos ==========

    async getEnvios(filters = {}) {
        let envios = this.get('envios') || [];

        if (filters.fecha_desde) {
            envios = envios.filter(e => e.fecha >= filters.fecha_desde);
        }
        if (filters.fecha_hasta) {
            envios = envios.filter(e => e.fecha <= filters.fecha_hasta);
        }
        if (filters.usuario) {
            envios = envios.filter(e => e.usuario === filters.usuario);
        }
        if (filters.estado) {
            envios = envios.filter(e => e.estado === filters.estado);
        }

        // Ordenar por fecha descendente
        envios.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        return envios;
    }

    async getEnvio(id) {
        const envios = await this.getEnvios();
        return envios.find(e => e.id === id) || null;
    }

    async saveEnvio(envio) {
        const envios = this.get('envios') || [];

        // Generar ID si no existe
        if (!envio.id) {
            envio.id = `ENV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }

        envio.fecha = envio.fecha || new Date().toISOString();
        envio.estado = envio.estado || 'completado';

        envios.push(envio);
        this.set('envios', envios);

        return envio;
    }

    // ========== Métodos específicos para Auditoría ==========

    async getAuditoria(filters = {}) {
        let eventos = this.get('auditoria') || [];

        if (filters.usuario) {
            eventos = eventos.filter(e => e.usuario === filters.usuario);
        }
        if (filters.accion) {
            eventos = eventos.filter(e => e.accion.includes(filters.accion));
        }
        if (filters.fecha_desde) {
            eventos = eventos.filter(e => e.fecha >= filters.fecha_desde);
        }
        if (filters.fecha_hasta) {
            eventos = eventos.filter(e => e.fecha <= filters.fecha_hasta);
        }
        if (filters.ip) {
            eventos = eventos.filter(e => e.ip === filters.ip);
        }

        // Ordenar por fecha descendente
        eventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        return eventos;
    }

    async saveAuditoria(evento) {
        const eventos = this.get('auditoria') || [];

        // Generar ID si no existe
        if (!evento.id) {
            evento.id = `AUD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }

        evento.fecha = evento.fecha || new Date().toISOString();
        evento.ip = evento.ip || 'localhost';

        eventos.push(evento);
        this.set('auditoria', eventos);

        return evento;
    }

    // ========== Métodos específicos para Configuración ==========

    async getConfiguracion() {
        return this.get('configuracion') || {
            remitente: 'alertia-noreply@alertia.com',
            nombre_remitente: 'AlertIA - Centro de Alertas',
            cc_global: []
        };
    }

    async saveConfiguracion(config) {
        const current = await this.getConfiguracion();
        const updated = { ...current, ...config, updated_at: new Date().toISOString() };
        this.set('configuracion', updated);
        return updated;
    }

    // ========== Métodos específicos para Usuarios ==========

    async getCurrentUser() {
        const users = this.get('usuarios') || {};
        return users.current || {
            nombre: 'Admin Usuario',
            email: 'admin@alertia.com',
            rol: 'Administrador'
        };
    }

    async setCurrentUser(user) {
        const users = this.get('usuarios') || {};
        users.current = user;
        this.set('usuarios', users);
        return user;
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.LocalStorageManager = LocalStorageManager;
}
