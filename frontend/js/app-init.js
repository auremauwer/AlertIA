/**
 * Inicialización de la aplicación
 * Carga todos los scripts necesarios en el orden correcto
 */
(function() {
    'use strict';

    // Orden de carga de scripts
    const scripts = [
        // Configuración
        'js/config/env.js',
        
        // Core (deben cargarse después de ENV)
        'js/core/local-storage.js',
        'js/core/api-client.js',
        'js/core/data-adapter.js',
        
        // Utilidades
        'js/utils.js',
        
        // Servicios
        'js/services/obligaciones-service.js',
        'js/services/alertas-service.js',
        'js/services/envios-service.js',
        'js/services/auditoria-service.js',
        'js/services/config-service.js',
        
        // Plantillas
        'js/email-template.js'
    ];

    /**
     * Cargar script dinámicamente
     */
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = false; // Mantener orden
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Error al cargar ${src}`));
            document.head.appendChild(script);
        });
    }

    /**
     * Inicializar aplicación
     */
    async function initApp() {
        try {
            // Cargar scripts en orden
            for (const src of scripts) {
                await loadScript(src);
            }

            // Esperar a que todo esté listo
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', onReady);
            } else {
                onReady();
            }
        } catch (error) {
            console.error('Error al inicializar aplicación:', error);
        }
    }

    /**
     * Cuando todo está listo
     */
    function onReady() {
        // Verificar que dataAdapter esté disponible
        if (window.dataAdapter) {
            console.log('✅ AlertIA inicializado correctamente');
            
            // Cargar datos iniciales si LocalStorage está vacío
            if (ENV.USE_LOCAL_STORAGE) {
                // Cargar script de seed data
                const seedScript = document.createElement('script');
                seedScript.src = 'js/scripts/seed-data.js';
                seedScript.onload = () => {
                    setTimeout(() => {
                        window.dataAdapter.getObligaciones().then(obls => {
                            if (!obls || obls.length === 0) {
                                console.log('📦 Cargando datos iniciales...');
                                if (window.seedInitialData) {
                                    window.seedInitialData();
                                }
                            }
                        }).catch(() => {
                            if (window.seedInitialData) {
                                window.seedInitialData();
                            }
                        });
                    }, 500);
                };
                document.head.appendChild(seedScript);
            }
        } else {
            console.warn('⚠️ dataAdapter no está disponible');
        }
    }

    // Iniciar cuando el script se carga
    initApp();
})();
