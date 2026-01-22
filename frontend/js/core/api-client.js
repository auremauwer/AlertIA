/**
 * API Client
 * Cliente para comunicación con API REST (producción AWS)
 */
class APIClient {
    constructor(baseURL) {
        this.baseURL = baseURL;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    /**
     * Realizar petición HTTP
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            ...options,
            headers: {
                ...this.defaultHeaders,
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Error en petición ${endpoint}:`, error);
            throw error;
        }
    }

    /**
     * GET request
     */
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    }

    /**
     * POST request
     */
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT request
     */
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * PATCH request
     */
    async patch(endpoint, data) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE request
     */
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    // ========== Métodos específicos para Obligaciones ==========

    async getObligaciones(filters = {}) {
        return this.get('/obligaciones', filters);
    }

    async getObligacion(id) {
        return this.get(`/obligaciones/${id}`);
    }

    async saveObligacion(obligacion) {
        // Si tiene ID, actualizar (PUT), sino crear (POST)
        if (obligacion.id) {
            return this.put(`/obligaciones/${obligacion.id}`, obligacion);
        } else {
            return this.post('/obligaciones', obligacion);
        }
    }

    async saveAllObligaciones(obligaciones) {
        // Guardar todas las obligaciones una por una
        let saved = 0;
        for (const obligacion of obligaciones) {
            try {
                await this.saveObligacion(obligacion);
                saved++;
            } catch (error) {
                console.error(`Error al guardar obligación ${obligacion.id}:`, error);
            }
        }
        return saved;
    }

    async updateObligacionEstado(id, estado) {
        return this.patch(`/obligaciones/${id}/estado`, { estado });
    }

    // ========== Métodos específicos para Alertas ==========

    async getAlertas(filters = {}) {
        return this.get('/alertas', filters);
    }

    async calcularAlertas() {
        return this.post('/alertas/calcular');
    }

    async updateAlertaEstado(id, estado) {
        return this.patch(`/alertas/${id}/estado`, { estado });
    }

    // ========== Métodos específicos para Envíos ==========

    async getEnvios(filters = {}) {
        return this.get('/envios', filters);
    }

    async getEnvio(id) {
        return this.get(`/envios/${id}`);
    }

    async createEnvio(envio) {
        return this.post('/envios', envio);
    }

    // ========== Métodos específicos para Auditoría ==========

    async getAuditoria(filters = {}) {
        return this.get('/auditoria', filters);
    }

    async saveAuditoria(evento) {
        return this.post('/auditoria', evento);
    }

    // ========== Métodos específicos para Configuración ==========

    async getConfiguracion() {
        return this.get('/configuracion');
    }

    async saveConfiguracion(config) {
        return this.put('/configuracion', config);
    }

    // ========== Métodos específicos para Email ==========

    async sendEmail(emailData) {
        return this.post('/email/send', emailData);
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.APIClient = APIClient;
}
