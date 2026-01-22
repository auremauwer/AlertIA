/**
 * Controlador de Gestión de Escritos
 * Maneja la carga, visualización y aprobación/rechazo de escritos por obligación
 */
class GestionEscritoController {
    constructor() {
        this.obligacionesService = null;
        this.archivosService = null;
        this.fileStorageService = null;
        this.obligaciones = [];
        this.obligacionSeleccionada = null;
        this.archivos = [];
    }

    /**
     * Inicializar controlador
     */
    async init() {
        if (!window.dataAdapter) {
            console.error('dataAdapter no está disponible');
            return;
        }

        // Inicializar servicios
        this.obligacionesService = new ObligacionesService(window.dataAdapter);
        
        // Inicializar FileStorageService si está disponible
        if (window.FileStorageService) {
            this.fileStorageService = new FileStorageService();
            try {
                await this.fileStorageService.init();
            } catch (error) {
                console.warn('No se pudo inicializar FileStorageService:', error);
            }
        }

        // Inicializar ArchivosService
        this.archivosService = new ArchivosService(window.dataAdapter, this.fileStorageService);

        this.setupEventListeners();
        await this.loadObligaciones();
        
        // Actualizar estado inicial de los botones
        this.actualizarEstadoBotonAceptar();
        this.actualizarEstadoBotonRechazar();
        this.actualizarEstadoBotonEnviar();
        this.actualizarEstadoBotonCargar();
    }

    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        // Selector de folio
        const selectFolio = document.getElementById('folio');
        if (selectFolio) {
            selectFolio.addEventListener('change', () => this.onFolioChange());
        }

        // Botón consultar folio
        const btnConsultar = document.getElementById('btn-consultar-folio');
        if (btnConsultar) {
            btnConsultar.addEventListener('click', () => this.consultarFolio());
        }

        // Botón cargar archivo
        const btnCargar = document.getElementById('btn-cargar-archivo');
        const inputArchivo = document.getElementById('input-archivo');
        if (btnCargar) {
            btnCargar.addEventListener('click', () => {
                if (inputArchivo) inputArchivo.click();
            });
        }

        if (inputArchivo) {
            inputArchivo.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    this.handleFileSelect(Array.from(e.target.files));
                }
            });
        }

        // Drag and drop
        const dropZone = document.getElementById('drop-zone');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                // Solo permitir drag and drop si el botón está habilitado
                if (this.puedeCargarArchivos()) {
                    e.preventDefault();
                    dropZone.classList.add('border-primary', 'bg-red-50');
                }
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('border-primary', 'bg-red-50');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('border-primary', 'bg-red-50');
                // Solo procesar si el botón está habilitado
                if (this.puedeCargarArchivos() && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    this.handleFileSelect(Array.from(e.dataTransfer.files));
                } else {
                    Utils.showNotification('No se pueden cargar archivos en este momento. El estatus debe ser "Recordatorio" y el subestatus "Sin respuesta".', 'warning');
                }
            });
        }

        // Botones de aceptar/rechazar escrito
        const btnAceptar = document.getElementById('btn-aceptar-escrito');
        const btnRechazar = document.getElementById('btn-rechazar-escrito');
        if (btnAceptar) {
            btnAceptar.addEventListener('click', () => this.aceptarTodasEscritos());
        }
        if (btnRechazar) {
            btnRechazar.addEventListener('click', () => this.rechazarTodasEscritos());
        }

        // Botón enviar escrito
        const btnEnviar = document.getElementById('btn-enviar-escrito');
        if (btnEnviar) {
            btnEnviar.addEventListener('click', () => this.enviarEscrito());
        }
    }

    /**
     * Cargar obligaciones en el selector
     */
    async loadObligaciones() {
        try {
            this.obligaciones = await this.obligacionesService.getAll();
            
            const selectFolio = document.getElementById('folio');
            if (!selectFolio) return;

            // Limpiar opciones existentes (excepto la primera)
            while (selectFolio.children.length > 1) {
                selectFolio.removeChild(selectFolio.lastChild);
            }

            // Agregar obligaciones al selector
            this.obligaciones.forEach(obl => {
                const option = document.createElement('option');
                option.value = obl.id;
                const nombre = obl.descripcion || obl.nombre || 'Sin descripción';
                option.textContent = `${obl.id_oficial || obl.id} - ${nombre}`;
                selectFolio.appendChild(option);
            });
        } catch (error) {
            console.error('Error al cargar obligaciones:', error);
            Utils.showNotification('Error al cargar obligaciones', 'error');
        }
    }

    /**
     * Manejar cambio de folio
     */
    onFolioChange() {
        const selectFolio = document.getElementById('folio');
        if (!selectFolio) return;

        const obligacionId = selectFolio.value;
        if (obligacionId) {
            this.obligacionSeleccionada = this.obligaciones.find(obl => obl.id === obligacionId);
        } else {
            this.obligacionSeleccionada = null;
        }
        
        // Mostrar estatus y subestatus
        this.mostrarEstatusSubestatus();
        
        // Actualizar estado de los botones
        this.actualizarEstadoBotonAceptar();
        this.actualizarEstadoBotonRechazar();
        this.actualizarEstadoBotonEnviar();
        this.actualizarEstadoBotonCargar();
    }

    /**
     * Consultar folio seleccionado
     */
    async consultarFolio() {
        const selectFolio = document.getElementById('folio');
        if (!selectFolio || !selectFolio.value) {
            Utils.showNotification('Por favor seleccione un folio', 'warning');
            return;
        }

        const obligacionId = selectFolio.value;
        this.obligacionSeleccionada = this.obligaciones.find(obl => obl.id === obligacionId);

        if (!this.obligacionSeleccionada) {
            Utils.showNotification('Obligación no encontrada', 'error');
            return;
        }

        // Cargar archivos de la obligación
        await this.cargarArchivos(obligacionId);
        
        // Mostrar estatus y subestatus
        this.mostrarEstatusSubestatus();
        
        // Actualizar estado de los botones
        this.actualizarEstadoBotonAceptar();
        this.actualizarEstadoBotonRechazar();
        this.actualizarEstadoBotonEnviar();
        this.actualizarEstadoBotonCargar();
    }

    /**
     * Mostrar estatus y subestatus del folio seleccionado
     */
    mostrarEstatusSubestatus() {
        const contenedor = document.getElementById('info-estatus-subestatus');
        const estatusDisplay = document.getElementById('estatus-display');
        const subestatusDisplay = document.getElementById('subestatus-display');

        if (!contenedor || !estatusDisplay || !subestatusDisplay) return;

        if (!this.obligacionSeleccionada) {
            contenedor.classList.add('hidden');
            return;
        }

        // Obtener estatus y subestatus
        const estatus = this.obligacionSeleccionada.estatus || 'No definido';
        const subestatus = this.obligacionSeleccionada.sub_estatus || 'No definido';

        // Obtener clases CSS según estatus
        const estatusClass = this.getEstatusClass(estatus);
        const subestatusClass = this.getSubEstatusClass(subestatus);

        // Obtener etiquetas legibles
        const estatusLabel = this.getEstatusLabel(estatus);
        const subestatusLabel = subestatus;

        // Actualizar HTML
        estatusDisplay.className = `inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide status-pill ${estatusClass}`;
        estatusDisplay.textContent = estatusLabel;

        subestatusDisplay.className = `inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide status-pill ${subestatusClass}`;
        subestatusDisplay.textContent = subestatusLabel;

        // Mostrar contenedor
        contenedor.classList.remove('hidden');
    }

    /**
     * Obtener etiqueta legible para estatus
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
        return labels[estatus?.toLowerCase()] || estatus || 'No definido';
    }

    /**
     * Obtener clase CSS para estatus
     */
    getEstatusClass(estatus) {
        const estatusLower = String(estatus || '').toLowerCase();
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
        return classes[estatusLower] || 'status-pendiente';
    }

    /**
     * Obtener clase CSS para subestatus
     */
    getSubEstatusClass(subEstatus) {
        if (!subEstatus) return 'status-pendiente';
        
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
            return 'status-pendiente';
        }
    }

    /**
     * Cargar archivos de una obligación
     */
    async cargarArchivos(obligacionId) {
        try {
            this.archivos = await this.archivosService.obtenerArchivos(obligacionId);
            this.renderArchivos();
        } catch (error) {
            console.error('Error al cargar archivos:', error);
            Utils.showNotification('Error al cargar archivos', 'error');
        }
    }

    /**
     * Renderizar tabla de archivos
     */
    renderArchivos() {
        const tbody = document.getElementById('tabla-archivos');
        const contador = document.getElementById('contador-archivos');
        
        if (!tbody) return;

        if (this.archivos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-8 text-center text-sm text-gray-500">
                        No hay archivos cargados para este folio
                    </td>
                </tr>
            `;
            if (contador) contador.textContent = '0 Archivos';
            return;
        }

        if (contador) contador.textContent = `${this.archivos.length} Archivo${this.archivos.length !== 1 ? 's' : ''}`;

        tbody.innerHTML = this.archivos.map(archivo => {
            const fechaCarga = Utils.formatDate(archivo.fecha_subida, 'DD/MM/YYYY');
            const icono = this.getIconoArchivo(archivo.tipo);
            const estadoBadge = this.getEstadoBadge(archivo.estado);
            const acciones = this.getAccionesArchivo(archivo);

            return `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-3">
                            <span class="material-symbols-outlined ${icono.color}">${icono.nombre}</span>
                            <div class="flex flex-col">
                                <span class="text-sm font-semibold">${archivo.nombre}</span>
                                <span class="text-[10px] text-gray-400 uppercase font-medium">${this.formatearTamaño(archivo.tamaño)}</span>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-600 font-medium">${fechaCarga}</td>
                    <td class="px-6 py-4 text-sm text-gray-600 font-medium">${archivo.usuario_subio || 'Usuario'}</td>
                    <td class="px-6 py-4 text-center">
                        ${estadoBadge}
                    </td>
                    <td class="px-6 py-4 text-right">
                        <div class="flex justify-end gap-2">
                            ${acciones}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Agregar event listeners a los botones
        this.attachActionListeners();
        
        // Actualizar estado del botón enviar escrito
        this.actualizarEstadoBotonEnviar();
    }

    /**
     * Obtener icono según tipo de archivo
     */
    getIconoArchivo(tipo) {
        if (tipo && tipo.includes('pdf')) {
            return { nombre: 'picture_as_pdf', color: 'text-red-500' };
        }
        if (tipo && (tipo.includes('image') || tipo.includes('png') || tipo.includes('jpeg') || tipo.includes('jpg'))) {
            return { nombre: 'image', color: 'text-blue-500' };
        }
        return { nombre: 'description', color: 'text-gray-500' };
    }

    /**
     * Obtener badge de estado
     */
    getEstadoBadge(estado) {
        const estados = {
            'pendiente_revision': { 
                texto: 'Pendiente', 
                clases: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' 
            },
            'aprobado': { 
                texto: 'Aprobado', 
                clases: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
            },
            'rechazado': { 
                texto: 'Rechazado', 
                clases: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
            }
        };

        const estadoInfo = estados[estado] || estados['pendiente_revision'];
        return `
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${estadoInfo.clases}">
                ${estadoInfo.texto}
            </span>
        `;
    }

    /**
     * Obtener acciones según estado del archivo
     */
    getAccionesArchivo(archivo) {
        if (archivo.estado === 'pendiente_revision') {
            return `
                <button class="btn-aprobar w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-colors border border-emerald-100" 
                        data-archivo-id="${archivo.id}" title="Aprobar">
                    <span class="material-symbols-outlined text-lg">check</span>
                </button>
                <button class="btn-rechazar w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-primary hover:bg-primary hover:text-white transition-colors border border-red-100" 
                        data-archivo-id="${archivo.id}" title="Rechazar">
                    <span class="material-symbols-outlined text-lg">close</span>
                </button>
            `;
        }
        
        return `
            <button class="btn-ver w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors" 
                    data-archivo-id="${archivo.id}" title="Ver">
                <span class="material-symbols-outlined text-lg">visibility</span>
            </button>
        `;
    }

    /**
     * Adjuntar event listeners a los botones de acción
     */
    attachActionListeners() {
        // Botones aprobar
        document.querySelectorAll('.btn-aprobar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const archivoId = e.currentTarget.dataset.archivoId;
                this.aprobarArchivo(archivoId);
            });
        });

        // Botones rechazar
        document.querySelectorAll('.btn-rechazar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const archivoId = e.currentTarget.dataset.archivoId;
                this.rechazarArchivo(archivoId);
            });
        });

        // Botones ver
        document.querySelectorAll('.btn-ver').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const archivoId = e.currentTarget.dataset.archivoId;
                this.verArchivo(archivoId);
            });
        });
    }

    /**
     * Verificar si se pueden cargar archivos según estatus y subestatus
     */
    puedeCargarArchivos() {
        if (!this.obligacionSeleccionada) return false;
        
        // Normalizar estatus y subestatus para comparación (case-insensitive)
        const estatus = String(this.obligacionSeleccionada.estatus || '').trim();
        const subestatus = String(this.obligacionSeleccionada.sub_estatus || '').trim();
        
        return estatus.toLowerCase() === 'recordatorio' && 
               subestatus.toLowerCase() === 'sin respuesta';
    }

    /**
     * Actualizar estado del botón "Cargar nuevo archivo" según estatus y subestatus
     */
    actualizarEstadoBotonCargar() {
        const btnCargar = document.getElementById('btn-cargar-archivo');
        const dropZone = document.getElementById('drop-zone');
        
        if (!btnCargar) return;

        const puedeCargar = this.puedeCargarArchivos();

        if (puedeCargar) {
            btnCargar.disabled = false;
            btnCargar.classList.remove('opacity-50', 'cursor-not-allowed');
            btnCargar.classList.add('cursor-pointer');
            if (dropZone) {
                dropZone.style.pointerEvents = 'auto';
                dropZone.style.opacity = '1';
            }
        } else {
            btnCargar.disabled = true;
            btnCargar.classList.add('opacity-50', 'cursor-not-allowed');
            btnCargar.classList.remove('cursor-pointer');
            if (dropZone) {
                dropZone.style.pointerEvents = 'none';
                dropZone.style.opacity = '0.5';
            }
        }
    }

    /**
     * Manejar selección de archivos
     */
    async handleFileSelect(files) {
        if (!this.obligacionSeleccionada) {
            Utils.showNotification('Por favor seleccione un folio primero', 'warning');
            return;
        }

        if (!this.puedeCargarArchivos()) {
            Utils.showNotification('No se pueden cargar archivos en este momento. El estatus debe ser "Recordatorio" y el subestatus "Sin respuesta".', 'warning');
            return;
        }

        for (const file of files) {
            try {
                await this.subirArchivo(file);
            } catch (error) {
                console.error('Error al subir archivo:', error);
                Utils.showNotification(`Error al subir ${file.name}: ${error.message}`, 'error');
            }
        }

        // Recargar archivos después de subir
        await this.cargarArchivos(this.obligacionSeleccionada.id);
        
        // Actualizar estado del botón enviar escrito
        this.actualizarEstadoBotonEnviar();
    }

    /**
     * Subir archivo
     */
    async subirArchivo(file) {
        if (!this.obligacionSeleccionada) {
            throw new Error('No hay obligación seleccionada');
        }

        const btnCargar = document.getElementById('btn-cargar-archivo');
        if (btnCargar) {
            btnCargar.disabled = true;
            btnCargar.textContent = 'Subiendo...';
        }

        try {
            await this.archivosService.subirArchivo(
                this.obligacionSeleccionada.id,
                file,
                ''
            );

            Utils.showNotification(`Archivo ${file.name} subido correctamente`, 'success');

            // Notificar al responsable CN
            if (window.NotificacionesService) {
                const notificacionesService = new NotificacionesService(window.dataAdapter);
                const user = await window.dataAdapter.getCurrentUser();
                await notificacionesService.enviarNotificacionArchivo(
                    this.obligacionSeleccionada.id,
                    {
                        nombre: file.name,
                        tamaño: file.size,
                        tipo: file.type
                    },
                    user,
                    user.area
                );
            }
        } finally {
            if (btnCargar) {
                btnCargar.textContent = '+ Cargar nuevo archivo';
            }
            // Actualizar estado del botón según condiciones actuales
            this.actualizarEstadoBotonCargar();
        }
    }

    /**
     * Aprobar archivo
     */
    async aprobarArchivo(archivoId) {
        if (!this.obligacionSeleccionada) return;

        try {
            await this.cambiarEstadoArchivo(archivoId, 'aprobado');
            Utils.showNotification('Archivo aprobado', 'success');
            await this.cargarArchivos(this.obligacionSeleccionada.id);
        } catch (error) {
            console.error('Error al aprobar archivo:', error);
            Utils.showNotification('Error al aprobar archivo', 'error');
        }
    }

    /**
     * Rechazar archivo
     */
    async rechazarArchivo(archivoId) {
        if (!this.obligacionSeleccionada) return;

        try {
            await this.cambiarEstadoArchivo(archivoId, 'rechazado');
            Utils.showNotification('Archivo rechazado', 'success');
            await this.cargarArchivos(this.obligacionSeleccionada.id);
        } catch (error) {
            console.error('Error al rechazar archivo:', error);
            Utils.showNotification('Error al rechazar archivo', 'error');
        }
    }

    /**
     * Cambiar estado de un archivo
     */
    async cambiarEstadoArchivo(archivoId, nuevoEstado) {
        const obligacion = await this.dataAdapter.getObligacion(this.obligacionSeleccionada.id);
        if (!obligacion || !obligacion.archivos) {
            throw new Error('Obligación o archivos no encontrados');
        }

        const archivo = obligacion.archivos.find(a => a.id === archivoId);
        if (!archivo) {
            throw new Error('Archivo no encontrado');
        }

        archivo.estado = nuevoEstado;
        archivo.fecha_revision = new Date().toISOString();
        const user = await window.dataAdapter.getCurrentUser();
        archivo.usuario_reviso = user.nombre || 'Usuario';

        obligacion.updated_at = new Date().toISOString();
        await this.dataAdapter.saveObligacion(obligacion);

        // Registrar en bitácora
        if (window.BitacoraService) {
            const bitacoraService = new BitacoraService(this.dataAdapter);
            await bitacoraService.registrarEvento(
                this.obligacionSeleccionada.id,
                nuevoEstado === 'aprobado' ? 'archivo_aprobado' : 'archivo_rechazado',
                nuevoEstado === 'aprobado' ? 'Archivo aprobado' : 'Archivo rechazado',
                `Archivo "${archivo.nombre}" ${nuevoEstado === 'aprobado' ? 'aprobado' : 'rechazado'} por ${user.nombre || 'Usuario'}`,
                { estado: archivo.estado },
                { estado: nuevoEstado },
                null
            );
        }
    }

    /**
     * Ver archivo
     */
    async verArchivo(archivoId) {
        try {
            await this.archivosService.descargarArchivo(this.obligacionSeleccionada.id, archivoId);
        } catch (error) {
            console.error('Error al ver archivo:', error);
            Utils.showNotification('Error al descargar archivo', 'error');
        }
    }

    /**
     * Actualizar estado del botón "Enviar Escrito" según archivos nuevos
     */
    actualizarEstadoBotonEnviar() {
        const btnEnviar = document.getElementById('btn-enviar-escrito');
        if (!btnEnviar) return;

        // Verificar si hay al menos un archivo nuevo (pendiente_revision)
        const archivosNuevos = this.archivos.filter(a => a.estado === 'pendiente_revision');
        const tieneArchivosNuevos = archivosNuevos.length > 0 && this.obligacionSeleccionada;

        if (tieneArchivosNuevos) {
            btnEnviar.disabled = false;
            btnEnviar.classList.remove('opacity-50', 'cursor-not-allowed');
            btnEnviar.classList.add('cursor-pointer');
        } else {
            btnEnviar.disabled = true;
            btnEnviar.classList.add('opacity-50', 'cursor-not-allowed');
            btnEnviar.classList.remove('cursor-pointer');
        }
    }

    /**
     * Enviar escrito al responsable CN
     */
    async enviarEscrito() {
        if (!this.obligacionSeleccionada) {
            Utils.showNotification('Por favor seleccione un folio primero', 'warning');
            return;
        }

        const archivosNuevos = this.archivos.filter(a => a.estado === 'pendiente_revision');
        
        if (archivosNuevos.length === 0) {
            Utils.showNotification('No hay escritos nuevas para enviar', 'info');
            return;
        }

        const confirmar = await Utils.confirm(`¿Está seguro de enviar ${archivosNuevos.length} escrito(s) nueva(s) al responsable CN para verificación? Esta acción cambiará el estatus a "Recordatorio" y el subestatus a "Pendiente (cn)".`);
        if (!confirmar) return;

        try {
            // Obtener obligación actualizada
            const obligacion = await window.dataAdapter.getObligacion(this.obligacionSeleccionada.id);
            if (!obligacion) {
                throw new Error('Obligación no encontrada');
            }

            // Cambiar estatus y subestatus
            obligacion.estatus = 'Recordatorio';
            obligacion.sub_estatus = 'Pendiente (cn)';
            obligacion.updated_at = new Date().toISOString();

            // Guardar obligación actualizada
            await window.dataAdapter.saveObligacion(obligacion);

            // Actualizar obligación seleccionada en memoria
            this.obligacionSeleccionada.estatus = 'Recordatorio';
            this.obligacionSeleccionada.sub_estatus = 'Pendiente (cn)';

            // Registrar en bitácora
            if (window.BitacoraService) {
                const bitacoraService = new BitacoraService(window.dataAdapter);
                const user = await window.dataAdapter.getCurrentUser();
                await bitacoraService.registrarEvento(
                    obligacion.id,
                    'archivo_subido',
                    'Escrito enviada para verificación',
                    `${archivosNuevos.length} escrito(s) enviada(s) para verificación por ${user.nombre || 'Usuario'}. Estatus cambiado a "Recordatorio" y subestatus a "Pendiente (cn)". Se envió notificación al responsable CN.`,
                    { estatus: obligacion.estatus, sub_estatus: obligacion.sub_estatus },
                    { estatus: 'Recordatorio', sub_estatus: 'Pendiente (cn)' },
                    archivosNuevos.map(a => a.id)
                );
            }

            // Enviar notificación al responsable CN
            if (window.NotificacionesService) {
                const notificacionesService = new NotificacionesService(window.dataAdapter);
                await notificacionesService.enviarNotificacionVerificacionEscrito(obligacion.id, archivosNuevos);
            }

            Utils.showNotification(`${archivosNuevos.length} escrito(s) enviada(s) correctamente. Notificación enviada al responsable CN para verificación.`, 'success');
            
            // Desactivar botón inmediatamente después de enviar
            const btnEnviar = document.getElementById('btn-enviar-escrito');
            if (btnEnviar) {
                btnEnviar.disabled = true;
                btnEnviar.classList.add('opacity-50', 'cursor-not-allowed');
                btnEnviar.classList.remove('cursor-pointer');
            }
            
            // Recargar archivos
            await this.cargarArchivos(this.obligacionSeleccionada.id);
            
            // Actualizar estado de los otros botones
            this.actualizarEstadoBotonAceptar();
            this.actualizarEstadoBotonRechazar();
            this.actualizarEstadoBotonCargar();
            
            // Actualizar visualización de estatus y subestatus
            this.mostrarEstatusSubestatus();
        } catch (error) {
            console.error('Error al enviar escrito:', error);
            Utils.showNotification('Error al enviar escrito', 'error');
        }
    }

    /**
     * Actualizar estado del botón "Aceptar Escrito" según estatus y subestatus
     */
    actualizarEstadoBotonAceptar() {
        const btnAceptar = document.getElementById('btn-aceptar-escrito');
        if (!btnAceptar) return;

        // Verificar si la obligación cumple las condiciones
        const puedeAceptar = this.obligacionSeleccionada && 
                            this.obligacionSeleccionada.estatus === 'Recordatorio' && 
                            this.obligacionSeleccionada.sub_estatus === 'Pendiente (cn)';

        if (puedeAceptar) {
            btnAceptar.disabled = false;
            btnAceptar.classList.remove('opacity-50', 'cursor-not-allowed');
            btnAceptar.classList.add('cursor-pointer');
        } else {
            btnAceptar.disabled = true;
            btnAceptar.classList.add('opacity-50', 'cursor-not-allowed');
            btnAceptar.classList.remove('cursor-pointer');
        }
    }

    /**
     * Aceptar todas las escritos pendientes del folio
     */
    async aceptarTodasEscritos() {
        if (!this.obligacionSeleccionada) {
            Utils.showNotification('Por favor seleccione un folio primero', 'warning');
            return;
        }

        // Verificar que el estatus y subestatus sean correctos
        if (this.obligacionSeleccionada.estatus !== 'Recordatorio' || 
            this.obligacionSeleccionada.sub_estatus !== 'Pendiente (cn)') {
            Utils.showNotification('Esta acción solo está disponible cuando el estatus es "Recordatorio" y el subestatus es "Pendiente (cn)"', 'warning');
            return;
        }

        const archivosPendientes = this.archivos.filter(a => a.estado === 'pendiente_revision');
        
        if (archivosPendientes.length === 0) {
            Utils.showNotification('No hay escritos pendientes para aprobar', 'info');
            return;
        }

        const confirmar = await Utils.confirm(`¿Está seguro de aprobar ${archivosPendientes.length} escrito(s) pendiente(s)? Esta acción cambiará el estatus a "Solicitud" y el subestatus a "Pendiente (juridico)", y se enviará una notificación al responsable jurídico.`);
        if (!confirmar) return;

        try {
            // Obtener obligación actualizada
            const obligacion = await window.dataAdapter.getObligacion(this.obligacionSeleccionada.id);
            if (!obligacion) {
                throw new Error('Obligación no encontrada');
            }

            // Aprobar todas las escritos pendientes
            let aprobados = 0;
            for (const archivo of archivosPendientes) {
                try {
                    await this.cambiarEstadoArchivo(archivo.id, 'aprobado');
                    aprobados++;
                } catch (error) {
                    console.error(`Error al aprobar archivo ${archivo.id}:`, error);
                }
            }

            // Cambiar estatus y subestatus
            obligacion.estatus = 'Solicitud';
            obligacion.sub_estatus = 'Pendiente (juridico)';
            obligacion.updated_at = new Date().toISOString();

            // Guardar obligación actualizada
            await window.dataAdapter.saveObligacion(obligacion);

            // Actualizar obligación seleccionada en memoria
            this.obligacionSeleccionada.estatus = 'Solicitud';
            this.obligacionSeleccionada.sub_estatus = 'Pendiente (juridico)';

            // Registrar en bitácora
            if (window.BitacoraService) {
                const bitacoraService = new BitacoraService(window.dataAdapter);
                const user = await window.dataAdapter.getCurrentUser();
                await bitacoraService.registrarEvento(
                    obligacion.id,
                    'cambio_estatus',
                    'Escritos aceptadas - Cambio de estatus',
                    `Escritos aceptadas. Estatus cambiado de "Recordatorio" a "Solicitud" y subestatus de "Pendiente (cn)" a "Pendiente (juridico)" por ${user.nombre || 'Usuario'}. Se envió notificación al responsable jurídico.`,
                    { estatus: 'Recordatorio', sub_estatus: 'Pendiente (cn)' },
                    { estatus: 'Solicitud', sub_estatus: 'Pendiente (juridico)' },
                    null
                );
            }

            // Enviar notificación al responsable jurídico
            if (window.NotificacionesService) {
                const notificacionesService = new NotificacionesService(window.dataAdapter);
                await notificacionesService.enviarNotificacionJuridico(obligacion.id);
            }

            Utils.showNotification(`${aprobados} escrito(s) aprobada(s) correctamente. Estatus actualizado y notificación enviada al responsable jurídico.`, 'success');
            
            // Recargar archivos y actualizar estado de los botones
            await this.cargarArchivos(this.obligacionSeleccionada.id);
            this.actualizarEstadoBotonAceptar();
            this.actualizarEstadoBotonRechazar();
            
            // Actualizar visualización de estatus y subestatus
            this.mostrarEstatusSubestatus();
        } catch (error) {
            console.error('Error al aprobar escritos:', error);
            Utils.showNotification('Error al aprobar escritos', 'error');
        }
    }

    /**
     * Actualizar estado del botón "Rechazar Escrito" según estatus y subestatus
     */
    actualizarEstadoBotonRechazar() {
        const btnRechazar = document.getElementById('btn-rechazar-escrito');
        if (!btnRechazar) return;

        // Verificar si la obligación cumple las condiciones
        const puedeRechazar = this.obligacionSeleccionada && 
                             this.obligacionSeleccionada.estatus === 'Recordatorio' && 
                             this.obligacionSeleccionada.sub_estatus === 'Pendiente (cn)';

        if (puedeRechazar) {
            btnRechazar.disabled = false;
            btnRechazar.classList.remove('opacity-50', 'cursor-not-allowed');
            btnRechazar.classList.add('cursor-pointer');
        } else {
            btnRechazar.disabled = true;
            btnRechazar.classList.add('opacity-50', 'cursor-not-allowed');
            btnRechazar.classList.remove('cursor-pointer');
        }
    }

    /**
     * Rechazar todas las escritos pendientes del folio
     */
    async rechazarTodasEscritos() {
        if (!this.obligacionSeleccionada) {
            Utils.showNotification('Por favor seleccione un folio primero', 'warning');
            return;
        }

        // Verificar que el estatus y subestatus sean correctos
        if (this.obligacionSeleccionada.estatus !== 'Recordatorio' || 
            this.obligacionSeleccionada.sub_estatus !== 'Pendiente (cn)') {
            Utils.showNotification('Esta acción solo está disponible cuando el estatus es "Recordatorio" y el subestatus es "Pendiente (cn)"', 'warning');
            return;
        }

        const archivosPendientes = this.archivos.filter(a => a.estado === 'pendiente_revision');
        
        if (archivosPendientes.length === 0) {
            Utils.showNotification('No hay escritos pendientes para rechazar', 'info');
            return;
        }

        const confirmar = await Utils.confirm(`¿Está seguro de rechazar ${archivosPendientes.length} escrito(s) pendiente(s)? Esta acción cambiará el subestatus a "Sin respuesta" y se enviará una notificación al área responsable.`);
        if (!confirmar) return;

        try {
            // Obtener obligación actualizada
            const obligacion = await window.dataAdapter.getObligacion(this.obligacionSeleccionada.id);
            if (!obligacion) {
                throw new Error('Obligación no encontrada');
            }

            // Rechazar todas las escritos pendientes
            let rechazados = 0;
            for (const archivo of archivosPendientes) {
                try {
                    await this.cambiarEstadoArchivo(archivo.id, 'rechazado');
                    rechazados++;
                } catch (error) {
                    console.error(`Error al rechazar archivo ${archivo.id}:`, error);
                }
            }

            // Cambiar subestatus (el estatus se mantiene en "Recordatorio")
            obligacion.estatus = 'Recordatorio';
            obligacion.sub_estatus = 'Sin respuesta';
            obligacion.updated_at = new Date().toISOString();

            // Guardar obligación actualizada
            await window.dataAdapter.saveObligacion(obligacion);

            // Actualizar obligación seleccionada en memoria
            this.obligacionSeleccionada.estatus = 'Recordatorio';
            this.obligacionSeleccionada.sub_estatus = 'Sin respuesta';

            // Registrar en bitácora
            if (window.BitacoraService) {
                const bitacoraService = new BitacoraService(window.dataAdapter);
                const user = await window.dataAdapter.getCurrentUser();
                await bitacoraService.registrarEvento(
                    obligacion.id,
                    'cambio_estatus',
                    'Escritos rechazadas - Cambio de subestatus',
                    `Escritos rechazadas. Subestatus cambiado de "Pendiente (cn)" a "Sin respuesta" por ${user.nombre || 'Usuario'}. Se envió notificación al área responsable.`,
                    { estatus: 'Recordatorio', sub_estatus: 'Pendiente (cn)' },
                    { estatus: 'Recordatorio', sub_estatus: 'Sin respuesta' },
                    null
                );
            }

            // Enviar notificación al área responsable
            if (window.NotificacionesService) {
                const notificacionesService = new NotificacionesService(window.dataAdapter);
                await notificacionesService.enviarNotificacionRechazoEscrito(obligacion.id);
            }

            Utils.showNotification(`${rechazados} escrito(s) rechazada(s) correctamente. Subestatus actualizado y notificación enviada al área responsable.`, 'success');
            
            // Recargar archivos y actualizar estado de los botones
            await this.cargarArchivos(this.obligacionSeleccionada.id);
            this.actualizarEstadoBotonRechazar();
            this.actualizarEstadoBotonCargar();
            
            // Actualizar visualización de estatus y subestatus
            this.mostrarEstatusSubestatus();
        } catch (error) {
            console.error('Error al rechazar escritos:', error);
            Utils.showNotification('Error al rechazar escritos', 'error');
        }
    }

    /**
     * Formatear tamaño de archivo
     */
    formatearTamaño(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}

// Inicializar cuando el DOM esté listo
function initializeGestionEscritoController() {
    if (window.dataAdapter && !window.gestionEscritoController) {
        const controller = new GestionEscritoController();
        controller.init();
        window.gestionEscritoController = controller;
    }
}

// Intentar inicializar inmediatamente o esperar evento
if (window.dataAdapter) {
    initializeGestionEscritoController();
} else {
    document.addEventListener('alertia-ready', initializeGestionEscritoController);
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initializeGestionEscritoController, 500);
    });
}

if (typeof window !== 'undefined') {
    window.GestionEscritoController = GestionEscritoController;
}
