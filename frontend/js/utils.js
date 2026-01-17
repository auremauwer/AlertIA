/**
 * Utilidades generales
 */
const Utils = {
    /**
     * Formatear fecha a formato legible
     */
    formatDate(date, format = 'DD/MM/YYYY') {
        if (!date) return '';
        
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        
        switch (format) {
            case 'DD/MM/YYYY':
                return `${day}/${month}/${year}`;
            case 'DD/MM/YYYY HH:mm':
                return `${day}/${month}/${year} ${hours}:${minutes}`;
            case 'YYYY-MM-DD':
                return `${year}-${month}-${day}`;
            case 'relative':
                return this.getRelativeTime(d);
            default:
                return `${day}/${month}/${year}`;
        }
    },

    /**
     * Obtener tiempo relativo (hace X días, etc.)
     */
    getRelativeTime(date) {
        const now = new Date();
        const diff = now - new Date(date);
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor(diff / (1000 * 60));
        
        if (days > 0) {
            return `Hace ${days} día${days > 1 ? 's' : ''}`;
        } else if (hours > 0) {
            return `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
        } else if (minutes > 0) {
            return `Hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
        } else {
            return 'Hace unos momentos';
        }
    },

    /**
     * Calcular días restantes hasta una fecha
     */
    getDaysUntil(date) {
        if (!date) return null;
        
        const fechaLimite = new Date(date);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        fechaLimite.setHours(0, 0, 0, 0);
        
        const diff = fechaLimite - hoy;
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        
        return days;
    },

    /**
     * Determinar criticidad según días restantes
     */
    getCriticidad(diasRestantes, reglas = { critica: 5, alerta2: 10, alerta1: 30 }) {
        if (diasRestantes < 0) {
            return { nivel: 'vencida', label: 'Vencida', color: 'red' };
        } else if (diasRestantes <= reglas.critica) {
            return { nivel: 'critica', label: 'Crítica', color: 'red' };
        } else if (diasRestantes <= reglas.alerta2) {
            return { nivel: 'ventana', label: 'En ventana', color: 'orange' };
        } else if (diasRestantes <= reglas.alerta1) {
            return { nivel: 'advertencia', label: 'Advertencia', color: 'yellow' };
        } else {
            return { nivel: 'normal', label: 'Normal', color: 'green' };
        }
    },

    /**
     * Validar email
     */
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    /**
     * Validar múltiples emails separados por comas
     */
    validateEmails(emailsString) {
        if (!emailsString) return { valid: true, emails: [] };
        
        const emails = emailsString.split(',').map(e => e.trim()).filter(e => e);
        const invalid = emails.filter(e => !this.isValidEmail(e));
        
        return {
            valid: invalid.length === 0,
            emails: emails,
            invalid: invalid
        };
    },

    /**
     * Generar ID único
     */
    generateId(prefix = '') {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
    },

    /**
     * Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Obtener IP del usuario (simulado para local)
     */
    getUserIP() {
        // En producción, esto vendría del backend
        return 'localhost';
    },

    /**
     * Mostrar notificación
     */
    showNotification(message, type = 'info') {
        // Crear elemento de notificación
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        // Remover después de 3 segundos
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    },

    /**
     * Confirmar acción
     */
    async confirm(message) {
        return new Promise((resolve) => {
            const confirmed = window.confirm(message);
            resolve(confirmed);
        });
    },

    /**
     * Formatear número con separadores
     */
    formatNumber(num) {
        return new Intl.NumberFormat('es-ES').format(num);
    },

    /**
     * Truncar texto
     */
    truncate(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substr(0, maxLength) + '...';
    },

    /**
     * Copiar al portapapeles
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showNotification('Copiado al portapapeles', 'success');
            return true;
        } catch (err) {
            console.error('Error al copiar:', err);
            return false;
        }
    }
};

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.Utils = Utils;
}
