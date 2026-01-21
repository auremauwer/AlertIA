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
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                        header: 1,
                        defval: null
                    });

                    // Procesar datos con fila 4 como cabecera (índice 3)
                    const obligaciones = this.parseExcelData(jsonData, totalFilasEnExcel, 3);

                    resolve(obligaciones);
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
            dias_para_vencer: ['días para vencer', 'dias para vencer', 'días restantes', 'dias restantes', 'días hasta vencimiento', 'dias hasta vencimiento']
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
            if (!val) return null;
            let date = null;
            if (val instanceof Date) {
                date = val;
            } else if (typeof val === 'number') {
                if (val > 1000) {
                    const excelEpoch = new Date(1899, 11, 30);
                    date = new Date(excelEpoch.getTime() + (val - 1) * 86400 * 1000);
                }
            } else {
                try {
                    date = new Date(val);
                    if (isNaN(date.getTime())) {
                        // Try DD/MM/YYYY
                        const dateParts = String(val).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
                        if (dateParts) {
                            const [, day, month, year] = dateParts;
                            date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                        }
                    }
                } catch (e) { }
            }

            if (date && !isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
                return date;
            }
            return null;
        };

        // DEBUG: Logging de fila para verificar columnas
        if (rowIndex < headerRowIndex + 5) { // Loguear solo las primeras 5 filas de datos
            console.log(`[ExcelService] DEBUG Row ${rowIndex + 1} (Data):`, {
                'Col H (7) Area': row[7],
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
        const area = row[7] ? String(row[7]).trim() : 'Sin asignar';

        // Obtener Periodicidad directamente de la columna N (índice 13)
        const periodicidad = row[13] ? String(row[13]).trim() : 'No definida';

        // Obtener valores básicos
        const nombre = getValue('nombre') || idOriginal;
        // Obtener Regulador directamente de la columna C (índice 2)
        const regulador = row[2] ? String(row[2]).trim() : 'General';

        // Nuevos campos
        // Mapeo estricto solicitado por el usuario:
        // Columna T (19) -> Estatus
        // Columna U (20) -> Subestatus
        const estatusVal = row[19];
        const estatus = estatusVal ? String(estatusVal).trim() : null;

        const subEstatusVal = row[20];
        const subEstatus = subEstatusVal ? String(subEstatusVal).trim() : null;
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
        // Si existe columna fecha_limite, usarla. Si no, usar alerta_4 como fecha limite aproximada
        let fechaLimiteVal = getValue('fecha_limite');
        let fechaLimiteDate = parseDate(fechaLimiteVal);

        if (!fechaLimiteDate && alerta4) {
            fechaLimiteDate = alerta4;
        }
        if (!fechaLimiteDate) {
            const year = new Date().getFullYear();
            fechaLimiteDate = new Date(year, 11, 31);
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
            fecha_limite: fechaLimiteDate.toISOString().split('T')[0],
            estatus: estatus ? String(estatus).toLowerCase().trim() : null,
            sub_estatus: subEstatus ? String(subEstatus).trim().charAt(0).toUpperCase() + String(subEstatus).trim().slice(1).replace(/\(cn\)/i, '(CN)') : null,
            responsable_cn: respCN,
            responsable_juridico: respJur,
            dias_para_vencer_excel: diasParaVencer, // Guardar el valor del Excel
            alertas: {
                alerta_1: alerta1 ? alerta1.toISOString().split('T')[0] : null,
                alerta_2: alerta2 ? alerta2.toISOString().split('T')[0] : null,
                alerta_3: alerta3 ? alerta3.toISOString().split('T')[0] : null,
                alerta_4: alerta4 ? alerta4.toISOString().split('T')[0] : null
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        return {
            obligacion: obligacion,
            problemas: []
        };
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.ExcelService = ExcelService;
}
