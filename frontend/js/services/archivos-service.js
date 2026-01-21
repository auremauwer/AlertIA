/**
 * Servicio de Archivos
 * Maneja la subida, descarga y gestión de archivos/evidencias por obligación
 */
class ArchivosService {
    constructor(dataAdapter, fileStorageService = null) {
        this.dataAdapter = dataAdapter;
        this.fileStorageService = fileStorageService;
        this.maxFileSize = 25 * 1024 * 1024; // 25MB
        this.allowedTypes = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/jpg',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'application/msword', // .doc
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
            'text/plain',
            'application/zip',
            'application/x-zip-compressed'
        ];
    }

    /**
     * Validar archivo antes de subir
     * @param {File} archivo - Archivo a validar
     * @returns {object} { valido: boolean, error: string }
     */
    validarArchivo(archivo) {
        if (!archivo) {
            return { valido: false, error: 'No se seleccionó ningún archivo' };
        }

        // Validar tamaño
        if (archivo.size > this.maxFileSize) {
            return { 
                valido: false, 
                error: `El archivo excede el tamaño máximo de ${this.maxFileSize / (1024 * 1024)}MB` 
            };
        }

        // Validar tipo (opcional, permitir cualquier tipo si no está en la lista)
        // if (this.allowedTypes.length > 0 && !this.allowedTypes.includes(archivo.type)) {
        //     return { 
        //         valido: false, 
        //         error: `Tipo de archivo no permitido: ${archivo.type}` 
        //     };
        // }

        return { valido: true, error: null };
    }

    /**
     * Subir archivo para una obligación
     * @param {string} obligacionId - ID de la obligación
     * @param {File} archivo - Archivo a subir
     * @param {string} descripcion - Descripción opcional del archivo
     * @returns {Promise<object>} Objeto con información del archivo subido
     */
    async subirArchivo(obligacionId, archivo, descripcion = '') {
        try {
            // Validar archivo
            const validacion = this.validarArchivo(archivo);
            if (!validacion.valido) {
                throw new Error(validacion.error);
            }

            // Obtener obligación
            const obligacion = await this.dataAdapter.getObligacion(obligacionId);
            if (!obligacion) {
                throw new Error(`Obligación ${obligacionId} no encontrada`);
            }

            // Obtener usuario actual
            const user = await this.dataAdapter.getCurrentUser();

            // Generar ID único para el archivo
            const archivoId = `arch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Preparar información del archivo
            const archivoInfo = {
                id: archivoId,
                nombre: archivo.name,
                tipo: archivo.type,
                tamaño: archivo.size,
                fecha_subida: new Date().toISOString(),
                usuario_subio: user.nombre || 'Usuario',
                area_subio: user.area || null,
                descripcion: descripcion || '',
                estado: 'pendiente_revision'
            };

            // Guardar archivo en almacenamiento
            if (this.fileStorageService) {
                // Usar FileStorageService (IndexedDB)
                const blob = new Blob([archivo], { type: archivo.type });
                const ruta = `obligaciones/${obligacionId}/${archivoId}/${archivo.name}`;
                await this.fileStorageService.saveFile(archivo.name, blob, `obligaciones/${obligacionId}`, archivo.type);
                archivoInfo.ruta = ruta;
            } else {
                // Fallback: convertir a base64 y guardar en la obligación (no recomendado para archivos grandes)
                const reader = new FileReader();
                const base64 = await new Promise((resolve, reject) => {
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(archivo);
                });
                archivoInfo.ruta = base64; // Guardar como base64
                archivoInfo.esBase64 = true;
            }

            // Inicializar array de archivos si no existe
            if (!obligacion.archivos || !Array.isArray(obligacion.archivos)) {
                obligacion.archivos = [];
            }

            // Agregar archivo a la obligación
            obligacion.archivos.push(archivoInfo);
            obligacion.updated_at = new Date().toISOString();

            // Guardar obligación actualizada
            await this.dataAdapter.saveObligacion(obligacion);

            // Registrar evento en bitácora
            if (window.BitacoraService) {
                const bitacoraService = new BitacoraService(this.dataAdapter);
                await bitacoraService.registrarEvento(
                    obligacionId,
                    'archivo_subido',
                    'Archivo subido',
                    `Archivo "${archivo.name}" subido por ${user.nombre || 'Usuario'}`,
                    null,
                    { archivo: archivoInfo },
                    [archivoId]
                );
            }

            console.log(`[Archivos] Archivo ${archivo.name} subido para obligación ${obligacionId}`);
            return archivoInfo;
        } catch (error) {
            console.error('[Archivos] Error al subir archivo:', error);
            throw error;
        }
    }

    /**
     * Obtener todos los archivos de una obligación
     * @param {string} obligacionId - ID de la obligación
     * @returns {Promise<Array>} Array de archivos
     */
    async obtenerArchivos(obligacionId) {
        try {
            const obligacion = await this.dataAdapter.getObligacion(obligacionId);
            if (!obligacion) {
                return [];
            }

            return obligacion.archivos || [];
        } catch (error) {
            console.error('[Archivos] Error al obtener archivos:', error);
            return [];
        }
    }

    /**
     * Descargar un archivo
     * @param {string} obligacionId - ID de la obligación
     * @param {string} archivoId - ID del archivo
     * @returns {Promise<void>}
     */
    async descargarArchivo(obligacionId, archivoId) {
        try {
            const obligacion = await this.dataAdapter.getObligacion(obligacionId);
            if (!obligacion || !obligacion.archivos) {
                throw new Error('Obligación o archivos no encontrados');
            }

            const archivo = obligacion.archivos.find(a => a.id === archivoId);
            if (!archivo) {
                throw new Error('Archivo no encontrado');
            }

            // Si está en FileStorageService, descargar desde ahí
            if (this.fileStorageService && archivo.ruta && !archivo.esBase64) {
                await this.fileStorageService.downloadFile(archivo.ruta, archivo.nombre);
                return;
            }

            // Si es base64, convertir y descargar
            if (archivo.esBase64 && archivo.ruta) {
                const link = document.createElement('a');
                link.href = archivo.ruta;
                link.download = archivo.nombre;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                return;
            }

            throw new Error('No se pudo descargar el archivo');
        } catch (error) {
            console.error('[Archivos] Error al descargar archivo:', error);
            throw error;
        }
    }

    /**
     * Eliminar un archivo
     * @param {string} obligacionId - ID de la obligación
     * @param {string} archivoId - ID del archivo
     * @returns {Promise<void>}
     */
    async eliminarArchivo(obligacionId, archivoId) {
        try {
            const obligacion = await this.dataAdapter.getObligacion(obligacionId);
            if (!obligacion || !obligacion.archivos) {
                throw new Error('Obligación o archivos no encontrados');
            }

            const archivo = obligacion.archivos.find(a => a.id === archivoId);
            if (!archivo) {
                throw new Error('Archivo no encontrado');
            }

            // Eliminar del almacenamiento si está en FileStorageService
            if (this.fileStorageService && archivo.ruta && !archivo.esBase64) {
                try {
                    await this.fileStorageService.deleteFile(archivo.ruta);
                } catch (error) {
                    console.warn('No se pudo eliminar el archivo del almacenamiento:', error);
                }
            }

            // Eliminar de la lista de archivos
            obligacion.archivos = obligacion.archivos.filter(a => a.id !== archivoId);
            obligacion.updated_at = new Date().toISOString();

            // Guardar obligación actualizada
            await this.dataAdapter.saveObligacion(obligacion);

            // Registrar evento en bitácora
            if (window.BitacoraService) {
                const bitacoraService = new BitacoraService(this.dataAdapter);
                await bitacoraService.registrarEvento(
                    obligacionId,
                    'archivo_eliminado',
                    'Archivo eliminado',
                    `Archivo "${archivo.nombre}" eliminado`,
                    { archivo: archivo },
                    null,
                    null
                );
            }

            console.log(`[Archivos] Archivo ${archivoId} eliminado de obligación ${obligacionId}`);
        } catch (error) {
            console.error('[Archivos] Error al eliminar archivo:', error);
            throw error;
        }
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.ArchivosService = ArchivosService;
}
