/**
 * Lambda Function: Enviar Correo con AWS SES
 * 
 * Esta función recibe una petición POST con los datos del correo
 * y lo envía usando Amazon SES.
 */

const AWS = require('aws-sdk');
// AWS_REGION es establecida automáticamente por Lambda
const ses = new AWS.SES({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1' });

exports.handler = async (event) => {
    console.log('📧 Event recibido:', JSON.stringify(event, null, 2));
    
    // Manejar preflight CORS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Max-Age': '3600'
            },
            body: ''
        };
    }
    
    try {
        // Parsear el body
        let body;
        try {
            body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        } catch (parseError) {
            console.error('❌ Error al parsear body:', parseError);
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                body: JSON.stringify({ 
                    error: 'Body inválido',
                    message: 'El body debe ser un JSON válido'
                })
            };
        }
        
        const { to, subject, body: emailBody, cc = [], from, fromName } = body;
        
        // Validar parámetros requeridos
        if (!to) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                body: JSON.stringify({ 
                    error: 'Falta el parámetro requerido: to (destinatario)'
                })
            };
        }
        
        if (!subject) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                body: JSON.stringify({ 
                    error: 'Falta el parámetro requerido: subject (asunto)'
                })
            };
        }
        
        if (!emailBody) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                body: JSON.stringify({ 
                    error: 'Falta el parámetro requerido: body (cuerpo del correo)'
                })
            };
        }
        
        // Obtener email remitente (de parámetro, variable de entorno, o default)
        // IMPORTANTE: Debe ser un email verificado en SES
        const fromEmail = from || process.env.FROM_EMAIL || 'auremauwer@gmail.com';
        const fromEmailName = fromName || process.env.FROM_NAME || 'AlertIA';
        
        // Normalizar destinatarios (aceptar string o array)
        const toAddresses = Array.isArray(to) ? to : [to];
        
        // Normalizar CC (aceptar string, array, o string separado por comas/punto y coma)
        let ccAddresses = [];
        if (cc && cc.length > 0) {
            if (Array.isArray(cc)) {
                ccAddresses = cc;
            } else if (typeof cc === 'string') {
                // Separar por comas o punto y coma
                ccAddresses = cc.split(/[,;]/).map(email => email.trim()).filter(email => email);
            }
        }
        
        // Preparar parámetros para SES
        const params = {
            Source: fromEmailName ? `${fromEmailName} <${fromEmail}>` : fromEmail,
            Destination: {
                ToAddresses: toAddresses,
                CcAddresses: ccAddresses.length > 0 ? ccAddresses : undefined
            },
            Message: {
                Subject: {
                    Data: subject,
                    Charset: 'UTF-8'
                },
                Body: {
                    Html: {
                        Data: emailBody.replace(/\n/g, '<br>').replace(/\r/g, ''),
                        Charset: 'UTF-8'
                    },
                    Text: {
                        Data: emailBody,
                        Charset: 'UTF-8'
                    }
                }
            }
        };
        
        // Remover CcAddresses si está vacío (SES no acepta arrays vacíos)
        if (!params.Destination.CcAddresses) {
            delete params.Destination.CcAddresses;
        }
        
        console.log('📤 Enviando correo con SES:', {
            from: params.Source,
            to: toAddresses,
            cc: ccAddresses,
            subject: subject
        });
        
        // Enviar correo usando SES
        const result = await ses.sendEmail(params).promise();
        
        console.log('✅ Correo enviado exitosamente. MessageId:', result.MessageId);
        
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                success: true,
                messageId: result.MessageId,
                message: 'Correo enviado exitosamente',
                to: toAddresses,
                cc: ccAddresses
            })
        };
        
    } catch (error) {
        console.error('❌ Error al enviar correo:', error);
        
        // Error específico de SES
        if (error.code === 'MessageRejected') {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    error: 'Correo rechazado',
                    message: error.message || 'El correo fue rechazado por SES. Verifica que el remitente esté verificado.',
                    code: error.code
                })
            };
        }
        
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                error: 'Error al enviar correo',
                message: error.message || 'Error desconocido al enviar el correo',
                code: error.code || 'UNKNOWN_ERROR'
            })
        };
    }
};
