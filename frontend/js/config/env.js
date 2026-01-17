/**
 * Configuración de entorno
 * Detecta automáticamente si está en local o producción
 */
const ENV = {
    // Detectar modo según hostname
    MODE: window.location.hostname === 'localhost' || 
          window.location.hostname === '127.0.0.1' || 
          window.location.hostname === '' 
        ? 'local' 
        : 'production',
    
    // URL base de la API
    API_BASE_URL: (() => {
        if (window.location.hostname === 'localhost' || 
            window.location.hostname === '127.0.0.1' || 
            window.location.hostname === '') {
            return 'http://localhost:3000/api';
        }
        // En producción, usar el dominio de la API
        return 'https://api.alertia.example.com';
    })(),
    
    // Usar LocalStorage solo en local
    USE_LOCAL_STORAGE: window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' || 
                       window.location.hostname === '',
    
    // Versión de la aplicación
    VERSION: '1.0.0',
    
    // Debug mode
    DEBUG: window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1'
};

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.ENV = ENV;
}

// Log de configuración en modo debug
if (ENV.DEBUG) {
    console.log('🔧 Configuración de entorno:', ENV);
}
