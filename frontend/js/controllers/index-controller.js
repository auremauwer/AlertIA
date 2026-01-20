/**
 * Controlador de la Página Inicial
 * Maneja la carga de archivos Excel y navegación inicial
 */
class IndexController {
    constructor() {
        this.excelService = null;
        this.obligacionesService = null;
        this.auditoriaService = null;
    }

    /**
     * Inicializar controlador
     */
    async init() {
        // Esperar a que SheetJS esté disponible
        if (typeof XLSX === 'undefined') {
            console.error('IndexController: SheetJS no está disponible');
            return;
        }

        if (!window.dataAdapter) {
            console.error('IndexController: dataAdapter no está disponible');
            return;
        }

        try {
            this.excelService = new ExcelService();
            this.obligacionesService = new ObligacionesService(window.dataAdapter);
            this.auditoriaService = new AuditoriaService(window.dataAdapter);

            this.setupEventListeners();
            console.log('IndexController: Event listeners configurados');
        } catch (error) {
            console.error('IndexController: Error al inicializar:', error);
            throw error;
        }
    }

    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        const fileInput = document.getElementById('excel-file-input');
        const uploadArea = document.getElementById('upload-area');
        const uploadButton = document.getElementById('upload-button');

        console.log('[DEBUG] IndexController: Configurando event listeners', {
            fileInput: !!fileInput,
            uploadArea: !!uploadArea,
            uploadButton: !!uploadButton,
            fileInputId: fileInput?.id,
            uploadButtonId: uploadButton?.id
        });

        if (!fileInput) {
            console.error('[DEBUG] IndexController: ERROR - No se encontró el elemento excel-file-input');
            return;
        }

        if (!uploadButton) {
            console.error('[DEBUG] IndexController: ERROR - No se encontró el elemento upload-button');
            return;
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                console.log('[DEBUG] IndexController: Archivo seleccionado en input', e.target.files);
                if (e.target.files.length > 0) {
                    this.handleFileSelect(e.target.files[0]);
                } else {
                    console.warn('[DEBUG] IndexController: Input change pero no hay archivos');
                }
            });
        }

        if (uploadArea) {
            // Drag and drop
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('drag-over');
            });

            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('drag-over');
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('drag-over');
                
                const files = e.dataTransfer.files;
                if (files.length > 0 && this.isExcelFile(files[0])) {
                    this.handleFileSelect(files[0]);
                } else {
                    Utils.showNotification('Por favor selecciona un archivo Excel (.xlsx o .xls)', 'error');
                }
            });

            // Click para abrir selector (solo si no se clickeó el botón)
            uploadArea.addEventListener('click', (e) => {
                // Si el click fue en el botón, no hacer nada (el botón manejará su propio click)
                if (e.target && (e.target.id === 'upload-button' || e.target.closest('#upload-button'))) {
                    console.log('[DEBUG] IndexController: Click en upload-area pero fue en el botón, ignorando');
                    return;
                }
                console.log('[DEBUG] IndexController: Click en upload-area (no en botón)');
                if (fileInput) {
                    fileInput.click();
                }
            });
        }

        if (uploadButton) {
            // Agregar múltiples listeners para debug
            uploadButton.addEventListener('click', (e) => {
                console.log('[DEBUG] IndexController: Botón de upload clickeado - evento capturado');
                e.stopPropagation(); // Evitar que el evento se propague al upload-area
                e.preventDefault();
                
                if (fileInput) {
                    console.log('[DEBUG] IndexController: fileInput encontrado, llamando click()');
                    try {
                        fileInput.click();
                        console.log('[DEBUG] IndexController: fileInput.click() ejecutado');
                    } catch (error) {
                        console.error('[DEBUG] IndexController: ERROR al llamar fileInput.click()', error);
                    }
                } else {
                    console.error('[DEBUG] IndexController: ERROR - fileInput no disponible al hacer click en el botón');
                }
            }, true); // Usar capture phase para asegurar que se ejecute
            
            // También agregar listener con mousedown para debug
            uploadButton.addEventListener('mousedown', (e) => {
                console.log('[DEBUG] IndexController: Botón mousedown detectado');
            });
        } else {
            console.error('[DEBUG] IndexController: ERROR - No se encontró el elemento upload-button');
        }
    }

    /**
     * Verificar si es archivo Excel
     */
    isExcelFile(file) {
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel' // .xls
        ];
        const validExtensions = ['.xlsx', '.xls'];
        
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        
        return validTypes.includes(file.type) || validExtensions.includes(extension);
    }

    /**
     * Manejar selección de archivo
     */
    async handleFileSelect(file) {
        if (!this.isExcelFile(file)) {
            Utils.showNotification('Por favor selecciona un archivo Excel (.xlsx o .xls)', 'error');
            return;
        }

        this.showLoading(true);
        this.updateStatus('Leyendo hojas del archivo...', 'info');

        try {
            // Obtener lista de hojas del Excel
            const sheetNames = await this.excelService.getSheetNames(file);
            
            if (sheetNames.length === 0) {
                throw new Error('El archivo Excel no contiene hojas');
            }

            // Si solo hay una hoja, usarla automáticamente
            let selectedSheet = sheetNames[0];
            
            if (sheetNames.length > 1) {
                // Mostrar diálogo para seleccionar hoja
                this.showLoading(false);
                selectedSheet = await this.showSheetSelectionDialog(sheetNames);
                if (!selectedSheet) {
                    this.updateStatus('Carga cancelada', 'info');
                    return;
                }
                this.showLoading(true);
            }

            this.updateStatus('Procesando archivo...', 'info');

            // Procesar Excel con la hoja seleccionada
            const resultado = await this.excelService.processExcelFile(file, selectedSheet);
            const obligaciones = resultado.obligaciones || [];
            const problemas = resultado.problemas || { columnas: {}, filas: [], estadisticas: {} };
            
            // Mostrar problemas de columnas si existen
            if (problemas.columnas && problemas.columnas.advertencias && problemas.columnas.advertencias.length > 0) {
                this.mostrarProblemasColumnas(problemas.columnas);
            }
            
            // Si no hay obligaciones pero hay problemas, mostrar los problemas y salir
            if (obligaciones.length === 0) {
                this.showLoading(false);
                if (problemas.filas && problemas.filas.length > 0) {
                    this.mostrarProblemasFilas(problemas.filas, problemas.estadisticas);
                }
                this.updateStatus('❌ No se pudieron procesar obligaciones. Revisa los problemas detallados abajo.', 'error');
                Utils.showNotification('No se encontraron obligaciones válidas. Revisa los problemas detallados en la página.', 'error');
                return;
            }
            
            this.updateStatus(`Se encontraron ${obligaciones.length} obligaciones. Guardando...`, 'info');
            
            // Guardar obligaciones - ahora con IDs únicos, no necesitamos verificar duplicados por ID
            // Pero verificamos por nombre + regulador para evitar duplicados reales
            let saved = 0;
            let skipped = 0;
            let errors = 0;
            
            // Obtener todas las obligaciones existentes para verificar duplicados por contenido
            const todasObligaciones = await this.obligacionesService.getAll();
            const obligacionesExistentes = new Set(
                todasObligaciones.map(obl => `${obl.regulador}|${obl.nombre}`.toLowerCase())
            );
            
            // También crear un set para las obligaciones que vamos a guardar en esta carga
            // para evitar duplicados dentro del mismo archivo
            const obligacionesEnCarga = new Set();
            
            for (const obligacion of obligaciones) {
                try {
                    // Verificar si ya existe una obligación con el mismo regulador y nombre
                    const clave = `${obligacion.regulador}|${obligacion.nombre}`.toLowerCase();
                    
                    // Verificar duplicados en la base de datos existente
                    if (obligacionesExistentes.has(clave)) {
                        skipped++;
                        continue;
                    }
                    
                    // Verificar duplicados dentro del mismo archivo que estamos cargando
                    if (obligacionesEnCarga.has(clave)) {
                        skipped++;
                        continue;
                    }
                    
                    await window.dataAdapter.saveObligacion(obligacion);
                    obligacionesExistentes.add(clave); // Agregar a la lista para evitar duplicados en la misma carga
                    obligacionesEnCarga.add(clave); // Agregar al set de esta carga
                    saved++;
                } catch (error) {
                    console.error(`Error al guardar obligación ${obligacion.id}:`, error);
                    errors++;
                }
            }
            
            // Mostrar problemas de filas si existen
            if (problemas.filas && problemas.filas.length > 0) {
                this.mostrarProblemasFilas(problemas.filas, problemas.estadisticas);
            }
            
            // Guardar el total de filas del Excel y las filas excluidas en la configuración
            // Usar el total de filas de datos del Excel (sin contar encabezados)
            const totalFilasExcel = problemas.estadisticas?.total || obligaciones.length; // Total de filas de datos en el Excel
            
            // Recopilar información de filas excluidas
            const filasExcluidas = [];
            if (problemas.filas && problemas.filas.length > 0) {
                problemas.filas.forEach(({ fila, problemas: problemasFila }) => {
                    problemasFila.forEach(prob => {
                        if (prob.campo === 'id_oficial' || prob.mensaje?.includes('no tiene ID') || prob.mensaje?.includes('columna V')) {
                            filasExcluidas.push({
                                fila: prob.filaExcel || fila,
                                razon: prob.mensaje || 'ID faltante en columna V'
                            });
                        }
                    });
                });
            }
            
            console.log('[DEBUG] Guardando total_filas_excel:', totalFilasExcel, 'estadisticas.total:', problemas.estadisticas?.total, 'obligaciones.length:', obligaciones.length);
            console.log('[DEBUG] Filas excluidas:', filasExcluidas);
            
            try {
                const configService = new ConfigService(window.dataAdapter);
                const configActual = await configService.getConfiguracion();
                const configToSave = {
                    ...configActual,
                    total_filas_excel: totalFilasExcel, // Guardar el total de filas de datos del Excel
                    total_filas_archivo: totalFilasExcel, // Total de filas del archivo (igual al total de filas de datos)
                    ultima_carga_excel: new Date().toISOString(),
                    filas_excluidas: filasExcluidas // Guardar filas excluidas con sus razones
                };
                const configGuardada = await configService.saveConfiguracion(configToSave);
                console.log(`✅ Guardado en configuración: ${totalFilasExcel} filas de datos del Excel, ${filasExcluidas.length} filas excluidas`);
            } catch (error) {
                console.warn('No se pudo guardar el total de filas en configuración:', error);
            }
            
            // Registrar en auditoría
            const user = await window.dataAdapter.getCurrentUser();
            await this.auditoriaService.registrarEvento('Cargó obligaciones desde Excel', {
                archivo: file.name,
                total: obligaciones.length,
                guardadas: saved,
                omitidas: skipped,
                total_filas: problemas.estadisticas?.total || 0
            });
            
            // Mostrar resultado
            this.showLoading(false);
            
            let statusMessage = `✅ Carga completada: ${saved} obligaciones guardadas de ${obligaciones.length} procesadas`;
            if (skipped > 0) {
                statusMessage += `, ${skipped} omitidas (duplicadas)`;
            }
            if (errors > 0) {
                statusMessage += `, ${errors} con errores`;
            }
            
            // Si todas son duplicadas pero se procesaron correctamente, usar tipo 'info' en lugar de 'error'
            const tipoStatus = saved > 0 ? 'success' : (skipped > 0 && errors === 0 ? 'info' : 'error');
            this.updateStatus(statusMessage, tipoStatus);
            
            if (saved > 0) {
                Utils.showNotification(
                    `${saved} obligaciones cargadas exitosamente de ${obligaciones.length} procesadas${skipped > 0 ? ` (${skipped} duplicadas omitidas)` : ''}`,
                    'success'
                );
            } else {
                // Si todas son duplicadas, mostrar mensaje diferente y más positivo
                if (skipped > 0 && errors === 0) {
                    Utils.showNotification(
                        `✅ ${obligaciones.length} obligaciones procesadas correctamente. Todas ya existen en la base de datos (duplicadas). El contador se actualizó correctamente.`,
                        'info'
                    );
                } else {
                    Utils.showNotification(
                        `No se pudieron guardar obligaciones. Procesadas: ${obligaciones.length}, Omitidas: ${skipped}, Errores: ${errors}`,
                        'error'
                    );
                }
            }
            
            // Redirigir después de 3 segundos si no hay problemas críticos
            const tieneProblemasCriticos = problemas.filas && problemas.filas.length > 0;
            if (!tieneProblemasCriticos) {
                setTimeout(() => {
                    window.location.href = 'Dashboard.html';
                }, 3000);
            }
            
        } catch (error) {
            console.error('Error al procesar Excel:', error);
            this.showLoading(false);
            this.updateStatus(`❌ Error: ${error.message}`, 'error');
            Utils.showNotification(`Error al procesar Excel: ${error.message}`, 'error');
        }
    }

    /**
     * Mostrar diálogo para seleccionar hoja del Excel
     */
    async showSheetSelectionDialog(sheetNames) {
        return new Promise((resolve) => {
            // Crear modal para seleccionar hoja
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50';
            modal.innerHTML = `
                <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                    <h3 class="text-lg font-bold mb-4 text-gray-900">Seleccionar hoja del Excel</h3>
                    <p class="text-sm text-gray-600 mb-4">El archivo contiene ${sheetNames.length} hoja(s). Selecciona la hoja que contiene la matriz de obligaciones:</p>
                    <select id="sheet-select" class="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none">
                        ${sheetNames.map(name => `<option value="${name}">${name}</option>`).join('')}
                    </select>
                    <div class="flex gap-3 justify-end">
                        <button id="btn-cancel-sheet" class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors text-sm font-medium">Cancelar</button>
                        <button id="btn-confirm-sheet" class="px-4 py-2 bg-primary text-white rounded hover:bg-red-700 transition-colors text-sm font-medium">Continuar</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const confirmBtn = modal.querySelector('#btn-confirm-sheet');
            const cancelBtn = modal.querySelector('#btn-cancel-sheet');
            const select = modal.querySelector('#sheet-select');
            
            // Focus en el select
            select.focus();
            
            confirmBtn.addEventListener('click', () => {
                const selected = select.value;
                document.body.removeChild(modal);
                resolve(selected);
            });
            
            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(null);
            });
            
            // Cerrar con Escape
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    document.body.removeChild(modal);
                    document.removeEventListener('keydown', handleEscape);
                    resolve(null);
                }
            };
            document.addEventListener('keydown', handleEscape);
        });
    }

    /**
     * Mostrar/ocultar indicador de carga
     */
    showLoading(show) {
        const loadingEl = document.getElementById('upload-loading');
        const uploadArea = document.getElementById('upload-area');
        
        if (loadingEl) {
            loadingEl.style.display = show ? 'block' : 'none';
        }
        
        if (uploadArea) {
            uploadArea.style.opacity = show ? '0.6' : '1';
            uploadArea.style.pointerEvents = show ? 'none' : 'auto';
        }
    }

    /**
     * Actualizar mensaje de estado
     */
    updateStatus(message, type = 'info') {
        const statusEl = document.getElementById('upload-status');
        if (!statusEl) return;
        
        statusEl.textContent = message;
        statusEl.className = `upload-status ${type}`;
        statusEl.style.display = 'block';
    }

    /**
     * Mostrar problemas de columnas
     */
    mostrarProblemasColumnas(problemasColumnas) {
        let mensaje = '';
        
        if (problemasColumnas.advertencias && problemasColumnas.advertencias.length > 0) {
            mensaje += '⚠️ ADVERTENCIAS:\n';
            problemasColumnas.advertencias.forEach(adv => {
                mensaje += `• ${adv.mensaje}\n`;
                if (adv.sugerencia) {
                    mensaje += `  Sugerencia: ${adv.sugerencia}\n`;
                }
            });
        }
        
        if (mensaje) {
            console.warn('Problemas de columnas:', mensaje);
            Utils.showNotification(mensaje.split('\n')[0], 'info');
        }
    }

    /**
     * Mostrar problemas de filas de forma detallada
     */
    mostrarProblemasFilas(problemasFilas, estadisticas) {
        // Crear o obtener contenedor de problemas
        let problemasContainer = document.getElementById('problemas-detalle');
        if (!problemasContainer) {
            problemasContainer = document.createElement('div');
            problemasContainer.id = 'problemas-detalle';
            problemasContainer.className = 'mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6';
            
            const statusEl = document.getElementById('upload-status');
            if (statusEl && statusEl.parentNode) {
                statusEl.parentNode.insertBefore(problemasContainer, statusEl.nextSibling);
            }
        }
        
        // Limpiar contenido previo
        problemasContainer.innerHTML = '';
        
        // Título
        const titulo = document.createElement('h3');
        titulo.className = 'text-lg font-bold text-yellow-900 mb-4 flex items-center gap-2';
        titulo.innerHTML = '<span class="material-symbols-outlined">warning</span> Problemas detectados en el archivo';
        problemasContainer.appendChild(titulo);
        
        // Resumen estadístico
        if (estadisticas) {
            const resumen = document.createElement('div');
            resumen.className = 'mb-4 p-3 bg-white rounded border border-yellow-200';
            resumen.innerHTML = `
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <span class="text-gray-600">Total filas:</span>
                        <span class="font-bold ml-2">${estadisticas.total || 0}</span>
                    </div>
                    <div>
                        <span class="text-gray-600">Procesadas:</span>
                        <span class="font-bold text-green-600 ml-2">${estadisticas.procesadas || 0}</span>
                    </div>
                    <div>
                        <span class="text-gray-600">Vacías:</span>
                        <span class="font-bold text-gray-500 ml-2">${estadisticas.vacias || 0}</span>
                    </div>
                    <div>
                        <span class="text-gray-600">Con errores:</span>
                        <span class="font-bold text-red-600 ml-2">${estadisticas.conErrores || 0}</span>
                    </div>
                </div>
            `;
            problemasContainer.appendChild(resumen);
        }
        
        // Mostrar solo las primeras 10 filas con problemas para no saturar
        const filasAMostrar = problemasFilas.slice(0, 10);
        const hayMas = problemasFilas.length > 10;
        
        if (filasAMostrar.length > 0) {
            const listaProblemas = document.createElement('div');
            listaProblemas.className = 'space-y-3 max-h-96 overflow-y-auto';
            
            filasAMostrar.forEach(({ fila, problemas }) => {
                const itemProblema = document.createElement('div');
                itemProblema.className = 'bg-white rounded border border-yellow-300 p-4';
                
                const filaHeader = document.createElement('div');
                filaHeader.className = 'font-bold text-yellow-900 mb-2 flex items-center gap-2';
                filaHeader.innerHTML = `<span class="material-symbols-outlined text-sm">description</span> Fila ${fila}`;
                itemProblema.appendChild(filaHeader);
                
                const listaDetalles = document.createElement('ul');
                listaDetalles.className = 'list-disc list-inside space-y-1 text-sm text-gray-700';
                
                problemas.forEach(problema => {
                    const li = document.createElement('li');
                    li.className = 'mb-1';
                    
                    let icono = '❌';
                    if (problema.tipo === 'requerido') icono = '🔴';
                    else if (problema.tipo === 'advertencia') icono = '⚠️';
                    
                    let contenido = `${icono} <strong>${problema.mensaje}</strong>`;
                    // Si el problema tiene filaExcel, destacar el número de fila
                    if (problema.filaExcel) {
                        contenido = `${icono} <strong style="color: #dc2626;">Fila ${problema.filaExcel} del Excel:</strong> ${problema.mensaje.replace(`Fila ${problema.filaExcel} del Excel: `, '')}`;
                    }
                    if (problema.sugerencia) {
                        contenido += `<br><span class="text-gray-600 text-xs ml-4">💡 ${problema.sugerencia}</span>`;
                    }
                    if (problema.valor !== null && problema.valor !== undefined) {
                        contenido += `<br><span class="text-gray-500 text-xs ml-4">Valor encontrado: "${problema.valor}"</span>`;
                    }
                    
                    li.innerHTML = contenido;
                    listaDetalles.appendChild(li);
                });
                
                itemProblema.appendChild(listaDetalles);
                listaProblemas.appendChild(itemProblema);
            });
            
            problemasContainer.appendChild(listaProblemas);
            
            if (hayMas) {
                const masProblemas = document.createElement('div');
                masProblemas.className = 'mt-4 text-center text-sm text-yellow-800 font-medium';
                masProblemas.textContent = `... y ${problemasFilas.length - 10} filas más con problemas (ver consola del navegador para detalles completos)`;
                problemasContainer.appendChild(masProblemas);
            }
            
            // Instrucciones
            const instrucciones = document.createElement('div');
            instrucciones.className = 'mt-4 p-3 bg-yellow-100 rounded border border-yellow-300 text-sm text-yellow-900';
            instrucciones.innerHTML = `
                <strong>📋 Instrucciones:</strong>
                <ul class="list-disc list-inside mt-2 space-y-1">
                    <li>Revisa los problemas listados arriba</li>
                    <li>Corrige el archivo Excel agregando los datos faltantes</li>
                    <li>Vuelve a cargar el archivo corregido</li>
                    <li>Las filas con problemas no se guardarán hasta que se corrijan</li>
                </ul>
            `;
            problemasContainer.appendChild(instrucciones);
        }
        
        // Mostrar en consola todos los problemas
        console.group('🔍 Problemas detallados en el archivo Excel');
        problemasFilas.forEach(({ fila, problemas }) => {
            console.group(`Fila ${fila}`);
            problemas.forEach(p => {
                console.warn(`${p.tipo.toUpperCase()}: ${p.mensaje}`, p);
            });
            console.groupEnd();
        });
        console.groupEnd();
    }
}

// Inicializar cuando el DOM esté listo
function initializeIndexController() {
    if (typeof XLSX === 'undefined') {
        console.warn('IndexController: Esperando SheetJS (XLSX)...');
        setTimeout(initializeIndexController, 100);
        return;
    }

    if (!window.dataAdapter) {
        console.warn('IndexController: Esperando dataAdapter...');
        setTimeout(initializeIndexController, 100);
        return;
    }

    // Si ya está inicializado, no hacer nada
    if (window.indexController) {
        return;
    }

    console.log('IndexController: Inicializando...');
    const controller = new IndexController();
    controller.init().then(() => {
        console.log('IndexController: Inicializado correctamente');
    }).catch(error => {
        console.error('IndexController: Error en inicialización:', error);
    });
    window.indexController = controller;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeIndexController();
    });
} else {
    initializeIndexController();
}

if (typeof window !== 'undefined') {
    window.IndexController = IndexController;
}
