/**
 * Lambda Function: CRUD de Obligaciones
 * 
 * Esta función maneja las operaciones CRUD básicas para obligaciones
 * usando DynamoDB.
 */

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.OBLIGACIONES_TABLE || 'alertia-obligaciones';

// Headers CORS comunes
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Content-Type': 'application/json'
};

exports.handler = async (event) => {
    console.log('📋 Event recibido:', JSON.stringify(event, null, 2));
    
    const { httpMethod, pathParameters, body, queryStringParameters } = event;
    
    // Manejar preflight CORS
    if (httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }
    
    try {
        switch (httpMethod) {
            case 'GET':
                if (pathParameters && pathParameters.id) {
                    // GET /obligaciones/{id} - Obtener una obligación específica
                    console.log('🔍 Obteniendo obligación:', pathParameters.id);
                    
                    const item = await dynamodb.get({
                        TableName: TABLE_NAME,
                        Key: { id: pathParameters.id }
                    }).promise();
                    
                    if (!item.Item) {
                        return {
                            statusCode: 404,
                            headers: corsHeaders,
                            body: JSON.stringify({ 
                                error: 'Obligación no encontrada',
                                id: pathParameters.id
                            })
                        };
                    }
                    
                    return {
                        statusCode: 200,
                        headers: corsHeaders,
                        body: JSON.stringify(item.Item)
                    };
                } else {
                    // GET /obligaciones - Obtener todas las obligaciones (con filtros opcionales)
                    console.log('🔍 Obteniendo todas las obligaciones');
                    
                    // Por ahora, obtener todas. En el futuro se pueden agregar filtros
                    const result = await dynamodb.scan({
                        TableName: TABLE_NAME
                    }).promise();
                    
                    return {
                        statusCode: 200,
                        headers: corsHeaders,
                        body: JSON.stringify(result.Items || [])
                    };
                }
                
            case 'POST':
                // POST /obligaciones - Crear nueva obligación
                console.log('➕ Creando nueva obligación');
                
                let obligacion;
                try {
                    obligacion = typeof body === 'string' ? JSON.parse(body) : body;
                } catch (parseError) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ 
                            error: 'Body inválido',
                            message: 'El body debe ser un JSON válido'
                        })
                    };
                }
                
                // Generar ID si no existe
                if (!obligacion.id) {
                    obligacion.id = `OBL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                }
                
                // Agregar timestamps
                obligacion.created_at = obligacion.created_at || new Date().toISOString();
                obligacion.updated_at = new Date().toISOString();
                
                await dynamodb.put({
                    TableName: TABLE_NAME,
                    Item: obligacion
                }).promise();
                
                console.log('✅ Obligación creada:', obligacion.id);
                
                return {
                    statusCode: 201,
                    headers: corsHeaders,
                    body: JSON.stringify(obligacion)
                };
                
            case 'PUT':
            case 'PATCH':
                // PUT/PATCH /obligaciones/{id} - Actualizar obligación
                if (!pathParameters || !pathParameters.id) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: 'Se requiere el ID de la obligación' })
                    };
                }
                
                console.log('✏️ Actualizando obligación:', pathParameters.id);
                
                let updateData;
                try {
                    updateData = typeof body === 'string' ? JSON.parse(body) : body;
                } catch (parseError) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ 
                            error: 'Body inválido',
                            message: 'El body debe ser un JSON válido'
                        })
                    };
                }
                
                // Actualizar timestamp
                updateData.updated_at = new Date().toISOString();
                updateData.id = pathParameters.id; // Asegurar que el ID no cambie
                
                await dynamodb.put({
                    TableName: TABLE_NAME,
                    Item: updateData
                }).promise();
                
                console.log('✅ Obligación actualizada:', pathParameters.id);
                
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify(updateData)
                };
                
            case 'DELETE':
                // DELETE /obligaciones/{id} - Eliminar obligación
                if (!pathParameters || !pathParameters.id) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: 'Se requiere el ID de la obligación' })
                    };
                }
                
                console.log('🗑️ Eliminando obligación:', pathParameters.id);
                
                await dynamodb.delete({
                    TableName: TABLE_NAME,
                    Key: { id: pathParameters.id }
                }).promise();
                
                console.log('✅ Obligación eliminada:', pathParameters.id);
                
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ 
                        success: true,
                        message: 'Obligación eliminada exitosamente',
                        id: pathParameters.id
                    })
                };
                
            default:
                return {
                    statusCode: 405,
                    headers: corsHeaders,
                    body: JSON.stringify({ 
                        error: 'Método no permitido',
                        method: httpMethod
                    })
                };
        }
    } catch (error) {
        console.error('❌ Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ 
                error: 'Error interno del servidor',
                message: error.message,
                code: error.code
            })
        };
    }
};
