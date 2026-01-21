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
     * Obtener fecha del consejo (15-septiembre del año actual)
     */
    getFechaConsejo() {
        const hoy = new Date();
        const año = hoy.getFullYear();
        // 15 de septiembre (mes 8 porque enero es 0)
        return new Date(año, 8, 15);
    },

    /**
     * Determinar qué alerta corresponde según las nuevas reglas
     * Retorna: { alerta1: boolean, alerta2: boolean, alerta3: boolean, alerta4: boolean }
     * o null si no aplica ninguna alerta
     */
    getAlertaSegunReglas(obligacion) {
        if (!obligacion || !obligacion.fecha_limite || !obligacion.periodicidad) {
            return null;
        }

        // Determinar fecha límite a usar
        let fechaLimite;
        const periodicidad = String(obligacion.periodicidad).trim();

        // Caso especial: "Anual, una vez al año" usa fecha del consejo (15-septiembre)
        if (periodicidad.toLowerCase() === 'anual, una vez al año' ||
            periodicidad.toLowerCase().includes('anual, una vez')) {
            fechaLimite = this.getFechaConsejo();
        } else {
            fechaLimite = new Date(obligacion.fecha_limite);
        }

        // Calcular días restantes
        const diasRestantes = this.getDaysUntil(fechaLimite.toISOString().split('T')[0]);

        if (diasRestantes === null || diasRestantes < 0) {
            return null; // Fecha vencida o inválida
        }

        const periodicidadLower = periodicidad.toLowerCase();
        const resultado = {
            alerta1: false,
            alerta2: false,
            alerta3: false,
            alerta4: false
        };

        // Normalizar periodicidad para comparaciones
        const esAnual = periodicidadLower.includes('anual') && !periodicidadLower.includes('semestral') && !periodicidadLower.includes('trimestral');
        const esAnioYMedio = periodicidadLower.includes('año y medio') || periodicidadLower.includes('año y medio');
        const esBianual = periodicidadLower.includes('bianual') || periodicidadLower.includes('bi-anual');
        const esSemestral = periodicidadLower.includes('semestral');
        const esTrimestral = periodicidadLower.includes('trimestral');
        const esBimestral = periodicidadLower.includes('bimestral') || periodicidadLower.includes('bi-mestral');
        const esMensual = periodicidadLower.includes('mensual');
        const esEventual = periodicidadLower.includes('eventual');
        const esAnualUnaVez = periodicidadLower === 'anual, una vez al año' || periodicidadLower.includes('anual, una vez');

        // 1ª Alerta (Áreas)
        if (esAnual || esAnioYMedio || esBianual) {
            if (diasRestantes <= 90) {
                resultado.alerta1 = true;
            }
        } else if (esSemestral || esTrimestral || esBimestral || esEventual) {
            if (diasRestantes <= 30) {
                resultado.alerta1 = true;
            }
        } else if (esMensual) {
            if (diasRestantes <= 20) {
                resultado.alerta1 = true;
            }
        } else if (esAnualUnaVez) {
            if (diasRestantes <= 90) {
                resultado.alerta1 = true;
            }
        }

        // 2ª Alerta (Áreas) - Eventual no tiene 2ª alerta
        if (!esEventual) {
            if (esAnual || esAnioYMedio || esBianual || esAnualUnaVez) {
                if (diasRestantes <= 30) {
                    resultado.alerta2 = true;
                }
            } else if (esSemestral || esTrimestral || esBimestral) {
                if (diasRestantes <= 10) {
                    resultado.alerta2 = true;
                }
            } else if (esMensual) {
                if (diasRestantes <= 7) {
                    resultado.alerta2 = true;
                }
            }
        }

        // 3ª Alerta (CN) - Eventual no tiene 3ª alerta
        if (!esEventual) {
            if (esAnual || esAnioYMedio || esBianual || esAnualUnaVez) {
                if (diasRestantes <= 20) {
                    resultado.alerta3 = true;
                }
            } else if (esSemestral || esTrimestral || esBimestral) {
                if (diasRestantes <= 7) {
                    resultado.alerta3 = true;
                }
            } else if (esMensual) {
                if (diasRestantes <= 5) {
                    resultado.alerta3 = true;
                }
            }
        }

        // 4ª Alerta (CN) - Solo para Semestral, Trimestral, Bimestral y "Anual, una vez al año"
        if (esSemestral || esTrimestral || esBimestral || esAnualUnaVez) {
            if (diasRestantes <= 3) {
                resultado.alerta4 = true;
            }
        }

        // Retornar null si ninguna alerta aplica
        if (!resultado.alerta1 && !resultado.alerta2 && !resultado.alerta3 && !resultado.alerta4) {
            return null;
        }

        return resultado;
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


                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
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
    },

    /**
     * Cerrar sesión y limpiar datos
     */
    logoutApp() {
        if (confirm('¿Está seguro de que desea salir? Esto borrará la caché local y recargará la aplicación.')) {
            try {
                // Borrar LocalStorage y SessionStorage
                localStorage.clear();
                sessionStorage.clear();

                // Borrar cookies
                document.cookie.split(";").forEach(function (c) {
                    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
                });

                console.log('🧹 Memorias borradas. Saliendo...');

                // Redirigir a inicio
                window.location.href = 'index.html';
            } catch (e) {
                console.error('Error al salir:', e);
                window.location.reload();
            }
        }
    }
};

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.Utils = Utils;
}
