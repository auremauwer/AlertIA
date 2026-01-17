/**
 * Controlador de Configuración
 * Maneja la configuración del sistema
 */
class ConfiguracionController {
    constructor() {
        this.configService = null;
    }

    /**
     * Inicializar controlador
     */
    async init() {
        if (!window.dataAdapter) {
            console.error('dataAdapter no está disponible');
            return;
        }

        this.configService = new ConfigService(window.dataAdapter);
        this.excelService = new ExcelService(window.dataAdapter);

        this.setupEventListeners();
        await this.loadConfiguracion();
    }

    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        // Select de remitente
        const remitenteSelect = document.querySelector('select');
        if (remitenteSelect) {
            remitenteSelect.addEventListener('change', (e) => {
                this.handleRemitenteChange(e.target.value);
            });
        }

        // Input nombre remitente
        const nombreRemitenteInput = Array.from(document.querySelectorAll('input')).find(input =>
            input.placeholder && input.placeholder.includes('Nombre visible')
        );
        if (nombreRemitenteInput) {
            nombreRemitenteInput.addEventListener('blur', () => {
                this.handleConfigChange();
            });
        }

        // Textarea CC global
        const ccTextarea = Array.from(document.querySelectorAll('textarea')).find(textarea =>
            textarea.placeholder && textarea.placeholder.includes('correo')
        );
        if (ccTextarea) {
            ccTextarea.addEventListener('blur', () => {
                this.handleConfigChange();
            });
        }

        // Botón guardar
        const btnGuardar = Array.from(document.querySelectorAll('button')).find(btn =>
            btn.textContent.includes('Guardar')
        );
        if (btnGuardar) {
            btnGuardar.addEventListener('click', () => this.guardarConfiguracion());
        }

        // Botón cancelar
        const btnCancelar = Array.from(document.querySelectorAll('button')).find(btn =>
            btn.textContent.includes('Cancelar')
        );
        if (btnCancelar) {
            btnCancelar.addEventListener('click', () => this.loadConfiguracion());
        }

        // Excel Re-upload Logic
        const btnReloadExcel = document.getElementById('btn-reload-excel');
        const excelInput = document.getElementById('excel-reupload-input');

        if (btnReloadExcel && excelInput) {
            btnReloadExcel.addEventListener('click', () => excelInput.click());

            excelInput.addEventListener('change', async (e) => {
                if (e.target.files.length > 0) {
                    await this.handleExcelUpload(e.target.files[0]);
                    // Reset input
                    excelInput.value = '';
                }
            });
        }
    }

    async handleExcelUpload(file) {
        if (!this.excelService) return;

        try {
            Utils.showNotification('Procesando archivo...', 'info');

            // 1. Procesar Excel (Devuelve array de obligaciones)
            const obligaciones = await this.excelService.processExcelFile(file);

            if (obligaciones && Array.isArray(obligaciones) && obligaciones.length > 0) {
                // 2. Guardar en Base de Datos
                await window.dataAdapter.saveAllObligaciones(obligaciones);

                Utils.showNotification(`Datos actualizados: ${obligaciones.length} obligaciones cargadas`, 'success');
            } else {
                throw new Error('No se encontraron obligaciones válidas en el archivo');
            }
        } catch (error) {
            console.error('Error al subir Excel:', error);
            Utils.showNotification(error.message || 'Error al procesar el archivo Excel', 'error');
        }
    }

    /**
     * Cargar configuración actual
     */
    async loadConfiguracion() {
        try {
            const config = await this.configService.getConfiguracion();

            // Cargar remitentes autorizados
            const remitentes = this.configService.getRemitentesAutorizados();
            const remitenteSelect = document.querySelector('select');
            if (remitenteSelect) {
                remitenteSelect.innerHTML = '<option value="">Seleccione un remitente...</option>';
                remitentes.forEach(rem => {
                    const option = document.createElement('option');
                    option.value = rem;
                    option.textContent = rem;
                    if (rem === config.remitente) {
                        option.selected = true;
                    }
                    remitenteSelect.appendChild(option);
                });
            }

            // Cargar nombre remitente
            const nombreInput = Array.from(document.querySelectorAll('input')).find(input =>
                input.placeholder && input.placeholder.includes('Nombre visible')
            );
            if (nombreInput) {
                nombreInput.value = config.nombre_remitente || '';
            }

            // Cargar CC global
            const ccTextarea = Array.from(document.querySelectorAll('textarea')).find(textarea =>
                textarea.placeholder && textarea.placeholder.includes('correo')
            );
            if (ccTextarea) {
                ccTextarea.value = (config.cc_global || []).join(', ');
            }
        } catch (error) {
            console.error('Error al cargar configuración:', error);
            Utils.showNotification('Error al cargar configuración', 'error');
        }
    }

    /**
     * Manejar cambio de remitente
     */
    handleRemitenteChange(remitente) {
        if (!this.configService.isRemitenteAutorizado(remitente)) {
            Utils.showNotification('El remitente no está autorizado', 'error');
            return;
        }
    }

    /**
     * Manejar cambio de configuración
     */
    handleConfigChange() {
        // Marcar como modificado si es necesario
    }

    /**
     * Guardar configuración
     */
    async guardarConfiguracion() {
        try {
            const remitenteSelect = document.querySelector('select');
            const nombreInput = Array.from(document.querySelectorAll('input')).find(input =>
                input.placeholder && input.placeholder.includes('Nombre visible')
            );
            const ccTextarea = Array.from(document.querySelectorAll('textarea')).find(textarea =>
                textarea.placeholder && textarea.placeholder.includes('correo')
            );

            const config = {
                remitente: remitenteSelect?.value || '',
                nombre_remitente: nombreInput?.value || '',
                cc_global: ccTextarea?.value || ''
            };

            // Validar
            if (!config.remitente) {
                Utils.showNotification('Debe seleccionar un remitente', 'error');
                return;
            }

            await this.configService.saveConfiguracion(config);
            Utils.showNotification('Configuración guardada correctamente', 'success');
        } catch (error) {
            console.error('Error al guardar configuración:', error);
            Utils.showNotification(error.message || 'Error al guardar configuración', 'error');
        }
    }
}

// Inicializar cuando el DOM esté listo
const initController = () => {
    if (window.dataAdapter) {
        const controller = new ConfiguracionController();
        controller.init();
        window.configuracionController = controller;
    } else {
        // Retry every 100ms for up to 5 seconds
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            if (window.dataAdapter) {
                clearInterval(interval);
                const controller = new ConfiguracionController();
                controller.init();
                window.configuracionController = controller;
            } else if (attempts >= 50) {
                clearInterval(interval);
                console.error('Timeout: dataAdapter no disponible después de 5s');
            }
        }, 100);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initController);
} else {
    initController();
}

if (typeof window !== 'undefined') {
    window.ConfiguracionController = ConfiguracionController;
}
