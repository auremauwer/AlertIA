/**
 * Controlador de Gestión de Evidencias
 * Maneja la carga, visualización y aprobación/rechazo de evidencias por obligación
 */
class GestionEvidenciaController {
    constructor() {
        this.dataAdapter = null;
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

        // Guardar referencia al dataAdapter
        this.dataAdapter = window.dataAdapter;

        // Inicializar servicios
        this.obligacionesService = new ObligacionesService(this.dataAdapter);
        
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
        this.archivosService = new ArchivosService(this.dataAdapter, this.fileStorageService);

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

        // Campo de búsqueda de folio
        const buscarFolio = document.getElementById('buscar-folio');
        if (buscarFolio) {
            // Buscar al presionar Enter
            buscarFolio.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.buscarFolioPorId();
                }
            });
            // Buscar al perder el foco (opcional, se puede quitar si no se desea)
            buscarFolio.addEventListener('blur', () => {
                if (buscarFolio.value.trim()) {
                    this.buscarFolioPorId();
                }
            });
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

        // Botones de aceptar/rechazar evidencia
        const btnAceptar = document.getElementById('btn-aceptar-evidencia');
        const btnRechazar = document.getElementById('btn-rechazar-evidencia');
        if (btnAceptar) {
            btnAceptar.addEventListener('click', () => this.aceptarTodasEvidencias());
        }
        if (btnRechazar) {
            btnRechazar.addEventListener('click', () => this.rechazarTodasEvidencias());
        }

        // Botón enviar evidencia
        const btnEnviar = document.getElementById('btn-enviar-evidencia');
        if (btnEnviar) {
            btnEnviar.addEventListener('click', () => this.enviarEvidencia());
        }
    }

    /**
     * Cargar obligaciones en el selector
     */
    async loadObligaciones() {
        try {
            const todasObligaciones = await this.obligacionesService.getAll();
            
            // Filtrar solo obligaciones con estatus=Recordatorio (cualquier subestatus)
            this.obligaciones = todasObligaciones.filter(obl => {
                const estatus = String(obl.estatus || '').trim();
                return estatus.toLowerCase() === 'recordatorio';
            });
            
            const selectFolio = document.getElementById('folio');
            if (!selectFolio) return;

            // Limpiar opciones existentes (excepto la primera)
            while (selectFolio.children.length > 1) {
                selectFolio.removeChild(selectFolio.lastChild);
            }

            // Agregar obligaciones filtradas al selector
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
    async onFolioChange() {
        const selectFolio = document.getElementById('folio');
        if (!selectFolio) return;

        const obligacionId = selectFolio.value;
        if (obligacionId) {
            this.obligacionSeleccionada = this.obligaciones.find(obl => obl.id === obligacionId);
            // Cargar archivos automáticamente cuando se selecciona un folio
            await this.cargarArchivos(obligacionId);
        } else {
            this.obligacionSeleccionada = null;
            // Limpiar tabla de archivos si no hay folio seleccionado
            const tbody = document.getElementById('tabla-archivos');
            const contador = document.getElementById('contador-archivos');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="px-6 py-8 text-center text-sm text-gray-500">
                            Seleccione un folio para ver los archivos cargados
                        </td>
                    </tr>
                `;
            }
            if (contador) contador.textContent = '0 Archivos';
            this.archivos = [];
        }
        
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

        // Cargar archivos de la obligación (asegurar que se carguen y muestren)
        try {
            await this.cargarArchivos(obligacionId);
            
            // Mostrar notificación si hay archivos cargados
            if (this.archivos.length > 0) {
                Utils.showNotification(`${this.archivos.length} archivo(s) encontrado(s) para este folio`, 'success');
            } else {
                Utils.showNotification('No hay archivos cargados para este folio', 'info');
            }
        } catch (error) {
            console.error('Error al cargar archivos:', error);
            Utils.showNotification('Error al cargar archivos', 'error');
        }
        
        // Actualizar estado de los botones
        this.actualizarEstadoBotonAceptar();
        this.actualizarEstadoBotonRechazar();
        this.actualizarEstadoBotonEnviar();
        this.actualizarEstadoBotonCargar();
    }

    /**
     * Buscar folio por ID (sin restricciones de estatus)
     */
    async buscarFolioPorId() {
        const buscarFolio = document.getElementById('buscar-folio');
        if (!buscarFolio) return;

        const folioBuscado = buscarFolio.value.trim();
        if (!folioBuscado) {
            Utils.showNotification('Por favor ingrese un ID de folio', 'warning');
            return;
        }

        try {
            // Obtener todas las obligaciones sin filtro de estatus
            const todasObligaciones = await this.obligacionesService.getAll();
            
            // Buscar por ID o ID oficial (case-insensitive)
            const obligacionEncontrada = todasObligaciones.find(obl => {
                const id = String(obl.id || '').trim();
                const idOficial = String(obl.id_oficial || '').trim();
                const busqueda = folioBuscado.toLowerCase();
                return id.toLowerCase() === busqueda || 
                       idOficial.toLowerCase() === busqueda ||
                       id.toLowerCase().includes(busqueda) ||
                       idOficial.toLowerCase().includes(busqueda);
            });

            if (!obligacionEncontrada) {
                Utils.showNotification(`No se encontró ningún folio con ID "${folioBuscado}"`, 'warning');
                return;
            }

            // Establecer como obligación seleccionada
            this.obligacionSeleccionada = obligacionEncontrada;

            // Actualizar el selector de folio si la obligación está en la lista filtrada
            const selectFolio = document.getElementById('folio');
            if (selectFolio) {
                const optionEncontrada = Array.from(selectFolio.options).find(opt => opt.value === obligacionEncontrada.id);
                if (optionEncontrada) {
                    selectFolio.value = obligacionEncontrada.id;
                } else {
                    // Si no está en la lista, agregarla temporalmente
                    const option = document.createElement('option');
                    option.value = obligacionEncontrada.id;
                    const nombre = obligacionEncontrada.descripcion || obligacionEncontrada.nombre || 'Sin descripción';
                    option.textContent = `${obligacionEncontrada.id_oficial || obligacionEncontrada.id} - ${nombre}`;
                    selectFolio.appendChild(option);
                    selectFolio.value = obligacionEncontrada.id;
                }
            }

            // Cargar archivos de la obligación encontrada
            await this.cargarArchivos(obligacionEncontrada.id);
            
            // Mostrar notificación
            if (this.archivos.length > 0) {
                Utils.showNotification(`Folio encontrado: ${obligacionEncontrada.id_oficial || obligacionEncontrada.id}. ${this.archivos.length} archivo(s) encontrado(s)`, 'success');
            } else {
                Utils.showNotification(`Folio encontrado: ${obligacionEncontrada.id_oficial || obligacionEncontrada.id}. No hay archivos cargados`, 'info');
            }

            // Actualizar estado de los botones
            this.actualizarEstadoBotonAceptar();
            this.actualizarEstadoBotonRechazar();
            this.actualizarEstadoBotonEnviar();
            this.actualizarEstadoBotonCargar();
        } catch (error) {
            console.error('Error al buscar folio:', error);
            Utils.showNotification('Error al buscar folio', 'error');
        }
    }

    /**
     * Cargar archivos de una obligación
     */
    async cargarArchivos(obligacionId) {
        try {
            this.archivos = await this.archivosService.obtenerArchivos(obligacionId);
            this.renderArchivos();
            
            // Actualizar estado de los botones después de cargar archivos
            this.actualizarEstadoBotonAceptar();
            this.actualizarEstadoBotonRechazar();
        } catch (error) {
            console.error('Error al cargar archivos:', error);
            Utils.showNotification('Error al cargar archivos', 'error');
        }
    }

    /**
     * Actualizar estatus y subestatus cuando hay archivos cargados
     */
    async actualizarEstatusConArchivos() {
        if (!this.obligacionSeleccionada || !this.archivos || this.archivos.length === 0) {
            return;
        }

        try {
            // Obtener obligación actualizada
            const obligacion = await this.dataAdapter.getObligacion(this.obligacionSeleccionada.id);
            if (!obligacion) {
                return;
            }

            // Solo cambiar si no está ya en el estado correcto
            const estatusActual = String(obligacion.estatus || '').trim();
            const subestatusActual = String(obligacion.sub_estatus || '').trim();

            if (estatusActual.toLowerCase() !== 'recordatorio' || 
                subestatusActual.toLowerCase() !== 'pendiente (cn)') {
                
                obligacion.estatus = 'Recordatorio';
                obligacion.sub_estatus = 'Pendiente (cn)';
                obligacion.updated_at = new Date().toISOString();

                // Guardar obligación actualizada
                await this.dataAdapter.saveObligacion(obligacion);

                // Actualizar obligación seleccionada en memoria
                this.obligacionSeleccionada.estatus = 'Recordatorio';
                this.obligacionSeleccionada.sub_estatus = 'Pendiente (cn)';

                // Registrar en bitácora
                if (window.BitacoraService) {
                    const bitacoraService = new BitacoraService(this.dataAdapter);
                    const user = await this.dataAdapter.getCurrentUser();
                    await bitacoraService.registrarEvento(
                        obligacion.id,
                        'cambio_estatus',
                        'Estatus actualizado por carga de archivos',
                        `Estatus cambiado a "Recordatorio" y subestatus a "Pendiente (cn)" automáticamente al cargar ${this.archivos.length} archivo(s)`,
                        { estatus: estatusActual, sub_estatus: subestatusActual },
                        { estatus: 'Recordatorio', sub_estatus: 'Pendiente (cn)' },
                        null
                    );
                }

                // Los estatus y subestatus ya no se muestran en la UI según requerimientos anteriores
            }
        } catch (error) {
            console.error('Error al actualizar estatus:', error);
            // No mostrar error al usuario, solo loguear
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
        
        // Actualizar estado del botón enviar evidencia
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
        
        if (archivo.estado === 'aprobado') {
            return `
                <div class="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 cursor-default" 
                     title="Aprobado">
                    <span class="material-symbols-outlined text-lg">check</span>
                </div>
            `;
        }
        
        // Para archivos rechazados, mostrar tache en gris y botón de eliminar
        if (archivo.estado === 'rechazado') {
            return `
                <div class="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 cursor-default" 
                     title="Rechazado">
                    <span class="material-symbols-outlined text-lg">close</span>
                </div>
                <button class="btn-eliminar w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-colors border border-red-100" 
                        data-archivo-id="${archivo.id}" title="Eliminar">
                    <span class="material-symbols-outlined text-lg">delete</span>
                </button>
            `;
        }
        
        // Para otros estados, mostrar botón de ver
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

        // Botones ver (solo para archivos rechazados, no para aprobados)
        document.querySelectorAll('.btn-ver').forEach(btn => {
            // Solo agregar listener si el botón no está deshabilitado
            if (!btn.disabled) {
                btn.addEventListener('click', (e) => {
                    const archivoId = e.currentTarget.dataset.archivoId;
                    this.verArchivo(archivoId);
                });
            }
        });

        // Botones eliminar
        document.querySelectorAll('.btn-eliminar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const archivoId = e.currentTarget.dataset.archivoId;
                this.eliminarArchivo(archivoId);
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
        
        // Si hay al menos un archivo, cambiar estatus y subestatus automáticamente
        if (this.archivos.length > 0) {
            await this.actualizarEstatusConArchivos();
        }
        
        // Actualizar estado de los botones
        this.actualizarEstadoBotonEnviar();
        this.actualizarEstadoBotonAceptar();
        this.actualizarEstadoBotonRechazar();
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

        // Capturar estado anterior antes de cambiarlo
        const estadoAnterior = archivo.estado || 'pendiente_revision';

        archivo.estado = nuevoEstado;
        archivo.fecha_revision = new Date().toISOString();
        
        if (!this.dataAdapter) {
            throw new Error('dataAdapter no está inicializado');
        }
        
        const user = await this.dataAdapter.getCurrentUser();
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
                { estado: estadoAnterior },
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
     * Eliminar archivo
     */
    async eliminarArchivo(archivoId) {
        if (!this.obligacionSeleccionada) return;

        const archivo = this.archivos.find(a => a.id === archivoId);
        if (!archivo) {
            Utils.showNotification('Archivo no encontrado', 'error');
            return;
        }

        const confirmar = await Utils.confirm(`¿Está seguro de eliminar el archivo "${archivo.nombre}"? Esta acción no se puede deshacer.`);
        if (!confirmar) return;

        try {
            await this.archivosService.eliminarArchivo(this.obligacionSeleccionada.id, archivoId);
            Utils.showNotification('Archivo eliminado correctamente', 'success');
            await this.cargarArchivos(this.obligacionSeleccionada.id);
        } catch (error) {
            console.error('Error al eliminar archivo:', error);
            Utils.showNotification('Error al eliminar archivo', 'error');
        }
    }

    /**
     * Actualizar estado del botón "Enviar Evidencia" según archivos nuevos
     */
    actualizarEstadoBotonEnviar() {
        const btnEnviar = document.getElementById('btn-enviar-evidencia');
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
     * Enviar evidencia al responsable CN
     */
    async enviarEvidencia() {
        if (!this.obligacionSeleccionada) {
            Utils.showNotification('Por favor seleccione un folio primero', 'warning');
            return;
        }

        const archivosNuevos = this.archivos.filter(a => a.estado === 'pendiente_revision');
        
        if (archivosNuevos.length === 0) {
            Utils.showNotification('No hay evidencias nuevas para enviar', 'info');
            return;
        }

        const confirmar = await Utils.confirm(`¿Está seguro de enviar ${archivosNuevos.length} evidencia(s) nueva(s) al responsable CN para verificación? Esta acción cambiará el estatus a "Recordatorio" y el subestatus a "Pendiente (cn)".`);
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
                    'Evidencia enviada para verificación',
                    `${archivosNuevos.length} evidencia(s) enviada(s) para verificación por ${user.nombre || 'Usuario'}. Estatus cambiado a "Recordatorio" y subestatus a "Pendiente (cn)". Se envió notificación al responsable CN.`,
                    { estatus: obligacion.estatus, sub_estatus: obligacion.sub_estatus },
                    { estatus: 'Recordatorio', sub_estatus: 'Pendiente (cn)' },
                    archivosNuevos.map(a => a.id)
                );
            }

            // Enviar notificación al responsable CN
            if (window.NotificacionesService) {
                const notificacionesService = new NotificacionesService(window.dataAdapter);
                await notificacionesService.enviarNotificacionVerificacionEvidencia(obligacion.id, archivosNuevos);
            }

            Utils.showNotification(`${archivosNuevos.length} evidencia(s) enviada(s) correctamente. Notificación enviada al responsable CN para verificación.`, 'success');
            
            // Desactivar botón inmediatamente después de enviar
            const btnEnviar = document.getElementById('btn-enviar-evidencia');
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
        } catch (error) {
            console.error('Error al enviar evidencia:', error);
            Utils.showNotification('Error al enviar evidencia', 'error');
        }
    }

    /**
     * Actualizar estado del botón "Aceptar Evidencia" según archivos cargados
     */
    actualizarEstadoBotonAceptar() {
        const btnAceptar = document.getElementById('btn-aceptar-evidencia');
        if (!btnAceptar) return;

        // Verificar si hay al menos un archivo cargado
        const tieneArchivos = this.obligacionSeleccionada && 
                             this.archivos && 
                             this.archivos.length > 0;

        if (tieneArchivos) {
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
     * Aceptar todas las evidencias pendientes del folio
     */
    async aceptarTodasEvidencias() {
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
            Utils.showNotification('No hay evidencias pendientes para aprobar', 'info');
            return;
        }

        const confirmar = await Utils.confirm(`¿Está seguro de aprobar ${archivosPendientes.length} evidencia(s) pendiente(s)? Esta acción cambiará el estatus a "Solicitud" y el subestatus a "Pendiente (juridico)", y se enviará una notificación al responsable jurídico.`);
        if (!confirmar) return;

        try {
            // Obtener obligación actualizada
            const obligacion = await window.dataAdapter.getObligacion(this.obligacionSeleccionada.id);
            if (!obligacion) {
                throw new Error('Obligación no encontrada');
            }

            // Aprobar todas las evidencias pendientes
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
                    'Evidencias aceptadas - Cambio de estatus',
                    `Evidencias aceptadas. Estatus cambiado de "Recordatorio" a "Solicitud" y subestatus de "Pendiente (cn)" a "Pendiente (juridico)" por ${user.nombre || 'Usuario'}. Se envió notificación al responsable jurídico.`,
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

            Utils.showNotification(`${aprobados} evidencia(s) aprobada(s) correctamente. Estatus actualizado y notificación enviada al responsable jurídico.`, 'success');
            
            // Recargar archivos y actualizar estado de los botones
            await this.cargarArchivos(this.obligacionSeleccionada.id);
            this.actualizarEstadoBotonAceptar();
            this.actualizarEstadoBotonRechazar();
        } catch (error) {
            console.error('Error al aprobar evidencias:', error);
            Utils.showNotification('Error al aprobar evidencias', 'error');
        }
    }

    /**
     * Actualizar estado del botón "Rechazar Evidencia" según archivos cargados
     */
    actualizarEstadoBotonRechazar() {
        const btnRechazar = document.getElementById('btn-rechazar-evidencia');
        if (!btnRechazar) return;

        // Verificar si hay al menos un archivo cargado
        const tieneArchivos = this.obligacionSeleccionada && 
                             this.archivos && 
                             this.archivos.length > 0;

        if (tieneArchivos) {
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
     * Rechazar todas las evidencias pendientes del folio
     */
    async rechazarTodasEvidencias() {
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
            Utils.showNotification('No hay evidencias pendientes para rechazar', 'info');
            return;
        }

        const confirmar = await Utils.confirm(`¿Está seguro de rechazar ${archivosPendientes.length} evidencia(s) pendiente(s)? Esta acción cambiará el subestatus a "Sin respuesta" y se enviará una notificación al área responsable.`);
        if (!confirmar) return;

        try {
            // Obtener obligación actualizada
            const obligacion = await window.dataAdapter.getObligacion(this.obligacionSeleccionada.id);
            if (!obligacion) {
                throw new Error('Obligación no encontrada');
            }

            // Rechazar todas las evidencias pendientes
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
                    'Evidencias rechazadas - Cambio de subestatus',
                    `Evidencias rechazadas. Subestatus cambiado de "Pendiente (cn)" a "Sin respuesta" por ${user.nombre || 'Usuario'}. Se envió notificación al área responsable.`,
                    { estatus: 'Recordatorio', sub_estatus: 'Pendiente (cn)' },
                    { estatus: 'Recordatorio', sub_estatus: 'Sin respuesta' },
                    null
                );
            }

            // Enviar notificación al área responsable
            if (window.NotificacionesService) {
                const notificacionesService = new NotificacionesService(window.dataAdapter);
                await notificacionesService.enviarNotificacionRechazoEvidencia(obligacion.id);
            }

            Utils.showNotification(`${rechazados} evidencia(s) rechazada(s) correctamente. Subestatus actualizado y notificación enviada al área responsable.`, 'success');
            
            // Recargar archivos y actualizar estado de los botones
            await this.cargarArchivos(this.obligacionSeleccionada.id);
            this.actualizarEstadoBotonRechazar();
            this.actualizarEstadoBotonCargar();
        } catch (error) {
            console.error('Error al rechazar evidencias:', error);
            Utils.showNotification('Error al rechazar evidencias', 'error');
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
function initializeGestionEvidenciaController() {
    if (window.dataAdapter && !window.gestionEvidenciaController) {
        const controller = new GestionEvidenciaController();
        controller.init();
        window.gestionEvidenciaController = controller;
    }
}

// Intentar inicializar inmediatamente o esperar evento
if (window.dataAdapter) {
    initializeGestionEvidenciaController();
} else {
    document.addEventListener('alertia-ready', initializeGestionEvidenciaController);
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initializeGestionEvidenciaController, 500);
    });
}

if (typeof window !== 'undefined') {
    window.GestionEvidenciaController = GestionEvidenciaController;
}
