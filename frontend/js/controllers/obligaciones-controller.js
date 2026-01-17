/**
 * Controlador de Obligaciones
 * Maneja la lógica y renderizado de la pantalla de obligaciones
 */
class ObligacionesController {
    constructor() {
        this.obligacionesService = null;
        this.currentFilters = {
            area: null,
            periodicidad: null,
            estado: null,
            criticidad: null,
            search: ''
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

        this.obligacionesService = new ObligacionesService(window.dataAdapter);

        this.setupEventListeners();
        await this.loadObligaciones();
        await this.loadFilters();
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
                this.loadObligaciones();
            }, 300));
        }

        // Dropdown logic with delegation
        document.addEventListener('click', (e) => {
            // Handle Trigger Click
            const trigger = e.target.closest('.filter-dropdown .trigger');
            if (trigger) {
                e.preventDefault();
                e.stopPropagation();

                const menu = trigger.nextElementSibling;
                const isCurrentlyHidden = menu.classList.contains('hidden');

                // Close all other dropdowns
                this.closeAllDropdowns();

                // Toggle current
                if (isCurrentlyHidden) {
                    menu.classList.remove('hidden');
                    // Force reflow to ensure transition works
                    void menu.offsetWidth;
                    menu.classList.remove('opacity-0', 'translate-y-2');
                }
                return;
            }

            // Handle Item Click
            const item = e.target.closest('.dropdown-item');
            if (item) {
                e.preventDefault();
                e.stopPropagation();

                const filterType = item.dataset.filter;
                const filterValue = item.dataset.value;
                this.handleFilterSelection(filterType, filterValue, item);

                this.closeAllDropdowns();
                return;
            }

            // Handle Outside Click
            if (!e.target.closest('.filter-dropdown')) {
                this.closeAllDropdowns();
            }
        });

        // Botones de acción
        this.attachActionListeners();
    }

    closeAllDropdowns() {
        document.querySelectorAll('.filter-dropdown .menu').forEach(m => {
            // Reset styles for hidden state
            m.classList.add('opacity-0', 'translate-y-2');
            m.classList.add('hidden'); // Hide immediately to prevent ghost clicks
        });
    }

    /**
     * Manejar selección de filtro
     */
    handleFilterSelection(type, value, element) {
        // Toggle logic: if clicking the already active value, clear it
        let isActive = false;

        switch (type) {
            case 'criticidad':
                if (this.currentFilters.criticidad === value) {
                    this.currentFilters.criticidad = null;
                } else {
                    this.currentFilters.criticidad = value;
                    this.currentFilters.estado = null; // Mutually exclusive in UI group
                }
                break;
            case 'estado':
                if (this.currentFilters.estado === value) {
                    this.currentFilters.estado = null;
                } else {
                    this.currentFilters.estado = value;
                    this.currentFilters.criticidad = null;
                }
                break;
            case 'area':
                this.currentFilters.area = (this.currentFilters.area === value) ? null : value;
                break;
            case 'periodicidad':
                this.currentFilters.periodicidad = (this.currentFilters.periodicidad === value) ? null : value;
                break;
        }

        this.updateDropdownStyles();
        this.loadObligaciones();
    }

    updateDropdownStyles() {
        // Reset all items
        document.querySelectorAll('.dropdown-item').forEach(item => {
            item.classList.remove('bg-gray-100', 'text-primary', 'font-bold');
            item.classList.add('text-gray-600');
        });

        // Apply active styles to matching filters
        const filters = this.currentFilters;

        if (filters.criticidad) this.highlightItem('criticidad', filters.criticidad);
        if (filters.estado) this.highlightItem('estado', filters.estado);
        if (filters.area) this.highlightItem('area', filters.area);
        if (filters.periodicidad) this.highlightItem('periodicidad', filters.periodicidad);
    }

    highlightItem(type, value) {
        const item = document.querySelector(`.dropdown-item[data-filter="${type}"][data-value="${value}"]`);
        if (item) {
            item.classList.remove('text-gray-600');
            item.classList.add('bg-gray-100', 'text-primary', 'font-bold');
        }
    }

    /**
     * Cargar obligaciones
     */
    async loadObligaciones() {
        try {
            const obligaciones = await this.obligacionesService.filter(this.currentFilters);
            this.renderObligaciones(obligaciones);
            this.updatePagination(obligaciones.length);
        } catch (error) {
            console.error('Error al cargar obligaciones:', error);
            Utils.showNotification('Error al cargar obligaciones', 'error');
        }
    }

    /**
     * Renderizar obligaciones en tabla
     */
    renderObligaciones(obligaciones) {
        const tbody = document.querySelector('table tbody');
        if (!tbody) return;

        // Paginación
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const paginated = obligaciones.slice(start, end);

        tbody.innerHTML = '';

        paginated.forEach(obl => {
            const row = document.createElement('tr');
            row.className = 'group hover:bg-gray-50 cursor-pointer transition-colors';

            const diasRestantes = obl.dias_restantes;
            const diasClass = diasRestantes < 0 ? 'text-red-600' :
                diasRestantes <= 5 ? 'text-red-600' :
                    diasRestantes <= 10 ? 'text-amber-600' :
                        'text-gray-400';

            const estadoClass = {
                'activa': 'status-pendiente',
                'pausada': 'status-pausada',
                'atendida': 'status-atendida',
                'en_ventana': 'status-ventana'
            }[obl.estado] || 'status-pendiente';

            row.innerHTML = `
                <td class="p-4 text-xs font-bold text-primary group-hover:underline">${obl.id}</td>
                <td class="p-4 text-xs font-semibold">${obl.regulador}</td>
                <td class="p-4 text-xs text-text-muted max-w-xs truncate">${obl.descripcion || obl.nombre}</td>
                <td class="p-4 text-xs font-medium">${obl.area}</td>
                <td class="p-4 text-xs">${obl.periodicidad}</td>
                <td class="p-4 text-xs font-mono">${Utils.formatDate(obl.fecha_limite, 'DD/MM/YYYY')}</td>
                <td class="p-4 text-xs font-bold ${diasClass}">
                    ${diasRestantes !== null ? diasRestantes : 'N/A'}
                    ${diasRestantes === 0 ? '<span class="absolute -top-1 left-3 bg-primary text-white text-[8px] font-bold px-1 py-0.5 rounded leading-none whitespace-nowrap shadow-sm">VENCE HOY</span>' : ''}
                </td>
                <td class="p-4 text-center">
                    <span class="status-pill ${estadoClass}">${this.getEstadoLabel(obl.estado)}</span>
                </td>
                <td class="p-4 text-xs text-text-muted italic">${this.getUltimaAccion(obl)}</td>
                <td class="p-4 text-right">
                    <div class="flex items-center justify-end gap-1">
                        <button class="p-1.5 hover:bg-gray-100 rounded-full text-text-muted hover:text-primary transition-colors" 
                                data-action="ver-detalle" data-id="${obl.id}" title="Ver detalles">
                            <span class="material-symbols-outlined">visibility</span>
                        </button>
                        ${obl.estado === 'pausada' ?
                    `<button class="p-1.5 hover:bg-gray-100 rounded-full text-primary hover:text-red-700 transition-colors" 
                                     data-action="reanudar" data-id="${obl.id}" title="Reanudar">
                                <span class="material-symbols-outlined">play_circle</span>
                            </button>` :
                    `<button class="p-1.5 hover:bg-gray-100 rounded-full text-text-muted hover:text-gray-900 transition-colors" 
                                     data-action="pausar" data-id="${obl.id}" title="Pausar">
                                <span class="material-symbols-outlined">pause_circle</span>
                            </button>`
                }
                        <button class="p-1.5 hover:bg-green-50 rounded-full text-text-muted hover:text-green-600 transition-colors" 
                                data-action="marcar-atendida" data-id="${obl.id}" title="Marcar como atendida">
                            <span class="material-symbols-outlined">check_circle</span>
                        </button>
                        <span class="material-symbols-outlined text-gray-300 group-hover:text-gray-500 transition-colors ml-1 !text-lg">chevron_right</span>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Re-attach event listeners
        this.attachActionListeners();
    }

    /**
     * Adjuntar listeners de acciones
     */
    attachActionListeners() {
        document.querySelectorAll('[data-action="ver-detalle"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.verDetalle(id);
            });
        });

        document.querySelectorAll('[data-action="pausar"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.pausar(id);
            });
        });

        document.querySelectorAll('[data-action="reanudar"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.reanudar(id);
            });
        });

        document.querySelectorAll('[data-action="marcar-atendida"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.marcarAtendida(id);
            });
        });
    }

    /**
     * Obtener label de estado
     */
    getEstadoLabel(estado) {
        const labels = {
            'activa': 'Pendiente',
            'pausada': 'Pausada',
            'atendida': 'Atendida',
            'en_ventana': 'En ventana'
        };
        return labels[estado] || estado;
    }

    /**
     * Obtener última acción
     */
    getUltimaAccion(obligacion) {
        if (obligacion.updated_at) {
            return `Actualizado ${Utils.formatDate(obligacion.updated_at, 'DD/MM/YYYY')}`;
        }
        return 'Sin acciones recientes';
    }

    /**
     * Cargar opciones de filtros
     */
    async loadFilters() {
        try {
            const obligaciones = await this.obligacionesService.getAll();

            // Contar por área
            const areas = {};
            const periodicidades = {};

            obligaciones.forEach(obl => {
                if (obl.area) areas[obl.area] = (areas[obl.area] || 0) + 1;
                if (obl.periodicidad) periodicidades[obl.periodicidad] = (periodicidades[obl.periodicidad] || 0) + 1;
            });

            // Actualizar contadores en filtros de Área
            Object.entries(areas).forEach(([area, count]) => {
                const countEl = document.querySelector(`.dropdown-item[data-value="${area}"] .filter-count`);
                if (countEl) countEl.textContent = count;
            });

            // Actualizar contadores en filtros de Periodicidad
            Object.entries(periodicidades).forEach(([per, count]) => {
                const countEl = document.querySelector(`.dropdown-item[data-value="${per}"] .filter-count`);
                if (countEl) countEl.textContent = count;
            });

        } catch (error) {
            console.error('Error al cargar filtros:', error);
        }
    }

    /**
     * Actualizar paginación
     */
    updatePagination(total) {
        const totalPages = Math.ceil(total / this.itemsPerPage);
        const paginationEl = document.querySelector('.pagination');

        if (paginationEl) {
            // Actualizar texto
            const textEl = paginationEl.querySelector('[data-pagination-text]');
            if (textEl) {
                textEl.textContent = `Mostrando ${Math.min((this.currentPage - 1) * this.itemsPerPage + 1, total)} de ${total} registros`;
            }
        }
    }

    /**
     * Ver detalle de obligación
     */
    verDetalle(id) {
        // Abrir modal o redirigir
        window.location.href = `DetalleObligaciones.html?id=${id}`;
    }

    /**
     * Pausar obligación
     */
    async pausar(id) {
        if (!await Utils.confirm('¿Está seguro de pausar esta obligación?')) {
            return;
        }

        try {
            await this.obligacionesService.pausar(id);
            Utils.showNotification('Obligación pausada correctamente', 'success');
            await this.loadObligaciones();
        } catch (error) {
            Utils.showNotification('Error al pausar obligación', 'error');
        }
    }

    /**
     * Reanudar obligación
     */
    async reanudar(id) {
        try {
            await this.obligacionesService.reanudar(id);
            Utils.showNotification('Obligación reanudada correctamente', 'success');
            await this.loadObligaciones();
        } catch (error) {
            Utils.showNotification('Error al reanudar obligación', 'error');
        }
    }

    /**
     * Marcar como atendida
     */
    async marcarAtendida(id) {
        if (!await Utils.confirm('¿Está seguro de marcar esta obligación como atendida?')) {
            return;
        }

        try {
            await this.obligacionesService.marcarAtendida(id);
            Utils.showNotification('Obligación marcada como atendida', 'success');
            await this.loadObligaciones();
        } catch (error) {
            Utils.showNotification('Error al marcar obligación como atendida', 'error');
        }
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.dataAdapter) {
            const controller = new ObligacionesController();
            controller.init();
            window.obligacionesController = controller;
        }
    });
} else {
    if (window.dataAdapter) {
        const controller = new ObligacionesController();
        controller.init();
        window.obligacionesController = controller;
    }
}

if (typeof window !== 'undefined') {
    window.ObligacionesController = ObligacionesController;
}
