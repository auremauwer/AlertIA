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
        const filters = ['area', 'estatus', 'sub-estatus'];
        filters.forEach(filter => {
            const el = document.getElementById(`filter-${filter}`);
            if (el) {
                el.addEventListener('change', (e) => {
                    const key = filter.replace('-', '_'); // estatus, sub_estatus
                    this.currentFilters[key] = e.target.value || null;
                    this.loadObligaciones();
                });
            }
        });

        const filterId = document.getElementById('filter-id');
        if (filterId) {
            filterId.addEventListener('input', Utils.debounce((e) => {
                this.currentFilters.id = e.target.value || null;
                this.loadObligaciones();
            }, 300));
        }

        // Búsqueda General (si existe input search global)
        const searchInput = document.querySelector('input[placeholder*="Buscar por ID, regulador"]');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.currentFilters.search = e.target.value;
                this.loadObligaciones();
            }, 300));
        }

        // Botones de acción
        this.attachActionListeners();
    }

    /**
     * Manejar selección de filtro (Legacy support or removed if not used)
     */
    // handleFilterSelection eliminado ya que se usan selects nativos

    // updateDropdownStyles eliminado

    // highlightItem eliminado

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
                'en_ventana': 'status-ventana',
                'recordatorio': 'status-recordatorio',
                'solicitud': 'status-solicitud',
                'cerrado': 'status-cerrado',
                'apagado': 'status-apagado'
            }[obl.estatus] || 'status-pendiente';

            row.innerHTML = `
                <td class="p-4 text-xs font-bold text-primary group-hover:underline">${obl.id || obl.id_oficial || '-'}</td>
                <td class="p-4 text-xs font-semibold">${obl.regulador || '-'}</td>
                <td class="p-4 text-xs font-medium">${obl.area || '-'}</td>
                <td class="p-4 text-xs font-mono">${Utils.formatDate(obl.fecha_limite, 'DD/MM/YYYY')}</td>
                <td class="p-4 text-xs font-bold ${diasClass}">
                    ${diasRestantes !== null ? diasRestantes : 'N/A'}
                    ${diasRestantes === 0 ? '<span class="absolute -top-1 left-3 bg-primary text-white text-[8px] font-bold px-1 py-0.5 rounded leading-none whitespace-nowrap shadow-sm">VENCE HOY</span>' : ''}
                </td>
                <td class="p-4">
                    <span class="status-pill ${estadoClass}">${this.getEstadoLabel(obl.estatus)}</span>
                </td>
                <td class="p-4 text-xs text-text-muted italic">${obl.sub_estatus || '-'}</td>
                <td class="p-4 text-right">
                    <div class="flex items-center justify-end gap-1">
                        <button class="p-1.5 hover:bg-gray-100 rounded-full text-text-muted hover:text-primary transition-colors" 
                                data-action="ver-detalle" data-id="${obl.id}" title="Ver detalles">
                            <span class="material-symbols-outlined">visibility</span>
                        </button>
                        ${obl.estatus === 'pausada' ?
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
     * Cargar opciones de filtros y restaurar estado
     */
    async loadFilters() {
        try {
            const obligaciones = await this.obligacionesService.getAll();

            // Colecciones para valores únicos (normalizados a string)
            const areas = new Set();
            const estatuses = new Set();
            const subEstatus = new Set();

            obligaciones.forEach(obl => {
                if (obl.area) areas.add(String(obl.area).trim());
                if (obl.estatus) estatuses.add(String(obl.estatus).trim());
                if (obl.sub_estatus) subEstatus.add(String(obl.sub_estatus).trim());
            });

            // Helper para poblar select
            const populateSelect = (id, values) => {
                const select = document.getElementById(id);
                if (!select) return;

                // Mantener primera opción (placeholder)
                const firstOption = select.options[0];
                select.innerHTML = '';
                select.appendChild(firstOption);

                Array.from(values).sort().forEach(val => {
                    const option = document.createElement('option');
                    // Usar valor original para value y label
                    option.value = val;
                    option.textContent = val;
                    select.appendChild(option);
                });
            };

            populateSelect('filter-area', areas);
            populateSelect('filter-estatus', estatuses);
            populateSelect('filter-sub-estatus', subEstatus);

            // Restaurar filtros desde localStorage (herencia del Dashboard)
            const savedFilters = localStorage.getItem('alertia_filters');
            if (savedFilters) {
                try {
                    const parsed = JSON.parse(savedFilters);

                    if (parsed.area) {
                        this.currentFilters.area = parsed.area;
                        const el = document.getElementById('filter-area');
                        if (el) el.value = parsed.area;
                    }
                    if (parsed.estatus) {
                        this.currentFilters.estatus = parsed.estatus;
                        const el = document.getElementById('filter-estatus');
                        if (el) el.value = parsed.estatus;
                    }
                    if (parsed.sub_estatus) {
                        this.currentFilters.sub_estatus = parsed.sub_estatus;
                        const el = document.getElementById('filter-sub-estatus');
                        if (el) el.value = parsed.sub_estatus;
                    }
                    if (parsed.id) {
                        this.currentFilters.id = parsed.id;
                        const el = document.getElementById('filter-id');
                        if (el) el.value = parsed.id;
                    }

                    // Recargar con los filtros aplicados
                    this.loadObligaciones();

                } catch (e) {
                    console.error('Error al restaurar filtros', e);
                }
            }

        } catch (error) {
            console.error('Error al cargar filtros:', error);
        }
    }

    /**
     * Actualizar paginación
     */
    updatePagination(total) {
        const totalPages = Math.ceil(total / this.itemsPerPage);

        // Actualizar texto
        const infoEl = document.getElementById('pagination-info');
        if (infoEl) {
            const start = total === 0 ? 0 : (this.currentPage - 1) * this.itemsPerPage + 1;
            const end = Math.min(this.currentPage * this.itemsPerPage, total);
            infoEl.textContent = `Mostrando ${start} de ${end} de ${total} registros`;
        }

        // Renderizar controles
        const controlsEl = document.getElementById('pagination-controls');
        if (controlsEl) {
            controlsEl.innerHTML = '';

            if (totalPages <= 1) return;

            // Botón Anterior
            const prevBtn = document.createElement('button');
            prevBtn.className = 'p-1.5 border border-border-subtle rounded bg-white text-text-muted hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
            prevBtn.innerHTML = '<span class="material-symbols-outlined">chevron_left</span>';
            prevBtn.disabled = this.currentPage === 1;
            prevBtn.onclick = () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.loadObligaciones();
                }
            };
            controlsEl.appendChild(prevBtn);

            // Páginas (Lógica simple: mostrar todas si son pocas, o rango limitado)
            // Para simplicidad mostramos rango alrededor de current page
            let startPage = Math.max(1, this.currentPage - 2);
            let endPage = Math.min(totalPages, startPage + 4);

            if (endPage - startPage < 4) {
                startPage = Math.max(1, endPage - 4);
            }

            for (let i = startPage; i <= endPage; i++) {
                const pageBtn = document.createElement('button');
                const isActive = i === this.currentPage;

                if (isActive) {
                    pageBtn.className = 'px-3 py-1 border border-primary bg-primary text-white text-xs font-bold rounded';
                } else {
                    pageBtn.className = 'px-3 py-1 border border-border-subtle bg-white text-text-muted text-xs font-bold rounded hover:bg-gray-100 hover:text-primary-black-black transition-colors';
                }

                pageBtn.textContent = i;
                pageBtn.onclick = () => {
                    this.currentPage = i;
                    this.loadObligaciones();
                };
                controlsEl.appendChild(pageBtn);
            }

            // Botón Siguiente
            const nextBtn = document.createElement('button');
            nextBtn.className = 'p-1.5 border border-border-subtle rounded bg-white text-text-muted hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
            nextBtn.innerHTML = '<span class="material-symbols-outlined">chevron_right</span>';
            nextBtn.disabled = this.currentPage === totalPages;
            nextBtn.onclick = () => {
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.loadObligaciones();
                }
            };
            controlsEl.appendChild(nextBtn);
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
// Inicializar cuando las dependencias estén listas
const initObligacionesController = () => {
    if (window.obligacionesController) return; // Ya inicializado

    if (window.dataAdapter) {
        const controller = new ObligacionesController();
        controller.init();
        window.obligacionesController = controller;
        console.log('✅ ObligacionesController inicializado');
    }
};

// Intentar inicializar inmediatamente o esperar evento
if (window.dataAdapter) {
    initObligacionesController();
} else {
    document.addEventListener('alertia-ready', initObligacionesController);
    // Respaldo por si el evento ya sucedió o hay condiciones de carrera
    document.addEventListener('DOMContentLoaded', initObligacionesController);
}

if (typeof window !== 'undefined') {
    window.ObligacionesController = ObligacionesController;
}
