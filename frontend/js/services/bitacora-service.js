/**
 * Servicio de Bitácora
 * Maneja el registro y consulta de eventos de bitácora por obligación
 */
class BitacoraService {
    constructor(dataAdapter, fileStorageService = null) {
        this.dataAdapter = dataAdapter;
        this.fileStorageService = fileStorageService;
    }

    /**
     * Registrar evento en la bitácora de una obligación
     * @param {string} obligacionId - ID de la obligación
     * @param {string} tipo - Tipo de evento (carga_inicial, inicio_seguimiento, fin_seguimiento, pausar, reanudar, marcar_atendida, cambio_estatus, cambio_regla, comentario, archivo_subido, recordatorio_enviado)
     * @param {string} titulo - Título del evento
     * @param {string} descripcion - Descripción detallada
     * @param {object} datosAnteriores - Valores previos (opcional)
     * @param {object} datosNuevos - Valores nuevos (opcional)
     * @param {array} archivos - IDs de archivos relacionados (opcional)
     */
    async registrarEvento(obligacionId, tipo, titulo, descripcion, datosAnteriores = null, datosNuevos = null, archivos = null) {
        // #region agent log (solo en local)
        if (window.ENV && window.ENV.MODE === 'local') {
            fetch('http://127.0.0.1:7242/ingest/334755c9-e669-4015-ace9-566328740005',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bitacora-service.js:21',message:'registrarEvento ENTRADA',data:{obligacionId,tipo,titulo,descripcion:descripcion?.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        }
        // #endregion
        try {
            // Obtener obligación actual
            const obligacion = await this.dataAdapter.getObligacion(obligacionId);
            if (!obligacion) {
                console.error(`[Bitacora] Obligación ${obligacionId} no encontrada`);
                return null;
            }

            // Obtener usuario actual
            let user = null;
            try {
                user = await this.dataAdapter.getCurrentUser();
            } catch (error) {
                console.warn('[Bitacora] No se pudo obtener usuario actual:', error);
            }

            // Crear evento con fecha y hora completa
            const fechaHora = new Date();
            const evento = {
                id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                tipo: tipo,
                titulo: titulo,
                descripcion: descripcion,
                fecha: fechaHora.toISOString(), // Guarda fecha y hora completa
                usuario: (user && user.nombre) ? user.nombre : (user && user.username) ? user.username : 'Sistema',
                area: (user && user.area) ? user.area : null,
                datos_anteriores: datosAnteriores,
                datos_nuevos: datosNuevos,
                archivos: archivos || []
            };

            // Inicializar historial si no existe
            if (!obligacion.historial || !Array.isArray(obligacion.historial)) {
                obligacion.historial = [];
            }

            // Verificar si el evento ya existe (evitar duplicados)
            const historialAntes = obligacion.historial.length;
            const eventoDuplicado = obligacion.historial.find(e => {
                // Comparar por ID si existe
                if (e.id && evento.id && e.id === evento.id) {
                    return true;
                }
                // Comparar por fecha, usuario, título y descripción (dentro de 2 segundos)
                const fechaE = new Date(e.fecha);
                const fechaEvento = new Date(evento.fecha);
                const diferenciaSegundos = Math.abs((fechaE - fechaEvento) / 1000);
                
                return diferenciaSegundos < 2 && 
                       e.usuario === evento.usuario &&
                       e.titulo === evento.titulo &&
                       e.descripcion === evento.descripcion;
            });
            // #region agent log (solo en local)
            if (window.ENV && window.ENV.MODE === 'local') {
                fetch('http://127.0.0.1:7242/ingest/334755c9-e669-4015-ace9-566328740005',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bitacora-service.js:59',message:'VERIFICACION DUPLICADO',data:{historialAntes,eventoId:evento.id,eventoFecha:evento.fecha,eventoTitulo:evento.titulo,esDuplicado:!!eventoDuplicado,duplicadoId:eventoDuplicado?.id,duplicadoFecha:eventoDuplicado?.fecha},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            }
            // #endregion

            // Solo agregar si no es duplicado
            if (!eventoDuplicado) {
                obligacion.historial.push(evento);
                // #region agent log (solo en local)
                if (window.ENV && window.ENV.MODE === 'local') {
                    fetch('http://127.0.0.1:7242/ingest/334755c9-e669-4015-ace9-566328740005',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bitacora-service.js:77',message:'EVENTO AGREGADO AL HISTORIAL',data:{historialDespues:obligacion.historial.length,eventoId:evento.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                }
                // #endregion
            } else {
                console.warn(`[Bitacora] Evento duplicado detectado y omitido: ${evento.titulo} - ${evento.fecha}`);
                // #region agent log (solo en local)
                if (window.ENV && window.ENV.MODE === 'local') {
                    fetch('http://127.0.0.1:7242/ingest/334755c9-e669-4015-ace9-566328740005',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bitacora-service.js:80',message:'EVENTO DUPLICADO OMITIDO',data:{eventoId:evento.id,duplicadoId:eventoDuplicado.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                }
                // #endregion
                return evento; // Retornar el evento existente en lugar de crear uno nuevo
            }

            // NO limitar historial - los archivos de texto no tienen límite
            // El historial completo se mantiene en localStorage y en archivo

            // Actualizar timestamp de la obligación
            obligacion.updated_at = new Date().toISOString();

            // Guardar obligación actualizada en localStorage
            await this.dataAdapter.saveObligacion(obligacion);

            // Guardar evento en archivo de texto persistente
            // #region agent log (solo en local)
            if (window.ENV && window.ENV.MODE === 'local') {
                fetch('http://127.0.0.1:7242/ingest/334755c9-e669-4015-ace9-566328740005',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bitacora-service.js:93',message:'ANTES guardarBitacoraEnArchivo',data:{obligacionId,eventoId:evento.id,eventoTitulo:evento.titulo},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            }
            // #endregion
            await this.guardarBitacoraEnArchivo(obligacionId, evento);
            // #region agent log (solo en local)
            if (window.ENV && window.ENV.MODE === 'local') {
                fetch('http://127.0.0.1:7242/ingest/334755c9-e669-4015-ace9-566328740005',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bitacora-service.js:95',message:'DESPUES guardarBitacoraEnArchivo',data:{obligacionId,eventoId:evento.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            }
            // #endregion

            console.log(`[Bitacora] Evento registrado: ${tipo} para obligación ${obligacionId}`);
            return evento;
        } catch (error) {
            console.error('[Bitacora] Error al registrar evento:', error);
            throw error;
        }
    }

    /**
     * Obtener historial de una obligación
     * @param {string} obligacionId - ID de la obligación
     * @returns {Promise<Array>} Array de eventos ordenados por fecha (más reciente primero)
     */
    async getHistorial(obligacionId) {
        try {
            const obligacion = await this.dataAdapter.getObligacion(obligacionId);
            if (!obligacion) {
                return [];
            }

            const historial = obligacion.historial || [];
            
            // Ordenar por fecha descendente (más reciente primero)
            return historial.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        } catch (error) {
            console.error('[Bitacora] Error al obtener historial:', error);
            return [];
        }
    }

    /**
     * Limpiar historial de una obligación
     * @param {string} obligacionId - ID de la obligación
     */
    async limpiarHistorial(obligacionId) {
        try {
            const obligacion = await this.dataAdapter.getObligacion(obligacionId);
            if (!obligacion) {
                return;
            }

            obligacion.historial = [];
            obligacion.updated_at = new Date().toISOString();
            await this.dataAdapter.saveObligacion(obligacion);

            // NOTA: No se elimina el archivo de bitácora para mantener persistencia
            // El archivo se mantiene como respaldo histórico

            console.log(`[Bitacora] Historial limpiado para obligación ${obligacionId}`);
        } catch (error) {
            console.error('[Bitacora] Error al limpiar historial:', error);
            throw error;
        }
    }

    /**
     * Formatear evento a texto legible
     * @param {object} evento - Evento a formatear
     * @returns {string} - Texto formateado
     */
    formatearEventoParaTexto(evento) {
        // Formatear fecha: [YYYY-MM-DD HH:mm:ss]
        // Asegurar que siempre se use la fecha del evento
        const fecha = evento.fecha ? new Date(evento.fecha) : new Date();
        const fechaStr = fecha.toISOString().replace('T', ' ').substring(0, 19);
        
        // Convertir tipo a mayúsculas legibles
        const tipoMap = {
            'carga_inicial': 'CARGA INICIAL',
            'inicio_seguimiento': 'INICIO DE SEGUIMIENTO',
            'fin_seguimiento': 'FIN DE SEGUIMIENTO',
            'pausar': 'PAUSAR SEGUIMIENTO',
            'reanudar': 'REANUDAR SEGUIMIENTO',
            'marcar_atendida': 'OBLIGACIÓN MARCADA COMO ATENDIDA',
            'cambio_estatus': 'CAMBIO DE ESTATUS',
            'cambio_regla': 'CAMBIO DE REGLA',
            'comentario': 'COMENTARIO',
            'archivo_subido': 'ARCHIVO SUBIDO',
            'recordatorio_enviado': 'RECORDATORIO ENVIADO',
            'archivo_eliminado': 'ARCHIVO ELIMINADO'
        };
        
        const tipoLegible = tipoMap[evento.tipo] || evento.tipo.toUpperCase();
        const titulo = evento.titulo || tipoLegible;
        
        // Construir texto del evento
        let texto = `[${fechaStr}] ${tipoLegible}: ${titulo}\n`;
        
        // Agregar usuario y área
        if (evento.usuario || evento.area) {
            texto += `Usuario: ${evento.usuario || 'Sistema'}`;
            if (evento.area) {
                texto += ` | Área: ${evento.area}`;
            }
            texto += '\n';
        }
        
        // Agregar descripción
        if (evento.descripcion) {
            texto += `Descripción: ${evento.descripcion}\n`;
        }
        
        // Agregar datos anteriores/nuevos si existen
        if (evento.datos_anteriores || evento.datos_nuevos) {
            if (evento.datos_anteriores) {
                texto += `Datos anteriores: ${JSON.stringify(evento.datos_anteriores)}\n`;
            }
            if (evento.datos_nuevos) {
                texto += `Datos nuevos: ${JSON.stringify(evento.datos_nuevos)}\n`;
            }
        }
        
        // Separador
        texto += '---\n';
        
        return texto;
    }

    /**
     * Guardar bitácora en archivo de texto
     * @param {string} obligacionId - ID de la obligación
     * @param {object} evento - Evento a guardar
     * @returns {Promise<void>}
     */
    async guardarBitacoraEnArchivo(obligacionId, evento) {
        // #region agent log (solo en local)
        if (window.ENV && window.ENV.MODE === 'local') {
            fetch('http://127.0.0.1:7242/ingest/334755c9-e669-4015-ace9-566328740005',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bitacora-service.js:238',message:'guardarBitacoraEnArchivo ENTRADA',data:{obligacionId,eventoId:evento.id,eventoTitulo:evento.titulo,eventoFecha:evento.fecha},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        }
        // #endregion
        try {
            // Si no hay FileStorageService, no hacer nada (modo sin persistencia)
            if (!this.fileStorageService) {
                // Intentar obtener FileStorageService global si existe
                if (window.FileStorageService) {
                    this.fileStorageService = new FileStorageService();
                    await this.fileStorageService.init();
                } else {
                    console.warn('[Bitacora] FileStorageService no disponible, no se guardará en archivo');
                    return;
                }
            }

            // Construir ruta: obligaciones/{obligacionId}/bitacora.txt
            const path = `obligaciones/${obligacionId}/bitacora.txt`;
            
            // Formatear evento a texto
            const textoEvento = this.formatearEventoParaTexto(evento);
            
            // Agregar al archivo (append)
            await this.fileStorageService.appendToFile(path, textoEvento, 'text/plain');
            
            console.log(`[Bitacora] Evento guardado en archivo: ${path}`);
        } catch (error) {
            // No lanzar error para no interrumpir el flujo principal
            console.error('[Bitacora] Error al guardar en archivo:', error);
        }
    }

    /**
     * Cargar bitácora desde archivo de texto
     * @param {string} obligacionId - ID de la obligación
     * @returns {Promise<Array>} - Array de eventos parseados
     */
    async cargarBitacoraDesdeArchivo(obligacionId) {
        try {
            // Si no hay FileStorageService, retornar array vacío
            if (!this.fileStorageService) {
                if (window.FileStorageService) {
                    this.fileStorageService = new FileStorageService();
                    await this.fileStorageService.init();
                } else {
                    return [];
                }
            }

            const path = `obligaciones/${obligacionId}/bitacora.txt`;
            
            // Leer archivo
            const contenido = await this.fileStorageService.readTextFile(path);
            
            if (!contenido || contenido.trim() === '') {
                return [];
            }

            // Parsear eventos desde texto
            const eventos = this.parsearEventosDesdeTexto(contenido);
            
            console.log(`[Bitacora] Cargados ${eventos.length} eventos desde archivo para obligación ${obligacionId}`);
            return eventos;
        } catch (error) {
            // Si el archivo no existe, retornar array vacío
            if (error.message && error.message.includes('no encontrado')) {
                return [];
            }
            console.error('[Bitacora] Error al cargar desde archivo:', error);
            return [];
        }
    }

    /**
     * Parsear eventos desde texto legible
     * @param {string} texto - Texto completo del archivo
     * @returns {Array} - Array de eventos parseados
     */
    parsearEventosDesdeTexto(texto) {
        const eventos = [];
        const bloques = texto.split('---\n').filter(bloque => bloque.trim() !== '');
        
        for (const bloque of bloques) {
            try {
                const lineas = bloque.trim().split('\n').filter(l => l.trim() !== '');
                if (lineas.length === 0) continue;

                // Parsear primera línea: [YYYY-MM-DD HH:mm:ss] TIPO: Título
                const primeraLinea = lineas[0];
                const matchFecha = primeraLinea.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
                if (!matchFecha) continue;

                const fechaStr = matchFecha[1];
                const fecha = new Date(fechaStr.replace(' ', 'T') + 'Z');
                
                // Extraer tipo y título
                const restoPrimeraLinea = primeraLinea.substring(matchFecha[0].length + 1).trim();
                const partesTitulo = restoPrimeraLinea.split(':');
                const tipo = partesTitulo[0].trim().toLowerCase().replace(/\s+/g, '_');
                const titulo = partesTitulo.slice(1).join(':').trim();

                // Parsear usuario y área
                let usuario = 'Sistema';
                let area = null;
                let descripcion = '';
                let datosAnteriores = null;
                let datosNuevos = null;

                for (let i = 1; i < lineas.length; i++) {
                    const linea = lineas[i];
                    if (linea.startsWith('Usuario:')) {
                        const matchUsuario = linea.match(/Usuario: ([^|]+)/);
                        if (matchUsuario) usuario = matchUsuario[1].trim();
                        const matchArea = linea.match(/Área: (.+)/);
                        if (matchArea) area = matchArea[1].trim();
                    } else if (linea.startsWith('Descripción:')) {
                        descripcion = linea.substring('Descripción:'.length).trim();
                    } else if (linea.startsWith('Datos anteriores:')) {
                        try {
                            datosAnteriores = JSON.parse(linea.substring('Datos anteriores:'.length).trim());
                        } catch (e) {
                            // Ignorar si no se puede parsear
                        }
                    } else if (linea.startsWith('Datos nuevos:')) {
                        try {
                            datosNuevos = JSON.parse(linea.substring('Datos nuevos:'.length).trim());
                        } catch (e) {
                            // Ignorar si no se puede parsear
                        }
                    }
                }

                // Crear evento
                const evento = {
                    id: `evt_${fecha.getTime()}_${Math.random().toString(36).substr(2, 9)}`,
                    tipo: tipo,
                    titulo: titulo,
                    descripcion: descripcion,
                    fecha: fecha.toISOString(),
                    usuario: usuario,
                    area: area,
                    datos_anteriores: datosAnteriores,
                    datos_nuevos: datosNuevos,
                    archivos: []
                };

                eventos.push(evento);
            } catch (error) {
                console.warn('[Bitacora] Error al parsear evento desde texto:', error);
                // Continuar con el siguiente evento
            }
        }

        // Ordenar por fecha (más antiguo primero, para mantener orden cronológico)
        return eventos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    }

    /**
     * Sincronizar bitácora: fusionar eventos de archivo y localStorage
     * @param {string} obligacionId - ID de la obligación
     * @returns {Promise<Array>} - Historial completo sincronizado
     */
    async sincronizarBitacora(obligacionId) {
        // #region agent log (solo en local)
        if (window.ENV && window.ENV.MODE === 'local') {
            fetch('http://127.0.0.1:7242/ingest/334755c9-e669-4015-ace9-566328740005',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bitacora-service.js:357',message:'sincronizarBitacora ENTRADA',data:{obligacionId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        }
        // #endregion
        try {
            // Cargar eventos desde archivo
            const eventosArchivo = await this.cargarBitacoraDesdeArchivo(obligacionId);
            
            // Cargar eventos desde localStorage
            const obligacion = await this.dataAdapter.getObligacion(obligacionId);
            const eventosLocalStorage = obligacion?.historial || [];
            
            // #region agent log (solo en local)
            if (window.ENV && window.ENV.MODE === 'local') {
                fetch('http://127.0.0.1:7242/ingest/334755c9-e669-4015-ace9-566328740005',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bitacora-service.js:364',message:'EVENTOS CARGADOS',data:{obligacionId,eventosArchivo:eventosArchivo.length,eventosLocalStorage:eventosLocalStorage.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            }
            // #endregion
            
            // Crear un mapa de eventos por ID o fecha+usuario+titulo+descripcion para evitar duplicados
            const eventosUnicos = new Map();
            
            // Función para generar clave única de un evento
            // IMPORTANTE: Usar siempre fecha+usuario+título+descripción para detectar duplicados
            // porque los IDs pueden diferir entre archivo y localStorage
            const generarClave = (evento) => {
                // Usar fecha (redondeada a segundo), usuario, título y descripción para detectar duplicados
                // Esto funciona incluso si los IDs son diferentes
                const fechaRedondeada = evento.fecha ? new Date(evento.fecha).toISOString().substring(0, 19) : '';
                const descripcionHash = evento.descripcion ? evento.descripcion.substring(0, 100) : '';
                const usuario = (evento.usuario || 'Sistema').trim();
                const titulo = (evento.titulo || '').trim();
                return `${fechaRedondeada}_${usuario}_${titulo}_${descripcionHash}`;
            };
            
            // Agregar eventos del archivo primero (son la fuente de verdad persistente)
            eventosArchivo.forEach(evento => {
                const clave = generarClave(evento);
                if (!eventosUnicos.has(clave)) {
                    eventosUnicos.set(clave, evento);
                } else {
                    // Si ya existe, preferir el que tiene ID (más completo)
                    const existente = eventosUnicos.get(clave);
                    if (evento.id && !existente.id) {
                        eventosUnicos.set(clave, evento);
                    }
                }
            });
            
            // Agregar eventos de localStorage (pueden ser más recientes)
            eventosLocalStorage.forEach(evento => {
                const clave = generarClave(evento);
                if (!eventosUnicos.has(clave)) {
                    eventosUnicos.set(clave, evento);
                } else {
                    // Si existe, preferir el de localStorage si tiene ID o es más reciente
                    const existente = eventosUnicos.get(clave);
                    const fechaEvento = new Date(evento.fecha);
                    const fechaExistente = new Date(existente.fecha);
                    
                    // Preferir el que tiene ID, o el más reciente si ambos tienen ID
                    if (evento.id && !existente.id) {
                        eventosUnicos.set(clave, evento);
                    } else if (evento.id && existente.id && fechaEvento > fechaExistente) {
                        eventosUnicos.set(clave, evento);
                    } else if (!evento.id && !existente.id && fechaEvento > fechaExistente) {
                        eventosUnicos.set(clave, evento);
                    }
                }
            });
            
            // Convertir a array y ordenar por fecha (más reciente primero)
            const historialCompleto = Array.from(eventosUnicos.values())
                .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            
            // #region agent log (solo en local)
            if (window.ENV && window.ENV.MODE === 'local') {
                fetch('http://127.0.0.1:7242/ingest/334755c9-e669-4015-ace9-566328740005',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'bitacora-service.js:393',message:'SINCRONIZACION RESULTADO',data:{obligacionId,eventosUnicos:historialCompleto.length,eventosArchivo:eventosArchivo.length,eventosLocalStorage:eventosLocalStorage.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            }
            // #endregion
            
            // Actualizar obligación con historial completo
            if (obligacion) {
                obligacion.historial = historialCompleto;
                obligacion.updated_at = new Date().toISOString();
                await this.dataAdapter.saveObligacion(obligacion);
            }
            
            console.log(`[Bitacora] Sincronizados ${historialCompleto.length} eventos para obligación ${obligacionId} (${eventosArchivo.length} del archivo, ${eventosLocalStorage.length} de localStorage)`);
            
            return historialCompleto;
        } catch (error) {
            console.error('[Bitacora] Error al sincronizar bitácora:', error);
            // Retornar eventos de localStorage como fallback
            const obligacion = await this.dataAdapter.getObligacion(obligacionId);
            return obligacion?.historial || [];
        }
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.BitacoraService = BitacoraService;
}
