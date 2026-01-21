/**
 * Servicio de Almacenamiento de Archivos
 * Gestiona la lectura y escritura de archivos usando IndexedDB y File System Access API
 */
class FileStorageService {
    constructor() {
        this.dbName = 'AlertIA_FileStorage';
        this.dbVersion = 1;
        this.db = null;
        this.storagePath = '/storage'; // Ruta base para archivos
    }

    /**
     * Inicializar la base de datos IndexedDB
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Error al abrir IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ FileStorageService inicializado');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Crear object store para archivos
                if (!db.objectStoreNames.contains('files')) {
                    const fileStore = db.createObjectStore('files', { keyPath: 'path' });
                    fileStore.createIndex('name', 'name', { unique: false });
                    fileStore.createIndex('type', 'type', { unique: false });
                    fileStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // Crear object store para metadatos
                if (!db.objectStoreNames.contains('metadata')) {
                    const metadataStore = db.createObjectStore('metadata', { keyPath: 'key' });
                }
            };
        });
    }

    /**
     * Guardar un archivo
     * @param {string} fileName - Nombre del archivo
     * @param {Blob|string} content - Contenido del archivo (Blob o string)
     * @param {string} category - Categoría del archivo (exports, uploads, logs)
     * @param {string} mimeType - Tipo MIME del archivo
     * @returns {Promise<string>} - Ruta del archivo guardado
     */
    async saveFile(fileName, content, category = 'exports', mimeType = 'text/plain') {
        if (!this.db) {
            await this.init();
        }

        const path = `${category}/${fileName}`;
        const timestamp = new Date().toISOString();

        // Convertir string a Blob si es necesario
        let blob;
        if (typeof content === 'string') {
            blob = new Blob([content], { type: mimeType });
        } else {
            blob = content;
        }

        // Convertir Blob a ArrayBuffer para almacenar en IndexedDB
        const arrayBuffer = await blob.arrayBuffer();

        const fileData = {
            path: path,
            name: fileName,
            category: category,
            type: mimeType,
            content: arrayBuffer,
            size: blob.size,
            createdAt: timestamp,
            updatedAt: timestamp
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');

            const request = store.put(fileData);

            request.onsuccess = () => {
                console.log(`✅ Archivo guardado: ${path}`);
                resolve(path);
            };

            request.onerror = () => {
                console.error('Error al guardar archivo:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Leer un archivo
     * @param {string} path - Ruta del archivo
     * @returns {Promise<Blob>} - Contenido del archivo como Blob
     */
    async readFile(path) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readonly');
            const store = transaction.objectStore('files');

            const request = store.get(path);

            request.onsuccess = () => {
                const fileData = request.result;
                if (!fileData) {
                    reject(new Error(`Archivo no encontrado: ${path}`));
                    return;
                }

                const blob = new Blob([fileData.content], { type: fileData.type });
                resolve(blob);
            };

            request.onerror = () => {
                console.error('Error al leer archivo:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Leer un archivo como texto
     * @param {string} path - Ruta del archivo
     * @returns {Promise<string>} - Contenido del archivo como texto
     */
    async readFileAsText(path) {
        const blob = await this.readFile(path);
        return await blob.text();
    }

    /**
     * Listar archivos por categoría
     * @param {string} category - Categoría a listar (exports, uploads, logs)
     * @returns {Promise<Array>} - Lista de archivos con metadatos
     */
    async listFiles(category = null) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readonly');
            const store = transaction.objectStore('files');
            const request = store.getAll();

            request.onsuccess = () => {
                let files = request.result;

                // Filtrar por categoría si se especifica
                if (category) {
                    files = files.filter(f => f.category === category);
                }

                // Ordenar por fecha de creación (más recientes primero)
                files.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                resolve(files.map(f => ({
                    path: f.path,
                    name: f.name,
                    category: f.category,
                    type: f.type,
                    size: f.size,
                    createdAt: f.createdAt,
                    updatedAt: f.updatedAt
                })));
            };

            request.onerror = () => {
                console.error('Error al listar archivos:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Eliminar un archivo
     * @param {string} path - Ruta del archivo
     * @returns {Promise<void>}
     */
    async deleteFile(path) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');

            const request = store.delete(path);

            request.onsuccess = () => {
                console.log(`✅ Archivo eliminado: ${path}`);
                resolve();
            };

            request.onerror = () => {
                console.error('Error al eliminar archivo:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Descargar un archivo al sistema de archivos del usuario
     * @param {string} path - Ruta del archivo en el almacenamiento
     * @param {string} suggestedName - Nombre sugerido para la descarga
     * @returns {Promise<void>}
     */
    async downloadFile(path, suggestedName = null) {
        try {
            const blob = await this.readFile(path);
            const fileName = suggestedName || path.split('/').pop();

            // Usar File System Access API si está disponible (Chrome/Edge)
            if ('showSaveFilePicker' in window) {
                try {
                    const fileHandle = await window.showSaveFilePicker({
                        suggestedName: fileName,
                        types: [{
                            description: 'Archivo',
                            accept: { [blob.type]: [`.${fileName.split('.').pop()}`] }
                        }]
                    });

                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    console.log(`✅ Archivo descargado: ${fileName}`);
                    return;
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        console.warn('File System Access API falló, usando método alternativo:', err);
                    } else {
                        // Usuario canceló
                        return;
                    }
                }
            }

            // Método alternativo: descarga tradicional
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            console.log(`✅ Archivo descargado: ${fileName}`);
        } catch (error) {
            console.error('Error al descargar archivo:', error);
            throw error;
        }
    }

    /**
     * Guardar metadatos
     * @param {string} key - Clave del metadato
     * @param {*} value - Valor del metadato
     * @returns {Promise<void>}
     */
    async saveMetadata(key, value) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['metadata'], 'readwrite');
            const store = transaction.objectStore('metadata');

            const request = store.put({
                key: key,
                value: value,
                updatedAt: new Date().toISOString()
            });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Leer metadatos
     * @param {string} key - Clave del metadato
     * @returns {Promise<*>} - Valor del metadato
     */
    async getMetadata(key) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['metadata'], 'readonly');
            const store = transaction.objectStore('metadata');

            const request = store.get(key);

            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? result.value : null);
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Obtener estadísticas de almacenamiento
     * @returns {Promise<Object>} - Estadísticas de uso
     */
    async getStorageStats() {
        const files = await this.listFiles();
        const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
        const byCategory = {};

        files.forEach(f => {
            if (!byCategory[f.category]) {
                byCategory[f.category] = { count: 0, size: 0 };
            }
            byCategory[f.category].count++;
            byCategory[f.category].size += f.size || 0;
        });

        return {
            totalFiles: files.length,
            totalSize: totalSize,
            byCategory: byCategory
        };
    }

    /**
     * Agregar contenido al final de un archivo (append)
     * @param {string} path - Ruta del archivo
     * @param {string} content - Contenido a agregar
     * @param {string} mimeType - Tipo MIME del archivo (default: text/plain)
     * @returns {Promise<string>} - Ruta del archivo actualizado
     */
    async appendToFile(path, content, mimeType = 'text/plain') {
        if (!this.db) {
            await this.init();
        }

        try {
            // Intentar leer el archivo existente
            let contenidoExistente = '';
            try {
                contenidoExistente = await this.readTextFile(path);
            } catch (error) {
                // Si el archivo no existe, empezar con contenido vacío
                contenidoExistente = '';
            }

            // Agregar el nuevo contenido
            const nuevoContenido = contenidoExistente + content;

            // Guardar el archivo completo
            const blob = new Blob([nuevoContenido], { type: mimeType });
            const arrayBuffer = await blob.arrayBuffer();

            // Extraer nombre de archivo y categoría de la ruta
            const pathParts = path.split('/');
            const fileName = pathParts.pop();
            const category = pathParts.join('/') || 'logs';

            const fileData = {
                path: path,
                name: fileName,
                category: category,
                type: mimeType,
                content: arrayBuffer,
                size: blob.size,
                createdAt: contenidoExistente ? (await this.getFileMetadata(path))?.createdAt || new Date().toISOString() : new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['files'], 'readwrite');
                const store = transaction.objectStore('files');

                const request = store.put(fileData);

                request.onsuccess = () => {
                    console.log(`✅ Contenido agregado a: ${path}`);
                    resolve(path);
                };

                request.onerror = () => {
                    console.error('Error al agregar contenido al archivo:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('Error en appendToFile:', error);
            throw error;
        }
    }

    /**
     * Leer un archivo como texto
     * @param {string} path - Ruta del archivo
     * @returns {Promise<string>} - Contenido del archivo como texto
     */
    async readTextFile(path) {
        try {
            return await this.readFileAsText(path);
        } catch (error) {
            // Si el archivo no existe, retornar string vacío
            if (error.message && error.message.includes('no encontrado')) {
                return '';
            }
            throw error;
        }
    }

    /**
     * Obtener metadatos de un archivo
     * @param {string} path - Ruta del archivo
     * @returns {Promise<Object|null>} - Metadatos del archivo o null si no existe
     */
    async getFileMetadata(path) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readonly');
            const store = transaction.objectStore('files');

            const request = store.get(path);

            request.onsuccess = () => {
                const fileData = request.result;
                if (!fileData) {
                    resolve(null);
                    return;
                }

                resolve({
                    path: fileData.path,
                    name: fileData.name,
                    category: fileData.category,
                    type: fileData.type,
                    size: fileData.size,
                    createdAt: fileData.createdAt,
                    updatedAt: fileData.updatedAt
                });
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }
}

// Exportar servicio
if (typeof window !== 'undefined') {
    window.FileStorageService = FileStorageService;
}
