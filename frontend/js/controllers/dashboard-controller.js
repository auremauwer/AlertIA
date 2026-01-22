/**
 * Controlador del Dashboard
 * Maneja la lógica y renderizado del dashboard
 */
class DashboardController {
    constructor() {
        this.obligacionesService = null;
        this.alertasService = null;
        this.enviosService = null;
        this.auditoriaService = null;
        this.configService = null;
        this.config = null;
        this.currentFilteredData = []; // Guardar datos filtrados actuales
        this.ultimaFechaVerificada = null; // Para detectar cambio de día
        this.intervalVerificacionDia = null; // Referencia al intervalo
    }

    /**
     * Inicializar controlador
     */
    async init() {
        // Esperar a que los servicios estén disponibles
        if (!window.dataAdapter) {
            console.error('dataAdapter no está disponible');
            return;
        }

        this.obligacionesService = new ObligacionesService(window.dataAdapter);
        this.configService = new ConfigService(window.dataAdapter);
        this.allObligaciones = []; // Store all data

        // Cargar configuración para obtener total_filas_excel
        try {
            this.config = await this.configService.getConfiguracion();
        } catch (error) {
            console.warn('No se pudo cargar la configuración:', error);
            this.config = {};
        }

        await this.loadDashboard();
        this.setupFilters();
        this.setupSalirButton();

        // Configurar descarga después de que todo esté cargado
        if (document.readyState === 'complete') {
            this.setupCardDownload();
        } else {
            window.addEventListener('load', () => {
                this.setupCardDownload();
            });
        }

        // Inicializar detección de cambio de día
        this.inicializarDeteccionCambioDia();
    }

    /**
     * Configurar botón de salir
     */
    setupSalirButton() {
        const btnSalir = document.getElementById('btn-salir');
        if (btnSalir) {
            btnSalir.addEventListener('click', async () => {
                await this.salir();
            });
        }
    }

    /**
     * Salir y limpiar datos
     */
    async salir() {
        if (!await Utils.confirm('¿Está seguro de salir? Se limpiarán todos los datos cargados y se cerrará la sesión.')) {
            return;
        }

        try {
            // Limpiar todos los datos
            if (window.dataAdapter && window.dataAdapter.storage) {
                if (window.dataAdapter.storage.clear) {
                    window.dataAdapter.storage.clear();
                } else if (window.dataAdapter.storage.remove) {
                    // Si no tiene clear, limpiar manualmente
                    const keys = ['obligaciones', 'configuracion', 'envios', 'auditoria', 'alertas'];
                    keys.forEach(key => {
                        try {
                            window.dataAdapter.storage.remove(key);
                        } catch (e) {
                            console.warn(`No se pudo limpiar ${key}:`, e);
                        }
                    });
                }
            }
            
            // Limpiar también localStorage directamente por si acaso
            localStorage.clear();
            
            console.log('✅ Datos limpiados. Redirigiendo a página de inicio...');
            
            // Redirigir a index.html
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Error al salir:', error);
            Utils.showNotification('Error al limpiar datos', 'error');
        }
    }

    /**
     * Cargar datos iniciales
     */
    async loadDashboard() {
        try {
            // Cargar todas las obligaciones
            this.allObligaciones = await this.obligacionesService.getAll();

            // Filtrar obligaciones que no tienen ID oficial (no deben mostrarse)
            const obligacionesSinID = this.allObligaciones.filter(obl => (!obl.id_oficial || obl.id_oficial.trim() === '') && (!obl.id || obl.id.trim() === ''));
            if (obligacionesSinID.length > 0) {
                console.warn(`[Dashboard] Se encontraron ${obligacionesSinID.length} obligaciones sin ID oficial. Estas se excluirán del dashboard.`);
                console.warn('[Dashboard] Obligaciones sin ID:', obligacionesSinID.map(obl => ({ id: obl.id, nombre: obl.nombre })));
            }
            this.allObligaciones = this.allObligaciones.filter(obl => (obl.id_oficial && obl.id_oficial.trim() !== '') || (obl.id && obl.id.trim() !== ''));

            // Mostrar alerta de filas excluidas si existen
            this.mostrarAlertaFilasExcluidas();

            // Poblar filtros con valores únicos
            this.populateFilterOptions();

            // Calcular y mostrar KPIs iniciales (sin filtros)
            this.applyFilters();

        } catch (error) {
            console.error('Error al cargar dashboard:', error);
            Utils.showNotification('Error al cargar datos del dashboard', 'error');
        } finally {
            // Exponer función de limpieza globalmente para debug
            window.clearData = () => {
                if (window.dataAdapter && window.dataAdapter.storage) {
                    window.dataAdapter.storage.clear();
                    console.log('🧹 LocalStorage limpiado. Recargue la página.');
                    alert('Datos limpiados. Recargue la página.');
                }
            };
        }
    }

    /**
     * Mostrar alerta de filas excluidas y duplicados
     */
    mostrarAlertaFilasExcluidas() {
        const alertContainer = document.getElementById('alert-filas-excluidas');
        const alertContent = document.getElementById('alert-filas-excluidas-content');
        const btnCerrar = document.getElementById('btn-cerrar-alerta-excluidas');

        if (!alertContainer || !alertContent) return;

        let hayAlertas = false;
        let contenido = '';

        // 1. Obtener duplicados omitidos de la configuración
        if (this.config && this.config.duplicados_omitidos && this.config.duplicados_omitidos.length > 0) {
            const duplicados = this.config.duplicados_omitidos;
            hayAlertas = true;

            const idsDuplicados = duplicados.map(d => d.id).filter(id => id);
            const idsTexto = idsDuplicados.length <= 5
                ? idsDuplicados.join(', ')
                : `${idsDuplicados.slice(0, 5).join(', ')} y ${idsDuplicados.length - 5} más`;

            contenido += `<div class="mb-3 pb-2 border-b border-yellow-200 last:border-0 last:mb-0 last:pb-0">
                <div class="flex items-start gap-2">
                    <span class="material-symbols-outlined text-yellow-600 text-lg mt-0.5">warning</span>
                    <div>
                        <span class="font-bold text-yellow-800">Registros Duplicados Omitidos (${duplicados.length})</span>
                        <p class="text-xs text-yellow-700 mt-1">
                            El sistema detectó IDs que ya existen en la base de datos o se repiten en el archivo. 
                            Para evitar errores, se omitieron los siguientes IDs: <span class="font-medium">${idsTexto}</span>
                        </p>
                    </div>
                </div>
            </div>`;
        }

        // 2. Obtener filas excluidas de la configuración (por falta de ID)
        if (this.config && this.config.filas_excluidas && this.config.filas_excluidas.length > 0) {
            const filasExcluidas = this.config.filas_excluidas;
            hayAlertas = true;

            // Agrupar por razón
            const agrupadas = {};
            filasExcluidas.forEach(({ fila, razon }) => {
                if (!agrupadas[razon]) {
                    agrupadas[razon] = [];
                }
                agrupadas[razon].push(fila);
            });

            Object.entries(agrupadas).forEach(([razon, filas]) => {
                filas.sort((a, b) => a - b); // Ordenar filas numéricamente
                const filasTexto = filas.length <= 10
                    ? filas.join(', ')
                    : `${filas.slice(0, 10).join(', ')} ...`;

                contenido += `<div class="mb-2 last:mb-0 pt-2 first:pt-0">
                    <div class="flex items-start gap-2">
                        <span class="material-symbols-outlined text-yellow-600 text-lg mt-0.5">error</span>
                        <div>
                            <span class="font-bold text-yellow-800">Filas Excluidas (Sin ID)</span>
                            <div class="text-xs text-yellow-700 mt-1">
                                <span class="font-semibold">${razon}</span>: Filas ${filasTexto}
                            </div>
                        </div>
                    </div>
                </div>`;
            });
        }

        if (hayAlertas) {
            alertContent.innerHTML = contenido;
            alertContainer.classList.remove('hidden');

            // Agregar listener para cerrar alerta
            if (btnCerrar) {
                // Remover listeners anteriores para evitar duplicados
                const newBtn = btnCerrar.cloneNode(true);
                btnCerrar.parentNode.replaceChild(newBtn, btnCerrar);

                newBtn.addEventListener('click', () => {
                    alertContainer.classList.add('hidden');
                });
            }
        } else {
            alertContainer.classList.add('hidden');
        }
    }

    /**
     * Configurar Listeners de Filtros
     */
    setupFilters() {
        const filterArea = document.getElementById('filter-area');
        const filterEstatus = document.getElementById('filter-estatus');
        const filterSubEstatus = document.getElementById('filter-sub-estatus');
        const filterId = document.getElementById('filter-id');

        const handleFilterChange = () => {
            this.applyFilters();
        };

        if (filterArea) filterArea.addEventListener('change', handleFilterChange);
        if (filterEstatus) filterEstatus.addEventListener('change', handleFilterChange);
        if (filterSubEstatus) filterSubEstatus.addEventListener('change', handleFilterChange);
        if (filterId) filterId.addEventListener('input', handleFilterChange);
    }

    /**
     * Poblar opciones de los selectores
     */
    populateFilterOptions() {
        const getUniqueValues = (field) => {
            // Filtrar valores nulos, vacíos y undefined, y normalizar
            const values = this.allObligaciones
                .map(o => o[field])
                .filter(v => v !== null && v !== undefined && String(v).trim() !== '')
                .map(v => String(v).trim().toLowerCase()); // Normalizar a lowercase
            return [...new Set(values)].sort();
        };

        const areas = getUniqueValues('area');
        const estatus = getUniqueValues('estatus');
        const subEstatus = getUniqueValues('sub_estatus');

        const populateSelect = (id, values) => {
            const select = document.getElementById(id);
            if (!select) return;
            // Mantener la primera opción (placeholder)
            const firstOption = select.options[0];
            select.innerHTML = '';
            select.appendChild(firstOption);

            values.forEach(val => {
                const option = document.createElement('option');
                option.value = val;
                // Capitalizar primera letra de cada palabra
                const capitalized = val.split(' ').map(word =>
                    word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ');
                option.textContent = capitalized;
                select.appendChild(option);
            });
        };

        populateSelect('filter-area', areas);
        populateSelect('filter-estatus', estatus);
        populateSelect('filter-sub-estatus', subEstatus);

        console.log('[Dashboard] Filtros cargados:', {
            areas: areas.length,
            estatus: estatus,
            subEstatus: subEstatus.length
        });
    }

    /**
     * Aplicar filtros y recalcular KPIs
     */
    applyFilters() {
        const filterArea = document.getElementById('filter-area')?.value.toLowerCase() || '';
        const filterEstatus = document.getElementById('filter-estatus')?.value.toLowerCase() || '';
        const filterSubEstatus = document.getElementById('filter-sub-estatus')?.value.toLowerCase() || '';
        const filterId = document.getElementById('filter-id')?.value.toLowerCase().trim() || '';

        // Guardar filtros en localStorage para persistencia entre páginas
        localStorage.setItem('alertia_filters', JSON.stringify({
            area: filterArea,
            estatus: filterEstatus,
            sub_estatus: filterSubEstatus,
            id: filterId
        }));

        let filtered = this.allObligaciones.filter(obl => {
            const matchArea = !filterArea || (obl.area && obl.area.toLowerCase() === filterArea);
            const matchEstatus = !filterEstatus || (obl.estatus && obl.estatus.toLowerCase() === filterEstatus);
            const matchSubEstatus = !filterSubEstatus || (obl.sub_estatus && obl.sub_estatus.toLowerCase() === filterSubEstatus);
            const matchId = !filterId || (obl.id_oficial && String(obl.id_oficial).toLowerCase().includes(filterId));

            return matchArea && matchEstatus && matchSubEstatus && matchId;
        });

        // Si hay total_filas_excel configurado, limitar a las obligaciones más recientes del Excel
        // Priorizar las que tienen dias_para_vencer_excel (vienen del Excel)
        if (this.config?.total_filas_excel) {
            // Separar las que tienen dias_para_vencer_excel (del Excel) de las que no
            const delExcel = filtered.filter(obl => obl.dias_para_vencer_excel !== null && obl.dias_para_vencer_excel !== undefined);
            const otras = filtered.filter(obl => obl.dias_para_vencer_excel === null || obl.dias_para_vencer_excel === undefined);

            // Ordenar por fecha de creación (más recientes primero) y tomar las primeras N
            const todasOrdenadas = [...delExcel, ...otras].sort((a, b) => {
                const fechaA = new Date(a.created_at || 0);
                const fechaB = new Date(b.created_at || 0);
                return fechaB - fechaA; // Más recientes primero
            });

            filtered = todasOrdenadas.slice(0, this.config.total_filas_excel);
        }

        this.currentFilteredData = filtered; // Guardar datos filtrados
        this.calculateKPIs(filtered);
    }

    /**
     * Calcular y Renderizar KPIs
     * @param {Array} datos - Datos filtrados
     */
    calculateKPIs(datos) {
        // 2. IDs por vencimiento (usando dias_restantes que viene de "Días para vencer" del Excel o se calcula)
        // Categorías EXCLUYENTES para que la suma dé el total:
        // - Vencidos (rojo oscuro): dias_restantes < 0
        // - Hasta 30 días (rojo): 0 <= dias_restantes <= 30
        // - Naranja (31-60 días): 30 < dias_restantes <= 60
        // - Amarillo (61-90 días): 60 < dias_restantes <= 90
        // - Verde (>90 días): dias_restantes > 90
        // - Sin fecha: dias_restantes === null

        const vencidos = datos.filter(d => d.dias_restantes !== null && d.dias_restantes < 0).length;
        const less30 = datos.filter(d => d.dias_restantes !== null && d.dias_restantes >= 0 && d.dias_restantes <= 30).length;
        const between30_60 = datos.filter(d => d.dias_restantes !== null && d.dias_restantes > 30 && d.dias_restantes <= 60).length;
        const between60_90 = datos.filter(d => d.dias_restantes !== null && d.dias_restantes > 60 && d.dias_restantes <= 90).length;
        const more90 = datos.filter(d => d.dias_restantes !== null && d.dias_restantes > 90).length;
        const sinFecha = datos.filter(d => d.dias_restantes === null).length;

        // 1. Total IDs - Calcular como la suma de todas las categorías para que cambie con los filtros
        const totalIds = vencidos + less30 + between30_60 + between60_90 + more90 + sinFecha;
        this.updateKPI('total-ids', totalIds);

        this.updateKPI('ids-vencidos', vencidos);
        this.updateKPI('ids-less-30', less30);
        this.updateKPI('ids-less-60', between30_60);
        this.updateKPI('ids-less-90', between60_90);
        this.updateKPI('ids-more-90', more90);
        this.updateKPI('ids-sin-fecha', sinFecha);

        // Verificar que la suma sea correcta (solo para debugging)
        if (totalIds !== datos.length) {
            console.warn('[Dashboard] La suma de categorías no coincide con el total de datos:', {
                suma: totalIds,
                totalDatos: datos.length,
                less30,
                between30_60,
                between60_90,
                more90,
                sinFecha
            });
        }

        // 3. IDs por Estatus
        // Normalizamos comparación a lowercase y manejamos variaciones
        const countStatus = (status) => {
            const statusBuscado = String(status).toLowerCase().trim();

            return datos.filter(d => {
                if (!d.estatus) return false;
                const estatusNormalizado = String(d.estatus).toLowerCase().trim();
                // Comparación exacta (case-insensitive)
                return estatusNormalizado === statusBuscado;
            }).length;
        };

        const recordatorio = countStatus('recordatorio');
        const solicitud = countStatus('solicitud');
        const cerrado = countStatus('cerrado');
        const apagado = countStatus('apagado');
        // Contar obligaciones sin estatus o con estatus null/undefined
        const sinEstatus = datos.filter(d => !d.estatus || String(d.estatus).trim() === '').length;

        // Log para debugging - ver todos los estatus únicos y su conteo
        const estatusConConteo = {};
        datos.forEach(d => {
            const estatus = d.estatus ? String(d.estatus).toLowerCase().trim() : 'sin estatus';
            estatusConConteo[estatus] = (estatusConConteo[estatus] || 0) + 1;
        });

        const sumaEstatus = recordatorio + solicitud + cerrado + apagado;

        // Log detallado
        console.log('[Dashboard] Conteo de estatus - DETALLE COMPLETO:', {
            totalDatos: datos.length,
            conteoPorEstatus: {
                recordatorio,
                solicitud,
                cerrado,
                apagado
            },
            sumaEstatus,
            diferencia: datos.length - sumaEstatus,
            todosLosEstatusEncontrados: estatusConConteo,
            listaCompletaEstatus: Object.entries(estatusConConteo).map(([est, count]) => `${est}: ${count}`).join(', ')
        });

        // Si la suma no coincide, mostrar detalle completo
        if (sumaEstatus !== datos.length) {
            console.warn('[Dashboard] ⚠️ La suma de estatus no coincide con el total:', {
                total: datos.length,
                suma: sumaEstatus,
                diferencia: datos.length - sumaEstatus,
                estatusEncontrados: estatusConConteo,
                detalle: {
                    recordatorio,
                    solicitud,
                    cerrado,
                    apagado
                }
            });

            // Mostrar qué estatus no están siendo contados
            const estatusNoContados = Object.keys(estatusConConteo).filter(est => {
                const estLower = est.toLowerCase().trim();
                return estLower !== 'recordatorio' &&
                    estLower !== 'solicitud' &&
                    estLower !== 'cerrado' &&
                    estLower !== 'apagado';
            });

            if (estatusNoContados.length > 0) {
                console.warn('[Dashboard] Estatus no contemplados en las tarjetas:', estatusNoContados);
            }
        }

        this.updateKPI('status-recordatorio', recordatorio);
        this.updateKPI('status-solicitud', solicitud);
        this.updateKPI('status-cerrado', cerrado);
        this.updateKPI('status-apagado', apagado);
        this.updateKPI('status-sin-estatus', sinEstatus);

        // Verificar que la suma de estatus coincida con el total
        const sumaEstatusFinal = recordatorio + solicitud + cerrado + apagado + sinEstatus;
        if (sumaEstatusFinal !== datos.length) {
            console.warn('[Dashboard] ⚠️ La suma de estatus aún no coincide:', {
                total: datos.length,
                suma: sumaEstatusFinal,
                diferencia: datos.length - sumaEstatusFinal
            });
        } else {
            console.log('[Dashboard] ✅ Suma de estatus correcta:', sumaEstatusFinal, '=', datos.length);
        }

    }

    /**
     * Obtener obligaciones filtradas por categoría
     */
    getObligacionesPorCategoria(datos, categoria) {
        switch (categoria) {
            case 'total':
                return datos;
            case 'vencidos':
                return datos.filter(d => d.dias_restantes !== null && d.dias_restantes < 0);
            case 'hasta-30':
                return datos.filter(d => d.dias_restantes !== null && d.dias_restantes >= 0 && d.dias_restantes <= 30);
            case '31-60':
                return datos.filter(d => d.dias_restantes !== null && d.dias_restantes > 30 && d.dias_restantes <= 60);
            case '61-90':
                return datos.filter(d => d.dias_restantes !== null && d.dias_restantes > 60 && d.dias_restantes <= 90);
            case 'mas-90':
                return datos.filter(d => d.dias_restantes !== null && d.dias_restantes > 90);
            case 'sin-fecha':
                return datos.filter(d => d.dias_restantes === null);
            case 'recordatorio':
                return datos.filter(d => d.estatus && String(d.estatus).toLowerCase().trim() === 'recordatorio');
            case 'solicitud':
                return datos.filter(d => d.estatus && String(d.estatus).toLowerCase().trim() === 'solicitud');
            case 'cerrado':
                return datos.filter(d => d.estatus && String(d.estatus).toLowerCase().trim() === 'cerrado');
            case 'apagado':
                return datos.filter(d => d.estatus && String(d.estatus).toLowerCase().trim() === 'apagado');
            case 'sin-estatus':
                return datos.filter(d => !d.estatus || String(d.estatus).trim() === '');
            default:
                return [];
        }
    }

    /**
     * Descargar CSV con IDs de una categoría
     */
    downloadIDsAsCSV(category, obligaciones) {


        if (!obligaciones || obligaciones.length === 0) {
            Utils.showNotification('No hay IDs para descargar en esta categoría', 'info');
            return;
        }

        // Filtrar obligaciones que no tienen ID oficial (no deben aparecer)
        const obligacionesConID = obligaciones.filter(obl => {
            if (!obl.id_oficial || obl.id_oficial.trim() === '') {
                console.warn('[Dashboard] Obligación sin ID oficial encontrada:', obl);
                return false;
            }
            return true;
        });

        if (obligacionesConID.length === 0) {
            Utils.showNotification('No hay IDs válidos para descargar en esta categoría. Todas las obligaciones carecen de ID oficial.', 'info');
            return;
        }

        // Ordenar obligaciones por ID oficial (solo usar id_oficial, nunca id generado)
        const obligacionesOrdenadas = [...obligacionesConID].sort((a, b) => {
            const idA = (a.id_oficial || '').toLowerCase();
            const idB = (b.id_oficial || '').toLowerCase();
            return idA.localeCompare(idB);
        });

        // Extraer solo los IDs oficiales (nunca usar IDs generados)
        const ids = obligacionesOrdenadas.map(obl => {
            if (!obl.id_oficial || obl.id_oficial.trim() === '') {
                console.error('[Dashboard] ERROR: Obligación sin ID oficial en descarga:', obl);
                return null;
            }
            return obl.id_oficial;
        }).filter(id => id !== null); // Filtrar cualquier null que pueda quedar

        // Crear contenido CSV (solo una columna: ID)
        const csvContent = 'ID\n' + ids.join('\n');

        // Crear blob y descargar
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM para Excel
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        // Nombre del archivo basado en la categoría
        const categoryNames = {
            'total': 'Total_IDs',
            'vencidos': 'Vencidos',
            'hasta-30': 'Hasta_30_dias',
            '31-60': '31_a_60_dias',
            '61-90': '61_a_90_dias',
            'mas-90': 'Mayor_a_90_dias',
            'sin-fecha': 'Sin_fecha_vencimiento',
            'recordatorio': 'Estatus_Recordatorio',
            'solicitud': 'Estatus_Solicitud',
            'cerrado': 'Estatus_Cerrado',
            'apagado': 'Estatus_Apagado',
            'sin-estatus': 'Sin_Estatus'
        };

        const fileName = `${categoryNames[category] || category}_${new Date().toISOString().split('T')[0]}.csv`;

        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Limpiar el URL del blob después de un breve delay
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 100);



        Utils.showNotification(`${ids.length} IDs descargados correctamente`, 'success');


    }

    /**
     * Configurar descarga de CSV en tarjetas
     */
    setupCardDownload() {
        try {
            // Limpiar listeners anteriores si existen
            if (this._cardDownloadSetup) {
                return; // Ya está configurado
            }
            this._cardDownloadSetup = true;

            // Esperar a que el DOM esté completamente renderizado
            const setupListeners = () => {
                try {
                    const cards = document.querySelectorAll('.kpi-card[data-kpi-category]');

                    if (cards.length === 0) {
                        console.warn('[Dashboard] No se encontraron tarjetas KPI para configurar descarga');
                        return;
                    }

                    cards.forEach(card => {
                        try {


                            // Verificar que la tarjeta existe y tiene las propiedades necesarias
                            if (!card) return;
                            if (!card.dataset) return;

                            // Verificar que la tarjeta no tenga ya listeners (evitar duplicados)
                            if (card.dataset.downloadSetup === 'true') {
                                return;
                            }
                            card.dataset.downloadSetup = 'true';

                            // Click en la tarjeta
                            card.addEventListener('click', (e) => {
                                try {
                                    // Si el click fue en el icono de descarga, salir
                                    if (e.target.closest('.download-icon')) return;

                                    const category = card.getAttribute('data-kpi-category');
                                    if (!category) return;

                                    // Lista de categorías que soportan modal de subestatus
                                    const modalCategories = ['recordatorio', 'solicitud', 'cerrado', 'apagado', 'sin-estatus'];

                                    if (modalCategories.includes(category)) {
                                        // Usar currentFilteredData si existe, sino usar allObligaciones
                                        const datos = this.currentFilteredData && this.currentFilteredData.length > 0
                                            ? this.currentFilteredData
                                            : (this.allObligaciones || []);

                                        const obligaciones = this.getObligacionesPorCategoria(datos, category);

                                        if (obligaciones.length > 0) {
                                            this.showSubstatusModal(category, obligaciones);
                                        }
                                    }

                                } catch (error) {
                                    console.error('[Dashboard] Error en click de tarjeta:', error);
                                }
                            });

                            // Click específico en el icono de descarga
                            const downloadIcon = card.querySelector('.download-icon');


                            if (downloadIcon) {
                                downloadIcon.addEventListener('click', (e) => {
                                    try {


                                        e.stopPropagation(); // Evitar doble descarga
                                        const category = card.getAttribute('data-kpi-category');
                                        if (!category) return;

                                        // Usar currentFilteredData si existe, sino usar allObligaciones
                                        const datos = this.currentFilteredData && this.currentFilteredData.length > 0
                                            ? this.currentFilteredData
                                            : (this.allObligaciones || []);

                                        const obligaciones = this.getObligacionesPorCategoria(datos, category);


                                        this.downloadIDsAsCSV(category, obligaciones);
                                    } catch (error) {

                                        console.error('[Dashboard] Error en click de icono descarga:', error);
                                    }
                                });
                            }
                        } catch (error) {
                            console.error('[Dashboard] Error configurando tarjeta:', error, card);
                        }
                    });
                } catch (error) {
                    console.error('[Dashboard] Error en setupListeners:', error);
                }
            };

            // Intentar configurar inmediatamente
            if (document.readyState === 'complete' || document.readyState === 'interactive') {
                setTimeout(setupListeners, 200);
            } else {
                window.addEventListener('load', () => {
                    setTimeout(setupListeners, 200);
                });
            }
        } catch (error) {
            console.error('[Dashboard] Error en setupCardDownload:', error);
        }
    }

    /**
     * Mostrar modal con detalle de subestatus
     */
    showSubstatusModal(category, obligaciones) {
        const modal = document.getElementById('modal-subestatus');
        const titleEl = document.getElementById('modal-subestatus-title');
        const subtitleEl = document.getElementById('modal-subestatus-subtitle');
        const listEl = document.getElementById('modal-subestatus-list');

        if (!modal || !listEl) return;

        // Títulos legibles
        const titles = {
            'recordatorio': 'Estatus: Recordatorio',
            'solicitud': 'Estatus: Solicitud',
            'cerrado': 'Estatus: Cerrado',
            'apagado': 'Estatus: Apagado',
            'sin-estatus': 'Sin Estatus Asignado'
        };

        const title = titles[category] || 'Detalle de Estatus';
        if (titleEl) titleEl.textContent = title;
        if (subtitleEl) subtitleEl.textContent = `Total: ${obligaciones.length} obligaciones`;

        // Agrupar por subestatus
        const counts = {};
        obligaciones.forEach(obl => {
            const sub = obl.sub_estatus ? String(obl.sub_estatus).trim() : 'Sin Sub-estatus';
            counts[sub] = (counts[sub] || 0) + 1;
        });

        // Generar HTML
        listEl.innerHTML = '';
        Object.entries(counts)
            .sort(([, a], [, b]) => b - a) // Ordenar por cantidad descendente
            .forEach(([subestatus, count]) => {
                const percentage = Math.round((count / obligaciones.length) * 100);

                const li = document.createElement('li');
                li.className = 'flex items-center justify-between py-3';
                li.innerHTML = `
                        <div class="flex items-center gap-3">
                        <div class="bg-gray-100 p-2 rounded-full">
                            <span class="material-symbols-outlined text-gray-500 text-sm">subdirectory_arrow_right</span>
                        </div>
                        <div>
                            <p class="text-sm font-medium text-gray-900 capitalize">${subestatus.toLowerCase()}</p>
                            <p class="text-xs text-gray-500">${percentage}% del total</p>
                        </div>
                        </div>
                    <span class="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                        ${count}
                    </span>
                `;
                listEl.appendChild(li);
            });

        // Mostrar modal
        modal.classList.remove('hidden');
    }

    /**
     * Helper para actualizar texto de KPI
     */
    updateKPI(id, value) {
        const element = document.querySelector(`[data-kpi="${id}"]`);
        if (element) {
            // Animar el cambio de número si se desea, por ahora directo
            element.textContent = value;
        }
    }

    /**
     * Inicializar detección de cambio de día para actualizar días restantes automáticamente
     */
    inicializarDeteccionCambioDia() {
        // Guardar fecha actual (solo día, sin hora)
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        this.ultimaFechaVerificada = hoy.getTime();

        // Verificar cada minuto si cambió el día
        this.intervalVerificacionDia = setInterval(() => {
            const ahora = new Date();
            ahora.setHours(0, 0, 0, 0);
            const ahoraTimestamp = ahora.getTime();

            // Si cambió el día, recargar dashboard
            if (ahoraTimestamp !== this.ultimaFechaVerificada) {
                console.log('📅 Cambio de día detectado. Actualizando dashboard...');
                this.ultimaFechaVerificada = ahoraTimestamp;
                
                // Recargar dashboard para actualizar días restantes y KPIs
                this.loadDashboard().catch(error => {
                    console.error('Error al recargar dashboard después del cambio de día:', error);
                });
            }
        }, 60000); // Verificar cada minuto (60000 ms)

        // Limpiar intervalo cuando la página se descarga
        window.addEventListener('beforeunload', () => {
            if (this.intervalVerificacionDia) {
                clearInterval(this.intervalVerificacionDia);
            }
        });
    }
}

// Manejador global de errores para capturar errores de classList
window.addEventListener('error', (event) => {
    if (event.message && event.message.includes('classList')) {

    }
}, true);

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.dataAdapter) {
            const controller = new DashboardController();
            controller.init();
            window.dashboardController = controller;
        } else {
            // Esperar a que dataAdapter esté disponible
            setTimeout(() => {
                if (window.dataAdapter) {
                    const controller = new DashboardController();
                    controller.init();
                    window.dashboardController = controller;
                }
            }, 500);
        }
    });
} else {
    if (window.dataAdapter) {
        const controller = new DashboardController();
        controller.init();
        window.dashboardController = controller;
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.DashboardController = DashboardController;
}
