/**
 * Controlador de la Página Inicial
 * Maneja la carga de archivos Excel y navegación inicial
 */
class IndexController {
    constructor() {
        this.excelService = null;
        this.obligacionesService = null;
        this.auditoriaService = null;
    }

    /**
     * Inicializar controlador
     */
    async init() {
        // Esperar a que SheetJS esté disponible
        if (typeof XLSX === 'undefined') {
            console.error('SheetJS no está disponible');
            return;
        }

        if (!window.dataAdapter) {
            console.error('dataAdapter no está disponible');
            return;
        }

        this.excelService = new ExcelService();
        this.obligacionesService = new ObligacionesService(window.dataAdapter);
        this.auditoriaService = new AuditoriaService(window.dataAdapter);

        this.setupEventListeners();
    }

    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        const fileInput = document.getElementById('excel-file-input');
        const uploadArea = document.getElementById('upload-area');
        const uploadButton = document.getElementById('upload-button');

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileSelect(e.target.files[0]);
                }
            });
        }

        if (uploadArea) {
            // Drag and drop
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('drag-over');
            });

            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('drag-over');
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('drag-over');
                
                const files = e.dataTransfer.files;
                if (files.length > 0 && this.isExcelFile(files[0])) {
                    this.handleFileSelect(files[0]);
                } else {
                    Utils.showNotification('Por favor selecciona un archivo Excel (.xlsx o .xls)', 'error');
                }
            });

            // Click para abrir selector
            uploadArea.addEventListener('click', () => {
                if (fileInput) {
                    fileInput.click();
                }
            });
        }

        if (uploadButton) {
            uploadButton.addEventListener('click', () => {
                if (fileInput) {
                    fileInput.click();
                }
            });
        }
    }

    /**
     * Verificar si es archivo Excel
     */
    isExcelFile(file) {
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel' // .xls
        ];
        const validExtensions = ['.xlsx', '.xls'];
        
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        
        return validTypes.includes(file.type) || validExtensions.includes(extension);
    }

    /**
     * Manejar selección de archivo
     */
    async handleFileSelect(file) {
        if (!this.isExcelFile(file)) {
            Utils.showNotification('Por favor selecciona un archivo Excel (.xlsx o .xls)', 'error');
            return;
        }

        this.showLoading(true);
        this.updateStatus('Procesando archivo...', 'info');

        try {
            // Procesar Excel
            const obligaciones = await this.excelService.processExcelFile(file);
            
            this.updateStatus(`Se encontraron ${obligaciones.length} obligaciones. Guardando...`, 'info');
            
            // Guardar obligaciones
            let saved = 0;
            let skipped = 0;
            let errors = 0;
            
            for (const obligacion of obligaciones) {
                try {
                    // Verificar si ya existe
                    try {
                        const existing = await this.obligacionesService.getById(obligacion.id);
                        if (existing) {
                            skipped++;
                            continue;
                        }
                    } catch (e) {
                        // No existe, continuar
                    }
                    
                    await window.dataAdapter.saveObligacion(obligacion);
                    saved++;
                } catch (error) {
                    console.error(`Error al guardar obligación ${obligacion.id}:`, error);
                    errors++;
                }
            }
            
            // Registrar en auditoría
            const user = await window.dataAdapter.getCurrentUser();
            await this.auditoriaService.registrarEvento('Cargó obligaciones desde Excel', {
                archivo: file.name,
                total: obligaciones.length,
                guardadas: saved,
                omitidas: skipped
            });
            
            // Mostrar resultado
            this.showLoading(false);
            
            let statusMessage = `✅ Carga completada: ${saved} obligaciones guardadas`;
            if (skipped > 0) {
                statusMessage += `, ${skipped} omitidas (ya existían)`;
            }
            if (errors > 0) {
                statusMessage += `, ${errors} con errores`;
            }
            
            this.updateStatus(statusMessage, saved > 0 ? 'success' : 'error');
            
            if (saved > 0) {
                Utils.showNotification(
                    `${saved} obligaciones cargadas exitosamente${skipped > 0 ? ` (${skipped} ya existían)` : ''}`,
                    'success'
                );
            } else {
                Utils.showNotification(
                    'No se pudieron guardar obligaciones. Verifica el formato del archivo.',
                    'error'
                );
            }
            
            // Redirigir después de 2 segundos
            setTimeout(() => {
                window.location.href = 'Dashboard.html';
            }, 2000);
            
        } catch (error) {
            console.error('Error al procesar Excel:', error);
            this.showLoading(false);
            this.updateStatus(`❌ Error: ${error.message}`, 'error');
            Utils.showNotification(`Error al procesar Excel: ${error.message}`, 'error');
        }
    }

    /**
     * Mostrar/ocultar indicador de carga
     */
    showLoading(show) {
        const loadingEl = document.getElementById('upload-loading');
        const uploadArea = document.getElementById('upload-area');
        
        if (loadingEl) {
            loadingEl.style.display = show ? 'block' : 'none';
        }
        
        if (uploadArea) {
            uploadArea.style.opacity = show ? '0.6' : '1';
            uploadArea.style.pointerEvents = show ? 'none' : 'auto';
        }
    }

    /**
     * Actualizar mensaje de estado
     */
    updateStatus(message, type = 'info') {
        const statusEl = document.getElementById('upload-status');
        if (!statusEl) return;
        
        statusEl.textContent = message;
        statusEl.className = `upload-status ${type}`;
        statusEl.style.display = 'block';
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Esperar a que SheetJS y dataAdapter estén disponibles
        const checkDependencies = setInterval(() => {
            if (typeof XLSX !== 'undefined' && window.dataAdapter) {
                clearInterval(checkDependencies);
                const controller = new IndexController();
                controller.init();
                window.indexController = controller;
            }
        }, 100);
        
        // Timeout después de 5 segundos
        setTimeout(() => {
            clearInterval(checkDependencies);
        }, 5000);
    });
} else {
    if (typeof XLSX !== 'undefined' && window.dataAdapter) {
        const controller = new IndexController();
        controller.init();
        window.indexController = controller;
    }
}

if (typeof window !== 'undefined') {
    window.IndexController = IndexController;
}
