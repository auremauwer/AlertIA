/**
 * Controlador de Detalle de Obligación
 * Maneja la visualización y acciones del detalle de una obligación
 */
class DetalleObligacionController {
    constructor() {
        this.obligacionesService = null;
        this.auditoriaService = null;
        this.obligacionId = null;
        this.reglaListeners = []; // Para manejar event listeners de reglas
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

        // Botón guardar (marcar atendida)
        const btnGuardar = document.getElementById('btn-guardar-atendida');
        if (!btnGuardar) {
            // Fallback: buscar por texto
        const btnAtendida = Array.from(document.querySelectorAll('button')).find(btn =>
                btn.textContent.includes('Guardar') || btn.textContent.includes('Marcar Atendida')
        );
        if (btnAtendida) {
            btnAtendida.addEventListener('click', () => this.marcarAtendida());
            }
        } else {
            btnGuardar.addEventListener('click', () => this.marcarAtendida());
        }

        // Botón calendario de notificaciones
        const btnCalendario = Array.from(document.querySelectorAll('button')).find(btn =>
            btn.textContent.includes('Calendario de notificaciones')
        );
        if (btnCalendario) {
            btnCalendario.addEventListener('click', () => this.mostrarCalendarioNotificaciones());
        }

        // Botón cerrar modal calendario
        const btnCerrarCalendario = document.getElementById('btn-cerrar-calendario');
        if (btnCerrarCalendario) {
            btnCerrarCalendario.addEventListener('click', () => this.cerrarModalCalendario());
        }

        // Cerrar modal al hacer clic fuera de él
        const modalCalendario = document.getElementById('modal-calendario-notificaciones');
        if (modalCalendario) {
            modalCalendario.addEventListener('click', (e) => {
                if (e.target === modalCalendario) {
                    this.cerrarModalCalendario();
                }
            });
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

        // Actualizar reglas de alertamiento (inputs editables)
        const reglas = obligacion.reglas_alertamiento || {};
        const regla1VezEl = document.querySelector('[data-field="regla_1_vez"]');
        const reglaSemanalEl = document.querySelector('[data-field="regla_semanal"]');
        const reglaSaltadoEl = document.querySelector('[data-field="regla_saltado"]');
        const reglaDiariaEl = document.querySelector('[data-field="regla_diaria"]');

        // Función helper para convertir DD/MM/YYYY a YYYY-MM-DD (formato de input date)
        const convertirFechaParaInput = (fechaStr) => {
            if (!fechaStr || fechaStr === '-') return '';
            // Si ya está en formato YYYY-MM-DD, retornarlo
            if (/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) return fechaStr;
            // Si está en formato DD/MM/YYYY, convertir
            const partes = fechaStr.split('/');
            if (partes.length === 3) {
                const [dia, mes, año] = partes;
                return `${año}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
            }
            return '';
        };

        // Remover listeners anteriores si existen
        if (this.reglaListeners) {
            this.reglaListeners.forEach(({ element, handler }) => {
                element.removeEventListener('change', handler);
            });
        }
        this.reglaListeners = [];

        if (regla1VezEl) {
            regla1VezEl.value = convertirFechaParaInput(reglas.regla_1_vez);
            const handler1 = () => this.actualizarReglaAlertamiento('regla_1_vez', regla1VezEl.value);
            regla1VezEl.addEventListener('change', handler1);
            this.reglaListeners.push({ element: regla1VezEl, handler: handler1 });
        }
        if (reglaSemanalEl) {
            reglaSemanalEl.value = convertirFechaParaInput(reglas.regla_semanal);
            const handler2 = () => this.actualizarReglaAlertamiento('regla_semanal', reglaSemanalEl.value);
            reglaSemanalEl.addEventListener('change', handler2);
            this.reglaListeners.push({ element: reglaSemanalEl, handler: handler2 });
        }
        if (reglaSaltadoEl) {
            reglaSaltadoEl.value = convertirFechaParaInput(reglas.regla_saltado);
            const handler3 = () => this.actualizarReglaAlertamiento('regla_saltado', reglaSaltadoEl.value);
            reglaSaltadoEl.addEventListener('change', handler3);
            this.reglaListeners.push({ element: reglaSaltadoEl, handler: handler3 });
        }
        if (reglaDiariaEl) {
            reglaDiariaEl.value = convertirFechaParaInput(reglas.regla_diaria);
            const handler4 = () => this.actualizarReglaAlertamiento('regla_diaria', reglaDiariaEl.value);
            reglaDiariaEl.addEventListener('change', handler4);
            this.reglaListeners.push({ element: reglaDiariaEl, handler: handler4 });
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
            
            // Remover listener anterior si existe
            if (this.toggleListener) {
                toggleEl.removeEventListener('change', this.toggleListener);
            }
            
            // Agregar listener para cambios en el toggle
            this.toggleListener = async (e) => {
                const nuevoEstado = e.target.checked;
                const estadoAnterior = shouldBeOn;
                
                if (nuevoEstado !== estadoAnterior) {
                    await this.manejarCambioToggle(nuevoEstado);
                }
            };
            
            toggleEl.addEventListener('change', this.toggleListener);
            
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
            let historial = [];
            
            // Intentar sincronizar bitácora primero si está disponible
            if (window.BitacoraService && window.FileStorageService) {
                try {
                    const bitacoraService = new BitacoraService(window.dataAdapter);
                    // Sincronizar bitácora (fusiona archivo y localStorage)
                    await bitacoraService.sincronizarBitacora(obligacion.id);
                } catch (syncError) {
                    console.warn('[Detalle] Error al sincronizar bitácora:', syncError);
                }
            }
            
            // Obtener historial desde bitácora
            if (window.BitacoraService) {
                const bitacoraService = new BitacoraService(window.dataAdapter);
                historial = await bitacoraService.getHistorial(obligacion.id);
                
                if (historial && historial.length > 0) {
                    console.log(`[Detalle] Historial cargado desde bitácora: ${historial.length} eventos`);
                    this.renderHistorial(historial);
                    return;
                }
            }
            
            // Fallback: usar historial de la obligación directamente
            if (obligacion.historial && Array.isArray(obligacion.historial) && obligacion.historial.length > 0) {
                console.log(`[Detalle] Historial cargado desde obligación: ${obligacion.historial.length} eventos`);
                this.renderHistorial(obligacion.historial);
                return;
            }
            
            // Último fallback: obtener eventos relacionados desde auditoría
            try {
            const eventos = await this.auditoriaService.getEventos();
            const eventosObligacion = eventos.filter(e =>
                    e.contexto?.obligacion_id === obligacion.id || e.contexto?.obligacion_id === obligacion.id_oficial
            );

                if (eventosObligacion && eventosObligacion.length > 0) {
                    console.log(`[Detalle] Historial cargado desde auditoría: ${eventosObligacion.length} eventos`);
            this.renderHistorial(eventosObligacion);
                    return;
                }
            } catch (auditError) {
                console.warn('[Detalle] Error al cargar desde auditoría:', auditError);
            }
            
            // Si no hay eventos, mostrar mensaje vacío
            console.log('[Detalle] No se encontraron eventos para esta obligación');
            this.renderHistorial([]);
        } catch (error) {
            console.error('[Detalle] Error al cargar historial:', error);
            this.renderHistorial([]);
        }
    }

    /**
     * Renderizar historial
     */
    renderHistorial(eventos) {
        const container = document.querySelector('[data-section="historial"]');
        if (!container) {
            console.warn('[Detalle] Contenedor de historial no encontrado');
            return;
        }

        // Limpiar contenedor existente completamente
        container.innerHTML = '';
        
        // Actualizar contador primero
        const contadorEl = document.getElementById('historial-contador');
        const totalEventos = eventos && Array.isArray(eventos) ? eventos.length : 0;
        if (contadorEl) {
            contadorEl.textContent = `${totalEventos} ${totalEventos === 1 ? 'Evento' : 'Eventos'}`;
        }

        // Si no hay eventos, mostrar mensaje
        if (!eventos || eventos.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'text-center py-8 text-text-muted text-sm';
            emptyMsg.textContent = 'No hay eventos registrados';
            container.appendChild(emptyMsg);
            console.log('[Detalle] Mostrando mensaje de historial vacío');
            return;
        }
        
        console.log(`[Detalle] Renderizando ${eventos.length} eventos en historial`);

        eventos.forEach((evento, index) => {
            const item = document.createElement('div');
            item.className = 'flex gap-4';

            // Determinar si es evento de bitácora (tiene 'tipo') o de auditoría (tiene 'accion')
            const esBitacora = evento.tipo !== undefined;
            const titulo = esBitacora ? evento.titulo : evento.accion;
            const descripcion = esBitacora ? evento.descripcion : this.getEventoDescripcion(evento);
            const tipo = esBitacora ? evento.tipo : this.inferirTipoDesdeAccion(evento.accion);

            // Obtener icono y clase según tipo
            const { icon, iconClass } = this.getIconoYClasePorTipo(tipo);

            // Obtener usuario del evento
            const usuario = evento.usuario || evento.contexto?.usuario || 'Sistema';
            
            // Formatear fecha y hora
            const fechaHora = Utils.formatDate(evento.fecha, 'DD MMM YYYY - HH:mm');

            item.innerHTML = `
                <div class="shrink-0 flex flex-col items-center">
                    <div class="size-7 rounded-full ${iconClass} flex items-center justify-center ring-4 ring-white z-10">
                        <span class="material-symbols-outlined text-[14px]">${icon}</span>
                    </div>
                    ${index < eventos.length - 1 ? '<div class="w-px flex-1 bg-gray-200 my-1"></div>' : ''}
                </div>
                <div class="pb-4 pt-1">
                    <p class="text-xs font-bold text-text-main">${titulo}</p>
                    <p class="text-[11px] text-text-muted">${descripcion || ''}</p>
                    <div class="flex items-center gap-2 mt-1">
                        <p class="text-[10px] font-medium text-text-muted uppercase">${fechaHora}</p>
                        <span class="text-[10px] text-text-muted">•</span>
                        <p class="text-[10px] font-medium text-text-muted">${usuario}</p>
                    </div>
                </div>
            `;
            container.appendChild(item);
        });
        
        console.log(`[Detalle] Historial renderizado correctamente con ${eventos.length} eventos`);
    }

    /**
     * Inferir tipo de evento desde acción de auditoría
     */
    inferirTipoDesdeAccion(accion) {
        if (!accion) return 'otro';
        const accionLower = accion.toLowerCase();
        if (accionLower.includes('envió')) return 'archivo_subido';
        if (accionLower.includes('calculó')) return 'cambio_regla';
        if (accionLower.includes('pausó')) return 'pausar';
        if (accionLower.includes('reanudó')) return 'reanudar';
        if (accionLower.includes('comentario')) return 'comentario';
        if (accionLower.includes('cargó')) return 'carga_inicial';
        return 'otro';
    }

    /**
     * Obtener icono y clase CSS según tipo de evento
     */
    getIconoYClasePorTipo(tipo) {
        const tipos = {
            'carga_inicial': { icon: 'upload', iconClass: 'bg-slate-600 text-white' },
            'inicio_seguimiento': { icon: 'notifications_active', iconClass: 'bg-green-600 text-white' },
            'fin_seguimiento': { icon: 'notifications_off', iconClass: 'bg-gray-600 text-white' },
            'pausar': { icon: 'pause_circle', iconClass: 'bg-orange-50 border border-orange-300 text-orange-600' },
            'reanudar': { icon: 'play_arrow', iconClass: 'bg-red-50 border border-red-300 text-red-500' },
            'marcar_atendida': { icon: 'check_circle', iconClass: 'bg-green-50 border border-green-300 text-green-600' },
            'cambio_estatus': { icon: 'swap_horiz', iconClass: 'bg-blue-50 border border-blue-300 text-blue-600' },
            'cambio_regla': { icon: 'calculate', iconClass: 'bg-purple-50 border border-purple-300 text-purple-600' },
            'comentario': { icon: 'comment', iconClass: 'bg-amber-50 border border-amber-300 text-amber-600' },
            'archivo_subido': { icon: 'attach_file', iconClass: 'bg-blue-50 border border-blue-300 text-blue-600' },
            'recordatorio_enviado': { icon: 'schedule', iconClass: 'bg-indigo-50 border border-indigo-300 text-indigo-600' },
            'otro': { icon: 'event', iconClass: 'bg-slate-600 text-white' }
        };

        return tipos[tipo] || tipos['otro'];
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
     * Manejar cambio en toggle de notificaciones
     */
    async manejarCambioToggle(nuevoEstado) {
        try {
            const tipo = nuevoEstado ? 'inicio_seguimiento' : 'fin_seguimiento';
            const titulo = nuevoEstado ? 'Inicio de seguimiento' : 'Fin de seguimiento';
            const descripcion = nuevoEstado 
                ? 'Las notificaciones han sido activadas para esta obligación'
                : 'Las notificaciones han sido desactivadas para esta obligación';

            // Registrar en bitácora
            if (window.BitacoraService) {
                const bitacoraService = new BitacoraService(window.dataAdapter);
                await bitacoraService.registrarEvento(
                    this.obligacionId,
                    tipo,
                    titulo,
                    descripcion,
                    { notificaciones: !nuevoEstado },
                    { notificaciones: nuevoEstado },
                    null
                );
            }

            // Registrar en auditoría
            if (this.auditoriaService) {
                await this.auditoriaService.registrarEvento(
                    nuevoEstado ? 'Activó notificaciones' : 'Desactivó notificaciones',
                    {
                        obligacion_id: this.obligacionId
                    }
                );
            }

            Utils.showNotification(titulo, 'success');
        } catch (error) {
            console.error('Error al manejar cambio de toggle:', error);
            Utils.showNotification('Error al actualizar notificaciones', 'error');
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
        if (!comentario || comentario.trim() === '') {
            return;
        }

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/334755c9-e669-4015-ace9-566328740005',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'detalle-obligacion-controller.js:625',message:'agregarComentario ENTRADA',data:{obligacionId:this.obligacionId,comentario:comentario.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion

        try {
            // Registrar en bitácora
            if (window.BitacoraService) {
                const bitacoraService = new BitacoraService(window.dataAdapter);
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/334755c9-e669-4015-ace9-566328740005',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'detalle-obligacion-controller.js:635',message:'LLAMANDO registrarEvento',data:{obligacionId:this.obligacionId,tipo:'comentario'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                // #endregion
                await bitacoraService.registrarEvento(
                    this.obligacionId,
                    'comentario',
                    'Comentario interno',
                    `"${comentario}"`,
                    null,
                    { comentario: comentario },
                    null
                );
            }
            
            // Registrar en auditoría
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
     * Guardar estado (botón Guardar)
     * Guarda el estado del toggle y actualiza estatus/subestatus de la obligación
     */
    async marcarAtendida() {
        try {
            // Obtener estado actual del toggle
            const toggleEl = document.getElementById('regla-toggle');
            if (!toggleEl) {
                Utils.showNotification('Toggle no encontrado', 'error');
                return;
            }

            const togglePrendido = toggleEl.checked;
            
            // Obtener obligación actual
            const obligacionActual = await this.obligacionesService.getById(this.obligacionId);
            if (!obligacionActual) {
                Utils.showNotification('Obligación no encontrada', 'error');
            return;
        }

            // Guardar estado anterior para bitácora
            const estatusAnterior = obligacionActual.estatus;
            const subEstatusAnterior = obligacionActual.sub_estatus;
            
            // Actualizar estatus y subestatus según el estado del toggle
            if (togglePrendido) {
                // Si el toggle está prendido: estatus = 'recordatorio', sub_estatus = 'Sin respuesta'
                obligacionActual.estatus = 'recordatorio';
                obligacionActual.sub_estatus = 'Sin respuesta';
            } else {
                // Si el toggle está apagado: cambiar a otro estado (mantener estatus actual pero cambiar subestatus)
                // O cambiar a 'pendiente' si estaba en 'recordatorio'
                if (obligacionActual.estatus === 'recordatorio') {
                    obligacionActual.estatus = 'pendiente';
                }
                // Mantener sub_estatus actual o cambiarlo según necesidad
                // Por ahora, si estaba en 'Sin respuesta', cambiar a otro
                if (obligacionActual.sub_estatus === 'Sin respuesta' || obligacionActual.sub_estatus?.includes('Sin respuesta')) {
                    obligacionActual.sub_estatus = 'Pendiente';
                }
            }
            
            // Guardar obligación actualizada
            if (!window.dataAdapter) {
                throw new Error('dataAdapter no está disponible');
            }
            await window.dataAdapter.saveObligacion(obligacionActual);
            
            // Registrar en bitácora el estado del toggle
            if (window.BitacoraService) {
                const bitacoraService = new BitacoraService(window.dataAdapter);
                
                // Registrar estado de notificaciones
                const estadoNotificaciones = togglePrendido ? 'prendidas' : 'apagadas';
                const tituloNotificaciones = togglePrendido ? 'Notificaciones prendidas' : 'Notificaciones apagadas';
                const descripcionNotificaciones = togglePrendido 
                    ? 'Las notificaciones están activas para esta obligación'
                    : 'Las notificaciones están desactivadas para esta obligación';
                
                await bitacoraService.registrarEvento(
                    this.obligacionId,
                    togglePrendido ? 'inicio_seguimiento' : 'fin_seguimiento',
                    tituloNotificaciones,
                    descripcionNotificaciones,
                    { 
                        estatus: estatusAnterior,
                        sub_estatus: subEstatusAnterior,
                        notificaciones: !togglePrendido
                    },
                    { 
                        estatus: obligacionActual.estatus,
                        sub_estatus: obligacionActual.sub_estatus,
                        notificaciones: togglePrendido
                    },
                    null
                );
            }
            
            // Registrar en auditoría
            if (this.auditoriaService) {
                await this.auditoriaService.registrarEvento(
                    togglePrendido ? 'Activó notificaciones' : 'Desactivó notificaciones',
                    {
                        obligacion_id: this.obligacionId,
                        estatus_anterior: estatusAnterior,
                        estatus_nuevo: obligacionActual.estatus,
                        sub_estatus_anterior: subEstatusAnterior,
                        sub_estatus_nuevo: obligacionActual.sub_estatus
                    }
                );
            }
            
            Utils.showNotification('Obligación actualizada', 'success');
            
            // Recargar el detalle para reflejar los cambios
            await this.loadDetalle();
        } catch (error) {
            console.error('Error al guardar estado:', error);
            Utils.showNotification('Error al actualizar obligación', 'error');
        }
    }

    /**
     * Actualizar regla de alertamiento
     */
    async actualizarReglaAlertamiento(tipoRegla, nuevaFecha) {
        try {
            // Obtener obligación actual
            const obligacion = await this.obligacionesService.getById(this.obligacionId);
            if (!obligacion) {
                throw new Error('Obligación no encontrada');
            }

            // Obtener valor anterior para bitácora
            const reglasAnteriores = obligacion.reglas_alertamiento || {};
            const valorAnterior = reglasAnteriores[tipoRegla] || null;

            // Convertir YYYY-MM-DD a DD/MM/YYYY para guardar
            const convertirFechaParaGuardar = (fechaStr) => {
                if (!fechaStr || fechaStr.trim() === '') return null;
                // Si está en formato YYYY-MM-DD, convertir a DD/MM/YYYY
                if (/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
                    const [año, mes, dia] = fechaStr.split('-');
                    return `${dia}/${mes}/${año}`;
                }
                // Si ya está en DD/MM/YYYY, retornarlo
                return fechaStr;
            };

            const fechaFormateada = convertirFechaParaGuardar(nuevaFecha);

            // Actualizar reglas de alertamiento
            const reglasActualizadas = {
                ...reglasAnteriores,
                [tipoRegla]: fechaFormateada
            };

            // Guardar obligación actualizada
            obligacion.reglas_alertamiento = reglasActualizadas;
            obligacion.updated_at = new Date().toISOString();

            await this.obligacionesService.dataAdapter.saveObligacion(obligacion);

            // Recalcular y guardar calendario de notificaciones
            if (window.CalendarioService) {
                try {
                    const fileStorageService = new FileStorageService();
                    await fileStorageService.init();
                    const calendarioService = new CalendarioService(fileStorageService);
                    await calendarioService.calcularYGuardarCalendario(this.obligacionId, obligacion);
                    console.log(`[Calendario] Calendario recalculado y guardado para ${this.obligacionId}`);
                } catch (calendarioError) {
                    console.warn(`No se pudo recalcular calendario para ${this.obligacionId}:`, calendarioError);
                }
            }

            // Reprogramar recordatorios si el servicio está disponible
            if (window.RecordatoriosService) {
                try {
                    const recordatoriosService = new RecordatoriosService(window.dataAdapter, this.obligacionesService);
                    await recordatoriosService.reprogramarRecordatorios(this.obligacionId);
                } catch (error) {
                    console.warn('No se pudieron reprogramar recordatorios:', error);
                }
            }

            // Nombres de reglas para mostrar
            const nombresReglas = {
                'regla_1_vez': '1 Vez',
                'regla_semanal': 'Semanal',
                'regla_saltado': 'Saltado',
                'regla_diaria': 'Diaria'
            };
            const nombreRegla = nombresReglas[tipoRegla] || tipoRegla;

            // Registrar evento en bitácora (si existe el servicio)
            if (window.bitacoraService) {
                await window.bitacoraService.registrarEvento(
                    this.obligacionId,
                    'cambio_regla',
                    `Cambio en regla de alertamiento: ${nombreRegla}`,
                    `Regla ${nombreRegla} actualizada de "${valorAnterior || 'vacío'}" a "${fechaFormateada || 'vacío'}"`,
                    { [tipoRegla]: valorAnterior },
                    { [tipoRegla]: fechaFormateada }
                );
            }

            // Registrar en auditoría (sistema actual)
            if (this.auditoriaService) {
                await this.auditoriaService.registrarEvento('Modificó regla de alertamiento', {
                    obligacion_id: this.obligacionId,
                    tipo_regla: tipoRegla,
                    nombre_regla: nombreRegla,
                    valor_anterior: valorAnterior,
                    valor_nuevo: fechaFormateada
                });
            }

            Utils.showNotification(`Regla ${nombreRegla} actualizada correctamente`, 'success');

            // Recargar detalle para reflejar cambios
            await this.loadDetalle();
        } catch (error) {
            console.error('Error al actualizar regla de alertamiento:', error);
            Utils.showNotification('Error al actualizar regla de alertamiento', 'error');
        }
    }

    /**
     * Mostrar calendario de notificaciones en modal
     */
    async mostrarCalendarioNotificaciones() {
        try {
            // Obtener obligación actual
            const obligacion = await this.obligacionesService.getById(this.obligacionId);
            if (!obligacion) {
                Utils.showNotification('Obligación no encontrada', 'error');
                return;
            }

            // Obtener calendario usando CalendarioService
            if (!window.CalendarioService) {
                Utils.showNotification('Servicio de calendario no disponible', 'error');
                return;
            }

            const fileStorageService = new FileStorageService();
            await fileStorageService.init();
            const calendarioService = new CalendarioService(fileStorageService);
            
            const fechas = await calendarioService.obtenerCalendario(this.obligacionId, obligacion);

            // Mostrar modal con las fechas
            this.renderCalendarioModal(fechas, obligacion);
        } catch (error) {
            console.error('Error al mostrar calendario de notificaciones:', error);
            Utils.showNotification('Error al cargar calendario de notificaciones', 'error');
        }
    }

    /**
     * Renderizar modal con calendario de notificaciones
     */
    renderCalendarioModal(fechas, obligacion) {
        const modal = document.getElementById('modal-calendario-notificaciones');
        if (!modal) {
            console.error('Modal de calendario no encontrado');
            return;
        }

        // Obtener reglas para determinar tipo de cada fecha
        const reglas = obligacion.reglas_alertamiento || {};
        const calendarioService = new CalendarioService();
        const a1 = calendarioService.parseFecha(reglas.regla_1_vez);
        const a2 = calendarioService.parseFecha(reglas.regla_semanal);
        const a3 = calendarioService.parseFecha(reglas.regla_saltado);
        const a4 = calendarioService.parseFecha(reglas.regla_diaria);

        // Actualizar título con ID
        const tituloEl = document.getElementById('modal-calendario-titulo');
        if (tituloEl) {
            tituloEl.textContent = `Calendario de Notificaciones - ${obligacion.id_oficial || obligacion.id}`;
        }

        // Contenedor de fechas
        const fechasContainer = document.getElementById('modal-calendario-fechas');
        if (!fechasContainer) {
            console.error('Contenedor de fechas no encontrado');
            return;
        }

        // Limpiar contenedor
        fechasContainer.innerHTML = '';

        if (!fechas || fechas.length === 0) {
            fechasContainer.innerHTML = `
                <div class="text-center py-8 text-text-muted text-sm">
                    No hay fechas calculadas para esta obligación.
                    ${!obligacion.fecha_limite && !obligacion.fecha_limite_original ? 'Falta fecha límite.' : ''}
                    ${(!reglas.regla_1_vez && !reglas.regla_semanal && !reglas.regla_saltado && !reglas.regla_diaria) ? 'No hay reglas de alertamiento definidas.' : ''}
                </div>
            `;
        } else {
            // Mapeo de tipos de regla a etiquetas y colores
            const tipoLabels = {
                '1_vez': { label: '1 Vez', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                'semanal': { label: 'Semanal', color: 'bg-green-50 text-green-700 border-green-200' },
                'saltado': { label: 'Saltado', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
                'diaria': { label: 'Diaria', color: 'bg-red-50 text-red-700 border-red-200' },
                'desconocido': { label: 'N/A', color: 'bg-gray-50 text-gray-700 border-gray-200' }
            };

            fechas.forEach((fecha, index) => {
                const tipo = calendarioService.determinarTipoRegla(fecha, a1, a2, a3, a4);
                const tipoInfo = tipoLabels[tipo] || tipoLabels['desconocido'];
                const fechaFormateada = Utils.formatDate(fecha, 'DD/MM/YYYY');

                const fechaItem = document.createElement('div');
                fechaItem.className = 'flex items-center justify-between p-3 border-b border-border-subtle hover:bg-gray-50 transition-colors';
                fechaItem.innerHTML = `
                    <div class="flex items-center gap-3">
                        <span class="text-xs font-bold text-text-muted w-8">${index + 1}</span>
                        <span class="text-sm font-semibold text-text-main">${fechaFormateada}</span>
                    </div>
                    <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${tipoInfo.color}">
                        ${tipoInfo.label}
                    </span>
                `;
                fechasContainer.appendChild(fechaItem);
            });
        }

        // Mostrar modal
        modal.classList.remove('hidden');
    }

    /**
     * Cerrar modal de calendario
     */
    cerrarModalCalendario() {
        const modal = document.getElementById('modal-calendario-notificaciones');
        if (modal) {
            modal.classList.add('hidden');
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
