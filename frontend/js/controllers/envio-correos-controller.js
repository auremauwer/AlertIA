/**
 * Controlador de Envío de Correos
 * Maneja el flujo completo de 4 pasos para envío de correos
 */
class EnvioCorreosController {
    constructor() {
        this.alertasService = null;
        this.enviosService = null;
        this.emailTemplate = null;
        this.currentStep = 1;
        this.isLocked = false;
        this.alertasCalculadas = [];
        this.alertasSeleccionadas = [];
    }

    /**
     * Inicializar controlador
     */
    async init() {
        if (!window.dataAdapter) {
            console.error('dataAdapter no está disponible');
            return;
        }

        this.alertasService = new AlertasService(window.dataAdapter);
        this.enviosService = new EnviosService(window.dataAdapter);
        this.emailTemplate = new EmailTemplate();

        this.setupEventListeners();
        this.updateStepIndicator();
    }

    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        // Botón calcular alertas
        const btnCalculate = document.getElementById('btn-calculate-step1');
        if (btnCalculate) {
            btnCalculate.addEventListener('click', () => this.calcularAlertas());
        }

        // Navegación entre pasos
        const btnNext1 = document.getElementById('btn-next-step1');
        if (btnNext1) {
            btnNext1.addEventListener('click', () => this.goToStep(2));
        }

        const btnBack2 = document.getElementById('btn-back-step2');
        const btnNext2 = document.getElementById('btn-next-step2');
        if (btnBack2) btnBack2.addEventListener('click', () => this.goToStep(1));
        if (btnNext2) btnNext2.addEventListener('click', () => this.goToStep(3));

        const btnBack3 = document.getElementById('btn-back-step3');
        const btnNext3 = document.getElementById('btn-next-step3');
        if (btnBack3) btnBack3.addEventListener('click', () => this.goToStep(2));
        if (btnNext3) btnNext3.addEventListener('click', () => this.goToStep(4));

        const btnBack4 = document.getElementById('btn-back-step4');
        const btnSendFinal = document.getElementById('btn-send-final');
        const btnCancelFinal = document.getElementById('btn-cancel-final');
        if (btnBack4) btnBack4.addEventListener('click', () => this.goToStep(3));
        if (btnSendFinal) btnSendFinal.addEventListener('click', () => this.enviarCorreos());
        if (btnCancelFinal) btnCancelFinal.addEventListener('click', () => this.goToStep(1));

        // Deseleccionar todos
        const btnDeselect = document.getElementById('btn-deselect-all');
        if (btnDeselect) {
            btnDeselect.addEventListener('click', () => this.deselectAll());
        }
    }

    /**
     * Calcular alertas del día
     */
    async calcularAlertas() {
        try {
            const btn = document.getElementById('btn-calculate-step1');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Calculando...';
            }

            this.alertasCalculadas = await this.alertasService.calcularAlertasDelDia();
            
            // Obtener obligaciones para enriquecer alertas
            const obligacionesService = new ObligacionesService(window.dataAdapter);
            for (const alerta of this.alertasCalculadas) {
                if (alerta.obligacion_id) {
                    alerta.obligacion = await obligacionesService.getById(alerta.obligacion_id);
                }
            }

            this.renderAlertasCalculadas();
            
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span class="material-symbols-outlined text-xl">calculate</span> Calcular alertas de hoy';
            }

            const btnNext = document.getElementById('btn-next-step1');
            if (btnNext) {
                btnNext.disabled = this.alertasCalculadas.length === 0;
            }

            Utils.showNotification(`${this.alertasCalculadas.length} alertas calculadas`, 'success');
        } catch (error) {
            console.error('Error al calcular alertas:', error);
            Utils.showNotification('Error al calcular alertas', 'error');
            
            const btn = document.getElementById('btn-calculate-step1');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span class="material-symbols-outlined text-xl">calculate</span> Calcular alertas de hoy';
            }
        }
    }

    /**
     * Renderizar alertas calculadas
     */
    renderAlertasCalculadas() {
        const tbody = document.querySelector('#step-1-table tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        this.alertasCalculadas.forEach((alerta, index) => {
            const obl = alerta.obligacion;
            if (!obl) return;

            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 transition-colors';
            
            const badgeClass = alerta.tipo === '1ra Alerta' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                              alerta.tipo === '2da Alerta' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                              'bg-red-100 text-primary border border-red-200';

            row.innerHTML = `
                <td class="p-4 text-center">
                    <input class="table-checkbox" type="checkbox" data-index="${index}" checked/>
                </td>
                <td class="p-4">
                    <div class="flex flex-col">
                        <span class="text-sm font-semibold text-text-main">${obl.descripcion || obl.nombre}</span>
                        <span class="text-xs text-text-secondary">${obl.id}</span>
                    </div>
                </td>
                <td class="p-4 text-sm text-text-secondary">${obl.area}</td>
                <td class="p-4">
                    <div class="flex items-center gap-2 text-sm text-text-main">
                        <span class="material-symbols-outlined text-gray-400 text-base">person</span>
                        ${obl.responsable}
                    </div>
                </td>
                <td class="p-4 text-center">
                    <span class="alert-badge ${badgeClass}">${alerta.tipo}</span>
                </td>
                <td class="p-4 text-sm font-medium text-text-main text-right">${Utils.formatDate(obl.fecha_limite, 'DD/MM/YYYY')}</td>
            `;
            tbody.appendChild(row);
        });

        // Agregar listeners a checkboxes
        tbody.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => this.updateCount());
        });

        this.updateCount();
    }

    /**
     * Actualizar contador de correos
     */
    updateCount() {
        const checkboxes = document.querySelectorAll('#step-1-table input[type="checkbox"]:checked');
        const count = checkboxes.length;
        
        const count1 = document.getElementById('count-step1');
        const count2 = document.getElementById('count-step2');
        const confirmCount = document.getElementById('confirm-count');
        
        if (count1) count1.textContent = count;
        if (count2) count2.textContent = count;
        if (confirmCount) confirmCount.textContent = count;
    }

    /**
     * Deseleccionar todos
     */
    deselectAll() {
        document.querySelectorAll('#step-1-table input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        this.updateCount();
    }

    /**
     * Ir a paso específico
     */
    async goToStep(step) {
        if (this.isLocked && step === 4) return;

        // Ocultar todos los pasos
        document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('footer[id^="footer-step"]').forEach(el => el.classList.add('hidden'));

        // Mostrar paso actual
        const stepEl = document.getElementById(`step-${step}`);
        const footerEl = document.getElementById(`footer-step-${step}`);
        if (stepEl) stepEl.classList.add('active');
        if (footerEl) footerEl.classList.remove('hidden');

        this.currentStep = step;
        this.updateStepIndicator();

        // Acciones específicas por paso
        if (step === 2) {
            await this.populateSelectionTable();
        } else if (step === 3) {
            await this.populatePreview();
        } else if (step === 4) {
            await this.updateConfirmation();
        }
    }

    /**
     * Actualizar indicador de progreso
     */
    updateStepIndicator() {
        for (let i = 1; i <= 4; i++) {
            const indicator = document.querySelector(`.step-indicator[data-step="${i}"]`);
            if (indicator) {
                indicator.classList.remove('active', 'completed', 'pending');
                if (i < this.currentStep) {
                    indicator.classList.add('completed');
                } else if (i === this.currentStep) {
                    indicator.classList.add('active');
                } else {
                    indicator.classList.add('pending');
                }
            }
        }
    }

    /**
     * Poblar tabla de selección (Paso 2)
     */
    async populateSelectionTable() {
        const tbody = document.getElementById('selection-table-body');
        if (!tbody) return;

        const checkedBoxes = document.querySelectorAll('#step-1-table input[type="checkbox"]:checked');
        this.alertasSeleccionadas = [];

        checkedBoxes.forEach(cb => {
            const index = parseInt(cb.dataset.index);
            if (this.alertasCalculadas[index]) {
                this.alertasSeleccionadas.push(this.alertasCalculadas[index]);
            }
        });

        tbody.innerHTML = '';

        this.alertasSeleccionadas.forEach((alerta, index) => {
            const obl = alerta.obligacion;
            if (!obl) return;

            const badgeClass = alerta.tipo === '1ra Alerta' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                              alerta.tipo === '2da Alerta' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                              'bg-red-100 text-primary border border-red-200';

            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 transition-colors';
            row.innerHTML = `
                <td class="p-4 text-center">
                    <input class="table-checkbox" type="checkbox" data-index="${index}" checked/>
                </td>
                <td class="p-4">
                    <div class="flex flex-col">
                        <span class="text-sm font-semibold text-text-main">${obl.descripcion || obl.nombre}</span>
                        <span class="text-xs text-text-secondary">${obl.id}</span>
                    </div>
                </td>
                <td class="p-4 text-sm text-text-secondary">${obl.area}</td>
                <td class="p-4">
                    <div class="flex items-center gap-2 text-sm text-text-main">
                        <span class="material-symbols-outlined text-gray-400 text-base">person</span>
                        ${obl.responsable}
                    </div>
                </td>
                <td class="p-4 text-center">
                    <span class="alert-badge ${badgeClass}">${alerta.tipo}</span>
                </td>
                <td class="p-4 text-sm font-medium text-text-main text-right">${Utils.formatDate(obl.fecha_limite, 'DD/MM/YYYY')}</td>
            `;
            tbody.appendChild(row);
        });

        this.updateCount();
    }

    /**
     * Poblar vista previa (Paso 3)
     */
    async populatePreview() {
        if (this.alertasSeleccionadas.length === 0) return;

        const primeraAlerta = this.alertasSeleccionadas[0];
        const obl = primeraAlerta.obligacion;
        if (!obl) return;

        const config = await window.dataAdapter.getConfiguracion();
        const destinatario = {
            nombre: obl.responsable,
            email: `${obl.responsable.toLowerCase().replace(' ', '.')}@example.com`
        };

        const email = this.emailTemplate.generateEmail(primeraAlerta, obl, destinatario, config);

        // Actualizar elementos de vista previa
        const previewDest = document.getElementById('preview-destinatario');
        const previewAsunto = document.getElementById('preview-asunto');
        const previewNombre = document.getElementById('preview-nombre');
        const previewObligacion = document.getElementById('preview-obligacion');
        const previewFecha = document.getElementById('preview-fecha');
        const previewTipo = document.getElementById('preview-tipo-alerta');
        const previewId = document.getElementById('preview-id');
        const previewArea = document.getElementById('preview-area');
        const previewRegulador = document.getElementById('preview-regulador');
        const previewBody = document.getElementById('preview-body');

        if (previewDest) previewDest.textContent = email.destinatario;
        if (previewAsunto) previewAsunto.textContent = email.asunto;
        if (previewNombre) previewNombre.textContent = destinatario.nombre;
        if (previewObligacion) previewObligacion.textContent = obl.descripcion || obl.nombre;
        if (previewFecha) previewFecha.textContent = Utils.formatDate(obl.fecha_limite, 'DD/MM/YYYY');
        if (previewTipo) previewTipo.textContent = email.tipo;
        if (previewId) previewId.textContent = obl.id;
        if (previewArea) previewArea.textContent = obl.area;
        if (previewRegulador) previewRegulador.textContent = obl.regulador;
        if (previewBody) {
            previewBody.innerHTML = this.emailTemplate.generatePreviewHTML(email);
        }
    }

    /**
     * Actualizar confirmación (Paso 4)
     */
    async updateConfirmation() {
        const count = this.alertasSeleccionadas.length;
        const confirmCount = document.getElementById('confirm-count');
        const confirmUser = document.getElementById('confirm-user');
        const confirmTimestamp = document.getElementById('confirm-timestamp');

        if (confirmCount) confirmCount.textContent = count;
        if (confirmUser) {
            const user = await window.dataAdapter.getCurrentUser();
            confirmUser.textContent = user.nombre;
        }
        if (confirmTimestamp) {
            confirmTimestamp.textContent = Utils.formatDate(new Date(), 'DD/MM/YYYY, HH:mm');
        }
    }

    /**
     * Enviar correos
     */
    async enviarCorreos() {
        if (this.isLocked) {
            Utils.showNotification('El envío ya está en proceso. Por favor espere.', 'error');
            return;
        }

        if (this.alertasSeleccionadas.length === 0) {
            Utils.showNotification('No hay correos seleccionados para enviar', 'error');
            return;
        }

        if (!await Utils.confirm(`¿Está seguro de enviar ${this.alertasSeleccionadas.length} correos?`)) {
            return;
        }

        this.isLocked = true;
        const btnSend = document.getElementById('btn-send-final');
        if (btnSend) {
            btnSend.disabled = true;
            btnSend.innerHTML = '<span class="material-symbols-outlined mr-2 animate-spin">sync</span>Enviando...';
        }

        try {
            // Crear envío
            const envio = await this.enviosService.createEnvio(this.alertasSeleccionadas);
            
            Utils.showNotification(`Envío completado: ${envio.correos_enviados} correos enviados`, 'success');
            
            // Redirigir al historial después de 2 segundos
            setTimeout(() => {
                window.location.href = 'Historial.html';
            }, 2000);
        } catch (error) {
            console.error('Error al enviar correos:', error);
            Utils.showNotification('Error al enviar correos', 'error');
            
            if (btnSend) {
                btnSend.disabled = false;
                btnSend.innerHTML = '<span class="material-symbols-outlined mr-2">send</span>Enviar correos seleccionados';
            }
            this.isLocked = false;
        }
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.dataAdapter) {
            const controller = new EnvioCorreosController();
            controller.init();
            window.envioCorreosController = controller;
        }
    });
} else {
    if (window.dataAdapter) {
        const controller = new EnvioCorreosController();
        controller.init();
        window.envioCorreosController = controller;
    }
}

if (typeof window !== 'undefined') {
    window.EnvioCorreosController = EnvioCorreosController;
}
