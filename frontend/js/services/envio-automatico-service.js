/**
 * Servicio de Envío Automático
 * Maneja el envío automático de correos según la configuración
 */
class EnvioAutomaticoService {
    constructor(dataAdapter) {
        this.dataAdapter = dataAdapter;
        this.intervalId = null;
        this.ultimaEjecucion = null;
    }

    /**
     * Iniciar servicio de envío automático
     */
    async iniciar() {
        // Limpiar intervalo anterior si existe
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }

        // Verificar cada minuto si es hora de enviar
        this.intervalId = setInterval(() => {
            this.verificarYEnviar();
        }, 60000); // Cada minuto

        // Ejecutar inmediatamente al iniciar
        this.verificarYEnviar();

        console.log('[Envío Automático] Servicio iniciado');
    }

    /**
     * Detener servicio de envío automático
     */
    detener() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        console.log('[Envío Automático] Servicio detenido');
    }

    /**
     * Verificar si es hora de enviar y ejecutar envíos
     */
    async verificarYEnviar() {
        try {
            // Obtener configuración
            const config = await this.dataAdapter.getConfiguracion();
            
            // Verificar si los envíos automáticos están activados
            if (!config.envios_automaticos) {
                return; // Envíos automáticos desactivados
            }

            // Obtener hora actual
            const ahora = new Date();
            const horaActual = ahora.getHours();
            const minutoActual = ahora.getMinutes();
            
            // Obtener hora configurada
            const horaConfigurada = config.hora_envio || '09:00';
            const [horaConfig, minutoConfig] = horaConfigurada.split(':').map(Number);

            // Verificar si es la hora configurada (con margen de 1 minuto)
            if (horaActual !== horaConfig || Math.abs(minutoActual - minutoConfig) > 1) {
                return; // No es la hora de envío
            }

            // Verificar si ya se ejecutó hoy a esta hora
            const hoy = ahora.toDateString();
            if (this.ultimaEjecucion === hoy) {
                return; // Ya se ejecutó hoy
            }

            // Verificar si es fin de semana
            const diaSemana = ahora.getDay(); // 0 = domingo, 6 = sábado
            const esFinDeSemana = diaSemana === 0 || diaSemana === 6;
            
            if (esFinDeSemana && !config.enviar_fines_semana) {
                console.log('[Envío Automático] Es fin de semana y los envíos están desactivados');
                return; // No enviar en fines de semana
            }

            // Ejecutar envíos
            console.log('[Envío Automático] Ejecutando envíos automáticos...');
            await this.ejecutarEnvios();
            
            // Marcar que ya se ejecutó hoy
            this.ultimaEjecucion = hoy;

        } catch (error) {
            console.error('[Envío Automático] Error al verificar envíos:', error);
        }
    }

    /**
     * Ejecutar envíos automáticos del día
     */
    async ejecutarEnvios() {
        try {
            // Obtener configuración
            const config = await this.dataAdapter.getConfiguracion();
            
            // Obtener todas las obligaciones activas
            const obligacionesService = new ObligacionesService(this.dataAdapter);
            const obligaciones = await obligacionesService.getAll();
            const obligacionesActivas = obligaciones.filter(obl => 
                obl.estatus === 'activa' || !obl.estatus
            );

            // Obtener fecha de hoy
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const hoyISO = hoy.toISOString().split('T')[0];

            // Calcular alertas del día usando CalendarioService
            const calendarioService = new CalendarioService();
            const alertasParaEnviar = [];

            for (const obligacion of obligacionesActivas) {
                try {
                    // Calcular fechas de alerta para esta obligación
                    const fechasAlerta = await calendarioService.calcularCalendario(obligacion);
                    
                    // Verificar si hoy está en las fechas de alerta
                    const hoyEnCalendario = fechasAlerta.some(fecha => {
                        const fechaAlerta = new Date(fecha);
                        fechaAlerta.setHours(0, 0, 0, 0);
                        return fechaAlerta.getTime() === hoy.getTime();
                    });

                    if (hoyEnCalendario) {
                        // Calcular tipo de alerta según días restantes
                        const fechaLimite = new Date(obligacion.fecha_limite || obligacion.fecha_limite_original);
                        const diasRestantes = Math.ceil((fechaLimite - hoy) / (1000 * 60 * 60 * 24));
                        
                        const reglas = obligacion.reglas_alertamiento || {
                            alerta1: 30,
                            alerta2: 10,
                            critica: 5
                        };

                        let tipoAlerta = '1ra Alerta';
                        if (diasRestantes <= reglas.critica && diasRestantes > 0) {
                            tipoAlerta = 'Crítica';
                        } else if (diasRestantes <= reglas.alerta2 && diasRestantes > 0) {
                            tipoAlerta = '2da Alerta';
                        } else if (diasRestantes <= reglas.alerta1 && diasRestantes > 0) {
                            tipoAlerta = '1ra Alerta';
                        }

                        // Verificar si ya se envió hoy
                        const alertasExistentes = await this.dataAdapter.getAlertas({
                            obligacion_id: obligacion.id,
                            fecha: hoyISO
                        });

                        if (alertasExistentes.length === 0 || alertasExistentes.every(a => a.estado !== 'enviada')) {
                            alertasParaEnviar.push({
                                obligacion: obligacion,
                                tipo: tipoAlerta,
                                diasRestantes: diasRestantes
                            });
                        }
                    }
                } catch (error) {
                    console.warn(`[Envío Automático] Error al procesar obligación ${obligacion.id}:`, error);
                }
            }

            if (alertasParaEnviar.length === 0) {
                console.log('[Envío Automático] No hay alertas para enviar hoy');
                return;
            }

            // Enviar correos
            console.log(`[Envío Automático] Enviando ${alertasParaEnviar.length} alertas...`);
            
            const notificacionesService = new NotificacionesService(this.dataAdapter);
            const emailTemplate = new EmailTemplate();
            const user = await this.dataAdapter.getCurrentUser();

            let enviados = 0;
            let fallidos = 0;

            for (const alerta of alertasParaEnviar) {
                try {
                    const obligacion = alerta.obligacion;
                    
                    // Obtener destinatario
                    const destinatario = {
                        nombre: obligacion.responsable || 'Responsable',
                        email: `${(obligacion.responsable || 'responsable').toLowerCase().replace(/\s+/g, '.')}@empresa.com`
                    };

                    // Generar email
                    const email = emailTemplate.generateEmail(
                        { tipo: alerta.tipo },
                        obligacion,
                        destinatario,
                        config
                    );

                    // Enviar correo
                    await notificacionesService.enviarPorSES(
                        destinatario.email,
                        email.asunto,
                        email.cuerpo,
                        config.cc_global || [],
                        config.remitente,
                        config.nombre_remitente
                    );

                    // Crear alerta y marcarla como enviada
                    const alertaData = {
                        id: `auto-${obligacion.id}-${hoyISO}-${Date.now()}`,
                        obligacion_id: obligacion.id,
                        tipo: alerta.tipo,
                        fecha: hoyISO,
                        estado: 'enviada',
                        fecha_envio: new Date().toISOString()
                    };
                    await this.dataAdapter.saveAlerta(alertaData);

                    // Registrar envío
                    const enviosService = new EnviosService(this.dataAdapter);
                    await enviosService.createEnvio([{
                        id: alertaData.id,
                        obligacion: obligacion
                    }]);

                    enviados++;
                } catch (error) {
                    console.error(`[Envío Automático] Error al enviar alerta para ${alerta.obligacion.id}:`, error);
                    fallidos++;
                }
            }

            // Registrar en auditoría
            await this.dataAdapter.saveAuditoria({
                usuario: user?.nombre || 'Sistema',
                accion: 'Ejecutó envío automático',
                contexto: {
                    fecha: hoyISO,
                    hora: config.hora_envio,
                    total: alertasParaEnviar.length,
                    enviados: enviados,
                    fallidos: fallidos
                },
                ip: Utils.getUserIP()
            });

            console.log(`[Envío Automático] ✅ Envío completado: ${enviados} enviados, ${fallidos} fallidos`);

        } catch (error) {
            console.error('[Envío Automático] Error al ejecutar envíos:', error);
        }
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.EnvioAutomaticoService = EnvioAutomaticoService;
}
