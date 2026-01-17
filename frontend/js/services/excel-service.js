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
     * Procesar archivo Excel
     */
    async processExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // Obtener la primera hoja
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    
                    // Convertir a JSON
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
                        header: 1,
                        defval: null
                    });
                    
                    // Procesar datos
                    const obligaciones = this.parseExcelData(jsonData);
                    
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
    parseExcelData(jsonData) {
        if (!jsonData || jsonData.length < 5) {
            throw new Error('El archivo Excel debe tener al menos una fila de encabezados (fila 4) y una fila de datos');
        }

        // Buscar la fila de encabezados (normalmente fila 4, índice 3)
        // Buscar fila que contenga "Disposición resumida" o "Órgano / Regulador"
        let headerRowIndex = 3; // Por defecto fila 4 (índice 3)
        
        for (let i = 0; i < Math.min(10, jsonData.length); i++) {
            const row = jsonData[i];
            if (row && row.some(cell => {
                const cellStr = String(cell || '').toLowerCase();
                return cellStr.includes('disposición resumida') || 
                       cellStr.includes('disposicion resumida') ||
                       cellStr.includes('órgano / regulador') ||
                       cellStr.includes('organo / regulador');
            })) {
                headerRowIndex = i;
                break;
            }
        }

        // Obtener encabezados de la fila encontrada
        const headers = jsonData[headerRowIndex].map(h => h ? String(h).toLowerCase().trim() : '');
        
        // Mapear nombres de columnas
        const columnMap = this.mapColumns(headers);
        
        // Validar columnas requeridas
        this.validateColumns(columnMap);
        
        // Procesar filas de datos (empezar después de los encabezados)
        const obligaciones = [];
        
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            
            // Saltar filas vacías
            if (!row || row.every(cell => !cell || (cell !== null && String(cell).trim() === ''))) {
                continue;
            }
            
            try {
                const obligacion = this.parseRow(row, headers, columnMap, i, headerRowIndex);
                if (obligacion) {
                    obligaciones.push(obligacion);
                }
            } catch (error) {
                console.warn(`Error al procesar fila ${i + 1}:`, error.message);
                // Continuar con las siguientes filas
            }
        }
        
        if (obligaciones.length === 0) {
            throw new Error('No se encontraron obligaciones válidas en el archivo');
        }
        
        return obligaciones;
    }

    /**
     * Mapear columnas del Excel
     */
    mapColumns(headers) {
        const map = {};
        
        // Mapeos específicos para la estructura real del Excel
        const mappings = {
            nombre: ['disposición resumida', 'disposicion resumida', 'disposicion resumida'],
            regulador: ['órgano / regulador', 'organo / regulador', 'órgano regulador', 'organo regulador'],
            descripcion: ['tema', 'disposición aplicable', 'disposicion aplicable'],
            area: ['área responsable', 'area responsable', 'area', 'área'],
            periodicidad: ['periodicidad'],
            fecha_limite: ['fecha límite de entrega', 'fecha limite de entrega', 'fecha límite', 'fecha limite'],
            mes_entrega: ['mes de entrega'],
            plazo_entrega: ['plazo de entrega'],
            articulo: ['artículo', 'articulo'],
            requerimiento: ['requerimiento'],
            regulador_destino: ['órgano / regulador al que se envía', 'organo / regulador al que se envia', 'órgano regulador al que se envía'],
            consejo_admin: ['consejo de admón', 'consejo de admin'],
            aprobacion_comite: ['aprobación del comité', 'aprobacion del comite'],
            director_general: ['director general'],
            pagina_internet: ['página de internet', 'pagina de internet'],
            notas: ['notas']
        };
        
        for (const [field, possibleNames] of Object.entries(mappings)) {
            for (let j = 0; j < headers.length; j++) {
                const header = headers[j];
                if (header) {
                    // Comparación más flexible
                    const headerLower = header.toLowerCase();
                    if (possibleNames.some(name => {
                        const nameLower = name.toLowerCase();
                        return headerLower === nameLower || 
                               headerLower.includes(nameLower) || 
                               nameLower.includes(headerLower);
                    })) {
                        map[field] = j;
                        break;
                    }
                }
            }
        }
        
        return map;
    }

    /**
     * Validar que existan las columnas requeridas
     */
    validateColumns(columnMap) {
        // Regulador y nombre son requeridos, fecha puede ser eventual
        const required = ['regulador', 'nombre'];
        const missing = required.filter(field => columnMap[field] === undefined);
        
        if (missing.length > 0) {
            const fieldNames = {
                'regulador': 'Órgano / Regulador',
                'nombre': 'Disposición resumida'
            };
            throw new Error(`Faltan columnas requeridas: ${missing.map(f => fieldNames[f] || f).join(', ')}`);
        }
        
        // Advertir si falta fecha pero no es crítico (puede ser eventual)
        if (!columnMap.fecha_limite && !columnMap.mes_entrega) {
            console.warn('No se encontró columna de fecha límite ni mes de entrega. Las fechas se calcularán como eventuales.');
        }
    }

    /**
     * Parsear una fila del Excel
     */
    parseRow(row, headers, columnMap, rowIndex, headerRowIndex) {
        const getValue = (field) => {
            const colIndex = columnMap[field];
            if (colIndex === undefined || colIndex >= row.length) {
                return null;
            }
            const value = row[colIndex];
            // Convertir null, undefined, o strings vacíos a null
            if (value === null || value === undefined) {
                return null;
            }
            if (typeof value === 'string' && value.trim() === '') {
                return null;
            }
            return value;
        };
        
        // Obtener valores
        const nombre = getValue('nombre');
        const regulador = getValue('regulador');
        const descripcion = getValue('descripcion') || nombre; // Usar tema o nombre
        const area = getValue('area');
        let fechaLimite = getValue('fecha_limite');
        const mesEntrega = getValue('mes_entrega');
        const periodicidad = getValue('periodicidad');
        const articulo = getValue('articulo');
        const requerimiento = getValue('requerimiento');
        const reguladorDestino = getValue('regulador_destino');
        const plazoEntrega = getValue('plazo_entrega');
        const consejoAdmin = getValue('consejo_admin');
        const aprobacionComite = getValue('aprobacion_comite');
        const directorGeneral = getValue('director_general');
        const paginaInternet = getValue('pagina_internet');
        const notas = getValue('notas');
        
        // Validar campos requeridos
        if (!regulador || !nombre) {
            throw new Error('Faltan campos requeridos: Regulador o Disposición resumida');
        }
        
        // Generar ID basado en número de fila
        const year = new Date().getFullYear();
        const numFila = rowIndex - headerRowIndex; // Número relativo desde encabezados
        const id = `OBL-${year}-${String(numFila).padStart(4, '0')}`;
        
        // Procesar fecha
        let fechaLimiteDate = null;
        const fechaLimiteStr = fechaLimite ? String(fechaLimite).trim() : '';
        
        if (fechaLimiteStr && fechaLimiteStr.toLowerCase() !== 'eventual') {
            // Intentar parsear como fecha
            if (fechaLimite instanceof Date) {
                fechaLimiteDate = fechaLimite;
            } else if (typeof fechaLimite === 'number') {
                // Excel serial date
                try {
                    fechaLimiteDate = XLSX.SSF.parse_date_code(fechaLimite);
                } catch (e) {
                    // Si falla, intentar como timestamp
                    fechaLimiteDate = new Date((fechaLimite - 25569) * 86400 * 1000);
                }
            } else {
                // String date - intentar varios formatos
                fechaLimiteDate = new Date(fechaLimiteStr);
            }
            
            // Validar fecha
            if (isNaN(fechaLimiteDate.getTime())) {
                fechaLimiteDate = null;
            }
        }
        
        // Si no hay fecha válida y hay mes de entrega, calcular fecha
        if (!fechaLimiteDate && mesEntrega) {
            const mes = parseInt(mesEntrega);
            if (mes >= 1 && mes <= 12) {
                const year = new Date().getFullYear();
                // Último día del mes especificado
                // new Date(year, mes + 1, 0) donde mes es 1-12 da el último día del mes correcto
                // Ejemplo: mes=1 (enero) → new Date(year, 2, 0) = 31 de enero
                // Ejemplo: mes=12 (diciembre) → new Date(year, 13, 0) = 31 de diciembre
                fechaLimiteDate = new Date(year, mes + 1, 0);
            }
        }
        
        // Si aún no hay fecha, usar fecha por defecto (fin de año actual)
        if (!fechaLimiteDate) {
            const year = new Date().getFullYear();
            fechaLimiteDate = new Date(year, 11, 31); // 31 de diciembre
        }
        
        // Normalizar periodicidad
        let periodicidadNormalizada = periodicidad ? String(periodicidad).trim() : 'Mensual';
        const periodicidadesValidas = ['Mensual', 'Anual', 'Trimestral', 'Semestral', 'Eventual', 'Diario'];
        if (!periodicidadesValidas.includes(periodicidadNormalizada)) {
            periodicidadNormalizada = 'Mensual';
        }
        
        // Crear objeto de obligación
        const obligacion = {
            id: id,
            regulador: String(regulador).trim(),
            descripcion: descripcion ? String(descripcion).trim() : String(nombre).trim(),
            nombre: String(nombre).trim(),
            responsable: 'Sin asignar', // No hay campo en el Excel
            area: area ? String(area).trim() : 'General',
            fecha_limite: fechaLimiteDate.toISOString().split('T')[0],
            periodicidad: periodicidadNormalizada,
            estado: 'activa',
            reglas_alertamiento: {
                alerta1: 30,
                alerta2: 10,
                critica: 5
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        // Agregar campos adicionales si existen
        if (articulo) {
            obligacion.articulo = String(articulo).trim();
        }
        if (requerimiento) {
            obligacion.requerimiento = String(requerimiento).trim();
        }
        if (reguladorDestino) {
            obligacion.regulador_destino = String(reguladorDestino).trim();
        }
        if (plazoEntrega) {
            obligacion.plazo_entrega = String(plazoEntrega).trim();
        }
        
        // Metadata
        obligacion.metadata = {};
        if (consejoAdmin) {
            obligacion.metadata.consejo_admin = String(consejoAdmin).trim();
        }
        if (aprobacionComite) {
            obligacion.metadata.aprobacion_comite = String(aprobacionComite).trim();
        }
        if (directorGeneral) {
            obligacion.metadata.director_general = String(directorGeneral).trim();
        }
        if (paginaInternet) {
            obligacion.metadata.pagina_internet = String(paginaInternet).trim();
        }
        if (notas) {
            obligacion.metadata.notas = String(notas).trim();
        }
        
        return obligacion;
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.ExcelService = ExcelService;
}
