/**
 * Inicialización de la aplicación
 * Carga todos los scripts necesarios en el orden correcto
 */
(function () {
    'use strict';

    // Versión de la aplicación para verificación
    window.APP_VERSION = '3.0.1';
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
        // Lógica de logout
        window.logoutApp = function () {
            if (confirm('¿Está seguro de que desea salir? Esto borrará la caché local y recargará la aplicación.')) {
                try {
                    // Borrar LocalStorage y SessionStorage
                    localStorage.clear();
                    sessionStorage.clear();

                    // Borrar cookies (opcional, aunque no estamos usándolas explícitamente)
                    document.cookie.split(";").forEach(function (c) {
                        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
                    });

                    console.log('🧹 Memorias borradas. Saliendo...');

                    // Redirigir a inicio o recargar
                    window.location.href = 'index.html';
                } catch (e) {
                    console.error('Error al salir:', e);
                    window.location.reload();
                }
            }
        };

        // Inyectar botón en el header si existe
        const headerContainer = document.querySelector('header .flex.items-center.gap-6');
        if (headerContainer) {
            // Limpiar contenido previo si venía del HTML estático
            if (!document.getElementById('logout-container')) {
                headerContainer.innerHTML = '';

                const container = document.createElement('div');
                container.id = 'logout-container';
                container.className = 'flex flex-col items-end gap-1';

                const logoutBtn = document.createElement('button');
                logoutBtn.id = 'btn-global-logout';
                logoutBtn.className = 'flex items-center gap-2 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded text-xs font-bold transition-colors cursor-pointer';
                logoutBtn.innerHTML = `
                    <span class="material-symbols-outlined text-sm">logout</span>
                    SALIR
                `;
                logoutBtn.onclick = window.logoutApp;

                container.appendChild(logoutBtn);
                headerContainer.appendChild(container);
            }
        }

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
        } else {
            console.warn('⚠️ dataAdapter no está disponible');
        }
    }

    // Iniciar cuando el script se carga
    initApp();
})();
