/**
 * Controlador de Evidencias
 * Maneja la carga y gestión de evidencias por obligación
 */
class EvidenciasController {
    constructor() {
        this.obligacionesService = null;
        this.archivosService = null;
        this.fileStorageService = null;
        this.obligaciones = [];
        this.obligacionActualSubida = null;
        this.archivoSeleccionado = null;
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

        // Obtener usuario actual para filtrar por área
        const user = await window.dataAdapter.getCurrentUser();
        this.usuarioActual = user;

        this.setupEventListeners();
        await this.loadObligaciones();
    }

    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        // Filtros
        const filtroId = document.getElementById('filtro-id');
        const filtroArea = document.getElementById('filtro-area');

        if (filtroId) {
            filtroId.addEventListener('input', () => this.aplicarFiltros());
        }

        if (filtroArea) {
            filtroArea.addEventListener('change', () => this.aplicarFiltros());
        }

        // Modal de subida
        const modal = document.getElementById('modal-subida');
        const cerrarModal = document.getElementById('cerrar-modal');
        const btnCancelar = document.getElementById('btn-cancelar-subida');
        const btnSeleccionar = document.getElementById('btn-seleccionar-archivo');
        const inputArchivo = document.getElementById('input-archivo');
        const dropZone = document.getElementById('drop-zone');
        const formSubida = document.getElementById('form-subida');
        const btnRemover = document.getElementById('btn-remover-archivo');

        if (cerrarModal) {
            cerrarModal.addEventListener('click', () => this.cerrarModal());
        }

        if (btnCancelar) {
            btnCancelar.addEventListener('click', () => this.cerrarModal());
        }

        if (btnSeleccionar) {
            btnSeleccionar.addEventListener('click', () => {
                if (inputArchivo) inputArchivo.click();
            });
        }

        if (inputArchivo) {
            inputArchivo.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.seleccionarArchivo(e.target.files[0]);
                }
            });
        }

        // Drag and drop
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('border-primary', 'bg-red-50');
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('border-primary', 'bg-red-50');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('border-primary', 'bg-red-50');
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    this.seleccionarArchivo(e.dataTransfer.files[0]);
                }
            });
        }

        if (formSubida) {
            formSubida.addEventListener('submit', (e) => {
                e.preventDefault();
                this.subirArchivo();
            });
        }

        if (btnRemover) {
            btnRemover.addEventListener('click', () => {
                this.archivoSeleccionado = null;
                if (inputArchivo) inputArchivo.value = '';
                const archivoSeleccionadoDiv = document.getElementById('archivo-seleccionado');
                if (archivoSeleccionadoDiv) archivoSeleccionadoDiv.classList.add('hidden');
            });
        }

        // Cerrar modal al hacer click fuera
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.cerrarModal();
                }
            });
        }
    }

    /**
     * Cargar obligaciones del área del usuario
     */
    async loadObligaciones() {
        try {
            // Obtener todas las obligaciones
            let todasObligaciones = await this.obligacionesService.getAll();

            // Filtrar por área del usuario si es área (no admin ni responsable CN)
            if (this.usuarioActual && this.usuarioActual.area && this.usuarioActual.rol !== 'administrador' && this.usuarioActual.rol !== 'responsable_cn') {
                todasObligaciones = todasObligaciones.filter(obl => 
                    obl.area && obl.area.toLowerCase() === this.usuarioActual.area.toLowerCase()
                );
            }

            this.obligaciones = todasObligaciones;

            // Cargar opciones de área en el filtro
            this.cargarOpcionesArea();

            // Renderizar obligaciones
            this.renderObligaciones(this.obligaciones);
        } catch (error) {
            console.error('Error al cargar obligaciones:', error);
            Utils.showNotification('Error al cargar obligaciones', 'error');
        }
    }

    /**
     * Cargar opciones de área en el filtro
     */
    cargarOpcionesArea() {
        const filtroArea = document.getElementById('filtro-area');
        if (!filtroArea) return;

        const areas = [...new Set(this.obligaciones.map(obl => obl.area).filter(Boolean))];
        areas.sort();

        // Limpiar opciones existentes (excepto "Todas las áreas")
        while (filtroArea.children.length > 1) {
            filtroArea.removeChild(filtroArea.lastChild);
        }

        areas.forEach(area => {
            const option = document.createElement('option');
            option.value = area;
            option.textContent = area;
            filtroArea.appendChild(option);
        });
    }

    /**
     * Aplicar filtros
     */
    aplicarFiltros() {
        const filtroId = document.getElementById('filtro-id');
        const filtroArea = document.getElementById('filtro-area');

        let filtradas = [...this.obligaciones];

        // Filtro por ID
        if (filtroId && filtroId.value.trim() !== '') {
            const idBusqueda = filtroId.value.trim().toLowerCase();
            filtradas = filtradas.filter(obl => {
                const id = (obl.id || obl.id_oficial || '').toLowerCase();
                return id.includes(idBusqueda);
            });
        }

        // Filtro por área
        if (filtroArea && filtroArea.value !== '') {
            filtradas = filtradas.filter(obl => obl.area === filtroArea.value);
        }

        this.renderObligaciones(filtradas);
    }

    /**
     * Renderizar obligaciones
     */
    renderObligaciones(obligaciones) {
        const container = document.getElementById('obligaciones-container');
        if (!container) return;

        if (obligaciones.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12 text-text-muted">
                    <span class="material-symbols-outlined text-6xl mb-4 block">inbox</span>
                    <p class="text-lg font-semibold">No hay obligaciones disponibles</p>
                    <p class="text-sm mt-2">No se encontraron obligaciones para mostrar</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        // Usar Promise.all para cargar archivos de todas las obligaciones
        Promise.all(obligaciones.map(async (obl) => {
            const archivos = await this.archivosService.obtenerArchivos(obl.id);
            return { obligacion: obl, archivos: archivos };
        })).then(obligacionesConArchivos => {
            obligacionesConArchivos.forEach(({ obligacion: obl, archivos }) => {
                const card = document.createElement('div');
                card.className = 'bg-white border border-border-soft rounded-lg shadow-sm p-6';
                card.dataset.obligacionId = obl.id;

                card.innerHTML = `
                    <div class="flex items-start justify-between mb-4">
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-2">
                                <span class="text-sm font-bold text-primary">${obl.id || obl.id_oficial || '-'}</span>
                                <span class="text-xs text-text-muted bg-gray-100 px-2 py-1 rounded">${obl.area || 'Sin área'}</span>
                            </div>
                            <p class="text-sm font-semibold text-text-main mb-1">${obl.descripcion || obl.nombre || 'Sin descripción'}</p>
                            <p class="text-xs text-text-muted">${obl.regulador || 'Sin regulador'}</p>
                        </div>
                        <button class="btn-subir-evidencia px-4 py-2 bg-primary text-white rounded text-sm font-semibold hover:bg-red-700 transition-colors flex items-center gap-2"
                                data-obligacion-id="${obl.id}">
                            <span class="material-symbols-outlined text-lg">upload</span>
                            Subir Evidencia
                        </button>
                    </div>
                    
                    <div class="archivos-container" data-obligacion-id="${obl.id}">
                        ${archivos.length > 0 ? this.renderArchivos(archivos, obl.id) : '<p class="text-xs text-text-muted italic">No hay archivos subidos</p>'}
                    </div>
                `;

                container.appendChild(card);

                // Agregar event listeners
                const btnSubir = card.querySelector('.btn-subir-evidencia');
                if (btnSubir) {
                    btnSubir.addEventListener('click', () => {
                        this.mostrarModalSubida(obl.id);
                    });
                }

                // Event listeners para descargar y eliminar archivos
                card.querySelectorAll('.btn-descargar-archivo').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const obligacionId = e.currentTarget.dataset.obligacionId;
                        const archivoId = e.currentTarget.dataset.archivoId;
                        this.descargarArchivo(obligacionId, archivoId);
                    });
                });

                card.querySelectorAll('.btn-eliminar-archivo').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const obligacionId = e.currentTarget.dataset.obligacionId;
                        const archivoId = e.currentTarget.dataset.archivoId;
                        this.eliminarArchivo(obligacionId, archivoId);
                    });
                });
            });
        }).catch(error => {
            console.error('Error al cargar archivos:', error);
        });
    }

    /**
     * Renderizar lista de archivos
     */
    renderArchivos(archivos, obligacionId) {
        if (!archivos || archivos.length === 0) {
            return '<p class="text-xs text-text-muted italic">No hay archivos subidos</p>';
        }

        return `
            <div class="space-y-2 mt-4">
                <p class="text-xs font-bold text-text-muted uppercase mb-2">Archivos (${archivos.length})</p>
                ${archivos.map(archivo => `
                    <div class="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
                        <div class="flex items-center gap-3 flex-1 min-w-0">
                            <span class="material-symbols-outlined text-gray-500 flex-shrink-0">description</span>
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium text-text-main truncate">${archivo.nombre}</p>
                                <div class="flex items-center gap-3 mt-1">
                                    <span class="text-xs text-text-muted">${this.formatearTamaño(archivo.tamaño)}</span>
                                    <span class="text-xs text-text-muted">•</span>
                                    <span class="text-xs text-text-muted">${Utils.formatDate(archivo.fecha_subida, 'DD/MM/YYYY HH:mm')}</span>
                                    ${archivo.descripcion ? `<span class="text-xs text-text-muted">• ${archivo.descripcion}</span>` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 flex-shrink-0">
                            <button class="btn-descargar-archivo p-2 text-primary hover:bg-red-50 rounded transition-colors"
                                    data-obligacion-id="${obligacionId}" data-archivo-id="${archivo.id}" title="Descargar">
                                <span class="material-symbols-outlined text-lg">download</span>
                            </button>
                            <button class="btn-eliminar-archivo p-2 text-red-500 hover:bg-red-50 rounded transition-colors"
                                    data-obligacion-id="${obligacionId}" data-archivo-id="${archivo.id}" title="Eliminar">
                                <span class="material-symbols-outlined text-lg">delete</span>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
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

    /**
     * Mostrar modal de subida
     */
    mostrarModalSubida(obligacionId) {
        const modal = document.getElementById('modal-subida');
        const obligacionIdInput = document.getElementById('obligacion-id-subida');
        
        if (!modal || !obligacionIdInput) return;

        this.obligacionActualSubida = obligacionId;
        obligacionIdInput.value = obligacionId;
        
        // Limpiar formulario
        this.archivoSeleccionado = null;
        const inputArchivo = document.getElementById('input-archivo');
        const descripcion = document.getElementById('descripcion-archivo');
        const archivoSeleccionadoDiv = document.getElementById('archivo-seleccionado');
        
        if (inputArchivo) inputArchivo.value = '';
        if (descripcion) descripcion.value = '';
        if (archivoSeleccionadoDiv) archivoSeleccionadoDiv.classList.add('hidden');

        modal.classList.remove('hidden');
    }

    /**
     * Cerrar modal
     */
    cerrarModal() {
        const modal = document.getElementById('modal-subida');
        if (modal) {
            modal.classList.add('hidden');
        }
        this.obligacionActualSubida = null;
        this.archivoSeleccionado = null;
    }

    /**
     * Seleccionar archivo
     */
    seleccionarArchivo(archivo) {
        this.archivoSeleccionado = archivo;

        const archivoSeleccionadoDiv = document.getElementById('archivo-seleccionado');
        const nombreArchivo = document.getElementById('nombre-archivo');
        const tamañoArchivo = document.getElementById('tamaño-archivo');

        if (archivoSeleccionadoDiv && nombreArchivo && tamañoArchivo) {
            nombreArchivo.textContent = archivo.name;
            tamañoArchivo.textContent = `(${this.formatearTamaño(archivo.size)})`;
            archivoSeleccionadoDiv.classList.remove('hidden');
        }
    }

    /**
     * Subir archivo
     */
    async subirArchivo() {
        if (!this.archivoSeleccionado || !this.obligacionActualSubida) {
            Utils.showNotification('Por favor selecciona un archivo', 'warning');
            return;
        }

        const descripcion = document.getElementById('descripcion-archivo');
        const descripcionTexto = descripcion ? descripcion.value.trim() : '';

        const btnSubir = document.getElementById('btn-subir-archivo');
        if (btnSubir) {
            btnSubir.disabled = true;
            btnSubir.textContent = 'Subiendo...';
        }

        try {
            await this.archivosService.subirArchivo(
                this.obligacionActualSubida,
                this.archivoSeleccionado,
                descripcionTexto
            );

            Utils.showNotification('Archivo subido correctamente', 'success');

            // Cerrar modal
            this.cerrarModal();

            // Recargar obligaciones para mostrar el nuevo archivo
            await this.loadObligaciones();

            // Notificar al responsable CN
            if (window.NotificacionesService) {
                const notificacionesService = new NotificacionesService(window.dataAdapter);
                const archivoInfo = {
                    nombre: this.archivoSeleccionado.name,
                    tamaño: this.archivoSeleccionado.size,
                    tipo: this.archivoSeleccionado.type,
                    descripcion: descripcionTexto
                };
                await notificacionesService.enviarNotificacionArchivo(
                    this.obligacionActualSubida,
                    archivoInfo,
                    this.usuarioActual,
                    this.usuarioActual.area
                );
            }
        } catch (error) {
            console.error('Error al subir archivo:', error);
            Utils.showNotification(error.message || 'Error al subir archivo', 'error');
        } finally {
            if (btnSubir) {
                btnSubir.disabled = false;
                btnSubir.textContent = 'Subir Archivo';
            }
        }
    }

    /**
     * Descargar archivo
     */
    async descargarArchivo(obligacionId, archivoId) {
        try {
            await this.archivosService.descargarArchivo(obligacionId, archivoId);
            Utils.showNotification('Descarga iniciada', 'success');
        } catch (error) {
            console.error('Error al descargar archivo:', error);
            Utils.showNotification('Error al descargar archivo', 'error');
        }
    }

    /**
     * Eliminar archivo
     */
    async eliminarArchivo(obligacionId, archivoId) {
        if (!await Utils.confirm('¿Está seguro de eliminar este archivo?')) {
            return;
        }

        try {
            await this.archivosService.eliminarArchivo(obligacionId, archivoId);
            Utils.showNotification('Archivo eliminado correctamente', 'success');
            
            // Recargar obligaciones
            await this.loadObligaciones();
        } catch (error) {
            console.error('Error al eliminar archivo:', error);
            Utils.showNotification('Error al eliminar archivo', 'error');
        }
    }
}

// Inicializar cuando el DOM esté listo
function initializeEvidenciasController() {
    if (window.dataAdapter && !window.evidenciasController) {
        const controller = new EvidenciasController();
        controller.init();
        window.evidenciasController = controller;
    }
}

// Intentar inicializar inmediatamente o esperar evento
if (window.dataAdapter) {
    initializeEvidenciasController();
} else {
    document.addEventListener('alertia-ready', initializeEvidenciasController);
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initializeEvidenciasController, 500);
    });
}
