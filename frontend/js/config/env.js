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
        // Esta URL se actualizará automáticamente durante el despliegue
        // Si necesitas cambiarla manualmente, reemplaza YOUR_API_ID con el ID real
        return 'https://sdgpz3mrrg.execute-api.us-east-1.amazonaws.com/Prod';
    })(),
    
    // Usar LocalStorage solo en local
    USE_LOCAL_STORAGE: window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' || 
                       window.location.hostname === '',
    
    // Versión de la aplicación
    VERSION: '3.0.7',
    
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
