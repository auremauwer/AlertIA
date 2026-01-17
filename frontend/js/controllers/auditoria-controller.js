/**
 * Controlador de Auditoría
 * Maneja la visualización de eventos de auditoría
 */
class AuditoriaController {
    constructor() {
        this.auditoriaService = null;
        this.currentFilters = {
            usuario: null,
            accion: null,
            fecha_desde: null,
            fecha_hasta: null,
            ip: null
        };
        this.currentPage = 1;
        this.itemsPerPage = 25;
    }

    /**
     * Inicializar controlador
     */
    async init() {
        if (!window.dataAdapter) {
            console.error('dataAdapter no está disponible');
            return;
        }

        this.auditoriaService = new AuditoriaService(window.dataAdapter);
        
        this.setupEventListeners();
        await this.loadAuditoria();
    }

    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        // Búsqueda
        const searchInput = document.querySelector('input[placeholder*="Buscar"]');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce(async (e) => {
                const query = e.target.value;
                if (query) {
                    const resultados = await this.auditoriaService.buscar(query);
                    this.renderEventos(resultados);
                } else {
                    await this.loadAuditoria();
                }
            }, 300));
        }
    }

    /**
     * Cargar eventos de auditoría
     */
    async loadAuditoria() {
        try {
            const eventos = await this.auditoriaService.getEventos(this.currentFilters);
            this.renderEventos(eventos);
            this.updatePagination(eventos.length);
        } catch (error) {
            console.error('Error al cargar auditoría:', error);
            Utils.showNotification('Error al cargar eventos de auditoría', 'error');
        }
    }

    /**
     * Renderizar eventos en tabla
     */
    renderEventos(eventos) {
        const tbody = document.querySelector('table tbody');
        if (!tbody) return;

        // Paginación
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const paginated = eventos.slice(start, end);

        tbody.innerHTML = '';

        paginated.forEach(evento => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-[#f8f6f6] dark:hover:bg-[#2d1515] transition-colors group';
            
            const fecha = Utils.formatDate(evento.fecha, 'DD/MM/YYYY');
            const hora = new Date(evento.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });

            row.innerHTML = `
                <td class="px-6 py-3">
                    <div class="flex items-center gap-3">
                        <div class="size-8 shrink-0 rounded-full bg-[#e5e7eb] dark:bg-[#331a1a] flex items-center justify-center text-xs font-bold text-[#6b7280]">${this.getInitials(evento.usuario)}</div>
                        <div class="flex flex-col min-w-0">
                            <span class="text-xs font-bold truncate">${evento.usuario}</span>
                            <span class="text-[10px] text-[#896161] truncate">${evento.usuario_email || ''}</span>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-3">
                    <div class="flex flex-col">
                        <span class="text-xs font-bold text-[#181111] dark:text-white">${evento.accion}</span>
                        ${evento.contexto?.obligacion_id ? `<span class="text-[10px] text-gray-400">Ref: ${evento.contexto.obligacion_id}</span>` : ''}
                    </div>
                </td>
                <td class="px-6 py-3">
                    <div class="flex flex-col">
                        <span class="text-xs font-medium">${fecha}</span>
                        <span class="text-[10px] text-[#896161]">${hora}</span>
                    </div>
                </td>
                <td class="px-6 py-3">
                    <span class="text-xs code-font text-gray-400">${evento.ip || 'localhost'}</span>
                </td>
                <td class="px-6 py-3">
                    ${this.renderCambios(evento.contexto)}
                </td>
                <td class="px-6 py-3">
                    <div class="flex items-center justify-center">
                        <button class="text-[#896161] hover:text-primary transition-colors p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20" 
                                data-action="ver-detalle" data-id="${evento.id}" title="Ver detalles">
                            <span class="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                    </div>
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
     * Renderizar cambios antes/después
     */
    renderCambios(contexto) {
        if (!contexto) return '<span class="text-[10px] code-font text-gray-500">-</span>';
        
        if (contexto.obligacion_id) {
            return `<span class="text-[10px] code-font text-gray-500">OBL: ${contexto.obligacion_id}</span>`;
        }
        
        return '<span class="text-[10px] code-font text-gray-500">-</span>';
    }

    /**
     * Obtener iniciales
     */
    getInitials(nombre) {
        return nombre.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }

    /**
     * Actualizar paginación
     */
    updatePagination(total) {
        // Actualizar UI de paginación
    }

    /**
     * Ver detalle de evento
     */
    async verDetalle(id) {
        try {
            const eventos = await this.auditoriaService.getEventos();
            const evento = eventos.find(e => e.id === id);
            
            if (evento) {
                // Mostrar modal con detalles
                alert(`Detalle de evento ${evento.id}\n\nUsuario: ${evento.usuario}\nAcción: ${evento.accion}\nFecha: ${Utils.formatDate(evento.fecha, 'DD/MM/YYYY HH:mm:ss')}\nIP: ${evento.ip}`);
            }
        } catch (error) {
            console.error('Error al obtener detalle:', error);
        }
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.dataAdapter) {
            const controller = new AuditoriaController();
            controller.init();
            window.auditoriaController = controller;
        }
    });
} else {
    if (window.dataAdapter) {
        const controller = new AuditoriaController();
        controller.init();
        window.auditoriaController = controller;
    }
}

if (typeof window !== 'undefined') {
    window.AuditoriaController = AuditoriaController;
}
