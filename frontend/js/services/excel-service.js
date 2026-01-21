/**
 * Servicio de Excel
 * Maneja el procesamiento de archivos Excel para cargar obligaciones
 */
class ExcelService {
    constructor() {
        // Verificar que SheetJS esté disponible
        if (typeof XLSX === 'undefined') {
            console.error('SheetJS (XLSX) no está disponible. Asegúrate de cargar la librería.');
        }
    }

    /**
     * Obtener lista de hojas del Excel
     */
    async getSheetNames(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    resolve(workbook.SheetNames);
                } catch (error) {
                    reject(new Error(`Error al leer el archivo: ${error.message}`));
                }
            };

            reader.onerror = () => {
                reject(new Error('Error al leer el archivo'));
            };

            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Procesar archivo Excel
     */
    async processExcelFile(file, sheetName = null) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // Si no se proporcionó el nombre de la hoja, rechazar para que se pregunte
                    if (!sheetName) {
                        reject(new Error('SHEET_SELECTION_REQUIRED'));
                        return;
                    }

                    // Validar que la hoja existe
                    if (!workbook.SheetNames.includes(sheetName)) {
                        reject(new Error(`La hoja "${sheetName}" no existe en el archivo. Hojas disponibles: ${workbook.SheetNames.join(', ')}`));
                        return;
                    }

                    const worksheet = workbook.Sheets[sheetName];

                    // Obtener el rango completo de la hoja para contar todas las filas
                    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
                    const totalFilasEnExcel = range.e.r + 1; // +1 porque es 0-indexed (fila 1 = índice 0)
                    console.log('[ExcelService] Total filas en Excel (incluyendo encabezados):', totalFilasEnExcel, 'Rango:', worksheet['!ref'], 'Hoja:', sheetName);
                    
                    // Convertir a JSON
                    // raw: true para obtener valores raw (números seriales para fechas)
                    // Esto nos permite controlar la conversión de fechas nosotros mismos
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
                        header: 1,
                        defval: null,
                        raw: true // Obtener valores raw para controlar la conversión de fechas
                    });

                    // Guardar estructura del Excel para exportación futura
                    const headers = jsonData[3] || []; // Fila 4 (índice 3) con encabezados
                    const headersLower = headers.map(h => h ? String(h).toLowerCase().trim() : '');
                    const columnMap = this.mapColumns(headersLower);
                    
                    // Procesar datos con fila 4 como cabecera (índice 3)
                    const result = this.parseExcelData(jsonData, totalFilasEnExcel, 3);
                    
                    // Agregar estructura del Excel al resultado
                    result.excelStructure = {
                        headers: headers,
                        columnMap: columnMap,
                        sheetName: sheetName,
                        headerRowIndex: 3,
                        totalRows: totalFilasEnExcel
                    };

                    resolve(result);
                } catch (error) {
                    reject(new Error(`Error al procesar Excel: ${error.message}`));
                }
            };

            reader.onerror = () => {
                reject(new Error('Error al leer el archivo'));
            };

            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Parsear datos del Excel a formato de obligaciones
     */
    parseExcelData(jsonData, totalFilasEnExcel = null, headerRowIndex = 3) {
        // Validar que hay suficientes filas (fila 4 como cabecera + al menos una fila de datos)
        if (!jsonData || jsonData.length < headerRowIndex + 2) {
            throw new Error(`El archivo Excel debe tener al menos ${headerRowIndex + 1} filas (cabecera en fila ${headerRowIndex + 1}) y una fila de datos`);
        }

        // Usar siempre la fila 4 (índice 3) como cabecera
        console.log(`[ExcelService] Usando fila ${headerRowIndex + 1} (índice ${headerRowIndex}) como cabecera`);

        // Obtener encabezados de la fila encontrada
        const headers = jsonData[headerRowIndex].map(h => h ? String(h).toLowerCase().trim() : '');

        // Log de headers para debugging
        console.log('[ExcelService] Headers encontrados:', headers);
        
        // Mapear nombres de columnas
        const columnMap = this.mapColumns(headers);
        console.log('[ExcelService] Mapeo de columnas:', columnMap);
        
        // Validar columnas requeridas y obtener información de problemas
        const problemasColumnas = this.validateColumns(columnMap, headers);
        
        // Procesar filas de datos (empezar después de los encabezados)
        const obligaciones = [];
        const problemasFilas = []; // Array para almacenar problemas por fila
        let filasVacias = 0;
        let filasConError = 0;
        const timestamp = Date.now(); // Timestamp para IDs únicos
        
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            
            // Saltar filas vacías
            if (!row || row.every(cell => !cell || (cell !== null && String(cell).trim() === ''))) {
                filasVacias++;
                continue;
            }
            
            try {
                const resultado = this.parseRow(row, headers, columnMap, i, headerRowIndex, timestamp);
                if (resultado.obligacion) {
                    obligaciones.push(resultado.obligacion);
                }
                if (resultado.problemas && resultado.problemas.length > 0) {
                    problemasFilas.push({
                        fila: i + 1,
                        problemas: resultado.problemas
                    });
                    // Si no hay obligación debido a problemas (como falta de ID), contar como error
                    if (!resultado.obligacion) {
                        filasConError++;
                    }
                }
            } catch (error) {
                console.warn(`Error al procesar fila ${i + 1}:`, error.message);
                problemasFilas.push({
                    fila: i + 1,
                    problemas: [{
                        tipo: 'error',
                        campo: 'general',
                        mensaje: error.message,
                        valor: null
                    }]
                });
                filasConError++;
                // Continuar con las siguientes filas
            }
        }

        // Log de estadísticas
        // Usar el total de filas del Excel si está disponible, sino calcular desde jsonData
        let totalFilas;
        if (totalFilasEnExcel !== null) {
            // Total de filas en el Excel menos la fila de encabezados
            // Si headerRowIndex es 3, significa que la fila de encabezados es la fila 4 (índice 3)
            // Entonces hay 3 filas antes (0,1,2) + 1 fila de encabezados = 4 filas de cabecera
            // Total de filas de datos = totalFilasEnExcel - (headerRowIndex + 1)
            totalFilas = totalFilasEnExcel - (headerRowIndex + 1);
        } else {
            // Fallback: contar desde jsonData
            totalFilas = jsonData.length - (headerRowIndex + 1);
        }

        console.log(`Procesamiento Excel: ${totalFilasEnExcel || jsonData.length} filas en archivo, ${headerRowIndex + 1} filas de encabezados/cabecera, ${totalFilas} filas de datos, ${obligaciones.length} procesadas, ${filasVacias} vacías, ${filasConError} con errores`);
        
        if (obligaciones.length === 0) {
            throw new Error(`No se encontraron obligaciones válidas en el archivo. Total filas: ${totalFilas}, Vacías: ${filasVacias}, Errores: ${filasConError}`);
        }

        // Retornar objeto con obligaciones y problemas detallados
        return {
            obligaciones: obligaciones,
            problemas: {
                columnas: problemasColumnas,
                filas: problemasFilas,
                estadisticas: {
                    total: totalFilas,
                    procesadas: obligaciones.length,
                    vacias: filasVacias,
                    conErrores: filasConError
                }
            }
        };
    }

    /**
     * Mapear columnas del Excel
     */
    mapColumns(headers) {
        const map = {};
        
        // Mapeos específicos para la estructura real del Excel y variaciones comunes
        const mappings = {
            id: ['id', 'identificador', 'código', 'codigo', 'id obligación', 'id obligacion'],
            estatus: ['estatus', 'estado', 'status', 'situación', 'situacion'],
            sub_estatus: ['sub estatus', 'sub_estatus', 'subestatus', 'sub-estatus', 'detalle estatus', 'subestatus'],
            alerta_1: ['1er alerta', '1er alerta (1 vez)', 'alerta 1', 'primera alerta'],
            alerta_2: ['2da alerta', '2da alerta (semanal)', 'alerta 2', 'segunda alerta'],
            alerta_3: ['3er alerta', '3er alerta (tercer dia)', 'alerta 3', 'tercera alerta'],
            alerta_4: ['4ta alerta', '4ta alerta (diaria)', 'alerta 4', 'cuarta alerta'],
            area: ['responsable área', 'responsable area', 'area', 'área', 'departamento', 'área responsable', 'area responsable', 'área responsable'],
            responsable_cn: ['responsable cn', 'responsable c.n.', 'cn'],
            responsable_juridico: ['responsable juridico', 'responsable jurídico', 'juridico'],

            // Mapeos antiguos (fallback)
            nombre: ['disposición resumida', 'disposicion resumida', 'disposicion resumida', 'nombre', 'obligación', 'obligacion', 'título', 'titulo'],
            regulador: ['órgano / regulador', 'organo / regulador', 'órgano regulador', 'organo regulador', 'regulador', 'autoridad'],
            descripcion: ['tema', 'disposición aplicable', 'disposicion aplicable', 'descripción', 'descripcion'],
            fecha_limite: ['fecha límite de entrega', 'fecha limite de entrega', 'fecha límite', 'fecha limite', 'fecha de vencimiento', 'vencimiento', 'fecha'],
            periodicidad: ['periodicidad', 'frecuencia'],
            dias_para_vencer: ['días para vencer', 'dias para vencer', 'días restantes', 'dias restantes', 'días hasta vencimiento', 'dias hasta vencimiento'],
            seguimiento: ['seguimiento'] // Columna agregada en exportación, se ignora al recargar
        };
        
        for (const [field, possibleNames] of Object.entries(mappings)) {
            for (let j = 0; j < headers.length; j++) {
                const header = headers[j];
                if (header) {
                    const headerLower = header.toLowerCase();
                    // Buscar coincidencia exacta primero
                    if (possibleNames.includes(headerLower)) {
                        map[field] = j;
                        break;
                    }
                    // Si no, buscar coincidencia parcial (más arriesgado pero útil)
                    if (possibleNames.some(name => headerLower.includes(name))) {
                        // Evitar falsos positivos (ej. "sub estatus" matcheando "estatus")
                        // Si ya mapeamos este campo con un match exacto, no lo sobreescribimos con parcial
                        if (map[field] === undefined) {
                            map[field] = j;
                        }
                    }
                }
            }
        }
        
        return map;
    }

    /**
     * Validar que existan las columnas requeridas
     */
    validateColumns(columnMap, headers) {
        const problemas = {
            columnasFaltantes: [],
            columnasEncontradas: [],
            advertencias: []
        };

        // Validar columnas críticas para el nuevo requerimiento
        // ID es fundamental ahora, o Estatus
        const required = [];
        if (!columnMap.id && !columnMap.nombre) {
            required.push({ field: 'id', nombres: ['ID', 'Disposición resumida'] });
        }

        required.forEach(({ field, nombres }) => {
            if (columnMap[field] === undefined) {
                problemas.columnasFaltantes.push({
                    campo: field,
                    nombresEsperados: nombres,
                    descripcion: field
                });
            } else {
                problemas.columnasEncontradas.push({
                    campo: field,
                    columna: headers[columnMap[field]],
                    indice: columnMap[field]
                });
            }
        });

        if (problemas.columnasFaltantes.length > 0) {
            const nombresFaltantes = problemas.columnasFaltantes.map(p => p.descripcion).join(', ');
            throw new Error(`Faltan columnas requeridas: ${nombresFaltantes}`);
        }

        return problemas;
    }

    /**
     * Parsear una fila del Excel
     */
    parseRow(row, headers, columnMap, rowIndex, headerRowIndex, timestamp = null) {
        const getValue = (field) => {
            const colIndex = columnMap[field];
            if (colIndex === undefined || colIndex >= row.length) {
                return null;
            }
            const value = row[colIndex];
            if (value === null || value === undefined) {
                return null;
            }
            if (typeof value === 'string' && value.trim() === '') {
                return null;
            }
            return value;
        };
        
        const parseDate = (val) => {
            if (val === null || val === undefined) return null;
            let date = null;
            
            if (val instanceof Date) {
                // Si ya es un Date, usarlo directamente
                date = val;
            } else if (typeof val === 'number') {
                // Números seriales de Excel
                // Excel día 1 = 1900-01-01
                // Excel tiene un bug: cuenta el 29 de febrero de 1900 (día 60) aunque 1900 no fue bisiesto
                // La fórmula correcta usando el epoch de 1899-12-30:
                // fecha = 1899-12-30 + número días
                // Esto automáticamente compensa el bug
                
                if (val > 0 && val < 1000000) {
                    // Usar el epoch estándar de Excel: 1899-12-30
                    // Crear la fecha en UTC a medianoche para evitar problemas de zona horaria
                    const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // 30 de diciembre de 1899 en UTC
                    const fechaCalculadaUTC = new Date(excelEpoch.getTime() + val * 86400 * 1000);
                    
                    // Crear una nueva fecha usando los componentes de fecha (sin hora) para evitar problemas de zona horaria
                    date = new Date(Date.UTC(
                        fechaCalculadaUTC.getUTCFullYear(),
                        fechaCalculadaUTC.getUTCMonth(),
                        fechaCalculadaUTC.getUTCDate()
                    ));
                    
                    // Verificar que la fecha sea válida
                    if (isNaN(date.getTime()) || date.getUTCFullYear() < 1900 || date.getUTCFullYear() > 2100) {
                        date = null;
                    }
                }
            } else if (typeof val === 'string') {
                const trimmed = val.trim();
                if (trimmed === '') return null;
                
                // Intentar parsear como número serial primero (si es un string numérico)
                const numVal = Number(trimmed);
                if (!isNaN(numVal) && numVal > 0 && numVal < 1000000) {
                    // Misma lógica que para números: usar epoch 1899-12-30 en UTC
                    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                    const fechaCalculadaUTC = new Date(excelEpoch.getTime() + numVal * 86400 * 1000);
                    date = new Date(Date.UTC(
                        fechaCalculadaUTC.getUTCFullYear(),
                        fechaCalculadaUTC.getUTCMonth(),
                        fechaCalculadaUTC.getUTCDate()
                    ));
                    if (isNaN(date.getTime()) || date.getUTCFullYear() < 1900 || date.getUTCFullYear() > 2100) {
                        date = null;
                    }
                }
                
                // Si no funcionó como número serial, intentar como fecha normal
                if (!date) {
                    try {
                        date = new Date(trimmed);
                        if (isNaN(date.getTime())) {
                            // Try DD/MM/YYYY
                            const dateParts = trimmed.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
                            if (dateParts) {
                                const [, day, month, year] = dateParts;
                                date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                            }
                        }
                    } catch (e) { }
                }
            }

            if (date && !isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() < 2100) {
                return date;
            }
            return null;
        };

        // DEBUG: Logging de fila para verificar columnas
        if (rowIndex < headerRowIndex + 5) { // Loguear solo las primeras 5 filas de datos
            console.log(`[ExcelService] DEBUG Row ${rowIndex + 1} (Data):`, {
                'Col H (7) Area': row[7],
                'Col P (15) Fecha Limite': row[15],
                'Col T (19) Estatus': row[19],
                'Col U (20) SubEstatus': row[20],
                'Col V (21) ID': row[21]
            });
        }

        // Obtener ID directamente de la columna V (índice 21) - OBLIGATORIO
        const idOriginal = row[21] ? String(row[21]).trim() : null;

        // Validar que el ID oficial exista (es obligatorio)
        // rowIndex es el índice en el array JSON (0-based)
        // La fila real del Excel = rowIndex + 1 (porque Excel cuenta desde 1)
        if (!idOriginal || idOriginal === '') {
            // Verificar si la fila tiene otros datos relevantes para determinar si es un error o una fila vacía
            // Muchas veces Excel lee filas vacías al final si tienen formato
            const hasNombre = getValue('nombre');
            const hasArea = row[7] ? String(row[7]).trim() : null;

            // Comprobar si hay *algún* dato en la fila
            const hasAnyData = row.some((cell, idx) => {
                if (idx === 21) return false; // Ignorar columna ID (ya sabemos que está vacía)
                return cell !== null && cell !== undefined && String(cell).trim() !== '';
            });

            if (!hasNombre && !hasArea && !hasAnyData) {
                return { obligacion: null, problemas: [] }; // Ignorar fila completamente vacía o irrelevante
            }

            const filaExcel = rowIndex + 1; // Fila real del Excel
            return {
                obligacion: null,
                problemas: [{
                    tipo: 'error',
                    campo: 'id_oficial',
                    mensaje: `Fila ${filaExcel} del Excel: La columna V (ID) está vacía, pero se detectaron datos en otras columnas. El ID es obligatorio.`,
                    valor: null,
                    filaExcel: filaExcel
                }]
            };
        }

        // Obtener Área Responsable directamente de la columna H (índice 7)
        const valArea = row[7];
        const area = (valArea && String(valArea).trim()) ? String(valArea).trim() : 'Sin asignar';

        // Obtener Periodicidad directamente de la columna N (índice 13)
        const valPeriodicidad = row[13];
        const periodicidad = (valPeriodicidad && String(valPeriodicidad).trim()) ? String(valPeriodicidad).trim() : 'No definida';

        // Obtener valores básicos
        const nombre = getValue('nombre') || idOriginal;
        // Obtener Regulador directamente de la columna C (índice 2)
        const valRegulador = row[2];
        const regulador = (valRegulador && String(valRegulador).trim()) ? String(valRegulador).trim() : 'General';

        // Nuevos campos
        // Mapeo estricto solicitado por el usuario:
        // Columna T (19) -> Estatus
        // Columna U (20) -> Subestatus
        const estatusVal = row[19];
        const estatus = estatusVal ? String(estatusVal).trim() : null;

        const subEstatusVal = row[20];
        const subEstatus = subEstatusVal ? String(subEstatusVal).trim() : null;

        // Leer reglas de alertamiento de las columnas W, X, Y, Z
        // Columna W (22) -> 1 Vez
        // Columna X (23) -> Semanal
        // Columna Y (24) -> Saltado
        // Columna Z (25) -> Diaria
        // Estas columnas pueden contener números seriales de Excel (fechas) o strings
        const regla1VezRaw = row[22];
        const reglaSemanalRaw = row[23];
        const reglaSaltadoRaw = row[24];
        const reglaDiariaRaw = row[25];

        // Convertir a fechas si son números seriales, o mantener como string si es texto
        const regla1Vez = this.parseReglaFecha(regla1VezRaw);
        const reglaSemanal = this.parseReglaFecha(reglaSemanalRaw);
        const reglaSaltado = this.parseReglaFecha(reglaSaltadoRaw);
        const reglaDiaria = this.parseReglaFecha(reglaDiariaRaw);
        const alerta1 = parseDate(getValue('alerta_1'));
        const alerta2 = parseDate(getValue('alerta_2'));
        const alerta3 = parseDate(getValue('alerta_3'));
        const alerta4 = parseDate(getValue('alerta_4'));
        const respCN = getValue('responsable_cn');
        const respJur = getValue('responsable_juridico');

        // Leer "Días para vencer" del Excel si existe
        const diasParaVencerVal = getValue('dias_para_vencer');
        let diasParaVencer = null;
        if (diasParaVencerVal !== null && diasParaVencerVal !== undefined) {
            // Intentar convertir a número
            const numVal = Number(diasParaVencerVal);
            if (!isNaN(numVal)) {
                diasParaVencer = Math.round(numVal);
            }
        }

        // Determinar Fecha Límite
        // Leer específicamente de la columna P (índice 15) - "Fecha limite de entrega"
        const fechaLimiteValRaw = row[15];
        
        // DEBUG: Logging de fecha límite
        if (rowIndex < headerRowIndex + 5) { // Loguear solo las primeras 5 filas
            console.log(`[ExcelService] DEBUG Fecha Límite - Fila ${rowIndex + 1}:`, {
                'Col P (15) Raw': fechaLimiteValRaw,
                'Tipo': typeof fechaLimiteValRaw,
                'Valor': fechaLimiteValRaw,
                'ID Obligacion': idOriginal
            });
        }
        
        // Intentar parsear como fecha
        // Primero verificar si SheetJS ya lo parseó como Date
        let fechaLimiteDate = null;
        let fechaLimiteOriginal = null;
        
        if (fechaLimiteValRaw !== null && fechaLimiteValRaw !== undefined) {
            if (fechaLimiteValRaw instanceof Date) {
                // Si SheetJS ya lo parseó como Date, usarlo directamente
                fechaLimiteDate = fechaLimiteValRaw;
            } else if (typeof fechaLimiteValRaw === 'number') {
                // Es un número serial de Excel
                // Excel día 1 = 1900-01-01
                // Excel tiene un bug: cuenta el 29 de febrero de 1900 (día 60) aunque 1900 no fue bisiesto
                // La fórmula correcta usando el epoch de 1899-12-30:
                // fecha = 1899-12-30 + número días
                // Esto automáticamente compensa el bug porque:
                // - Día 1: 1899-12-30 + 1 = 1899-12-31
                // - Día 2: 1899-12-30 + 2 = 1900-01-01 ✓
                // - Día 60: 1899-12-30 + 60 = 1900-02-28 (el bug del 29 de febrero se compensa)
                if (fechaLimiteValRaw > 0 && fechaLimiteValRaw < 1000000) {
                    // Usar el epoch estándar de Excel: 1899-12-30
                    // Crear la fecha en UTC a medianoche para evitar problemas de zona horaria
                    const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // 30 de diciembre de 1899 en UTC
                    const fechaCalculadaUTC = new Date(excelEpoch.getTime() + fechaLimiteValRaw * 86400 * 1000);
                    
                    // Crear una nueva fecha usando los componentes de fecha (sin hora) para evitar problemas de zona horaria
                    fechaLimiteDate = new Date(Date.UTC(
                        fechaCalculadaUTC.getUTCFullYear(),
                        fechaCalculadaUTC.getUTCMonth(),
                        fechaCalculadaUTC.getUTCDate()
                    ));
                    
                    // DEBUG: Logging detallado para el primer caso
                    if (rowIndex < headerRowIndex + 5) {
                        console.log(`[ExcelService] DEBUG Conversión Fecha - Fila ${rowIndex + 1}:`, {
                            'Numero Serial': fechaLimiteValRaw,
                            'Epoch': excelEpoch.toISOString(),
                            'Fecha Calculada UTC': fechaCalculadaUTC.toISOString(),
                            'Fecha Final (sin hora)': fechaLimiteDate.toISOString(),
                            'Fecha Formateada': `${fechaLimiteDate.getUTCDate()}/${fechaLimiteDate.getUTCMonth() + 1}/${fechaLimiteDate.getUTCFullYear()}`
                        });
                    }
                    
                    // Verificar que sea válida
                    if (isNaN(fechaLimiteDate.getTime()) || fechaLimiteDate.getUTCFullYear() < 1900 || fechaLimiteDate.getUTCFullYear() > 2100) {
                        fechaLimiteDate = null;
                        fechaLimiteOriginal = String(fechaLimiteValRaw);
                    }
                } else {
                    fechaLimiteOriginal = String(fechaLimiteValRaw);
                }
            } else if (typeof fechaLimiteValRaw === 'string') {
                const trimmed = fechaLimiteValRaw.trim();
                if (trimmed !== '') {
                    fechaLimiteOriginal = trimmed;
                    // Intentar parsear como fecha
                    fechaLimiteDate = parseDate(fechaLimiteValRaw);
                }
            } else {
                fechaLimiteOriginal = String(fechaLimiteValRaw);
            }
        }
        
        // DEBUG: Logging del resultado del parseo
        if (rowIndex < headerRowIndex + 5) {
            console.log(`[ExcelService] DEBUG Fecha Límite Parseada - Fila ${rowIndex + 1}:`, {
                'fechaLimiteDate': fechaLimiteDate ? fechaLimiteDate.toISOString().split('T')[0] : null,
                'fechaLimiteDateFormatted': fechaLimiteDate ? `${fechaLimiteDate.getUTCDate()}/${fechaLimiteDate.getUTCMonth() + 1}/${fechaLimiteDate.getUTCFullYear()}` : null,
                'fechaLimiteOriginal': fechaLimiteOriginal,
                'Tipo original': typeof fechaLimiteValRaw
            });
        }

        // Usar el ID oficial como ID principal (no generar IDs automáticos)
        // El ID oficial viene de la columna V y es obligatorio
        // IMPORTANTE: No usar fallbacks ni generar IDs - si no hay ID, la fila debe rechazarse

        // Crear objeto
        const obligacion = {
            id: idOriginal, // Usar SOLO el ID oficial (columna V)
            id_oficial: idOriginal, // También guardarlo como id_oficial para compatibilidad
            regulador: String(regulador).trim(),
            descripcion: String(nombre).trim(), // Usamos nombre/id como descripción
            nombre: String(nombre).trim(),
            area: String(area).trim(),
            periodicidad: periodicidad,
            fecha_limite: fechaLimiteDate ? 
                `${fechaLimiteDate.getUTCFullYear()}-${String(fechaLimiteDate.getUTCMonth() + 1).padStart(2, '0')}-${String(fechaLimiteDate.getUTCDate()).padStart(2, '0')}` : null,
            fecha_limite_original: fechaLimiteOriginal, // Guardar el valor original del Excel
            estatus: estatus ? String(estatus).toLowerCase().trim() : null,
            sub_estatus: subEstatus ? String(subEstatus).trim().charAt(0).toUpperCase() + String(subEstatus).trim().slice(1).replace(/\(cn\)/i, '(CN)') : null,
            responsable_cn: respCN,
            responsable_juridico: respJur,
            dias_para_vencer_excel: diasParaVencer, // Guardar el valor del Excel
            reglas_alertamiento: {
                regla_1_vez: regla1Vez && regla1Vez !== '' ? regla1Vez : null,
                regla_semanal: reglaSemanal && reglaSemanal !== '' ? reglaSemanal : null,
                regla_saltado: reglaSaltado && reglaSaltado !== '' ? reglaSaltado : null,
                regla_diaria: reglaDiaria && reglaDiaria !== '' ? reglaDiaria : null
            },
            alertas: {
                alerta_1: alerta1 ? alerta1.toISOString().split('T')[0] : null,
                alerta_2: alerta2 ? alerta2.toISOString().split('T')[0] : null,
                alerta_3: alerta3 ? alerta3.toISOString().split('T')[0] : null,
                alerta_4: alerta4 ? alerta4.toISOString().split('T')[0] : null
            },
            // IMPORTANTE: Guardar la fila original completa del Excel para poder exportarla tal cual
            row_original: row.map(cell => {
                // Mantener el valor original, pero convertir null/undefined a string vacío para consistencia
                if (cell === null || cell === undefined) return '';
                return cell;
            }),
            // Inicializar campos para bitácora y gestión de archivos
            historial: [],
            archivos: [],
            recordatorios_programados: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        return {
            obligacion: obligacion,
            problemas: []
        };
    }

    /**
     * Parsear regla de fecha (puede ser número serial de Excel o string)
     */
    parseReglaFecha(val) {
        if (val === null || val === undefined) return null;
        
        // Si es un número, intentar convertirlo a fecha
        if (typeof val === 'number' && val > 0 && val < 1000000) {
            // Es un número serial de Excel, convertirlo a fecha
            const excelEpoch = new Date(Date.UTC(1899, 11, 30));
            const fechaCalculadaUTC = new Date(excelEpoch.getTime() + val * 86400 * 1000);
            const fechaFinal = new Date(Date.UTC(
                fechaCalculadaUTC.getUTCFullYear(),
                fechaCalculadaUTC.getUTCMonth(),
                fechaCalculadaUTC.getUTCDate()
            ));
            
            // Formatear como DD/MM/YYYY
            const day = String(fechaFinal.getUTCDate()).padStart(2, '0');
            const month = String(fechaFinal.getUTCMonth() + 1).padStart(2, '0');
            const year = fechaFinal.getUTCFullYear();
            return `${day}/${month}/${year}`;
        } else if (typeof val === 'string') {
            const trimmed = val.trim();
            if (trimmed === '') return null;
            
            // Intentar parsear como número serial (string numérico)
            const numVal = Number(trimmed);
            if (!isNaN(numVal) && numVal > 0 && numVal < 1000000) {
                // Es un string numérico, convertir a fecha
                const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                const fechaCalculadaUTC = new Date(excelEpoch.getTime() + numVal * 86400 * 1000);
                const fechaFinal = new Date(Date.UTC(
                    fechaCalculadaUTC.getUTCFullYear(),
                    fechaCalculadaUTC.getUTCMonth(),
                    fechaCalculadaUTC.getUTCDate()
                ));
                
                const day = String(fechaFinal.getUTCDate()).padStart(2, '0');
                const month = String(fechaFinal.getUTCMonth() + 1).padStart(2, '0');
                const year = fechaFinal.getUTCFullYear();
                return `${day}/${month}/${year}`;
            }
            
            // Si no es numérico, devolver el string tal cual
            return trimmed;
        }
        
        return null;
    }

    /**
     * Exportar obligaciones a Excel
     * @param {Array} obligaciones - Array de obligaciones a exportar
     * @param {Object} excelStructure - Estructura del Excel original (headers, columnMap, sheetName)
     * @returns {Blob} - Blob del archivo Excel generado
     */
    exportToExcel(obligaciones, excelStructure = null) {
        if (typeof XLSX === 'undefined') {
            throw new Error('SheetJS (XLSX) no está disponible');
        }

        // Si no hay estructura guardada, usar estructura estándar
        let headers = [];
        let columnMap = {};
        let sheetName = 'Obligaciones';
        
        if (excelStructure) {
            // Usar TODOS los encabezados originales para mantener compatibilidad completa
            headers = [...(excelStructure.headers || [])];
            columnMap = { ...(excelStructure.columnMap || {}) };
            sheetName = excelStructure.sheetName || 'Obligaciones';
        } else {
            // Generar encabezados estándar basados en las columnas conocidas
            headers = this.generateStandardHeaders();
            columnMap = this.mapColumns(headers.map(h => h ? String(h).toLowerCase().trim() : ''));
        }

        // Asegurar que los encabezados no estén vacíos y convertir null/undefined a string vacío
        headers = headers.map(h => h === null || h === undefined ? '' : String(h));
        
        // Agregar columna "Seguimiento" al final de los encabezados
        const headersConSeguimiento = [...headers, 'Seguimiento'];
        
        // Asegurar que todos los valores de encabezados sean strings válidos
        const headersFinales = headersConSeguimiento.map(h => h === null || h === undefined ? '' : String(h));
        const numColumnas = headersFinales.length;
        
        // Crear array de arrays para SheetJS
        const data = [];
        
        // Filas 1-3 vacías (mantener estructura original) - deben tener el mismo número de columnas
        data.push(new Array(numColumnas).fill(''));
        data.push(new Array(numColumnas).fill(''));
        data.push(new Array(numColumnas).fill(''));
        
        // Fila 4: Encabezados (incluyendo "Seguimiento" al final)
        data.push(headersFinales);
        
        console.log('[ExcelService] Exportando con encabezados:', headersFinales.length, 'columnas');
        console.log('[ExcelService] Primeros 5 encabezados:', headersFinales.slice(0, 5));
        console.log('[ExcelService] Último encabezado:', headersFinales[headersFinales.length - 1]);
        
        // Filas de datos (a partir de fila 5)
        obligaciones.forEach(obligacion => {
            // Si la obligación tiene row_original, usar esos valores como base
            // Esto preserva TODAS las columnas originales del Excel, incluso las que no usamos
            let row = [];
            if (obligacion.row_original && Array.isArray(obligacion.row_original)) {
                // Usar la fila original como base, extendiéndola si es necesario
                row = [...obligacion.row_original];
                // Asegurar que tenga al menos el mismo número de columnas que los encabezados
                while (row.length < headers.length) {
                    row.push(null);
                }
            } else {
                // Si no hay row_original, crear fila vacía
                row = new Array(headers.length).fill(null);
            }
            
            // Ahora actualizar solo los campos que han cambiado en el sistema
            // Los demás campos se mantienen con sus valores originales del Excel (row_original)
            
            // Columna C (índice 2): regulador
            if (columnMap.regulador !== undefined && obligacion.regulador) {
                row[columnMap.regulador] = obligacion.regulador;
            } else if (headers.length > 2 && obligacion.regulador) {
                row[2] = obligacion.regulador;
            }
            
            // Columna H (índice 7): area
            if (columnMap.area !== undefined && obligacion.area) {
                row[columnMap.area] = obligacion.area;
            } else if (headers.length > 7 && obligacion.area) {
                row[7] = obligacion.area;
            }
            
            // Columna N (índice 13): periodicidad
            if (columnMap.periodicidad !== undefined && obligacion.periodicidad) {
                row[columnMap.periodicidad] = obligacion.periodicidad;
            } else if (headers.length > 13 && obligacion.periodicidad) {
                row[13] = obligacion.periodicidad;
            }
            
            // Columna P (índice 15): fecha_limite (actualizar si cambió)
            if (columnMap.fecha_limite !== undefined) {
                const fechaIndex = columnMap.fecha_limite;
                if (obligacion.fecha_limite_original) {
                    // Mantener formato original si existe
                    row[fechaIndex] = obligacion.fecha_limite_original;
                } else if (obligacion.fecha_limite) {
                    row[fechaIndex] = this.convertDateToExcelFormat(obligacion.fecha_limite);
                }
            } else if (headers.length > 15) {
                if (obligacion.fecha_limite_original) {
                    row[15] = obligacion.fecha_limite_original;
                } else if (obligacion.fecha_limite) {
                    row[15] = this.convertDateToExcelFormat(obligacion.fecha_limite);
                }
            }
            
            // Columna T (índice 19): estatus
            if (columnMap.estatus !== undefined && obligacion.estatus) {
                row[columnMap.estatus] = obligacion.estatus;
            } else if (headers.length > 19 && obligacion.estatus) {
                row[19] = obligacion.estatus;
            }
            
            // Columna U (índice 20): sub_estatus
            if (columnMap.sub_estatus !== undefined && obligacion.sub_estatus) {
                row[columnMap.sub_estatus] = obligacion.sub_estatus;
            } else if (headers.length > 20 && obligacion.sub_estatus) {
                row[20] = obligacion.sub_estatus;
            }
            
            // Columna V (índice 21): id_oficial (OBLIGATORIO)
            if (columnMap.id !== undefined) {
                row[columnMap.id] = obligacion.id_oficial || obligacion.id || '';
            } else if (headers.length > 21) {
                row[21] = obligacion.id_oficial || obligacion.id || '';
            }
            
            // Columna W (índice 22): regla_1_vez
            if (obligacion.reglas_alertamiento && obligacion.reglas_alertamiento.regla_1_vez) {
                if (headers.length > 22 && (!columnMap.alerta_1 || headers[22])) {
                    row[22] = this.convertReglaToExcelFormat(obligacion.reglas_alertamiento.regla_1_vez);
                } else if (columnMap.alerta_1 !== undefined) {
                    row[columnMap.alerta_1] = this.convertReglaToExcelFormat(obligacion.reglas_alertamiento.regla_1_vez);
                }
            }
            
            // Columna X (índice 23): regla_semanal
            if (obligacion.reglas_alertamiento && obligacion.reglas_alertamiento.regla_semanal) {
                if (headers.length > 23 && (!columnMap.alerta_2 || headers[23])) {
                    row[23] = this.convertReglaToExcelFormat(obligacion.reglas_alertamiento.regla_semanal);
                } else if (columnMap.alerta_2 !== undefined) {
                    row[columnMap.alerta_2] = this.convertReglaToExcelFormat(obligacion.reglas_alertamiento.regla_semanal);
                }
            }
            
            // Columna Y (índice 24): regla_saltado
            if (obligacion.reglas_alertamiento && obligacion.reglas_alertamiento.regla_saltado) {
                if (headers.length > 24 && (!columnMap.alerta_3 || headers[24])) {
                    row[24] = this.convertReglaToExcelFormat(obligacion.reglas_alertamiento.regla_saltado);
                } else if (columnMap.alerta_3 !== undefined) {
                    row[columnMap.alerta_3] = this.convertReglaToExcelFormat(obligacion.reglas_alertamiento.regla_saltado);
                }
            }
            
            // Columna Z (índice 25): regla_diaria
            if (obligacion.reglas_alertamiento && obligacion.reglas_alertamiento.regla_diaria) {
                if (headers.length > 25 && (!columnMap.alerta_4 || headers[25])) {
                    row[25] = this.convertReglaToExcelFormat(obligacion.reglas_alertamiento.regla_diaria);
                } else if (columnMap.alerta_4 !== undefined) {
                    row[columnMap.alerta_4] = this.convertReglaToExcelFormat(obligacion.reglas_alertamiento.regla_diaria);
                }
            }
            
            // Actualizar otros campos mapeados solo si tienen valores nuevos
            // Los valores originales del Excel se mantienen automáticamente
            Object.keys(columnMap).forEach(field => {
                const colIndex = columnMap[field];
                if (colIndex !== undefined && colIndex < headers.length) {
                    // Solo actualizar si el campo tiene un valor nuevo en la obligación
                    if (field === 'nombre' || field === 'disposicion_resumida' || field === 'obligacion' || field === 'titulo') {
                        if (obligacion.nombre || obligacion.descripcion) {
                            row[colIndex] = obligacion.nombre || obligacion.descripcion || '';
                        }
                    } else if (field === 'descripcion' || field === 'tema' || field === 'disposicion_aplicable') {
                        if (obligacion.descripcion) {
                            row[colIndex] = obligacion.descripcion;
                        }
                    } else if (field === 'responsable_cn' || field === 'cn' || field === 'responsable_c.n.') {
                        if (obligacion.responsable_cn) {
                            row[colIndex] = obligacion.responsable_cn;
                        }
                    } else if (field === 'responsable_juridico' || field === 'juridico') {
                        if (obligacion.responsable_juridico) {
                            row[colIndex] = obligacion.responsable_juridico;
                        }
                    } else if (field === 'dias_para_vencer' || field === 'dias_restantes' || field === 'dias_hasta_vencimiento') {
                        if (obligacion.dias_para_vencer_excel !== null && obligacion.dias_para_vencer_excel !== undefined) {
                            row[colIndex] = obligacion.dias_para_vencer_excel;
                        } else if (obligacion.dias_restantes !== null && obligacion.dias_restantes !== undefined) {
                            row[colIndex] = obligacion.dias_restantes;
                        }
                    }
                }
            });
            
            // Calcular estado del toggle: Prendido si estatus = "recordatorio" y sub_estatus = "Sin respuesta"
            const estatusLower = (obligacion.estatus || '').toLowerCase();
            const subEstatusLower = (obligacion.sub_estatus || '').toLowerCase();
            const isRecordatorio = estatusLower === 'recordatorio';
            const isSinRespuesta = subEstatusLower === 'sin respuesta' || subEstatusLower.includes('sin respuesta');
            const seguimientoEstado = (isRecordatorio && isSinRespuesta) ? 'Prendido' : 'Apagado';
            
            // Agregar columna "Seguimiento" al final de la fila
            row.push(seguimientoEstado);
            
            data.push(row);
        });
        
        // Crear worksheet
        const worksheet = XLSX.utils.aoa_to_sheet(data);
        
        // Crear workbook
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        
        // Convertir a Blob
        const excelBuffer = XLSX.write(workbook, { 
            type: 'array', 
            bookType: 'xlsx' 
        });
        
        return new Blob([excelBuffer], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
    }

    /**
     * Generar encabezados estándar si no hay estructura guardada
     */
    generateStandardHeaders() {
        // Generar array con suficientes columnas (hasta Z = índice 25)
        const headers = new Array(26).fill('');
        
        // Mapear columnas conocidas
        headers[2] = 'Órgano / Regulador';
        headers[7] = 'Área Responsable';
        headers[13] = 'Periodicidad';
        headers[15] = 'Fecha límite de entrega';
        headers[19] = 'Estatus';
        headers[20] = 'Sub Estatus';
        headers[21] = 'ID';
        headers[22] = '1ER ALERTA (1 vez)';
        headers[23] = '2DA ALERTA (semanal)';
        headers[24] = '3ER ALERTA (Tercer dia)';
        headers[25] = '4TA ALERTA (Diaria)';
        
        return headers;
    }

    /**
     * Convertir fecha YYYY-MM-DD a formato Excel (serial number)
     */
    convertDateToExcelFormat(dateStr) {
        if (!dateStr) return null;
        
        // Si ya es un string DD/MM/YYYY, mantenerlo
        if (typeof dateStr === 'string' && dateStr.includes('/')) {
            return dateStr;
        }
        
        // Si es YYYY-MM-DD, convertir a serial number de Excel
        if (typeof dateStr === 'string' && dateStr.includes('-')) {
            const date = new Date(dateStr + 'T00:00:00Z');
            if (isNaN(date.getTime())) return dateStr;
            
            // Calcular serial number de Excel
            const excelEpoch = new Date(Date.UTC(1899, 11, 30));
            const diffTime = date.getTime() - excelEpoch.getTime();
            const diffDays = diffTime / (1000 * 60 * 60 * 24);
            
            return diffDays;
        }
        
        return dateStr;
    }

    /**
     * Convertir regla de alertamiento a formato Excel
     * Puede ser DD/MM/YYYY (string) o serial number
     */
    convertReglaToExcelFormat(regla) {
        if (!regla) return null;
        
        // Si ya es un string DD/MM/YYYY, mantenerlo
        if (typeof regla === 'string' && regla.includes('/')) {
            return regla;
        }
        
        // Si es un número (serial de Excel), mantenerlo
        if (typeof regla === 'number') {
            return regla;
        }
        
        // Intentar convertir string YYYY-MM-DD a serial
        if (typeof regla === 'string' && regla.includes('-')) {
            const date = new Date(regla + 'T00:00:00Z');
            if (!isNaN(date.getTime())) {
                const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                const diffTime = date.getTime() - excelEpoch.getTime();
                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                return diffDays;
            }
        }
        
        return regla;
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.ExcelService = ExcelService;
}
