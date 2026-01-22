/**
 * Servicio de Notificaciones
 * Maneja el envío de notificaciones por correo electrónico
 */
class NotificacionesService {
    constructor(dataAdapter) {
        this.dataAdapter = dataAdapter;
    }

    /**
     * Enviar correo por AWS SES (producción)
     * @param {string} to - Destinatario
     * @param {string} subject - Asunto
     * @param {string} body - Cuerpo del correo
     * @param {Array} cc - Lista de CC (opcional)
     * @param {string} from - Email remitente (opcional)
     * @param {string} fromName - Nombre del remitente (opcional)
     * @returns {Promise<object>} Resultado del envío
     */
    async enviarPorSES(to, subject, body, cc = [], from = null, fromName = null) {
        try {
            // Obtener configuración
            const config = await this.dataAdapter.getConfiguracion();
            
            const payload = {
                to: Array.isArray(to) ? to : [to],
                subject: subject,
                body: body,
                cc: cc && cc.length > 0 ? (Array.isArray(cc) ? cc : [cc]) : [],
                from: from || config.remitente || 'auremauwer@gmail.com',
                fromName: fromName || config.nombre_remitente || 'AlertIA'
            };
            
            console.log('[Notificaciones] Enviando correo por SES:', payload);
            
            // Llamar a la API
            const response = await fetch(`${ENV.API_BASE_URL}/email/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(error.message || error.error || 'Error al enviar correo');
            }
            
            const result = await response.json();
            console.log('[Notificaciones] Correo enviado exitosamente por SES:', result);
            return result;
            
        } catch (error) {
            console.error('[Notificaciones] Error al enviar correo por SES:', error);
            throw error;
        }
    }

    /**
     * Enviar correo (detecta automáticamente si usar Outlook o SES)
     * @param {string} to - Destinatario
     * @param {string} subject - Asunto
     * @param {string} body - Cuerpo del correo
     * @param {Array} cc - Lista de CC (opcional)
     * @param {string} from - Email remitente (opcional)
     * @param {string} fromName - Nombre del remitente (opcional)
     * @returns {Promise<boolean|object>} Resultado del envío
     */
    async enviarCorreo(to, subject, body, cc = [], from = null, fromName = null) {
        if (ENV.USE_LOCAL_STORAGE) {
            // Modo local: usar Outlook
            console.log('[Notificaciones] Modo local: usando Outlook');
            return this.enviarPorOutlook(to, subject, body, cc);
        } else {
            // Modo producción: usar SES
            console.log('[Notificaciones] Modo producción: usando SES');
            return await this.enviarPorSES(to, subject, body, cc, from, fromName);
        }
    }

    /**
     * Enviar correo por Outlook usando mailto:
     * @param {string} to - Destinatario
     * @param {string} subject - Asunto
     * @param {string} body - Cuerpo del correo
     * @param {Array} cc - Lista de CC (opcional)
     */
    enviarPorOutlook(to, subject, body, cc = []) {
        try {
            // Codificar parámetros para URL
            const toEncoded = encodeURIComponent(to);
            const subjectEncoded = encodeURIComponent(subject);
            const bodyEncoded = encodeURIComponent(body);
            
            // Construir mailto link
            let mailtoLink = `mailto:${toEncoded}?subject=${subjectEncoded}&body=${bodyEncoded}`;
            
            // Agregar CC si existe
            if (cc && cc.length > 0) {
                const ccEncoded = encodeURIComponent(cc.join(';'));
                mailtoLink += `&cc=${ccEncoded}`;
            }
            
            // Abrir cliente de correo (Outlook si está configurado)
            window.location.href = mailtoLink;
            
            console.log('[Notificaciones] Abriendo Outlook con correo:', { to, subject });
            return true;
        } catch (error) {
            console.error('[Notificaciones] Error al abrir Outlook:', error);
            return false;
        }
    }

    /**
     * Mostrar diálogo para editar o enviar correo
     * @param {string} to - Destinatario
     * @param {string} subject - Asunto
     * @param {string} body - Cuerpo del correo
     * @param {Array} cc - Lista de CC (opcional)
     * @returns {Promise<boolean>} - true si se envió, false si se canceló
     */
    async mostrarDialogoEditarOEnviar(to, subject, body, cc = []) {
        return new Promise((resolve) => {
            // Crear modal de diálogo
            const dialogModal = document.createElement('div');
            dialogModal.className = 'fixed inset-0 z-[500] flex items-center justify-center bg-black bg-opacity-50';
            dialogModal.innerHTML = `
                <div class="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
                    <h3 class="text-lg font-bold mb-4 text-gray-900">Enviar Correo</h3>
                    <p class="text-sm text-gray-600 mb-6">¿Desea editar el correo antes de enviarlo o enviarlo directamente?</p>
                    <div class="flex gap-3 justify-end">
                        <button id="btn-cancelar-dialogo" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium">
                            Cancelar
                        </button>
                        <button id="btn-editar-correo" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                            Editar
                        </button>
                        <button id="btn-enviar-directo" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium">
                            Enviar
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(dialogModal);

            // Event listeners
            const btnCancelar = dialogModal.querySelector('#btn-cancelar-dialogo');
            const btnEditar = dialogModal.querySelector('#btn-editar-correo');
            const btnEnviar = dialogModal.querySelector('#btn-enviar-directo');

            const limpiar = () => {
                document.body.removeChild(dialogModal);
            };

            btnCancelar.addEventListener('click', () => {
                limpiar();
                resolve(false);
            });

            btnEnviar.addEventListener('click', async () => {
                limpiar();
                try {
                    await this.enviarCorreo(to, subject, body, cc);
                    if (!ENV.USE_LOCAL_STORAGE) {
                        Utils.showNotification('Correo enviado exitosamente', 'success');
                    }
                    resolve(true);
                } catch (error) {
                    console.error('Error al enviar correo:', error);
                    Utils.showNotification('Error al enviar correo: ' + error.message, 'error');
                    resolve(false);
                }
            });

            btnEditar.addEventListener('click', () => {
                limpiar();
                this.mostrarModalEditarCorreo(to, subject, body, cc).then((enviado) => {
                    resolve(enviado);
                });
            });
        });
    }

    /**
     * Mostrar modal para editar correo
     * @param {string} to - Destinatario
     * @param {string} subject - Asunto
     * @param {string} body - Cuerpo del correo
     * @param {Array} cc - Lista de CC (opcional)
     * @returns {Promise<boolean>} - true si se envió, false si se canceló
     */
    async mostrarModalEditarCorreo(to, subject, body, cc = []) {
        return new Promise((resolve) => {
            // Crear modal de edición
            const editModal = document.createElement('div');
            editModal.className = 'fixed inset-0 z-[600] flex items-center justify-center bg-black bg-opacity-50';
            editModal.innerHTML = `
                <div class="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] mx-4 shadow-2xl flex flex-col overflow-hidden">
                    <!-- Header -->
                    <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
                        <h3 class="text-lg font-bold text-gray-900">Editar Correo</h3>
                        <button id="btn-cerrar-editar" class="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <span class="material-symbols-outlined text-gray-600">close</span>
                        </button>
                    </div>
                    
                    <!-- Contenido -->
                    <div class="flex-1 overflow-y-auto p-6 space-y-4">
                        <!-- Destinatario -->
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Para:</label>
                            <input type="text" id="edit-to" value="${to}" 
                                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none">
                        </div>
                        
                        <!-- CC -->
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">CC:</label>
                            <input type="text" id="edit-cc" value="${cc && cc.length > 0 ? cc.join('; ') : ''}" 
                                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                                placeholder="correo1@dominio.com; correo2@dominio.com">
                            <p class="text-xs text-gray-500 mt-1">Separe múltiples correos electrónicos por punto y coma (;)</p>
                        </div>
                        
                        <!-- Asunto -->
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Asunto:</label>
                            <input type="text" id="edit-subject" value="${subject.replace(/"/g, '&quot;')}" 
                                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none">
                        </div>
                        
                        <!-- Cuerpo -->
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Mensaje:</label>
                            <textarea id="edit-body" rows="15" 
                                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none font-mono"
                                style="white-space: pre-wrap;"></textarea>
                        </div>
                    </div>
                    
                    <!-- Footer -->
                    <div class="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end bg-gray-50 shrink-0">
                        <button id="btn-cancelar-editar" 
                            class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium">
                            Cancelar
                        </button>
                        <button id="btn-enviar-editar" 
                            class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center gap-2">
                            <span class="material-symbols-outlined text-lg">send</span>
                            Enviar
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(editModal);

            // Event listeners
            const btnCerrar = editModal.querySelector('#btn-cerrar-editar');
            const btnCancelar = editModal.querySelector('#btn-cancelar-editar');
            const btnEnviar = editModal.querySelector('#btn-enviar-editar');
            const inputTo = editModal.querySelector('#edit-to');
            const inputSubject = editModal.querySelector('#edit-subject');
            const textareaBody = editModal.querySelector('#edit-body');
            const inputCC = editModal.querySelector('#edit-cc');

            // Establecer el valor del textarea después de crear el elemento
            textareaBody.value = body;

            const limpiar = () => {
                document.body.removeChild(editModal);
            };

            const enviar = async () => {
                const nuevoTo = inputTo.value.trim();
                const nuevoSubject = inputSubject.value.trim();
                const nuevoBody = textareaBody.value.trim();
                const nuevoCC = inputCC && inputCC.value.trim() 
                    ? inputCC.value.split(';').map(e => e.trim()).filter(e => e) 
                    : [];

                if (!nuevoTo || !nuevoSubject || !nuevoBody) {
                    Utils.showNotification('Por favor complete todos los campos requeridos', 'warning');
                    return;
                }

                limpiar();
                try {
                    await this.enviarCorreo(nuevoTo, nuevoSubject, nuevoBody, nuevoCC);
                    if (!ENV.USE_LOCAL_STORAGE) {
                        Utils.showNotification('Correo enviado exitosamente', 'success');
                    }
                    resolve(true);
                } catch (error) {
                    console.error('Error al enviar correo:', error);
                    Utils.showNotification('Error al enviar correo: ' + error.message, 'error');
                    resolve(false);
                }
            };

            btnCerrar.addEventListener('click', () => {
                limpiar();
                resolve(false);
            });

            btnCancelar.addEventListener('click', () => {
                limpiar();
                resolve(false);
            });

            btnEnviar.addEventListener('click', enviar);

            // Cerrar con ESC
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    limpiar();
                    resolve(false);
                    document.removeEventListener('keydown', handleEsc);
                }
            };
            document.addEventListener('keydown', handleEsc);

            // Focus en el textarea
            setTimeout(() => textareaBody.focus(), 100);
        });
    }

    /**
     * Formatear cuerpo de correo para notificación de archivo
     */
    formatearCuerpoNotificacionArchivo(emailData) {
        return `Estimado/a Responsable CN,

Se ha subido una nueva evidencia para la obligación:

ID: ${emailData.obligacion.id}
Descripción: ${emailData.obligacion.descripcion}
Regulador: ${emailData.obligacion.regulador}
Área: ${emailData.obligacion.area}

Archivo:
- Nombre: ${emailData.archivo.nombre}
- Tipo: ${emailData.archivo.tipo}
- Tamaño: ${this.formatearTamaño(emailData.archivo.tamaño)}

Subido por: ${emailData.usuario.nombre} (${emailData.usuario.area})

Por favor, revise la evidencia en el siguiente enlace:
${emailData.enlace}

Saludos,
AlertIA`;
    }

    /**
     * Formatear cuerpo de correo para notificación jurídico
     */
    formatearCuerpoNotificacionJuridico(emailData) {
        return `Estimado/a Responsable Jurídico,

Se requiere la redacción de un escrito para la siguiente obligación:

ID: ${emailData.obligacion.id}
Descripción: ${emailData.obligacion.descripcion}
Regulador: ${emailData.obligacion.regulador}
Área: ${emailData.obligacion.area}
Fecha límite: ${Utils.formatDate(emailData.obligacion.fecha_limite, 'DD/MM/YYYY')}

Por favor, proceda con la redacción del escrito. Puede acceder a los detalles en:
${emailData.enlace}

Saludos,
AlertIA`;
    }

    /**
     * Formatear cuerpo de correo para verificación de evidencia
     */
    formatearCuerpoVerificacionEvidencia(emailData) {
        let cuerpo = `Estimado/a Responsable CN,

Se han enviado ${emailData.cantidad_archivos} evidencia(s) nueva(s) para verificación:

ID Obligación: ${emailData.obligacion.id}
Descripción: ${emailData.obligacion.descripcion}
Regulador: ${emailData.obligacion.regulador}
Área: ${emailData.obligacion.area}
Fecha límite: ${Utils.formatDate(emailData.obligacion.fecha_limite, 'DD/MM/YYYY')}

Archivos enviados:
`;

        emailData.archivos.forEach((archivo, index) => {
            cuerpo += `${index + 1}. ${archivo.nombre} (${this.formatearTamaño(archivo.tamaño)})\n`;
        });

        cuerpo += `\nPor favor, revise las evidencias en el siguiente enlace:
${emailData.enlace}

Saludos,
AlertIA`;

        return cuerpo;
    }

    /**
     * Formatear cuerpo de correo para rechazo de evidencia
     */
    formatearCuerpoRechazoEvidencia(emailData) {
        return `Estimado/a Responsable del Área ${emailData.obligacion.area},

Le informamos que la evidencia enviada para la siguiente obligación ha sido rechazada:

ID: ${emailData.obligacion.id}
Descripción: ${emailData.obligacion.descripcion}
Regulador: ${emailData.obligacion.regulador}
Fecha límite: ${Utils.formatDate(emailData.obligacion.fecha_limite, 'DD/MM/YYYY')}

Por favor, revise los comentarios y vuelva a subir la evidencia corregida en:
${emailData.enlace}

Saludos,
AlertIA`;
    }

    /**
     * Formatear cuerpo de correo para recordatorio
     */
    formatearCuerpoRecordatorio(emailData) {
        return `Estimado/a Responsable del Área ${emailData.area},

Este es un recordatorio para subir la evidencia correspondiente a la siguiente obligación:

ID: ${emailData.obligacion.id}
Descripción: ${emailData.obligacion.descripcion}
Regulador: ${emailData.obligacion.regulador}
Fecha límite: ${Utils.formatDate(emailData.obligacion.fecha_limite, 'DD/MM/YYYY')}
Fecha del recordatorio: ${emailData.recordatorio.fecha_formateada}

Por favor, suba la evidencia en el siguiente enlace:
${emailData.enlace}

Saludos,
AlertIA`;
    }

    /**
     * Formatear tamaño de archivo
     */
    formatearTamaño(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Enviar notificación al responsable CN cuando se sube un archivo
     * @param {string} obligacionId - ID de la obligación
     * @param {object} archivo - Información del archivo subido
     * @param {object} usuario - Usuario que subió el archivo
     * @param {string} area - Área que subió el archivo
     */
    async enviarNotificacionArchivo(obligacionId, archivo, usuario, area) {
        try {
            // Obtener información de la obligación
            const obligacion = await this.dataAdapter.getObligacion(obligacionId);
            if (!obligacion) {
                console.warn(`[Notificaciones] Obligación ${obligacionId} no encontrada`);
                return;
            }

            // Obtener configuración para obtener email del responsable CN
            const configService = new ConfigService(this.dataAdapter);
            const config = await configService.getConfiguracion();
            
            // Construir información del email
            const emailData = {
                to: config.email_responsable_cn || 'responsable.cn@alertia.com', // Email del responsable CN
                subject: `[AlertIA] Nueva evidencia subida - ${obligacionId}`,
                obligacion: {
                    id: obligacion.id || obligacion.id_oficial,
                    descripcion: obligacion.descripcion || obligacion.nombre,
                    regulador: obligacion.regulador,
                    area: area
                },
                archivo: {
                    nombre: archivo.nombre,
                    tipo: archivo.tipo,
                    tamaño: archivo.tamaño,
                    descripcion: archivo.descripcion || 'Sin descripción'
                },
                usuario: {
                    nombre: usuario.nombre || 'Usuario',
                    area: area
                },
                fecha: new Date().toISOString(),
                enlace: `${window.location.origin}/frontend/DetalleObligaciones.html?id=${obligacionId}`
            };

            // Mostrar diálogo para editar o enviar
            const cuerpo = this.formatearCuerpoNotificacionArchivo(emailData);
            await this.mostrarDialogoEditarOEnviar(
                emailData.to,
                emailData.subject,
                cuerpo,
                config.cc_global || []
            );
            
        } catch (error) {
            console.error('[Notificaciones] Error al enviar notificación de archivo:', error);
            // No lanzar error para no interrumpir el flujo
        }
    }

    /**
     * Enviar notificación al responsable jurídico para redactar escrito
     * @param {string} obligacionId - ID de la obligación
     */
    async enviarNotificacionJuridico(obligacionId) {
        try {
            // Obtener información de la obligación
            const obligacion = await this.dataAdapter.getObligacion(obligacionId);
            if (!obligacion) {
                console.warn(`[Notificaciones] Obligación ${obligacionId} no encontrada`);
                return;
            }

            // Obtener configuración para obtener email del responsable jurídico
            const configService = new ConfigService(this.dataAdapter);
            const config = await configService.getConfiguracion();
            
            // Construir información del email
            const emailData = {
                to: config.email_responsable_juridico || 'responsable.juridico@alertia.com', // Email del responsable jurídico
                subject: `[AlertIA] Solicitud de redacción de escrito - ${obligacionId}`,
                obligacion: {
                    id: obligacion.id || obligacion.id_oficial,
                    descripcion: obligacion.descripcion || obligacion.nombre,
                    regulador: obligacion.regulador,
                    area: obligacion.area_responsable || obligacion.area,
                    fecha_limite: obligacion.fecha_limite || obligacion.fecha_limite_original
                },
                fecha: new Date().toISOString(),
                enlace: `${window.location.origin}/frontend/DetalleObligaciones.html?id=${obligacionId}`
            };

            // Mostrar diálogo para editar o enviar
            const cuerpo = this.formatearCuerpoNotificacionJuridico(emailData);
            await this.mostrarDialogoEditarOEnviar(
                emailData.to,
                emailData.subject,
                cuerpo,
                config.cc_global || []
            );
            
        } catch (error) {
            console.error('[Notificaciones] Error al enviar notificación a responsable jurídico:', error);
            // No lanzar error para no interrumpir el flujo
        }
    }

    /**
     * Enviar notificación al responsable CN para verificar evidencia enviada
     * @param {string} obligacionId - ID de la obligación
     * @param {Array} archivos - Array de archivos enviados para verificación
     */
    async enviarNotificacionVerificacionEvidencia(obligacionId, archivos = []) {
        try {
            // Obtener información de la obligación
            const obligacion = await this.dataAdapter.getObligacion(obligacionId);
            if (!obligacion) {
                console.warn(`[Notificaciones] Obligación ${obligacionId} no encontrada`);
                return;
            }

            // Obtener configuración para obtener email del responsable CN
            const configService = new ConfigService(this.dataAdapter);
            const config = await configService.getConfiguracion();
            
            // Construir información del email
            const emailData = {
                to: config.email_responsable_cn || 'responsable.cn@alertia.com', // Email del responsable CN
                subject: `[AlertIA] Nueva evidencia para verificación - ${obligacionId}`,
                obligacion: {
                    id: obligacion.id || obligacion.id_oficial,
                    descripcion: obligacion.descripcion || obligacion.nombre,
                    regulador: obligacion.regulador,
                    area: obligacion.area_responsable || obligacion.area,
                    fecha_limite: obligacion.fecha_limite || obligacion.fecha_limite_original
                },
                archivos: archivos.map(a => ({
                    nombre: a.nombre,
                    tipo: a.tipo,
                    tamaño: a.tamaño,
                    fecha_subida: a.fecha_subida
                })),
                cantidad_archivos: archivos.length,
                fecha: new Date().toISOString(),
                enlace: `${window.location.origin}/frontend/Evidencias.html?folio=${obligacionId}`
            };

            // Mostrar diálogo para editar o enviar
            const cuerpo = this.formatearCuerpoVerificacionEvidencia(emailData);
            await this.mostrarDialogoEditarOEnviar(
                emailData.to,
                emailData.subject,
                cuerpo,
                config.cc_global || []
            );
            
        } catch (error) {
            console.error('[Notificaciones] Error al enviar notificación de verificación de evidencia:', error);
            // No lanzar error para no interrumpir el flujo
        }
    }

    /**
     * Enviar notificación al área responsable cuando se rechaza evidencia
     * @param {string} obligacionId - ID de la obligación
     */
    async enviarNotificacionRechazoEvidencia(obligacionId) {
        try {
            // Obtener información de la obligación
            const obligacion = await this.dataAdapter.getObligacion(obligacionId);
            if (!obligacion) {
                console.warn(`[Notificaciones] Obligación ${obligacionId} no encontrada`);
                return;
            }

            // Obtener área responsable
            const area = obligacion.area_responsable || obligacion.area;
            if (!area) {
                console.warn(`[Notificaciones] No se encontró área responsable para obligación ${obligacionId}`);
                return;
            }

            // Obtener email del área (formato genérico basado en el nombre del área)
            const emailArea = `${area.toLowerCase().replace(/\s+/g, '.')}@alertia.com`;

            // Construir información del email
            const emailData = {
                to: emailArea,
                subject: `[AlertIA] Evidencia rechazada - ${obligacionId}`,
                obligacion: {
                    id: obligacion.id || obligacion.id_oficial,
                    descripcion: obligacion.descripcion || obligacion.nombre,
                    regulador: obligacion.regulador,
                    area: area,
                    fecha_limite: obligacion.fecha_limite || obligacion.fecha_limite_original
                },
                fecha: new Date().toISOString(),
                enlace: `${window.location.origin}/frontend/Evidencias.html`
            };

            // Mostrar diálogo para editar o enviar
            const cuerpo = this.formatearCuerpoRechazoEvidencia(emailData);
            await this.mostrarDialogoEditarOEnviar(
                emailData.to,
                emailData.subject,
                cuerpo
            );
            
        } catch (error) {
            console.error('[Notificaciones] Error al enviar notificación de rechazo de evidencia:', error);
            // No lanzar error para no interrumpir el flujo
        }
    }

    /**
     * Enviar recordatorio a área responsable para subir evidencia
     * @param {string} obligacionId - ID de la obligación
     * @param {string} fechaRecordatorio - Fecha del recordatorio (ISO string)
     * @param {string} area - Área responsable
     */
    async enviarRecordatorioEvidencia(obligacionId, fechaRecordatorio, area) {
        try {
            // Obtener información de la obligación
            const obligacion = await this.dataAdapter.getObligacion(obligacionId);
            if (!obligacion) {
                console.warn(`[Notificaciones] Obligación ${obligacionId} no encontrada`);
                return;
            }

            // Obtener configuración
            const configService = new ConfigService(this.dataAdapter);
            const config = await configService.getConfiguracion();

            // Obtener email del área (esto debería venir de la configuración de usuarios/áreas)
            // Por ahora, usar un formato genérico
            const emailArea = `${area.toLowerCase().replace(/\s+/g, '.')}@alertia.com`;

            // Construir información del email
            const emailData = {
                to: emailArea,
                subject: `[AlertIA] Recordatorio: Subir evidencia - ${obligacionId}`,
                obligacion: {
                    id: obligacion.id || obligacion.id_oficial,
                    descripcion: obligacion.descripcion || obligacion.nombre,
                    regulador: obligacion.regulador,
                    fecha_limite: obligacion.fecha_limite || obligacion.fecha_limite_original
                },
                recordatorio: {
                    fecha: fechaRecordatorio,
                    fecha_formateada: Utils.formatDate(fechaRecordatorio, 'DD/MM/YYYY')
                },
                area: area,
                enlace: `${window.location.origin}/frontend/Evidencias.html`
            };

            // Mostrar diálogo para editar o enviar
            const cuerpo = this.formatearCuerpoRecordatorio(emailData);
            await this.mostrarDialogoEditarOEnviar(
                emailData.to,
                emailData.subject,
                cuerpo
            );
            
        } catch (error) {
            console.error('[Notificaciones] Error al enviar recordatorio:', error);
            // No lanzar error para no interrumpir el flujo
        }
    }

    /**
     * Enviar recordatorio simple al área responsable
     * @param {string} obligacionId - ID de la obligación
     * @returns {Promise<void>}
     */
    async enviarRecordatorioSimple(obligacionId) {
        try {
            // Obtener información de la obligación
            const obligacion = await this.dataAdapter.getObligacion(obligacionId);
            if (!obligacion) {
                throw new Error(`Obligación ${obligacionId} no encontrada`);
            }

            // Obtener área responsable
            const area = obligacion.area_responsable || obligacion.area || 'Área no especificada';
            
            // Obtener email del área (formato genérico)
            // NOTA: En modo sandbox de SES, solo se pueden enviar correos a emails verificados
            // Para producción, verificar el email del área o salir del sandbox mode
            let emailArea = `${area.toLowerCase().replace(/\s+/g, '.')}@alertia.com`;
            
            // En modo producción con SES, si estamos en sandbox, usar email verificado como destinatario
            if (!ENV.USE_LOCAL_STORAGE) {
                // En sandbox de SES, usar el email verificado como destinatario para pruebas
                // TODO: En producción, verificar el email del área o solicitar salir del sandbox
                emailArea = 'auremauwer@gmail.com'; // Email verificado en SES
                console.log(`[Notificaciones] Modo sandbox SES: usando email verificado como destinatario`);
            }

            // Construir email simple
            const subject = `[AlertIA] Recordatorio - ${obligacionId}`;
            const body = 'Tienes una obligación pendiente';

            // Enviar correo (usará SES en producción, Outlook en local)
            await this.enviarCorreo(
                emailArea,
                subject,
                body,
                [],
                null,
                'AlertIA'
            );

            console.log(`[Notificaciones] Recordatorio simple enviado a ${emailArea} para obligación ${obligacionId}`);
            
        } catch (error) {
            console.error('[Notificaciones] Error al enviar recordatorio simple:', error);
            throw error;
        }
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.NotificacionesService = NotificacionesService;
    window.notificacionesService = null; // Se inicializará cuando se necesite
}
