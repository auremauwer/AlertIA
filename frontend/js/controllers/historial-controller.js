/**
 * Controlador de Historial
 * Maneja la visualización del historial de envíos
 */
class HistorialController {
    constructor() {
        this.enviosService = null;
        this.currentFilters = {
            fecha_desde: null,
            fecha_hasta: null,
            estado: null,
            obligacion: null,
            usuario: null
        };
        this.currentPage = 1;
        this.itemsPerPage = 10;
    }

    /**
     * Inicializar controlador
     */
    async init() {
        if (!window.dataAdapter) {
            console.error('dataAdapter no está disponible');
            return;
        }

        this.enviosService = new EnviosService(window.dataAdapter);
        
        this.setupEventListeners();
        await this.loadHistorial();
    }

    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        // Búsqueda
        const searchInput = document.querySelector('input[placeholder*="Buscar"]');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.currentFilters.search = e.target.value;
                this.loadHistorial();
            }, 300));
        }

        // Filtros
        const btnExitosos = Array.from(document.querySelectorAll('button')).find(btn => 
            btn.textContent.includes('Exitosos')
        );
        const btnFallidos = Array.from(document.querySelectorAll('button')).find(btn => 
            btn.textContent.includes('Fallidos')
        );
        
        if (btnExitosos) {
            btnExitosos.addEventListener('click', () => {
                this.currentFilters.estado = 'completado';
                this.loadHistorial();
            });
        }
        
        if (btnFallidos) {
            btnFallidos.addEventListener('click', () => {
                this.currentFilters.estado = 'fallido';
                this.loadHistorial();
            });
        }

        // Botones ver detalle
        document.querySelectorAll('[data-action="ver-detalle"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.verDetalle(id);
            });
        });
    }

    /**
     * Cargar historial
     */
    async loadHistorial() {
        try {
            const envios = await this.enviosService.getAll(this.currentFilters);
            this.renderHistorial(envios);
            this.updatePagination(envios.length);
        } catch (error) {
            console.error('Error al cargar historial:', error);
            Utils.showNotification('Error al cargar historial', 'error');
        }
    }

    /**
     * Renderizar historial en tabla
     */
    renderHistorial(envios) {
        const tbody = document.querySelector('table tbody');
        if (!tbody) return;

        // Paginación
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const paginated = envios.slice(start, end);

        tbody.innerHTML = '';

        paginated.forEach(envio => {
            const row = document.createElement('tr');
            row.className = 'bg-white hover:bg-gray-50/80 transition-colors';
            
            const fecha = Utils.formatDate(envio.fecha, 'DD/MM/YYYY, HH:mm');
            const estadoClass = envio.estado === 'completado' ? 
                'bg-green-50 text-green-700 border border-green-100' : 
                'bg-red-50 text-primary border border-red-100';
            const estadoIcon = envio.estado === 'completado' ? 
                '<span class="w-1.5 h-1.5 rounded-full bg-green-600"></span>' :
                '<span class="material-symbols-outlined text-[12px]">error</span>';
            const estadoText = envio.estado === 'completado' ? 'Enviado' : 'Fallido';

            row.innerHTML = `
                <td class="px-6 py-5 whitespace-nowrap font-bold text-accent-black">${fecha}</td>
                <td class="px-6 py-5 whitespace-nowrap">
                    <span class="px-2.5 py-1 bg-gray-100 text-gray-700 text-[11px] font-bold rounded border border-gray-200">${envio.alertas?.[0] || 'N/A'}</span>
                </td>
                <td class="px-6 py-5">
                    <div class="flex flex-col">
                        <span class="text-accent-black font-bold">${envio.usuario_email || envio.usuario}</span>
                        <span class="text-[10px] text-gray-400 font-bold uppercase">Usuario</span>
                    </div>
                </td>
                <td class="px-6 py-5 font-semibold text-gray-600">Envío Manual</td>
                <td class="px-6 py-5 font-semibold text-gray-600 max-w-xs line-clamp-2 text-ellipsis overflow-hidden">Envío de ${envio.correos_enviados} correos</td>
                <td class="px-6 py-5">
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${estadoClass}">
                        ${estadoIcon}
                        ${estadoText}
                    </span>
                </td>
                <td class="px-6 py-5 whitespace-nowrap">
                    <div class="flex items-center gap-2">
                        <div class="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold">${this.getInitials(envio.usuario)}</div>
                        <span class="text-gray-700 font-medium">${envio.usuario}</span>
                    </div>
                </td>
                <td class="px-6 py-5 text-center">
                    <button class="px-4 py-1.5 rounded-lg border border-border-subtle text-xs font-bold text-accent-black hover:bg-gray-50 transition-colors" 
                            data-action="ver-detalle" data-id="${envio.id}">Ver Detalle</button>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Re-attach listeners
        document.querySelectorAll('[data-action="ver-detalle"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.verDetalle(id);
            });
        });
    }

    /**
     * Obtener iniciales de nombre
     */
    getInitials(nombre) {
        return nombre.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }

    /**
     * Actualizar paginación
     */
    updatePagination(total) {
        const totalPages = Math.ceil(total / this.itemsPerPage);
        // Actualizar UI de paginación si existe
    }

    /**
     * Ver detalle de envío
     */
    async verDetalle(id) {
        try {
            const envio = await this.enviosService.getById(id);
            // Mostrar modal con detalles
            this.showDetalleModal(envio);
        } catch (error) {
            console.error('Error al obtener detalle:', error);
            Utils.showNotification('Error al cargar detalle del envío', 'error');
        }
    }

    /**
     * Mostrar modal de detalle
     */
    showDetalleModal(envio) {
        // Implementar modal de detalle
        alert(`Detalle de envío ${envio.id}\n\nCorreos: ${envio.correos_enviados}\nFecha: ${Utils.formatDate(envio.fecha, 'DD/MM/YYYY HH:mm')}\nUsuario: ${envio.usuario}`);
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.dataAdapter) {
            const controller = new HistorialController();
            controller.init();
            window.historialController = controller;
        }
    });
} else {
    if (window.dataAdapter) {
        const controller = new HistorialController();
        controller.init();
        window.historialController = controller;
    }
}

if (typeof window !== 'undefined') {
    window.HistorialController = HistorialController;
}
