/**
 * Inicialización de la aplicación
 * Carga todos los scripts necesarios en el orden correcto
 */
(function () {
    'use strict';

    // Versión de la aplicación para verificación
    window.APP_VERSION = '3.0.5';
    console.log(`%c AlertIA v${window.APP_VERSION} Iniciando... `, 'background: #ec0000; color: white; font-weight: bold; padding: 4px; border-radius: 2px;');

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
        'js/services/excel-service.js',
        'js/services/file-storage-service.js',
        'js/services/bitacora-service.js',
        'js/services/archivos-service.js',
        'js/services/notificaciones-service.js',
        'js/services/recordatorios-service.js',
        'js/services/auth-service.js',
        'js/services/calendario-service.js',

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
     * Configurar botón de logout global
     */
    /**
     * Configurar botón de logout global e información de archivo
     */
    async function setupGlobalLogout() {
        // Lógica de logout mejorada
        window.logoutApp = async function () {
            // Usar Utils.confirm si está disponible, sino usar confirm nativo
            let confirmed = false;
            if (window.Utils && window.Utils.confirm) {
                confirmed = await window.Utils.confirm('¿Está seguro de salir? Se limpiarán todos los datos cargados y se cerrará la sesión.');
            } else {
                confirmed = confirm('¿Está seguro de salir? Se limpiarán todos los datos cargados y se cerrará la sesión.');
            }
            
            if (!confirmed) {
                return;
            }
            
            try {
                // Limpiar datos a través del dataAdapter si está disponible
                if (window.dataAdapter && window.dataAdapter.storage) {
                    if (window.dataAdapter.storage.clear) {
                        window.dataAdapter.storage.clear();
                    } else if (window.dataAdapter.storage.remove) {
                        // Si no tiene clear, limpiar manualmente
                        const keys = ['obligaciones', 'configuracion', 'envios', 'auditoria', 'alertas'];
                        keys.forEach(key => {
                            try {
                                window.dataAdapter.storage.remove(key);
                            } catch (e) {
                                console.warn(`No se pudo limpiar ${key}:`, e);
                            }
                        });
                    }
                }
                
                // Borrar LocalStorage y SessionStorage
                localStorage.clear();
                sessionStorage.clear();

                // Borrar cookies (opcional, aunque no estamos usándolas explícitamente)
                document.cookie.split(";").forEach(function (c) {
                    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
                });

                console.log('✅ Datos limpiados. Redirigiendo a página de inicio...');

                // Redirigir a inicio
                window.location.href = 'index.html';
            } catch (e) {
                console.error('Error al salir:', e);
                if (window.Utils && window.Utils.showNotification) {
                    window.Utils.showNotification('Error al limpiar datos', 'error');
                }
                // Intentar redirigir de todas formas
                window.location.href = 'index.html';
            }
        };
        
        // Configurar botones de salir en el sidebar (btn-salir)
        const setupSidebarSalirButtons = () => {
            const btnSalir = document.getElementById('btn-salir');
            if (btnSalir) {
                btnSalir.addEventListener('click', window.logoutApp);
            }
        };
        
        // Ejecutar cuando el DOM esté listo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupSidebarSalirButtons);
        } else {
            setupSidebarSalirButtons();
        }

        // Botón de logout en header deshabilitado - solo se usa el botón del sidebar

        // NUEVO: Mostrar nombre del archivo en el sidebar (debajo de la versión)
        const sidebarFileInfo = document.getElementById('sidebar-file-info');
        if (sidebarFileInfo) {
            try {
                if (window.dataAdapter) {
                    const config = await window.dataAdapter.getConfiguracion();
                    // console.log('[DEBUG] Config for sidebar:', config);

                    if (config && config.nombre_archivo_excel) {
                        sidebarFileInfo.textContent = config.nombre_archivo_excel;
                        sidebarFileInfo.title = config.nombre_archivo_excel; // Tooltip completo
                        sidebarFileInfo.classList.remove('italic', 'opacity-50');
                    } else {
                        sidebarFileInfo.textContent = '(Sin archivo)';
                        sidebarFileInfo.classList.add('italic', 'opacity-50');
                    }
                }
            } catch (err) {
                console.warn('No se pudo cargar info del archivo en sidebar:', err);
            }
        }
    }

    /**
     * Configurar toggle del sidebar
     */
    function setupSidebarToggle() {
        const toggleBtn = document.getElementById('sidebar-toggle');
        const sidebar = document.getElementById('main-sidebar');

        if (!toggleBtn || !sidebar) return;

        const sidebarTexts = document.querySelectorAll('.sidebar-text');
        const iconSpan = toggleBtn.querySelector('span');

        // Estado inicial
        const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';

        // Función para aplicar estado
        const applyState = (collapsed) => {
            if (collapsed) {
                sidebar.classList.remove('w-64');
                sidebar.classList.add('w-20');

                sidebarTexts.forEach(el => {
                    el.classList.add('opacity-0', 'w-0', 'pointer-events-none');
                });

                if (iconSpan) iconSpan.innerText = 'chevron_right';
                toggleBtn.classList.remove('hidden'); // Asegurar visible si colapsado
                // No es necesario manipular la opacidad del botón, siempre debe ser visible
                // toggleBtn.classList.replace('right-[-12px]', 'right-[-12px]'); // Mantener

            } else {
                sidebar.classList.remove('w-20');
                sidebar.classList.add('w-64');

                sidebarTexts.forEach(el => {
                    el.classList.remove('opacity-0', 'w-0', 'pointer-events-none');
                });

                if (iconSpan) iconSpan.innerText = 'chevron_left';
            }
        };

        // Aplicar estado inicial sin animación (opcional)
        applyState(isCollapsed);

        // Click handler
        toggleBtn.addEventListener('click', () => {
            const currentCollapsed = sidebar.classList.contains('w-20');
            const newState = !currentCollapsed;

            applyState(newState);
            localStorage.setItem('sidebar-collapsed', newState);
        });
    }

    /**
     * Cuando todo está listo
     */
    /**
     * Sincronizar bitácoras de todas las obligaciones al iniciar
     */
    async function sincronizarBitacoras() {
        try {
            // Esperar a que los servicios estén disponibles
            if (!window.dataAdapter || !window.BitacoraService || !window.FileStorageService) {
                console.log('[Bitacora] Servicios no disponibles aún, reintentando en 1 segundo...');
                setTimeout(sincronizarBitacoras, 1000);
                return;
            }

            // Inicializar FileStorageService si no está inicializado
            let fileStorageService = null;
            if (window.FileStorageService) {
                fileStorageService = new FileStorageService();
                await fileStorageService.init();
            }

            // Obtener todas las obligaciones
            const obligacionesService = new ObligacionesService(window.dataAdapter);
            const todasObligaciones = await obligacionesService.getAll();

            if (todasObligaciones.length === 0) {
                console.log('[Bitacora] No hay obligaciones para sincronizar');
                return;
            }

            console.log(`[Bitacora] Sincronizando bitácoras de ${todasObligaciones.length} obligaciones...`);

            // Sincronizar bitácora de cada obligación
            const bitacoraService = new BitacoraService(window.dataAdapter, fileStorageService);
            let sincronizadas = 0;

            for (const obligacion of todasObligaciones) {
                try {
                    await bitacoraService.sincronizarBitacora(obligacion.id);
                    sincronizadas++;
                } catch (error) {
                    console.warn(`[Bitacora] Error al sincronizar bitácora de ${obligacion.id}:`, error);
                }
            }

            console.log(`[Bitacora] ✅ Sincronizadas ${sincronizadas} de ${todasObligaciones.length} bitácoras`);
        } catch (error) {
            console.error('[Bitacora] Error al sincronizar bitácoras:', error);
            // No bloquear la inicialización si falla la sincronización
        }
    }

    /**
     * Sincronizar bitácoras de todas las obligaciones al iniciar
     */
    async function sincronizarBitacoras() {
        try {
            // Esperar a que los servicios estén disponibles
            if (!window.dataAdapter || !window.BitacoraService || !window.FileStorageService) {
                console.log('[Bitacora] Servicios no disponibles aún, reintentando en 1 segundo...');
                setTimeout(sincronizarBitacoras, 1000);
                return;
            }

            // Inicializar FileStorageService si no está inicializado
            let fileStorageService = null;
            if (window.FileStorageService) {
                fileStorageService = new FileStorageService();
                await fileStorageService.init();
            }

            // Obtener todas las obligaciones
            const obligacionesService = new ObligacionesService(window.dataAdapter);
            const todasObligaciones = await obligacionesService.getAll();

            if (todasObligaciones.length === 0) {
                console.log('[Bitacora] No hay obligaciones para sincronizar');
                return;
            }

            console.log(`[Bitacora] Sincronizando bitácoras de ${todasObligaciones.length} obligaciones...`);

            // Sincronizar bitácora de cada obligación
            const bitacoraService = new BitacoraService(window.dataAdapter, fileStorageService);
            let sincronizadas = 0;

            for (const obligacion of todasObligaciones) {
                try {
                    await bitacoraService.sincronizarBitacora(obligacion.id);
                    sincronizadas++;
                } catch (error) {
                    console.warn(`[Bitacora] Error al sincronizar bitácora de ${obligacion.id}:`, error);
                }
            }

            console.log(`[Bitacora] ✅ Sincronizadas ${sincronizadas} de ${todasObligaciones.length} bitácoras`);
        } catch (error) {
            console.error('[Bitacora] Error al sincronizar bitácoras:', error);
            // No bloquear la inicialización si falla la sincronización
        }
    }

    function onReady() {
        // Verificar que dataAdapter esté disponible
        if (window.dataAdapter) {
            console.log('✅ AlertIA inicializado correctamente');

            // Notificar a los controladores que la app está lista
            document.dispatchEvent(new CustomEvent('alertia-ready'));

            // Configurar logout global
            setupGlobalLogout();

            // Configurar sidebar toggle
            setupSidebarToggle();

            // Cargar datos iniciales si LocalStorage está vacío
            if (ENV.USE_LOCAL_STORAGE) {
                // ...
            }

            // Sincronizar bitácoras después de que todo esté listo
            // Esperar un poco para asegurar que todos los servicios estén inicializados
            setTimeout(() => {
                sincronizarBitacoras();
            }, 2000);
        } else {
            console.warn('⚠️ dataAdapter no está disponible');
        }
    }

    // Iniciar cuando el script se carga
    initApp();
})();
