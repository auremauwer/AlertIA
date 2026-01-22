/**
 * Controlador de Configuración
 * Maneja la configuración del sistema
 */
class ConfiguracionController {
    constructor() {
        this.configService = null;
        this.plantillaActual = null; // Almacena la plantilla seleccionada actualmente
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
        // Select de plantilla de correo
        const templateSelect = document.getElementById('email-template-select');
        if (templateSelect) {
            templateSelect.addEventListener('change', (e) => {
                this.handleTemplateChange(e.target.value);
            });
        }

        // Select de remitente
        const remitenteSelect = document.getElementById('remitente-select');
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
            textarea.placeholder && textarea.placeholder.includes('correo') && !textarea.id
        );
        if (ccTextarea) {
            ccTextarea.addEventListener('blur', () => {
                this.handleConfigChange();
            });
        }

        // Input asunto correo
        const emailSubjectInput = document.getElementById('email-subject-input');
        if (emailSubjectInput) {
            emailSubjectInput.addEventListener('blur', () => {
                this.handleConfigChange();
            });
        }

        // Textarea cuerpo correo
        const emailBodyInput = document.getElementById('email-body-input');
        if (emailBodyInput) {
            emailBodyInput.addEventListener('blur', () => {
                this.handleConfigChange();
            });
        }

        // Toggle de envíos automáticos
        const enviosAutomaticosToggle = document.getElementById('envios-automaticos-toggle');
        if (enviosAutomaticosToggle) {
            enviosAutomaticosToggle.addEventListener('change', () => {
                this.updateEnviosAutomaticosStatus();
                this.toggleControlesEnvioAutomatico();
                this.guardarConfiguracionEnvioAutomatico();
            });
        }

        // Input de horario de envío
        const horaEnvioInput = document.getElementById('hora-envio-input');
        if (horaEnvioInput) {
            horaEnvioInput.addEventListener('change', () => {
                this.guardarConfiguracionEnvioAutomatico();
            });
        }

        // Toggle de enviar en fines de semana
        const enviarFinesSemanaToggle = document.getElementById('enviar-fines-semana-toggle');
        if (enviarFinesSemanaToggle) {
            enviarFinesSemanaToggle.addEventListener('change', () => {
                this.updateFinesSemanaStatus();
                this.guardarConfiguracionEnvioAutomatico();
            });
        }

        // Botón ver calendario de envíos
        const btnVerCalendario = document.getElementById('btn-ver-calendario-envios');
        if (btnVerCalendario) {
            btnVerCalendario.addEventListener('click', () => {
                this.abrirModalCalendario();
            });
        }

        // Botón cerrar calendario
        const btnCerrarCalendario = document.getElementById('btn-cerrar-calendario');
        if (btnCerrarCalendario) {
            btnCerrarCalendario.addEventListener('click', () => {
                this.cerrarModalCalendario();
            });
        }

        // Input fecha calendario
        const fechaCalendarioInput = document.getElementById('fecha-calendario-input');
        if (fechaCalendarioInput) {
            fechaCalendarioInput.addEventListener('change', (e) => {
                this.mostrarAlertasFecha(e.target.value);
            });
        }

        // Cerrar modal al hacer clic fuera
        const modalCalendario = document.getElementById('modal-calendario-envios');
        if (modalCalendario) {
            modalCalendario.addEventListener('click', (e) => {
                if (e.target === modalCalendario) {
                    this.cerrarModalCalendario();
                }
            });
        }

        // Botón guardar
        const btnGuardar = Array.from(document.querySelectorAll('button')).find(btn =>
            btn.textContent.includes('Guardar') && !btn.id
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

        // Setup Clear DB Button
        const btnClearDB = document.getElementById('btn-clear-db');
        if (btnClearDB) {
            btnClearDB.addEventListener('click', async () => {
                const confirmed = confirm('¿Estás seguro de que quieres ELIMINAR TODOS LOS DATOS?\n\nEsta acción no se puede deshacer. Se borrarán todas las obligaciones y el historial.');
                if (confirmed) {
                    try {
                        if (window.dataAdapter && window.dataAdapter.storage) {
                            window.dataAdapter.storage.clear();
                            Utils.showNotification('🧹 Base de datos eliminada correctamente', 'success');
                            setTimeout(() => window.location.reload(), 1500);
                        }
                    } catch (error) {
                        console.error('Error al limpiar DB:', error);
                        Utils.showNotification('Error al limpiar datos: ' + error.message, 'error');
                    }
                }
            });
        }
    }

    async handleExcelUpload(file) {
        if (!this.excelService) return;

        try {
            Utils.showNotification('Procesando archivo...', 'info');

            // 1. Procesar Excel (Devuelve array de obligaciones o objeto con obligaciones y problemas)
            const result = await this.excelService.processExcelFile(file);
            const obligaciones = Array.isArray(result) ? result : (result.obligaciones || []);

            if (obligaciones && obligaciones.length > 0) {
                // 2. Guardar en Base de Datos
                await window.dataAdapter.saveAllObligaciones(obligaciones);

                // 3. Guardar nombre del archivo en configuración
                try {
                    const configCurrent = await this.configService.getConfiguracion();
                    await this.configService.saveConfiguracion({
                        ...configCurrent,
                        nombre_archivo_excel: file.name,
                        ultima_carga_excel: new Date().toISOString()
                    });
                } catch (cfgError) {
                    console.warn('No se pudo guardar el nombre del archivo en configuración', cfgError);
                }

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


            // Cargar nombre remitente
            const nombreInput = Array.from(document.querySelectorAll('input')).find(input =>
                input.placeholder && input.placeholder.includes('Nombre visible')
            );
            if (nombreInput) {
                nombreInput.value = config.nombre_remitente || '';
            }

            // Cargar CC global
            const ccTextarea = Array.from(document.querySelectorAll('textarea')).find(textarea =>
                textarea.placeholder && textarea.placeholder.includes('correo') && !textarea.id
            );
            if (ccTextarea) {
                ccTextarea.value = (config.cc_global || []).join(', ');
            }

            // Cargar remitente
            const remitenteSelect = document.getElementById('remitente-select');
            if (remitenteSelect) {
                remitenteSelect.innerHTML = '<option value="">Seleccione un remitente...</option>';
                const remitentes = this.configService.getRemitentesAutorizados();
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

            // Cargar toggle de envíos automáticos
            const enviosAutomaticosToggle = document.getElementById('envios-automaticos-toggle');
            if (enviosAutomaticosToggle) {
                enviosAutomaticosToggle.checked = config.envios_automaticos !== false; // Por defecto true
                this.updateEnviosAutomaticosStatus();
                this.toggleControlesEnvioAutomatico();
            }

            // Cargar horario de envío
            const horaEnvioInput = document.getElementById('hora-envio-input');
            if (horaEnvioInput) {
                horaEnvioInput.value = config.hora_envio || '09:00';
            }

            // Cargar toggle de enviar en fines de semana
            const enviarFinesSemanaToggle = document.getElementById('enviar-fines-semana-toggle');
            if (enviarFinesSemanaToggle) {
                enviarFinesSemanaToggle.checked = config.enviar_fines_semana !== false; // Por defecto true
                this.updateFinesSemanaStatus();
            }
        } catch (error) {
            console.error('Error al cargar configuración:', error);
            Utils.showNotification('Error al cargar configuración', 'error');
        }
    }

    /**
     * Manejar cambio de plantilla de correo
     */
    async handleTemplateChange(templateId) {
        this.plantillaActual = templateId;
        const contentSection = document.getElementById('email-content-section');
        const emailSubjectInput = document.getElementById('email-subject-input');
        const emailBodyInput = document.getElementById('email-body-input');

        if (!templateId) {
            // Ocultar sección si no hay plantilla seleccionada
            if (contentSection) {
                contentSection.classList.add('hidden');
            }
            return;
        }

        // Mostrar sección de contenido
        if (contentSection) {
            contentSection.classList.remove('hidden');
        }

        // Cargar configuración de la plantilla seleccionada
        try {
            const config = await this.configService.getConfiguracion();
            const emailTemplates = config.email_templates || {};

            // Cargar valores de la plantilla seleccionada
            const template = emailTemplates[templateId] || {};
            
            if (emailSubjectInput) {
                emailSubjectInput.value = template.subject || '';
            }
            if (emailBodyInput) {
                emailBodyInput.value = template.body || '';
            }
        } catch (error) {
            console.error('Error al cargar plantilla:', error);
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
     * Actualizar texto de estado de envíos automáticos
     */
    updateEnviosAutomaticosStatus() {
        const enviosAutomaticosToggle = document.getElementById('envios-automaticos-toggle');
        const statusText = document.getElementById('envios-automaticos-status-text');
        
        if (enviosAutomaticosToggle && statusText) {
            if (enviosAutomaticosToggle.checked) {
                statusText.textContent = 'Envíos automáticos prendidos';
            } else {
                statusText.textContent = 'Envíos automáticos desactivados';
            }
        }
    }

    /**
     * Habilitar/deshabilitar controles de envío automático
     */
    toggleControlesEnvioAutomatico() {
        const enviosAutomaticosToggle = document.getElementById('envios-automaticos-toggle');
        const horaEnvioInput = document.getElementById('hora-envio-input');
        const enviarFinesSemanaToggle = document.getElementById('enviar-fines-semana-toggle');
        
        const isEnabled = enviosAutomaticosToggle?.checked || false;

        // Habilitar/deshabilitar campo de hora
        if (horaEnvioInput) {
            horaEnvioInput.disabled = !isEnabled;
            if (isEnabled) {
                horaEnvioInput.classList.remove('opacity-50', 'cursor-not-allowed');
            } else {
                horaEnvioInput.classList.add('opacity-50', 'cursor-not-allowed');
            }
        }

        // Habilitar/deshabilitar toggle de fines de semana
        if (enviarFinesSemanaToggle) {
            enviarFinesSemanaToggle.disabled = !isEnabled;
            const toggleDiv = enviarFinesSemanaToggle.parentElement?.querySelector('div');
            if (toggleDiv) {
                if (isEnabled) {
                    toggleDiv.classList.remove('opacity-50', 'cursor-not-allowed');
                } else {
                    toggleDiv.classList.add('opacity-50', 'cursor-not-allowed');
                }
            }
        }
    }

    /**
     * Actualizar texto de estado de fines de semana
     */
    updateFinesSemanaStatus() {
        const enviarFinesSemanaToggle = document.getElementById('enviar-fines-semana-toggle');
        const statusText = document.getElementById('fines-semana-status-text');
        
        if (enviarFinesSemanaToggle && statusText) {
            if (enviarFinesSemanaToggle.checked) {
                statusText.textContent = 'Correos en fines de semana activados';
            } else {
                statusText.textContent = 'Correos en fines de semana desactivados';
            }
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
            // Obtener configuración actual para preservar otras plantillas
            const configActual = await this.configService.getConfiguracion();
            const emailTemplates = configActual.email_templates || {};

            // Obtener valores del formulario
            const remitenteSelect = document.getElementById('remitente-select');
            const nombreInput = Array.from(document.querySelectorAll('input')).find(input =>
                input.placeholder && input.placeholder.includes('Nombre visible')
            );
            const ccTextarea = Array.from(document.querySelectorAll('textarea')).find(textarea =>
                textarea.placeholder && textarea.placeholder.includes('correo') && !textarea.id
            );
            const emailSubjectInput = document.getElementById('email-subject-input');
            const emailBodyInput = document.getElementById('email-body-input');
            const templateSelect = document.getElementById('email-template-select');

            // Si hay una plantilla seleccionada, guardar sus valores
            if (this.plantillaActual && emailSubjectInput && emailBodyInput) {
                emailTemplates[this.plantillaActual] = {
                    subject: emailSubjectInput.value || '',
                    body: emailBodyInput.value || ''
                };
            }

            // Obtener valores de horario de envío
            const enviosAutomaticosToggle = document.getElementById('envios-automaticos-toggle');
            const horaEnvioInput = document.getElementById('hora-envio-input');
            const enviarFinesSemanaToggle = document.getElementById('enviar-fines-semana-toggle');

            const config = {
                remitente: remitenteSelect?.value || configActual.remitente || '',
                nombre_remitente: nombreInput?.value || configActual.nombre_remitente || '',
                cc_global: ccTextarea?.value || configActual.cc_global || '',
                email_templates: emailTemplates,
                envios_automaticos: enviosAutomaticosToggle?.checked !== false, // Por defecto true
                hora_envio: horaEnvioInput?.value || configActual.hora_envio || '09:00',
                enviar_fines_semana: enviarFinesSemanaToggle?.checked !== false // Por defecto true
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

    /**
     * Guardar solo la configuración de envío automático
     */
    async guardarConfiguracionEnvioAutomatico() {
        try {
            // Obtener configuración actual para preservar otros valores
            const configActual = await this.configService.getConfiguracion();

            // Obtener valores de envío automático
            const enviosAutomaticosToggle = document.getElementById('envios-automaticos-toggle');
            const horaEnvioInput = document.getElementById('hora-envio-input');
            const enviarFinesSemanaToggle = document.getElementById('enviar-fines-semana-toggle');

            const config = {
                ...configActual,
                envios_automaticos: enviosAutomaticosToggle?.checked !== false,
                hora_envio: horaEnvioInput?.value || '09:00',
                enviar_fines_semana: enviarFinesSemanaToggle?.checked !== false
            };

            await this.configService.saveConfiguracion(config);
            // Guardar silenciosamente sin notificación para no ser intrusivo
        } catch (error) {
            console.error('Error al guardar configuración de envío automático:', error);
            Utils.showNotification(error.message || 'Error al guardar configuración', 'error');
        }
    }

    /**
     * Abrir modal de calendario de envíos
     */
    abrirModalCalendario() {
        const modal = document.getElementById('modal-calendario-envios');
        if (modal) {
            modal.classList.remove('hidden');
            // Establecer fecha de hoy por defecto
            const fechaInput = document.getElementById('fecha-calendario-input');
            if (fechaInput) {
                const hoy = new Date().toISOString().split('T')[0];
                fechaInput.value = hoy;
                this.mostrarAlertasFecha(hoy);
            }
        }
    }

    /**
     * Cerrar modal de calendario de envíos
     */
    cerrarModalCalendario() {
        const modal = document.getElementById('modal-calendario-envios');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * Mostrar alertas programadas para una fecha específica
     */
    async mostrarAlertasFecha(fechaStr) {
        const container = document.getElementById('alertas-fecha-container');
        if (!container || !fechaStr) {
            return;
        }

        container.innerHTML = '<div class="flex items-center justify-center py-4"><span class="material-symbols-outlined animate-spin text-primary">hourglass_empty</span><span class="ml-2 text-sm text-slate-500">Calculando alertas...</span></div>';

        try {
            const fechaSeleccionada = new Date(fechaStr + 'T00:00:00');
            fechaSeleccionada.setHours(0, 0, 0, 0);

            // Obtener todas las obligaciones activas
            const obligaciones = await window.dataAdapter.getObligaciones();
            const obligacionesActivas = obligaciones.filter(obl => obl.estado === 'activa' || !obl.estado);

            // Calcular alertas para esa fecha
            const alertasFecha = [];
            
            if (!window.CalendarioService) {
                throw new Error('CalendarioService no está disponible');
            }
            
            const calendarioService = new window.CalendarioService();

            for (const obligacion of obligacionesActivas) {
                try {
                    // Calcular fechas de alerta para esta obligación
                    const fechasAlerta = await calendarioService.calcularCalendario(obligacion);
                    
                    // Verificar si la fecha seleccionada está en las fechas de alerta
                    const fechaEnCalendario = fechasAlerta.some(fecha => {
                        const fechaAlerta = new Date(fecha);
                        fechaAlerta.setHours(0, 0, 0, 0);
                        return fechaAlerta.getTime() === fechaSeleccionada.getTime();
                    });

                    if (fechaEnCalendario) {
                        // Determinar tipo de frecuencia basándome en las reglas
                        const reglas = obligacion.reglas_alertamiento || {};
                        const a1 = calendarioService.parseFecha(reglas.regla_1_vez);
                        const a2 = calendarioService.parseFecha(reglas.regla_semanal);
                        const a3 = calendarioService.parseFecha(reglas.regla_saltado);
                        const a4 = calendarioService.parseFecha(reglas.regla_diaria);
                        const deadline = calendarioService.parseFecha(obligacion.fecha_limite || obligacion.fecha_limite_original);

                        let tipoFrecuencia = 'de una vez';
                        
                        // Verificar en orden de prioridad (diaria > saltada > semanal > una vez)
                        // 4TA (diaria): desde a4 hasta deadline
                        if (a4 && a4 <= deadline) {
                            const rangoDiario = calendarioService.genRange(a4, deadline, 1);
                            if (rangoDiario.some(f => {
                                const fechaDiaria = new Date(f);
                                fechaDiaria.setHours(0, 0, 0, 0);
                                return fechaDiaria.getTime() === fechaSeleccionada.getTime();
                            })) {
                                tipoFrecuencia = 'diaria';
                            }
                        }
                        
                        // 3ER (saltada): desde a3 hasta min(a4-1, deadline)
                        if (tipoFrecuencia === 'de una vez' && a3 && a3 <= deadline) {
                            const a4Minus1 = a4 ? new Date(a4.getTime() - 86400000) : null;
                            const upper = calendarioService.minNonNull(a4Minus1, deadline) || deadline;
                            if (a3 <= upper) {
                                const rangoSaltado = calendarioService.genRange(a3, upper, 2);
                                if (rangoSaltado.some(f => {
                                    const fechaSaltada = new Date(f);
                                    fechaSaltada.setHours(0, 0, 0, 0);
                                    return fechaSaltada.getTime() === fechaSeleccionada.getTime();
                                })) {
                                    tipoFrecuencia = 'saltada';
                                }
                            }
                        }
                        
                        // 2DA (semanal): desde a2 hasta min(a3-1, a4-1, deadline)
                        if (tipoFrecuencia === 'de una vez' && a2 && a2 <= deadline) {
                            const a3Minus1 = a3 ? new Date(a3.getTime() - 86400000) : null;
                            const a4Minus1 = a4 ? new Date(a4.getTime() - 86400000) : null;
                            const upper = calendarioService.minNonNull(a3Minus1, a4Minus1, deadline) || deadline;
                            if (a2 <= upper) {
                                const rangoSemanal = calendarioService.genRange(a2, upper, 7);
                                if (rangoSemanal.some(f => {
                                    const fechaSemanal = new Date(f);
                                    fechaSemanal.setHours(0, 0, 0, 0);
                                    return fechaSemanal.getTime() === fechaSeleccionada.getTime();
                                })) {
                                    tipoFrecuencia = 'semanal';
                                }
                            }
                        }
                        
                        // 1ER (una vez): solo si a1 coincide exactamente
                        if (tipoFrecuencia === 'de una vez' && a1 && a1 <= deadline) {
                            const cutoff = calendarioService.minNonNull(a2, a3, a4);
                            if (!cutoff || a1 < cutoff) {
                                const fechaUnaVez = new Date(a1);
                                fechaUnaVez.setHours(0, 0, 0, 0);
                                if (fechaUnaVez.getTime() === fechaSeleccionada.getTime()) {
                                    tipoFrecuencia = 'de una vez';
                                }
                            }
                        }

                        const fechaLimite = new Date(obligacion.fecha_limite || obligacion.fecha_limite_original);
                        const diasRestantes = Math.ceil((fechaLimite - fechaSeleccionada) / (1000 * 60 * 60 * 24));

                        alertasFecha.push({
                            obligacion: obligacion,
                            tipoFrecuencia: tipoFrecuencia,
                            diasRestantes: diasRestantes
                        });
                    }
                } catch (error) {
                    console.warn(`Error al calcular alerta para obligación ${obligacion.id}:`, error);
                }
            }

            // Mostrar resultados
            if (alertasFecha.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-8">
                        <span class="material-symbols-outlined text-4xl text-slate-300 mb-2">event_busy</span>
                        <p class="text-sm text-slate-500 dark:text-slate-400">No hay alertas programadas para esta fecha</p>
                    </div>
                `;
            } else {
                const fechaFormateada = Utils.formatDate(fechaStr, 'DD/MM/YYYY');
                container.innerHTML = `
                    <div class="mb-4">
                        <h3 class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Alertas programadas para ${fechaFormateada} (${alertasFecha.length})
                        </h3>
                    </div>
                    <div class="space-y-3">
                        ${alertasFecha.map(alerta => {
                            return `
                                <div class="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                                    <div class="flex items-start justify-between">
                                        <div class="flex-1">
                                            <div class="flex items-center gap-2 mb-1">
                                                <span class="text-xs font-bold px-2 py-0.5 rounded bg-yellow-400 text-white">
                                                    ${alerta.tipoFrecuencia}
                                                </span>
                                                <span class="text-xs font-medium text-slate-700">
                                                    ${alerta.obligacion.id}
                                                </span>
                                            </div>
                                            <p class="text-sm font-bold text-slate-800 mb-1">
                                                ${alerta.obligacion.descripcion || alerta.obligacion.nombre || 'Sin descripción'}
                                            </p>
                                            <div class="flex items-center gap-4 text-xs text-slate-500">
                                                <span>Días restantes: ${alerta.diasRestantes}</span>
                                                <span>Fecha límite: ${Utils.formatDate(alerta.obligacion.fecha_limite || alerta.obligacion.fecha_limite_original, 'DD/MM/YYYY')}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error al calcular alertas:', error);
            container.innerHTML = `
                <div class="text-center py-8">
                    <span class="material-symbols-outlined text-4xl text-red-300 mb-2">error</span>
                    <p class="text-sm text-red-500">Error al calcular las alertas: ${error.message}</p>
                </div>
            `;
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
