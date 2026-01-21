/**
 * Servicio de Notificaciones
 * Maneja el envío de notificaciones por correo electrónico
 */
class NotificacionesService {
    constructor(dataAdapter) {
        this.dataAdapter = dataAdapter;
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

            // En local, simular envío (log en consola)
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log('[Notificaciones] [SIMULADO] Email de notificación de archivo:', emailData);
                Utils.showNotification('Notificación enviada (simulado en desarrollo)', 'info');
                return;
            }

            // En producción, enviar via API/Lambda
            // TODO: Implementar llamada a Lambda function cuando esté disponible
            console.log('[Notificaciones] Email de notificación de archivo:', emailData);
            
        } catch (error) {
            console.error('[Notificaciones] Error al enviar notificación de archivo:', error);
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

            // En local, simular envío (log en consola)
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log('[Notificaciones] [SIMULADO] Email de recordatorio:', emailData);
                return;
            }

            // En producción, enviar via API/Lambda
            // TODO: Implementar llamada a Lambda function cuando esté disponible
            console.log('[Notificaciones] Email de recordatorio:', emailData);
            
        } catch (error) {
            console.error('[Notificaciones] Error al enviar recordatorio:', error);
            // No lanzar error para no interrumpir el flujo
        }
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.NotificacionesService = NotificacionesService;
    window.notificacionesService = null; // Se inicializará cuando se necesite
}
