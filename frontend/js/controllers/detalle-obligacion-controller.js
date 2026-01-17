/**
 * Controlador de Detalle de Obligación
 * Maneja la visualización y acciones del detalle de una obligación
 */
class DetalleObligacionController {
    constructor() {
        this.obligacionesService = null;
        this.auditoriaService = null;
        this.obligacionId = null;
    }

    /**
     * Inicializar controlador
     */
    async init() {
        if (!window.dataAdapter) {
            console.error('dataAdapter no está disponible');
            return;
        }

        // Obtener ID de la URL
        const urlParams = new URLSearchParams(window.location.search);
        this.obligacionId = urlParams.get('id');

        if (!this.obligacionId) {
            Utils.showNotification('ID de obligación no proporcionado', 'error');
            return;
        }

        this.obligacionesService = new ObligacionesService(window.dataAdapter);
        this.auditoriaService = new AuditoriaService(window.dataAdapter);

        this.setupEventListeners();
        await this.loadDetalle();
    }

    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        // Botón cerrar
        const btnCerrar = Array.from(document.querySelectorAll('button')).find(btn => 
            btn.textContent.includes('Cerrar')
        );
        if (btnCerrar) {
            btnCerrar.addEventListener('click', () => {
                window.history.back();
            });
        }

        // Botón pausar
        const btnPausar = Array.from(document.querySelectorAll('button')).find(btn => 
            btn.textContent.includes('Pausar')
        );
        if (btnPausar) {
            btnPausar.addEventListener('click', () => this.pausar());
        }

        // Botón agregar comentario
        const btnComentario = Array.from(document.querySelectorAll('button')).find(btn => 
            btn.textContent.includes('Comentario')
        );
        if (btnComentario) {
            btnComentario.addEventListener('click', () => this.agregarComentario());
        }

        // Botón marcar atendida
        const btnAtendida = Array.from(document.querySelectorAll('button')).find(btn => 
            btn.textContent.includes('Marcar Atendida')
        );
        if (btnAtendida) {
            btnAtendida.addEventListener('click', () => this.marcarAtendida());
        }
    }

    /**
     * Cargar detalle de obligación
     */
    async loadDetalle() {
        try {
            const obligacion = await this.obligacionesService.getById(this.obligacionId);
            this.renderDetalle(obligacion);
            await this.loadHistorial(obligacion);
        } catch (error) {
            console.error('Error al cargar detalle:', error);
            Utils.showNotification('Error al cargar detalle de obligación', 'error');
        }
    }

    /**
     * Renderizar detalle
     */
    renderDetalle(obligacion) {
        // Actualizar título
        const titulo = Array.from(document.querySelectorAll('h3')).find(h3 => 
            h3.textContent.includes('Detalle')
        );
        if (titulo) {
            titulo.innerHTML = `Detalle de Obligación <span class="text-xs font-bold text-primary bg-red-50 px-2 py-0.5 rounded">${obligacion.id}</span>`;
        }

        // Actualizar información general
        const descripcionEl = document.querySelector('[data-field="descripcion"]');
        const reguladorEl = document.querySelector('[data-field="regulador"]');
        const fechaLimiteEl = document.querySelector('[data-field="fecha_limite"]');
        const estadoEl = document.querySelector('[data-field="estado"]');

        if (descripcionEl) descripcionEl.textContent = obligacion.descripcion || obligacion.nombre;
        if (reguladorEl) reguladorEl.textContent = obligacion.regulador;
        if (fechaLimiteEl) fechaLimiteEl.textContent = Utils.formatDate(obligacion.fecha_limite, 'DD/MM/YYYY');
        if (estadoEl) {
            estadoEl.innerHTML = `<span class="status-pill status-${obligacion.estado}">${this.getEstadoLabel(obligacion.estado)}</span>`;
        }

        // Actualizar reglas de alertamiento
        const reglas = obligacion.reglas_alertamiento || {};
        const alerta1El = document.querySelector('[data-rule="alerta1"]');
        const alerta2El = document.querySelector('[data-rule="alerta2"]');
        const criticaEl = document.querySelector('[data-rule="critica"]');

        if (alerta1El) alerta1El.textContent = `${reglas.alerta1 || 30} días`;
        if (alerta2El) alerta2El.textContent = `${reglas.alerta2 || 10} días`;
        if (criticaEl) criticaEl.textContent = `${reglas.critica || 5} días`;
    }

    /**
     * Cargar historial de eventos
     */
    async loadHistorial(obligacion) {
        try {
            // Obtener eventos relacionados con esta obligación
            const eventos = await this.auditoriaService.getEventos();
            const eventosObligacion = eventos.filter(e => 
                e.contexto?.obligacion_id === obligacion.id
            );

            this.renderHistorial(eventosObligacion);
        } catch (error) {
            console.error('Error al cargar historial:', error);
        }
    }

    /**
     * Renderizar historial
     */
    renderHistorial(eventos) {
        const container = document.querySelector('[data-section="historial"]');
        if (!container) return;

        container.innerHTML = '';

        eventos.forEach((evento, index) => {
            const item = document.createElement('div');
            item.className = 'flex gap-4';
            
            const iconClass = evento.accion.includes('envió') ? 'bg-slate-600' :
                            evento.accion.includes('Pausó') ? 'bg-orange-50 border border-orange-300 text-orange-600' :
                            evento.accion.includes('Reanudó') ? 'bg-red-50 border border-red-300 text-red-500' :
                            evento.accion.includes('comentario') ? 'bg-amber-50 border border-amber-300 text-amber-600' :
                            'bg-slate-600';

            const icon = evento.accion.includes('envió') ? 'mail' :
                        evento.accion.includes('Calculó') ? 'calculate' :
                        evento.accion.includes('Pausó') ? 'pause_circle' :
                        evento.accion.includes('Reanudó') ? 'play_arrow' :
                        evento.accion.includes('comentario') ? 'comment' :
                        'event';

            item.innerHTML = `
                <div class="shrink-0 flex flex-col items-center">
                    <div class="size-7 rounded-full ${iconClass} text-white flex items-center justify-center ring-4 ring-white z-10">
                        <span class="material-symbols-outlined text-[14px]">${icon}</span>
                    </div>
                    ${index < eventos.length - 1 ? '<div class="w-px flex-1 bg-gray-200 my-1"></div>' : ''}
                </div>
                <div class="pb-4 pt-1">
                    <p class="text-xs font-bold text-text-main">${evento.accion}</p>
                    <p class="text-[11px] text-text-muted">${this.getEventoDescripcion(evento)}</p>
                    <p class="text-[10px] font-medium text-text-muted mt-1 uppercase">${Utils.formatDate(evento.fecha, 'DD/MM/YYYY - HH:mm')}</p>
                </div>
            `;
            container.appendChild(item);
        });
    }

    /**
     * Obtener descripción del evento
     */
    getEventoDescripcion(evento) {
        if (evento.accion.includes('envió')) {
            return `Correo enviado a responsable.`;
        } else if (evento.accion.includes('Calculó')) {
            return `Sistema detectó que requiere alerta.`;
        } else if (evento.contexto?.comentario) {
            return `"${evento.contexto.comentario}"`;
        }
        return evento.contexto?.motivo || '';
    }

    /**
     * Obtener label de estado
     */
    getEstadoLabel(estado) {
        const labels = {
            'activa': 'Activa',
            'pausada': 'Pausada',
            'atendida': 'Atendida'
        };
        return labels[estado] || estado;
    }

    /**
     * Pausar obligación
     */
    async pausar() {
        const motivo = prompt('Ingrese motivo de pausa (opcional):');
        try {
            await this.obligacionesService.pausar(this.obligacionId, motivo);
            Utils.showNotification('Obligación pausada correctamente', 'success');
            await this.loadDetalle();
        } catch (error) {
            Utils.showNotification('Error al pausar obligación', 'error');
        }
    }

    /**
     * Agregar comentario
     */
    async agregarComentario() {
        const comentario = prompt('Ingrese comentario interno:');
        if (!comentario) return;

        try {
            await this.auditoriaService.registrarEvento('Agregó comentario', {
                obligacion_id: this.obligacionId,
                comentario: comentario
            });
            Utils.showNotification('Comentario agregado correctamente', 'success');
            await this.loadDetalle();
        } catch (error) {
            Utils.showNotification('Error al agregar comentario', 'error');
        }
    }

    /**
     * Marcar como atendida
     */
    async marcarAtendida() {
        if (!await Utils.confirm('¿Está seguro de marcar esta obligación como atendida? Esto detendrá el seguimiento.')) {
            return;
        }

        try {
            await this.obligacionesService.marcarAtendida(this.obligacionId);
            Utils.showNotification('Obligación marcada como atendida', 'success');
            await this.loadDetalle();
        } catch (error) {
            Utils.showNotification('Error al marcar obligación como atendida', 'error');
        }
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.dataAdapter) {
            const controller = new DetalleObligacionController();
            controller.init();
            window.detalleObligacionController = controller;
        }
    });
} else {
    if (window.dataAdapter) {
        const controller = new DetalleObligacionController();
        controller.init();
        window.detalleObligacionController = controller;
    }
}

if (typeof window !== 'undefined') {
    window.DetalleObligacionController = DetalleObligacionController;
}
