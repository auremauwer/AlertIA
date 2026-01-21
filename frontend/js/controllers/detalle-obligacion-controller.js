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
        console.log('[DEBUG] DetalleObligacionController.init() called');
        
        if (!window.dataAdapter) {
            console.error('[DEBUG] dataAdapter no está disponible');
            return;
        }

        // Obtener ID de la URL
        const urlParams = new URLSearchParams(window.location.search);
        this.obligacionId = urlParams.get('id');
        console.log('[DEBUG] Obligacion ID from URL:', this.obligacionId);

        if (!this.obligacionId) {
            console.error('[DEBUG] ID de obligación no proporcionado');
            Utils.showNotification('ID de obligación no proporcionado', 'error');
            return;
        }

        this.obligacionesService = new ObligacionesService(window.dataAdapter);
        this.auditoriaService = new AuditoriaService(window.dataAdapter);
        console.log('[DEBUG] Services initialized');

        this.setupEventListeners();
        console.log('[DEBUG] Event listeners setup, calling loadDetalle()');
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
        console.log('[DEBUG] loadDetalle() called with ID:', this.obligacionId);
        try {
            const obligacion = await this.obligacionesService.getById(this.obligacionId);
            console.log('[DEBUG] Obligacion retrieved:', obligacion);
            this.renderDetalle(obligacion);
            await this.loadHistorial(obligacion);
        } catch (error) {
            console.error('[DEBUG] Error al cargar detalle:', error);
            Utils.showNotification('Error al cargar detalle de obligación', 'error');
        }
    }

    /**
     * Renderizar detalle
     */
    renderDetalle(obligacion) {
        console.log('[DEBUG] renderDetalle called with obligacion:', obligacion);
        
        // Actualizar header
        const headerId = document.getElementById('header-id');
        const headerSubtitle = document.getElementById('header-subtitle');

        console.log('[DEBUG] headerId element:', headerId);
        console.log('[DEBUG] headerSubtitle element:', headerSubtitle);

        if (headerId) {
            const idToShow = obligacion.id || obligacion.id_oficial || '---';
            headerId.textContent = idToShow;
            console.log('[DEBUG] Set header-id to:', idToShow);
        } else {
            console.error('[DEBUG] header-id element not found!');
        }

        if (headerSubtitle) {
            const parts = [];
            // Agregar partes solo si existen y no están vacías
            // Formatear regulador (ej: "CNBV" o "Comisión Nacional Bancaria y de Valores" -> "CNBV")
            let reguladorDisplay = obligacion.regulador || '';
            // Si el regulador es largo, intentar extraer siglas o usar las primeras letras
            if (reguladorDisplay.length > 10) {
                // Buscar siglas comunes
                const siglas = reguladorDisplay.match(/\b([A-Z]{2,})\b/g);
                if (siglas && siglas.length > 0) {
                    reguladorDisplay = siglas[0];
                } else {
                    // Extraer primeras letras de palabras importantes
                    const palabras = reguladorDisplay.split(' ');
                    if (palabras.length > 1) {
                        reguladorDisplay = palabras.map(p => p.charAt(0).toUpperCase()).join('').substring(0, 5);
                    }
                }
            }
            if (reguladorDisplay) parts.push(reguladorDisplay.toUpperCase());
            
            // Formatear área (ej: "Cumplimiento" -> "CUMPLIMIENTO")
            if (obligacion.area && obligacion.area !== 'Sin asignar' && obligacion.area.trim()) {
                parts.push(obligacion.area.toUpperCase());
            }
            
            // Formatear periodicidad (ej: "Mensual" -> "MENSUAL")
            if (obligacion.periodicidad && obligacion.periodicidad !== 'No definida' && obligacion.periodicidad.trim()) {
                parts.push(obligacion.periodicidad.toUpperCase());
            }

            const subtitleText = parts.join(' • ');
            headerSubtitle.textContent = subtitleText;
            console.log('[DEBUG] Set header-subtitle to:', subtitleText);
        } else {
            console.error('[DEBUG] header-subtitle element not found!');
        }

        // Actualizar información general
        const descripcionEl = document.querySelector('[data-field="descripcion"]');
        const reguladorEl = document.querySelector('[data-field="regulador"]');
        const fechaLimiteEl = document.querySelector('[data-field="fecha_limite"]');
        const estatusEl = document.querySelector('[data-field="estatus"]');
        const subEstatusEl = document.querySelector('[data-field="sub_estatus"]');

        if (descripcionEl) descripcionEl.textContent = obligacion.descripcion || obligacion.nombre;
        if (reguladorEl) reguladorEl.textContent = obligacion.regulador;
        if (fechaLimiteEl) {
            // Si hay fecha válida, formatearla. Si no, mostrar el valor original del Excel
            console.log('[DEBUG] fecha_limite:', obligacion.fecha_limite);
            console.log('[DEBUG] fecha_limite_original:', obligacion.fecha_limite_original);
            
            if (obligacion.fecha_limite) {
                const fechaFormateada = Utils.formatDate(obligacion.fecha_limite, 'DD/MM/YYYY');
                fechaLimiteEl.textContent = fechaFormateada;
                console.log('[DEBUG] Mostrando fecha formateada:', fechaFormateada);
            } else if (obligacion.fecha_limite_original) {
                // Mostrar el valor original del Excel si no hay fecha válida
                fechaLimiteEl.textContent = obligacion.fecha_limite_original;
                console.log('[DEBUG] Mostrando valor original del Excel:', obligacion.fecha_limite_original);
            } else {
                fechaLimiteEl.textContent = 'No definida';
                console.log('[DEBUG] No hay fecha, mostrando "No definida"');
            }
        }
        if (estatusEl) {
            // Mostrar estatus con el estilo de pill si existe
            if (obligacion.estatus) {
                const estatusClass = this.getEstatusClass(obligacion.estatus);
                estatusEl.innerHTML = `<span class="status-pill ${estatusClass}">${this.getEstatusLabel(obligacion.estatus)}</span>`;
            } else {
                estatusEl.innerHTML = '<span class="status-pill status-pendiente">No definido</span>';
            }
        }
        if (subEstatusEl) {
            // Mostrar subestatus con el mismo formato de pill
            if (obligacion.sub_estatus) {
                const subEstatusClass = this.getSubEstatusClass(obligacion.sub_estatus);
                subEstatusEl.innerHTML = `<span class="status-pill ${subEstatusClass}">${obligacion.sub_estatus}</span>`;
            } else {
                subEstatusEl.innerHTML = '';
            }
        }

        // Actualizar reglas de alertamiento
        const reglas = obligacion.reglas_alertamiento || {};
        const regla1VezEl = document.querySelector('[data-field="regla_1_vez"]');
        const reglaSemanalEl = document.querySelector('[data-field="regla_semanal"]');
        const reglaSaltadoEl = document.querySelector('[data-field="regla_saltado"]');
        const reglaDiariaEl = document.querySelector('[data-field="regla_diaria"]');

        if (regla1VezEl) {
            if (reglas.regla_1_vez) {
                regla1VezEl.textContent = reglas.regla_1_vez;
            } else {
                regla1VezEl.textContent = '-';
            }
        }
        if (reglaSemanalEl) {
            if (reglas.regla_semanal) {
                reglaSemanalEl.textContent = reglas.regla_semanal;
            } else {
                reglaSemanalEl.textContent = '-';
            }
        }
        if (reglaSaltadoEl) {
            if (reglas.regla_saltado) {
                reglaSaltadoEl.textContent = reglas.regla_saltado;
            } else {
                reglaSaltadoEl.textContent = '-';
            }
        }
        if (reglaDiariaEl) {
            if (reglas.regla_diaria) {
                reglaDiariaEl.textContent = reglas.regla_diaria;
            } else {
                reglaDiariaEl.textContent = '-';
            }
        }

        // Configurar toggle button
        // El toggle está prendido si: Estatus = "Recordatorio" Y Subestatus = "Sin respuesta"
        const toggleEl = document.getElementById('regla-toggle');
        if (toggleEl) {
            const estatus = obligacion.estatus ? String(obligacion.estatus).toLowerCase().trim() : '';
            const subEstatus = obligacion.sub_estatus ? String(obligacion.sub_estatus).toLowerCase().trim() : '';
            
            const isRecordatorio = estatus === 'recordatorio';
            const isSinRespuesta = subEstatus === 'sin respuesta' || subEstatus.includes('sin respuesta');
            
            const shouldBeOn = isRecordatorio && isSinRespuesta;
            
            toggleEl.checked = shouldBeOn;
            toggleEl.disabled = false; // Habilitar el toggle
            
            console.log('[DEBUG] Toggle configurado:', {
                estatus,
                subEstatus,
                isRecordatorio,
                isSinRespuesta,
                shouldBeOn
            });
        }
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
     * Obtener label de estatus
     */
    getEstatusLabel(estatus) {
        const labels = {
            'pendiente': 'Pendiente',
            'recordatorio': 'Recordatorio',
            'ventana': 'En ventana',
            'pausada': 'Pausada',
            'atendida': 'Atendida',
            'solicitud': 'Solicitud',
            'cerrado': 'Cerrado',
            'apagado': 'Apagado'
        };
        return labels[estatus] || estatus;
    }

    /**
     * Obtener clase CSS para estatus
     */
    getEstatusClass(estatus) {
        const classes = {
            'pendiente': 'status-pendiente',
            'recordatorio': 'status-recordatorio',
            'ventana': 'status-ventana',
            'pausada': 'status-pausada',
            'atendida': 'status-atendida',
            'solicitud': 'status-solicitud',
            'cerrado': 'status-cerrado',
            'apagado': 'status-apagado'
        };
        return classes[estatus] || 'status-pendiente';
    }

    /**
     * Obtener clase CSS para subestatus
     */
    getSubEstatusClass(subEstatus) {
        // Mapear subestatus a clases de color según el contenido
        const subEstatusLower = String(subEstatus).toLowerCase();
        
        if (subEstatusLower.includes('pendiente')) {
            return 'status-pendiente';
        } else if (subEstatusLower.includes('sin respuesta') || subEstatusLower.includes('vencida')) {
            return 'status-ventana';
        } else if (subEstatusLower.includes('atendida') || subEstatusLower.includes('completada')) {
            return 'status-atendida';
        } else if (subEstatusLower.includes('pausada') || subEstatusLower.includes('pausado')) {
            return 'status-pausada';
        } else if (subEstatusLower.includes('recordatorio')) {
            return 'status-recordatorio';
        } else if (subEstatusLower.includes('solicitud')) {
            return 'status-solicitud';
        } else if (subEstatusLower.includes('cerrado') || subEstatusLower.includes('cerrada')) {
            return 'status-cerrado';
        } else {
            // Por defecto, usar un estilo neutral
            return 'status-pendiente';
        }
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

// Función para inicializar el controlador
function initializeDetalleController() {
    if (window.dataAdapter && !window.detalleObligacionController) {
        console.log('[DEBUG] Creating DetalleObligacionController');
        const controller = new DetalleObligacionController();
        controller.init();
        window.detalleObligacionController = controller;
        return true;
    }
    return false;
}

// También escuchar el evento alertia-ready
document.addEventListener('alertia-ready', () => {
    console.log('[DEBUG] alertia-ready event received');
    initializeDetalleController();
}, { once: true });

// Inicializar cuando el DOM esté listo
console.log('[DEBUG] detalle-obligacion-controller.js loaded, document.readyState:', document.readyState);
console.log('[DEBUG] window.dataAdapter available:', !!window.dataAdapter);

if (document.readyState === 'loading') {
    console.log('[DEBUG] Waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[DEBUG] DOMContentLoaded fired');
        if (initializeDetalleController()) {
            // Controller initialized
        } else {
            console.error('[DEBUG] window.dataAdapter not available on DOMContentLoaded');
            // Esperar a que dataAdapter esté disponible
            const checkDataAdapter = setInterval(() => {
                if (initializeDetalleController()) {
                    clearInterval(checkDataAdapter);
                }
            }, 100);
            
            // Timeout después de 5 segundos
            setTimeout(() => {
                clearInterval(checkDataAdapter);
                if (!window.detalleObligacionController) {
                    console.error('[DEBUG] Timeout waiting for dataAdapter after DOMContentLoaded');
                }
            }, 5000);
        }
    });
} else {
    console.log('[DEBUG] DOM already ready, initializing immediately');
    if (initializeDetalleController()) {
        // Controller initialized
    } else {
        console.error('[DEBUG] window.dataAdapter not available');
        // Esperar a que dataAdapter esté disponible
        const checkDataAdapter = setInterval(() => {
            if (window.dataAdapter) {
                console.log('[DEBUG] dataAdapter now available, creating controller');
                clearInterval(checkDataAdapter);
                const controller = new DetalleObligacionController();
                controller.init();
                window.detalleObligacionController = controller;
            }
        }, 100);
        
        // Timeout después de 5 segundos
        setTimeout(() => {
            clearInterval(checkDataAdapter);
            if (!window.detalleObligacionController) {
                console.error('[DEBUG] Timeout waiting for dataAdapter');
            }
        }, 5000);
    }
}

if (typeof window !== 'undefined') {
    window.DetalleObligacionController = DetalleObligacionController;
}
