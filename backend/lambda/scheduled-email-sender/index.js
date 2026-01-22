/**
 * Lambda Function: Envío Automático Programado de Correos
 * 
 * Esta función se ejecuta automáticamente mediante EventBridge
 * para enviar correos programados según la configuración del sistema.
 */

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const ses = new AWS.SES({ region: process.env.AWS_REGION || 'us-east-1' });

const OBLIGACIONES_TABLE = process.env.OBLIGACIONES_TABLE || 'alertia-obligaciones';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@alertia.com';
const FROM_NAME = process.env.FROM_NAME || 'AlertIA';

async function getConfiguracion() {
    try {
        const result = await dynamodb.get({
            TableName: OBLIGACIONES_TABLE,
            Key: { id: 'configuracion' }
        }).promise();
        
        return result.Item || {
            envios_automaticos: false,
            hora_envio: '09:00',
            enviar_fines_semana: false,
            remitente: FROM_EMAIL,
            nombre_remitente: FROM_NAME,
            cc_global: []
        };
    } catch (error) {
        console.error('Error al obtener configuración:', error);
        return {
            envios_automaticos: false,
            hora_envio: '09:00',
            enviar_fines_semana: false,
            remitente: FROM_EMAIL,
            nombre_remitente: FROM_NAME,
            cc_global: []
        };
    }
}

async function getObligacionesActivas() {
    try {
        const result = await dynamodb.scan({
            TableName: OBLIGACIONES_TABLE,
            FilterExpression: 'attribute_not_exists(estatus) OR estatus = :activa',
            ExpressionAttributeValues: { ':activa': 'activa' }
        }).promise();
        return result.Items || [];
    } catch (error) {
        console.error('Error al obtener obligaciones:', error);
        return [];
    }
}

function calcularFechasAlerta(obligacion) {
    const fechas = [];
    const fechaLimite = new Date(obligacion.fecha_limite || obligacion.fecha_limite_original);
    if (isNaN(fechaLimite.getTime())) return fechas;
    
    const reglas = obligacion.reglas_alertamiento || { alerta1: 30, alerta2: 10, critica: 5 };
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    [reglas.alerta1, reglas.alerta2, reglas.critica].forEach(dias => {
        const fechaAlerta = new Date(fechaLimite);
        fechaAlerta.setDate(fechaLimite.getDate() - dias);
        if (fechaAlerta >= hoy) {
            fechas.push(fechaAlerta.toISOString().split('T')[0]);
        }
    });
    
    return fechas;
}

function determinarTipoAlerta(obligacion, hoy) {
    const fechaLimite = new Date(obligacion.fecha_limite || obligacion.fecha_limite_original);
    const diasRestantes = Math.ceil((fechaLimite - hoy) / (1000 * 60 * 60 * 24));
    const reglas = obligacion.reglas_alertamiento || { alerta1: 30, alerta2: 10, critica: 5 };
    
    if (diasRestantes <= reglas.critica && diasRestantes > 0) return 'Crítica';
    if (diasRestantes <= reglas.alerta2 && diasRestantes > 0) return '2da Alerta';
    if (diasRestantes <= reglas.alerta1 && diasRestantes > 0) return '1ra Alerta';
    return '1ra Alerta';
}

function generarEmail(obligacion, tipoAlerta, config) {
    const fechaLimite = new Date(obligacion.fecha_limite || obligacion.fecha_limite_original);
    const fechaFormateada = fechaLimite.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
    const asunto = `[${tipoAlerta}] ${obligacion.descripcion || obligacion.nombre || 'Obligación Normativa'}`;
    const cuerpo = `<html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #ec0000;">AlertIA - ${tipoAlerta}</h2>
        <p>Estimado/a <strong>${obligacion.responsable || 'Responsable'}</strong>,</p>
        <p>Le informamos que tiene una obligación normativa pendiente:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #ec0000; margin: 20px 0;">
            <p><strong>Descripción:</strong> ${obligacion.descripcion || obligacion.nombre || 'N/A'}</p>
            <p><strong>Regulador:</strong> ${obligacion.regulador || 'N/A'}</p>
            <p><strong>Fecha Límite:</strong> ${fechaFormateada}</p>
            <p><strong>Área:</strong> ${obligacion.area || 'N/A'}</p>
        </div>
        <p>Por favor, tome las acciones necesarias para cumplir con esta obligación antes de la fecha límite.</p>
        <p>Saludos cordiales,<br><strong>${config.nombre_remitente || FROM_NAME}</strong></p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="font-size: 11px; color: #666;">Este es un correo automático, por favor no responda a esta dirección.</p>
    </body></html>`;
    return { asunto, cuerpo };
}

async function enviarCorreo(to, subject, body, cc = [], config) {
    const fromEmail = config.remitente || FROM_EMAIL;
    const fromName = config.nombre_remitente || FROM_NAME;
    const params = {
        Source: `${fromName} <${fromEmail}>`,
        Destination: { ToAddresses: [to], CcAddresses: cc.length > 0 ? cc : undefined },
        Message: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: { Html: { Data: body, Charset: 'UTF-8' } }
        }
    };
    if (!params.Destination.CcAddresses) delete params.Destination.CcAddresses;
    return await ses.sendEmail(params).promise();
}

exports.handler = async (event) => {
    console.log('📧 [Envío Automático] Event recibido');
    
    try {
        const config = await getConfiguracion();
        if (!config.envios_automaticos) {
            return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Envíos automáticos desactivados', enviados: 0 }) };
        }
        
        const ahora = new Date();
        const diaSemana = ahora.getDay();
        if ((diaSemana === 0 || diaSemana === 6) && !config.enviar_fines_semana) {
            return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Es fin de semana, envíos desactivados', enviados: 0 }) };
        }
        
        const obligaciones = await getObligacionesActivas();
        if (obligaciones.length === 0) {
            return { statusCode: 200, body: JSON.stringify({ success: true, message: 'No hay obligaciones activas', enviados: 0 }) };
        }
        
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const hoyISO = hoy.toISOString().split('T')[0];
        const alertasParaEnviar = [];
        
        for (const obligacion of obligaciones) {
            try {
                const fechasAlerta = calcularFechasAlerta(obligacion);
                if (fechasAlerta.includes(hoyISO)) {
                    const tipoAlerta = determinarTipoAlerta(obligacion, hoy);
                    alertasParaEnviar.push({ obligacion, tipoAlerta });
                }
            } catch (error) {
                console.error(`Error al procesar obligación ${obligacion.id}:`, error);
            }
        }
        
        if (alertasParaEnviar.length === 0) {
            return { statusCode: 200, body: JSON.stringify({ success: true, message: 'No hay alertas para enviar hoy', enviados: 0 }) };
        }
        
        let enviados = 0;
        let fallidos = 0;
        const errores = [];
        
        for (const { obligacion, tipoAlerta } of alertasParaEnviar) {
            try {
                const destinatario = obligacion.responsable_email || `${(obligacion.responsable || 'responsable').toLowerCase().replace(/\s+/g, '.')}@empresa.com`;
                const email = generarEmail(obligacion, tipoAlerta, config);
                await enviarCorreo(destinatario, email.asunto, email.cuerpo, config.cc_global || [], config);
                enviados++;
                console.log(`✅ Correo enviado para obligación ${obligacion.id}`);
            } catch (error) {
                fallidos++;
                errores.push({ obligacion_id: obligacion.id, error: error.message });
                console.error(`❌ Error al enviar correo para obligación ${obligacion.id}:`, error);
            }
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: 'Envío automático completado',
                enviados,
                fallidos,
                errores: errores.length > 0 ? errores : undefined
            })
        };
    } catch (error) {
        console.error('❌ Error en envío automático:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: 'Error al ejecutar envío automático',
                message: error.message
            })
        };
    }
};
