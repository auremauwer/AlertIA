/**
 * Controlador de Obligaciones
 * Maneja la lógica y renderizado de la pantalla de obligaciones
 */
class ObligacionesController {
    constructor() {
        this.obligacionesService = null;
        this.fileStorageService = null;
        this.excelService = null;
        this.obligacionEditando = null;
        this.currentFilters = {
            area: null,
            periodicidad: null,
            estado: null,
            criticidad: null,
            search: ''
        };
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.ultimaFechaVerificada = null; // Para detectar cambio de día
        this.intervalVerificacionDia = null; // Referencia al intervalo
    }

    /**
     * Inicializar controlador
     */
    async init() {
        if (!window.dataAdapter) {
            console.error('dataAdapter no está disponible');
            return;
        }

        this.obligacionesService = new ObligacionesService(window.dataAdapter);
        
        // Inicializar servicio de Excel (esperar a que esté disponible)
        if (typeof XLSX !== 'undefined' && window.ExcelService) {
            this.excelService = new ExcelService();
            console.log('✅ ExcelService inicializado');
        } else {
            console.warn('⚠️ ExcelService no disponible. XLSX:', typeof XLSX, 'ExcelService:', typeof window.ExcelService);
            // Intentar esperar un poco y volver a intentar
            await new Promise(resolve => setTimeout(resolve, 100));
            if (typeof XLSX !== 'undefined' && window.ExcelService) {
                this.excelService = new ExcelService();
                console.log('✅ ExcelService inicializado (segundo intento)');
            }
        }
        
        // Inicializar servicio de almacenamiento de archivos
        if (window.FileStorageService) {
            this.fileStorageService = new FileStorageService();
            await this.fileStorageService.init();
        }

        this.setupEventListeners();
        await this.loadObligaciones();
        await this.loadFilters();
        
        // Inicializar detección de cambio de día
        this.inicializarDeteccionCambioDia();
    }

    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        const filters = ['area', 'estatus', 'sub-estatus'];
        filters.forEach(filter => {
            const el = document.getElementById(`filter-${filter}`);
            if (el) {
                el.addEventListener('change', (e) => {
                    const key = filter.replace('-', '_'); // estatus, sub_estatus
                    this.currentFilters[key] = e.target.value || null;
                    this.loadObligaciones();
                });
            }
        });

        const filterId = document.getElementById('filter-id');
        if (filterId) {
            filterId.addEventListener('input', Utils.debounce((e) => {
                this.currentFilters.id = e.target.value || null;
                this.loadObligaciones();
            }, 300));
        }

        // Búsqueda General (si existe input search global)
        const searchInput = document.querySelector('input[placeholder*="Buscar por ID, regulador"]');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.currentFilters.search = e.target.value;
                this.loadObligaciones();
            }, 300));
        }

        // Botón Exportar Excel
        const exportarExcelBtn = document.getElementById('exportar-excel-btn');
        if (exportarExcelBtn) {
            exportarExcelBtn.addEventListener('click', () => {
                this.exportarExcel();
            });
        }

        // Botón Exportar Calendario
        const exportarBtn = document.getElementById('exportar-calendario-btn');
        if (exportarBtn) {
            exportarBtn.addEventListener('click', () => {
                this.exportarCalendarioNotificaciones();
            });
        }

        // Botón Agregar Obligación
        const agregarBtn = document.getElementById('agregar-obligacion-btn');
        if (agregarBtn) {
            agregarBtn.addEventListener('click', () => {
                this.mostrarFormularioObligacion();
            });
        }

        // Event listeners del modal
        const cerrarModalBtn = document.getElementById('btn-cerrar-modal-obligacion');
        if (cerrarModalBtn) {
            cerrarModalBtn.addEventListener('click', () => {
                this.cerrarModalObligacion();
            });
        }

        const cancelarBtn = document.getElementById('btn-cancelar-obligacion');
        if (cancelarBtn) {
            cancelarBtn.addEventListener('click', () => {
                this.cerrarModalObligacion();
            });
        }

        const guardarBtn = document.getElementById('btn-guardar-obligacion');
        if (guardarBtn) {
            guardarBtn.addEventListener('click', () => {
                this.guardarObligacion();
            });
        }

        // Cerrar modal al hacer clic fuera
        const modal = document.getElementById('modal-obligacion');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.cerrarModalObligacion();
                }
            });
        }

        // Botones de acción
        this.attachActionListeners();
    }

    /**
     * Manejar selección de filtro (Legacy support or removed if not used)
     */
    // handleFilterSelection eliminado ya que se usan selects nativos

    // updateDropdownStyles eliminado

    // highlightItem eliminado

    /**
     * Cargar obligaciones
     */
    async loadObligaciones() {
        try {
            const obligaciones = await this.obligacionesService.filter(this.currentFilters);
            this.renderObligaciones(obligaciones);
            this.updatePagination(obligaciones.length);
        } catch (error) {
            console.error('Error al cargar obligaciones:', error);
            Utils.showNotification('Error al cargar obligaciones', 'error');
        }
    }

    /**
     * Renderizar obligaciones en tabla
     */
    renderObligaciones(obligaciones) {
        const tbody = document.querySelector('table tbody');
        if (!tbody) return;

        // Paginación
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const paginated = obligaciones.slice(start, end);

        tbody.innerHTML = '';

        paginated.forEach(obl => {
            const row = document.createElement('tr');
            row.className = 'group hover:bg-gray-50 cursor-pointer transition-colors';

            const diasRestantes = obl.dias_restantes;
            const diasClass = diasRestantes < 0 ? 'text-red-600' :
                diasRestantes <= 5 ? 'text-red-600' :
                    diasRestantes <= 10 ? 'text-amber-600' :
                        'text-gray-400';

            const estadoClass = {
                'activa': 'status-pendiente',
                'pausada': 'status-pausada',
                'atendida': 'status-atendida',
                'en_ventana': 'status-ventana',
                'recordatorio': 'status-recordatorio',
                'solicitud': 'status-solicitud',
                'cerrado': 'status-cerrado',
                'apagado': 'status-apagado'
            }[obl.estatus] || 'status-pendiente';

            row.innerHTML = `
                <td class="p-4 text-xs font-bold text-primary group-hover:underline">${obl.id || obl.id_oficial || '-'}</td>
                <td class="p-4 text-xs font-semibold">${obl.regulador || '-'}</td>
                <td class="p-4 text-xs font-medium">${obl.area || '-'}</td>
                <td class="p-4 text-xs font-mono">${this.formatFechaLimite(obl)}</td>
                <td class="p-4 text-xs font-bold ${diasClass}">
                    ${diasRestantes !== null ? diasRestantes : 'N/A'}
                    ${diasRestantes === 0 ? '<span class="absolute -top-1 left-3 bg-primary text-white text-[8px] font-bold px-1 py-0.5 rounded leading-none whitespace-nowrap shadow-sm">VENCE HOY</span>' : ''}
                </td>
                <td class="p-4">
                    <span class="status-pill ${estadoClass}">${this.getEstadoLabel(obl.estatus)}</span>
                </td>
                <td class="p-4 text-xs text-text-muted italic">${obl.sub_estatus || '-'}</td>
                <td class="p-4 text-right">
                    <div class="flex items-center justify-end gap-1">
                        <button class="p-1.5 hover:bg-gray-100 rounded-full text-text-muted hover:text-primary transition-colors" 
                                data-action="ver-detalle" data-id="${obl.id}" title="Ver detalles">
                            <span class="material-symbols-outlined">visibility</span>
                        </button>
                        <button class="p-1.5 hover:bg-blue-50 rounded-full text-text-muted hover:text-blue-600 transition-colors" 
                                data-action="modificar" data-id="${obl.id}" title="Modificar obligación">
                            <span class="material-symbols-outlined">edit</span>
                        </button>
                        <button class="p-1.5 hover:bg-red-50 rounded-full text-text-muted hover:text-red-600 transition-colors" 
                                data-action="eliminar" data-id="${obl.id}" title="Eliminar obligación">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Re-attach event listeners
        this.attachActionListeners();
    }

    /**
     * Adjuntar listeners de acciones
     */
    attachActionListeners() {
        document.querySelectorAll('[data-action="ver-detalle"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.verDetalle(id);
            });
        });

        document.querySelectorAll('[data-action="pausar"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.pausar(id);
            });
        });

        document.querySelectorAll('[data-action="reanudar"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.reanudar(id);
            });
        });

        document.querySelectorAll('[data-action="marcar-atendida"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.marcarAtendida(id);
            });
        });

        document.querySelectorAll('[data-action="modificar"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.currentTarget.dataset.id;
                this.mostrarFormularioObligacion(id);
            });
        });

        document.querySelectorAll('[data-action="eliminar"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.currentTarget.dataset.id;
                this.eliminarObligacion(id);
            });
        });
    }

    /**
     * Obtener label de estado
     */
    /**
     * Formatear fecha límite para mostrar
     */
    formatFechaLimite(obligacion) {
        // Si hay fecha válida, formatearla. Si no, mostrar el valor original del Excel
        if (obligacion.fecha_limite) {
            return Utils.formatDate(obligacion.fecha_limite, 'DD/MM/YYYY');
        } else if (obligacion.fecha_limite_original) {
            // Mostrar el valor original del Excel si no hay fecha válida
            return obligacion.fecha_limite_original;
        } else {
            return 'No definida';
        }
    }

    getEstadoLabel(estado) {
        const labels = {
            'activa': 'Pendiente',
            'pausada': 'Pausada',
            'atendida': 'Atendida',
            'en_ventana': 'En ventana'
        };
        return labels[estado] || estado;
    }

    /**
     * Obtener última acción
     */
    getUltimaAccion(obligacion) {
        if (obligacion.updated_at) {
            return `Actualizado ${Utils.formatDate(obligacion.updated_at, 'DD/MM/YYYY')}`;
        }
        return 'Sin acciones recientes';
    }

    /**
     * Cargar opciones de filtros y restaurar estado
     */
    async loadFilters() {
        try {
            const obligaciones = await this.obligacionesService.getAll();

            // Colecciones para valores únicos (normalizados a string)
            const areas = new Set();
            const estatuses = new Set();
            const subEstatus = new Set();

            obligaciones.forEach(obl => {
                if (obl.area) areas.add(String(obl.area).trim());
                if (obl.estatus) estatuses.add(String(obl.estatus).trim());
                if (obl.sub_estatus) subEstatus.add(String(obl.sub_estatus).trim());
            });

            // Helper para poblar select
            const populateSelect = (id, values) => {
                const select = document.getElementById(id);
                if (!select) return;

                // Mantener primera opción (placeholder)
                const firstOption = select.options[0];
                select.innerHTML = '';
                select.appendChild(firstOption);

                Array.from(values).sort().forEach(val => {
                    const option = document.createElement('option');
                    // Usar valor original para value y label
                    option.value = val;
                    option.textContent = val;
                    select.appendChild(option);
                });
            };

            populateSelect('filter-area', areas);
            populateSelect('filter-estatus', estatuses);
            populateSelect('filter-sub-estatus', subEstatus);

            // Obtener referencia al select de área
            const filterAreaEl = document.getElementById('filter-area');

            // Restaurar filtros desde localStorage (herencia del Dashboard)
            const savedFilters = localStorage.getItem('alertia_filters');
            if (savedFilters) {
                try {
                    const parsed = JSON.parse(savedFilters);

                    if (parsed.area) {
                        this.currentFilters.area = parsed.area;
                        if (filterAreaEl) filterAreaEl.value = parsed.area;
                    } else {
                        // Si no hay área guardada, establecer "Todas las áreas" por defecto
                        if (filterAreaEl) {
                            filterAreaEl.value = '';
                            this.currentFilters.area = null;
                        }
                    }
                    if (parsed.estatus) {
                        this.currentFilters.estatus = parsed.estatus;
                        const el = document.getElementById('filter-estatus');
                        if (el) el.value = parsed.estatus;
                    }
                    if (parsed.sub_estatus) {
                        this.currentFilters.sub_estatus = parsed.sub_estatus;
                        const el = document.getElementById('filter-sub-estatus');
                        if (el) el.value = parsed.sub_estatus;
                    }
                    if (parsed.id) {
                        this.currentFilters.id = parsed.id;
                        const el = document.getElementById('filter-id');
                        if (el) el.value = parsed.id;
                    }

                    // Recargar con los filtros aplicados
                    this.loadObligaciones();

                } catch (e) {
                    console.error('Error al restaurar filtros', e);
                    // En caso de error, establecer "Todas las áreas" por defecto
                    if (filterAreaEl) {
                        filterAreaEl.value = '';
                        this.currentFilters.area = null;
                    }
                }
            } else {
                // Si no hay filtros guardados, establecer "Todas las áreas" por defecto
                if (filterAreaEl) {
                    filterAreaEl.value = '';
                    this.currentFilters.area = null;
                }
            }

        } catch (error) {
            console.error('Error al cargar filtros:', error);
        }
    }

    /**
     * Actualizar paginación
     */
    updatePagination(total) {
        const totalPages = Math.ceil(total / this.itemsPerPage);

            // Actualizar texto
        const infoEl = document.getElementById('pagination-info');
        if (infoEl) {
            const start = total === 0 ? 0 : (this.currentPage - 1) * this.itemsPerPage + 1;
            const end = Math.min(this.currentPage * this.itemsPerPage, total);
            infoEl.textContent = `Mostrando ${start} de ${end} de ${total} registros`;
        }

        // Renderizar controles
        const controlsEl = document.getElementById('pagination-controls');
        if (controlsEl) {
            controlsEl.innerHTML = '';

            if (totalPages <= 1) return;

            // Botón Anterior
            const prevBtn = document.createElement('button');
            prevBtn.className = 'p-1.5 border border-border-subtle rounded bg-white text-text-muted hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
            prevBtn.innerHTML = '<span class="material-symbols-outlined">chevron_left</span>';
            prevBtn.disabled = this.currentPage === 1;
            prevBtn.onclick = () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.loadObligaciones();
                }
            };
            controlsEl.appendChild(prevBtn);

            // Páginas (Lógica simple: mostrar todas si son pocas, o rango limitado)
            // Para simplicidad mostramos rango alrededor de current page
            let startPage = Math.max(1, this.currentPage - 2);
            let endPage = Math.min(totalPages, startPage + 4);

            if (endPage - startPage < 4) {
                startPage = Math.max(1, endPage - 4);
            }

            for (let i = startPage; i <= endPage; i++) {
                const pageBtn = document.createElement('button');
                const isActive = i === this.currentPage;

                if (isActive) {
                    pageBtn.className = 'px-3 py-1 border border-primary bg-primary text-white text-xs font-bold rounded';
                } else {
                    pageBtn.className = 'px-3 py-1 border border-border-subtle bg-white text-text-muted text-xs font-bold rounded hover:bg-gray-100 hover:text-primary-black-black transition-colors';
                }

                pageBtn.textContent = i;
                pageBtn.onclick = () => {
                    this.currentPage = i;
                    this.loadObligaciones();
                };
                controlsEl.appendChild(pageBtn);
            }

            // Botón Siguiente
            const nextBtn = document.createElement('button');
            nextBtn.className = 'p-1.5 border border-border-subtle rounded bg-white text-text-muted hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
            nextBtn.innerHTML = '<span class="material-symbols-outlined">chevron_right</span>';
            nextBtn.disabled = this.currentPage === totalPages;
            nextBtn.onclick = () => {
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.loadObligaciones();
                }
            };
            controlsEl.appendChild(nextBtn);
        }
    }

    /**
     * Ver detalle de obligación
     */
    verDetalle(id) {
        // Abrir modal o redirigir
        window.location.href = `DetalleObligaciones.html?id=${id}`;
    }

    /**
     * Pausar obligación
     */
    async pausar(id) {
        if (!await Utils.confirm('¿Está seguro de pausar esta obligación?')) {
            return;
        }

        try {
            await this.obligacionesService.pausar(id);
            Utils.showNotification('Obligación pausada correctamente', 'success');
            await this.loadObligaciones();
        } catch (error) {
            Utils.showNotification('Error al pausar obligación', 'error');
        }
    }

    /**
     * Reanudar obligación
     */
    async reanudar(id) {
        try {
            await this.obligacionesService.reanudar(id);
            Utils.showNotification('Obligación reanudada correctamente', 'success');
            await this.loadObligaciones();
        } catch (error) {
            Utils.showNotification('Error al reanudar obligación', 'error');
        }
    }

    /**
     * Marcar como atendida
     */
    async marcarAtendida(id) {
        if (!await Utils.confirm('¿Está seguro de marcar esta obligación como atendida?')) {
            return;
        }

        try {
            await this.obligacionesService.marcarAtendida(id);
            Utils.showNotification('Obligación marcada como atendida', 'success');
            await this.loadObligaciones();
        } catch (error) {
            Utils.showNotification('Error al marcar obligación como atendida', 'error');
        }
    }

    /**
     * Exportar Excel actualizado
     * Genera un archivo Excel con todas las obligaciones en el estado actual
     */
    async exportarExcel() {
        try {
            if (!this.excelService) {
                Utils.showNotification('Servicio de Excel no disponible', 'error');
                return;
            }

            // Obtener todas las obligaciones (sin filtros)
            const todasObligaciones = await this.obligacionesService.getAll();
            
            if (todasObligaciones.length === 0) {
                Utils.showNotification('No hay obligaciones para exportar', 'warning');
                return;
            }

            // Obtener estructura del Excel original desde configuración
            let excelStructure = null;
            if (window.configService) {
                try {
                    const config = await window.configService.getConfiguracion();
                    excelStructure = config.excelStructure || null;
                } catch (error) {
                    console.warn('No se pudo obtener estructura del Excel desde configuración:', error);
                }
            }

            // Generar Excel
            const blob = this.excelService.exportToExcel(todasObligaciones, excelStructure);
            
            // Generar nombre de archivo con timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const fileName = `obligaciones_actualizadas_${timestamp}.xlsx`;
            
            // Guardar en almacenamiento de archivos si está disponible
            if (this.fileStorageService) {
                try {
                    await this.fileStorageService.saveFile(fileName, blob, 'exports', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                    
                    // Guardar metadatos del export
                    await this.fileStorageService.saveMetadata(`excel_export_${timestamp}`, {
                        fileName: fileName,
                        totalObligaciones: todasObligaciones.length,
                        fechaGeneracion: new Date().toISOString(),
                        tieneEstructuraOriginal: excelStructure !== null
                    });
                    
                    console.log(`✅ Excel guardado en almacenamiento: ${fileName}`);
                    
                    // Descargar usando el servicio
                    const filePath = `exports/${fileName}`;
                    await this.fileStorageService.downloadFile(filePath, fileName);
                } catch (error) {
                    console.warn('Error al guardar/descargar con servicio de almacenamiento, usando método tradicional:', error);
                    // Fallback a método tradicional
                    const link = document.createElement('a');
                    const url = URL.createObjectURL(blob);
                    link.setAttribute('href', url);
                    link.setAttribute('download', fileName);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }
} else {
                // Método tradicional si no hay servicio de almacenamiento
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', fileName);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }

            // Mostrar notificación
            Utils.showNotification(`Excel exportado: ${todasObligaciones.length} obligaciones`, 'success');

        } catch (error) {
            console.error('Error al exportar Excel:', error);
            Utils.showNotification('Error al exportar Excel: ' + error.message, 'error');
        }
    }

    /**
     * Exportar calendario de notificaciones
     * Genera un CSV con las fechas de alertas según las reglas de las columnas W, X, Y, Z
     */
    async exportarCalendarioNotificaciones() {
        try {
            // Obtener todas las obligaciones (sin filtros)
            const todasObligaciones = await this.obligacionesService.getAll();
            
            const MAX_FECHAS_POR_ID = 100;
            const resultados = [];
            const logs = [];

            for (const obligacion of todasObligaciones) {
                const id = obligacion.id_oficial || obligacion.id;
                if (!id || id.trim() === '') {
                    continue;
                }

                // Parsear fecha límite
                const deadline = this.parseFecha(obligacion.fecha_limite || obligacion.fecha_limite_original);
                if (!deadline) {
                    logs.push(`ID=${id}: sin 'Fecha límite de entrega' válida (no se generaron alertas).`);
                    continue;
                }

                // Obtener fechas de reglas de alertamiento
                const reglas = obligacion.reglas_alertamiento || {};
                const a1 = this.parseFecha(reglas.regla_1_vez);      // 1 Vez
                const a2 = this.parseFecha(reglas.regla_semanal);    // Semanal
                const a3 = this.parseFecha(reglas.regla_saltado);     // Saltado (cada 2 días)
                const a4 = this.parseFecha(reglas.regla_diaria);     // Diaria

                // Verificar incongruencias (solo para log)
                const warnings = this.checkIncongruence(a1, a2, a3, a4, deadline);
                warnings.forEach(w => logs.push(`ID=${id}: ${w}`));

                // Generar calendario con prioridad: 4TA (Diaria) > 3ER (Saltado) > 2DA (Semanal) > 1ER (1 Vez)
                const fechas = this.generateScheduleForRow(a1, a2, a3, a4, deadline);

                // Regla: si >100 fechas, cancelar ese ID
                if (fechas.length > MAX_FECHAS_POR_ID) {
                    logs.push(`ID=${id}: cancelado, generó ${fechas.length} fechas (>${MAX_FECHAS_POR_ID}).`);
                    continue;
                }

                // Agregar fechas al resultado
                fechas.forEach(fecha => {
                    resultados.push({
                        ID: id,
                        Fecha: this.formatFechaCSV(fecha)
                    });
                });
            }

            // Generar CSV
            const csv = this.generateCSV(resultados);
            
            // Generar nombre de archivo con timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const fileName = `calendario_alertas_${timestamp}.csv`;
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            
            // Guardar en almacenamiento de archivos y descargar si está disponible
            if (this.fileStorageService) {
                try {
                    // Guardar en almacenamiento
                    const filePath = await this.fileStorageService.saveFile(fileName, blob, 'exports', 'text/csv');
                    
                    // Guardar metadatos del export
                    await this.fileStorageService.saveMetadata(`export_${timestamp}`, {
                        fileName: fileName,
                        totalFechas: resultados.length,
                        totalObligaciones: todasObligaciones.length,
                        fechaGeneracion: new Date().toISOString(),
                        logs: logs.length > 0 ? logs : null
                    });
                    
                    console.log(`✅ Calendario guardado en almacenamiento: ${fileName}`);
                    
                    // Descargar usando el servicio
                    await this.fileStorageService.downloadFile(filePath, fileName);
                } catch (error) {
                    console.warn('Error al guardar/descargar con servicio de almacenamiento, usando método tradicional:', error);
                    // Fallback a método tradicional
                    const link = document.createElement('a');
                    const url = URL.createObjectURL(blob);
                    link.setAttribute('href', url);
                    link.setAttribute('download', fileName);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }
            } else {
                // Método tradicional si no hay servicio de almacenamiento
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', fileName);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }

            // Mostrar notificación
            Utils.showNotification(`Calendario exportado: ${resultados.length} fechas generadas`, 'success');
            
            // Log en consola si hay advertencias
            if (logs.length > 0) {
                console.warn('Advertencias al generar calendario:', logs);
            }

        } catch (error) {
            console.error('Error al exportar calendario:', error);
            Utils.showNotification('Error al exportar calendario de notificaciones', 'error');
        }
    }

    /**
     * Parsea una fecha desde string DD/MM/YYYY o YYYY-MM-DD a Date
     */
    parseFecha(fechaStr) {
        if (!fechaStr) return null;
        
        // Si es string DD/MM/YYYY
        if (typeof fechaStr === 'string' && fechaStr.includes('/')) {
            const parts = fechaStr.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1; // Mes es 0-based
                const year = parseInt(parts[2], 10);
                if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                    return new Date(Date.UTC(year, month, day));
                }
            }
        }
        
        // Si es string YYYY-MM-DD
        if (typeof fechaStr === 'string' && fechaStr.includes('-')) {
            const date = new Date(fechaStr + 'T00:00:00Z');
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
        
        // Si ya es Date
        if (fechaStr instanceof Date && !isNaN(fechaStr.getTime())) {
            return fechaStr;
        }
        
        return null;
    }

    /**
     * Formatea una fecha a DD/MM/YYYY para el CSV
     */
    formatFechaCSV(fecha) {
        if (!fecha) return '';
        const d = new Date(fecha);
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${day}/${month}/${year}`;
    }

    /**
     * Verifica incongruencias temporales entre alertas
     */
    checkIncongruence(a1, a2, a3, a4, deadline) {
        const warnings = [];
        
        const fmt = (d) => d ? this.formatFechaCSV(d) : 'NA';
        
        // Incongruencias: una alerta de MAYOR prioridad con fecha menor que una de menor prioridad
        const pairs = [
            ['2DA', a2, '1ER', a1],
            ['3ER', a3, '2DA', a2],
            ['3ER', a3, '1ER', a1],
            ['4TA', a4, '3ER', a3],
            ['4TA', a4, '2DA', a2],
            ['4TA', a4, '1ER', a1],
        ];
        
        for (const [higherName, higherDate, lowerName, lowerDate] of pairs) {
            if (higherDate && lowerDate && higherDate < lowerDate) {
                warnings.push(
                    `Incongruencia: ${higherName} (${fmt(higherDate)}) < ${lowerName} (${fmt(lowerDate)}). Se aplicó prioridad.`
                );
            }
        }
        
        // Alertas que arrancan después de la fecha límite
        if (deadline) {
            for (const [name, d] of [['1ER', a1], ['2DA', a2], ['3ER', a3], ['4TA', a4]]) {
                if (d && d > deadline) {
                    warnings.push(
                        `Alerta ${name} (${fmt(d)}) > Fecha límite (${fmt(deadline)}). No generó envíos.`
                    );
                }
            }
        }
        
        return warnings;
    }

    /**
     * Genera rango de fechas desde start hasta end (inclusive) avanzando stepDays
     */
    genRange(start, end, stepDays) {
        const fechas = [];
        let cur = new Date(start);
        const endDate = new Date(end);
        
        while (cur <= endDate) {
            fechas.push(new Date(cur));
            cur = new Date(cur);
            cur.setUTCDate(cur.getUTCDate() + stepDays);
        }
        
        return fechas;
    }

    /**
     * Obtiene la fecha mínima no nula
     */
    minNonNull(...dates) {
        const clean = dates.filter(d => d !== null && d !== undefined);
        return clean.length > 0 ? new Date(Math.min(...clean.map(d => d.getTime()))) : null;
    }

    /**
     * Genera el calendario de fechas para una obligación aplicando prioridad
     * Prioridad: 4TA (Diaria) > 3ER (Saltado) > 2DA (Semanal) > 1ER (1 Vez)
     */
    generateScheduleForRow(a1, a2, a3, a4, deadline) {
        if (!deadline) return [];
        
        const fechas = [];
        
        // 4TA (diaria): desde a4 hasta deadline (inclusive)
        if (a4 && a4 <= deadline) {
            fechas.push(...this.genRange(a4, deadline, 1));
        }
        
        // 3ER (cada 2 días): desde a3 hasta min(a4-1, deadline)
        if (a3 && a3 <= deadline) {
            const a4Minus1 = a4 ? new Date(a4.getTime() - 86400000) : null; // a4 - 1 día
            const upper = this.minNonNull(a4Minus1, deadline) || deadline;
            if (a3 <= upper) {
                fechas.push(...this.genRange(a3, upper, 2));
            }
        }
        
        // 2DA (semanal): desde a2 hasta min(a3-1, a4-1, deadline)
        if (a2 && a2 <= deadline) {
            const a3Minus1 = a3 ? new Date(a3.getTime() - 86400000) : null;
            const a4Minus1 = a4 ? new Date(a4.getTime() - 86400000) : null;
            const upper = this.minNonNull(a3Minus1, a4Minus1, deadline) || deadline;
            if (a2 <= upper) {
                fechas.push(...this.genRange(a2, upper, 7));
            }
        }
        
        // 1ER (única): sólo si queda antes del arranque de cualquier alerta de mayor prioridad
        if (a1 && a1 <= deadline) {
            const cutoff = this.minNonNull(a2, a3, a4);
            if (!cutoff) {
                fechas.push(a1);
            } else {
                if (a1 < cutoff) {
                    fechas.push(a1);
                }
            }
        }
        
        // Unificar y ordenar (y asegurar <= deadline)
        const fechasUnicas = [...new Set(fechas.map(f => f.getTime()))]
            .map(t => new Date(t))
            .filter(f => f <= deadline)
            .sort((a, b) => a.getTime() - b.getTime());
        
        return fechasUnicas;
    }

    /**
     * Genera CSV desde array de objetos
     */
    generateCSV(data) {
        if (data.length === 0) {
            return 'ID,Fecha\n';
        }
        
        const headers = Object.keys(data[0]);
        const rows = data.map(row => 
            headers.map(header => {
                const value = row[header];
                // Escapar comillas y envolver en comillas si contiene comas o comillas
                if (value && (value.toString().includes(',') || value.toString().includes('"'))) {
                    return `"${value.toString().replace(/"/g, '""')}"`;
                }
                return value || '';
            }).join(',')
        );
        
        return [headers.join(','), ...rows].join('\n');
    }

    /**
     * Mostrar formulario de obligación (agregar o modificar)
     */
    async mostrarFormularioObligacion(obligacionId = null) {
        const modal = document.getElementById('modal-obligacion');
        const titulo = document.getElementById('modal-obligacion-titulo');
        const form = document.getElementById('form-obligacion');

        if (!modal || !titulo || !form) {
            console.error('Elementos del modal no encontrados');
            return;
        }

        // Limpiar formulario
        form.reset();
        this.obligacionEditando = obligacionId;

        if (obligacionId) {
            // Modificar: cargar datos
            titulo.textContent = 'Modificar Obligación';
            try {
                const obligacion = await this.obligacionesService.getById(obligacionId);
                this.cargarDatosEnFormulario(obligacion);
            } catch (error) {
                console.error('Error al cargar obligación:', error);
                Utils.showNotification('Error al cargar obligación', 'error');
                return;
            }
        } else {
            // Agregar: formulario vacío
            titulo.textContent = 'Agregar Obligación';
        }

        modal.classList.remove('hidden');
    }

    /**
     * Cargar datos de obligación en el formulario
     */
    cargarDatosEnFormulario(obligacion) {
        // Información básica
        const idInput = document.getElementById('form-id');
        if (idInput) idInput.value = obligacion.id_oficial || obligacion.id || '';
        
        const reguladorInput = document.getElementById('form-regulador');
        if (reguladorInput) reguladorInput.value = obligacion.regulador || '';
        
        const areaInput = document.getElementById('form-area');
        if (areaInput) areaInput.value = obligacion.area || '';
        
        const periodicidadInput = document.getElementById('form-periodicidad');
        if (periodicidadInput) periodicidadInput.value = obligacion.periodicidad || '';
        
        const nombreInput = document.getElementById('form-nombre');
        if (nombreInput) nombreInput.value = obligacion.nombre || obligacion.descripcion || '';

        // Fechas y estatus
        const fechaLimiteInput = document.getElementById('form-fecha-limite');
        if (fechaLimiteInput && obligacion.fecha_limite) {
            // Convertir YYYY-MM-DD a formato de input date
            fechaLimiteInput.value = obligacion.fecha_limite;
        }

        const estatusSelect = document.getElementById('form-estatus');
        if (estatusSelect) estatusSelect.value = obligacion.estatus || '';

        const subEstatusInput = document.getElementById('form-sub-estatus');
        if (subEstatusInput) subEstatusInput.value = obligacion.sub_estatus || '';

        const responsableCNInput = document.getElementById('form-responsable-cn');
        if (responsableCNInput) responsableCNInput.value = obligacion.responsable_cn || '';

        const responsableJuridicoInput = document.getElementById('form-responsable-juridico');
        if (responsableJuridicoInput) responsableJuridicoInput.value = obligacion.responsable_juridico || '';

        // Reglas de alertamiento
        const reglas = obligacion.reglas_alertamiento || {};
        
        const regla1VezInput = document.getElementById('form-regla-1-vez');
        if (regla1VezInput && reglas.regla_1_vez) {
            const fecha1Vez = this.convertirFechaParaInput(reglas.regla_1_vez);
            if (fecha1Vez) regla1VezInput.value = fecha1Vez;
        }

        const reglaSemanalInput = document.getElementById('form-regla-semanal');
        if (reglaSemanalInput && reglas.regla_semanal) {
            const fechaSemanal = this.convertirFechaParaInput(reglas.regla_semanal);
            if (fechaSemanal) reglaSemanalInput.value = fechaSemanal;
        }

        const reglaSaltadoInput = document.getElementById('form-regla-saltado');
        if (reglaSaltadoInput && reglas.regla_saltado) {
            const fechaSaltado = this.convertirFechaParaInput(reglas.regla_saltado);
            if (fechaSaltado) reglaSaltadoInput.value = fechaSaltado;
        }

        const reglaDiariaInput = document.getElementById('form-regla-diaria');
        if (reglaDiariaInput && reglas.regla_diaria) {
            const fechaDiaria = this.convertirFechaParaInput(reglas.regla_diaria);
            if (fechaDiaria) reglaDiariaInput.value = fechaDiaria;
        }
    }

    /**
     * Convertir fecha DD/MM/YYYY o YYYY-MM-DD a formato YYYY-MM-DD para input date
     */
    convertirFechaParaInput(fechaStr) {
        if (!fechaStr) return null;
        
        // Si ya es YYYY-MM-DD
        if (typeof fechaStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
            return fechaStr;
        }
        
        // Si es DD/MM/YYYY
        if (typeof fechaStr === 'string' && fechaStr.includes('/')) {
            const parts = fechaStr.split('/');
            if (parts.length === 3) {
                const day = parts[0].padStart(2, '0');
                const month = parts[1].padStart(2, '0');
                const year = parts[2];
                return `${year}-${month}-${day}`;
            }
        }
        
        return null;
    }

    /**
     * Cerrar modal de obligación
     */
    cerrarModalObligacion() {
        const modal = document.getElementById('modal-obligacion');
        if (modal) {
            modal.classList.add('hidden');
        }
        this.obligacionEditando = null;
    }

    /**
     * Guardar obligación (crear o actualizar)
     */
    async guardarObligacion() {
        const form = document.getElementById('form-obligacion');
        if (!form) return;

        // Validar formulario
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        try {
            // Obtener valores del formulario
            const formData = new FormData(form);
            const id = formData.get('id').trim();
            
            // Verificar que el ID no esté vacío
            if (!id) {
                Utils.showNotification('El ID es obligatorio', 'error');
                return;
            }

            // Obtener estructura del Excel para crear row_original
            let excelStructure = null;
            if (window.configService) {
                try {
                    const config = await window.configService.getConfiguracion();
                    excelStructure = config.excelStructure || null;
                } catch (error) {
                    console.warn('No se pudo obtener estructura del Excel:', error);
                }
            }

            // Crear row_original basado en headers del Excel
            let rowOriginal = [];
            if (excelStructure && excelStructure.headers) {
                rowOriginal = new Array(excelStructure.headers.length).fill(null);
                
                // Mapear campos a columnas según columnMap
                const columnMap = excelStructure.columnMap || {};
                
                // Columna V (21): ID
                rowOriginal[21] = id;
                
                // Columna C (2): Regulador
                if (columnMap.regulador !== undefined) {
                    rowOriginal[columnMap.regulador] = formData.get('regulador') || '';
                } else {
                    rowOriginal[2] = formData.get('regulador') || '';
                }
                
                // Columna H (7): Área
                if (columnMap.area !== undefined) {
                    rowOriginal[columnMap.area] = formData.get('area') || '';
                } else {
                    rowOriginal[7] = formData.get('area') || '';
                }
                
                // Columna N (13): Periodicidad
                if (columnMap.periodicidad !== undefined) {
                    rowOriginal[columnMap.periodicidad] = formData.get('periodicidad') || '';
                } else {
                    rowOriginal[13] = formData.get('periodicidad') || '';
                }
                
                // Columna P (15): Fecha límite
                const fechaLimite = formData.get('fecha_limite');
                if (fechaLimite) {
                    if (columnMap.fecha_limite !== undefined) {
                        rowOriginal[columnMap.fecha_limite] = fechaLimite;
                    } else {
                        rowOriginal[15] = fechaLimite;
                    }
                }
                
                // Columna T (19): Estatus
                if (columnMap.estatus !== undefined) {
                    rowOriginal[columnMap.estatus] = formData.get('estatus') || '';
                } else {
                    rowOriginal[19] = formData.get('estatus') || '';
                }
                
                // Columna U (20): Subestatus
                if (columnMap.sub_estatus !== undefined) {
                    rowOriginal[columnMap.sub_estatus] = formData.get('sub_estatus') || '';
                } else {
                    rowOriginal[20] = formData.get('sub_estatus') || '';
                }
                
                // Reglas de alertamiento (W, X, Y, Z)
                const regla1Vez = formData.get('regla_1_vez');
                if (regla1Vez) rowOriginal[22] = regla1Vez;
                
                const reglaSemanal = formData.get('regla_semanal');
                if (reglaSemanal) rowOriginal[23] = reglaSemanal;
                
                const reglaSaltado = formData.get('regla_saltado');
                if (reglaSaltado) rowOriginal[24] = reglaSaltado;
                
                const reglaDiaria = formData.get('regla_diaria');
                if (reglaDiaria) rowOriginal[25] = reglaDiaria;
            } else {
                // Si no hay estructura, crear fila básica
                rowOriginal = new Array(26).fill(null);
                rowOriginal[2] = formData.get('regulador') || '';
                rowOriginal[7] = formData.get('area') || '';
                rowOriginal[13] = formData.get('periodicidad') || '';
                rowOriginal[15] = formData.get('fecha_limite') || '';
                rowOriginal[19] = formData.get('estatus') || '';
                rowOriginal[20] = formData.get('sub_estatus') || '';
                rowOriginal[21] = id;
                rowOriginal[22] = formData.get('regla_1_vez') || '';
                rowOriginal[23] = formData.get('regla_semanal') || '';
                rowOriginal[24] = formData.get('regla_saltado') || '';
                rowOriginal[25] = formData.get('regla_diaria') || '';
            }

            // Convertir fechas de reglas a formato DD/MM/YYYY si es necesario
            const convertirReglaFecha = (fechaStr) => {
                if (!fechaStr) return null;
                // Si ya es YYYY-MM-DD, convertir a DD/MM/YYYY
                if (/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
                    const [year, month, day] = fechaStr.split('-');
                    return `${day}/${month}/${year}`;
                }
                return fechaStr;
            };

            // Construir objeto de obligación
            const obligacionData = {
                id: id,
                id_oficial: id,
                regulador: formData.get('regulador') || '',
                area: formData.get('area') || '',
                periodicidad: formData.get('periodicidad') || 'No definida',
                nombre: formData.get('nombre') || id,
                descripcion: formData.get('nombre') || id,
                fecha_limite: formData.get('fecha_limite') || null,
                fecha_limite_original: formData.get('fecha_limite') || null,
                estatus: formData.get('estatus') || null,
                sub_estatus: formData.get('sub_estatus') || null,
                responsable_cn: formData.get('responsable_cn') || null,
                responsable_juridico: formData.get('responsable_juridico') || null,
                reglas_alertamiento: {
                    regla_1_vez: convertirReglaFecha(formData.get('regla_1_vez')),
                    regla_semanal: convertirReglaFecha(formData.get('regla_semanal')),
                    regla_saltado: convertirReglaFecha(formData.get('regla_saltado')),
                    regla_diaria: convertirReglaFecha(formData.get('regla_diaria'))
                },
                row_original: rowOriginal,
                historial: [],
                archivos: [],
                recordatorios_programados: []
            };

            let obligacionGuardada;
            if (this.obligacionEditando) {
                // Actualizar
                obligacionGuardada = await this.obligacionesService.actualizar(this.obligacionEditando, obligacionData);
                
                // Registrar en bitácora
                if (window.BitacoraService) {
                    try {
                        const bitacoraService = new BitacoraService(window.dataAdapter);
                        await bitacoraService.registrarEvento(
                            this.obligacionEditando,
                            'cambio_regla',
                            'Obligación modificada',
                            'La obligación fue modificada desde el formulario',
                            null,
                            obligacionData,
                            null
                        );
                    } catch (bitacoraError) {
                        console.warn('Error al registrar en bitácora:', bitacoraError);
                    }
                }
            } else {
                // Crear nueva
                obligacionGuardada = await this.obligacionesService.crear(obligacionData);
                
                // Registrar en bitácora
                if (window.BitacoraService) {
                    try {
                        const bitacoraService = new BitacoraService(window.dataAdapter);
                        await bitacoraService.registrarEvento(
                            id,
                            'carga_inicial',
                            'Carga inicial',
                            'Obligación creada desde el formulario',
                            null,
                            null,
                            null
                        );
                    } catch (bitacoraError) {
                        console.warn('Error al registrar en bitácora:', bitacoraError);
                    }
                }
            }

            // Calcular y guardar calendario de notificaciones
            if (window.CalendarioService && window.FileStorageService) {
                try {
                    const fileStorageService = new FileStorageService();
                    await fileStorageService.init();
                    const calendarioService = new CalendarioService(fileStorageService);
                    await calendarioService.calcularYGuardarCalendario(obligacionGuardada.id, obligacionGuardada);
                    console.log(`✅ Calendario calculado y guardado para ${obligacionGuardada.id}`);
                } catch (calendarioError) {
                    console.warn(`No se pudo calcular calendario para ${obligacionGuardada.id}:`, calendarioError);
                }
            }

            // Cerrar modal y recargar tabla
            this.cerrarModalObligacion();
            await this.loadObligaciones();
            
            Utils.showNotification(
                this.obligacionEditando ? 'Obligación actualizada correctamente' : 'Obligación creada correctamente',
                'success'
            );
        } catch (error) {
            console.error('Error al guardar obligación:', error);
            Utils.showNotification('Error al guardar obligación: ' + error.message, 'error');
        }
    }

    /**
     * Eliminar obligación
     */
    async eliminarObligacion(obligacionId) {
        try {
            // Obtener obligación para mostrar ID en confirmación
            const obligacion = await this.obligacionesService.getById(obligacionId);
            const idMostrar = obligacion.id_oficial || obligacion.id;

            // Confirmar eliminación
            if (!await Utils.confirm(`¿Está seguro de eliminar la obligación ${idMostrar}?`)) {
                return;
            }

            // Eliminar
            await this.obligacionesService.eliminar(obligacionId);

            // Recargar tabla
            await this.loadObligaciones();

            Utils.showNotification('Obligación eliminada correctamente', 'success');
        } catch (error) {
            console.error('Error al eliminar obligación:', error);
            Utils.showNotification('Error al eliminar obligación: ' + error.message, 'error');
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

            // Si cambió el día, recargar obligaciones
            if (ahoraTimestamp !== this.ultimaFechaVerificada) {
                console.log('📅 Cambio de día detectado. Actualizando días restantes...');
                this.ultimaFechaVerificada = ahoraTimestamp;
                
                // Recargar obligaciones para actualizar días restantes
                this.loadObligaciones().catch(error => {
                    console.error('Error al recargar obligaciones después del cambio de día:', error);
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

// Inicializar cuando el DOM esté listo
// Inicializar cuando las dependencias estén listas
const initObligacionesController = () => {
    if (window.obligacionesController) return; // Ya inicializado

    if (window.dataAdapter) {
        const controller = new ObligacionesController();
        controller.init();
        window.obligacionesController = controller;
        console.log('✅ ObligacionesController inicializado');
    }
};

// Intentar inicializar inmediatamente o esperar evento
if (window.dataAdapter) {
    initObligacionesController();
} else {
    document.addEventListener('alertia-ready', initObligacionesController);
    // Respaldo por si el evento ya sucedió o hay condiciones de carrera
    document.addEventListener('DOMContentLoaded', initObligacionesController);
}

if (typeof window !== 'undefined') {
    window.ObligacionesController = ObligacionesController;
}
