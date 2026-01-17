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
        this.alertasService = new AlertasService(window.dataAdapter);
        this.enviosService = new EnviosService(window.dataAdapter);
        this.auditoriaService = new AuditoriaService(window.dataAdapter);

        await this.loadDashboard();
    }

    /**
     * Cargar datos del dashboard
     */
    async loadDashboard() {
        try {
            // Cargar KPIs
            await this.loadKPIs();
            
            // Cargar semáforo de criticidad
            await this.loadSemaforoCriticidad();
            
            // Cargar estado reciente de alertas
            await this.loadEstadoReciente();
            
            // Cargar última ejecución manual
            await this.loadUltimaEjecucion();
        } catch (error) {
            console.error('Error al cargar dashboard:', error);
            Utils.showNotification('Error al cargar datos del dashboard', 'error');
        }
    }

    /**
     * Cargar KPIs
     */
    async loadKPIs() {
        try {
            const statsObligaciones = await this.obligacionesService.getEstadisticas();
            const statsAlertas = await this.alertasService.getEstadisticas();
            const statsEnvios = await this.enviosService.getEstadisticas();

            // Total obligaciones vigentes
            const totalObligacionesEl = document.querySelector('[data-kpi="total-obligaciones"]');
            if (totalObligacionesEl) {
                totalObligacionesEl.textContent = statsObligaciones.activas;
            }

            // Alertas listas para enviar
            const alertasListasEl = document.querySelector('[data-kpi="alertas-listas"]');
            if (alertasListasEl) {
                alertasListasEl.textContent = statsAlertas.pendientes;
            }

            // Correos enviados hoy
            const correosHoyEl = document.querySelector('[data-kpi="correos-hoy"]');
            if (correosHoyEl) {
                correosHoyEl.textContent = statsEnvios.correos_hoy;
            }

            // Alertas pausadas
            const alertasPausadasEl = document.querySelector('[data-kpi="alertas-pausadas"]');
            if (alertasPausadasEl) {
                alertasPausadasEl.textContent = statsObligaciones.pausadas;
            }
        } catch (error) {
            console.error('Error al cargar KPIs:', error);
        }
    }

    /**
     * Cargar semáforo de criticidad
     */
    async loadSemaforoCriticidad() {
        try {
            const obligaciones = await this.obligacionesService.getAll({ estado: 'activa' });
            
            // Separar por criticidad
            const criticas = obligaciones.filter(obl => 
                obl.criticidad.nivel === 'critica' && obl.requiere_envio
            );
            
            const enVentana = obligaciones.filter(obl => 
                obl.criticidad.nivel === 'ventana' && obl.en_ventana
            );

            // Renderizar críticas
            this.renderCriticas(criticas);
            
            // Renderizar en ventana
            this.renderEnVentana(enVentana);
        } catch (error) {
            console.error('Error al cargar semáforo de criticidad:', error);
        }
    }

    /**
     * Renderizar obligaciones críticas
     */
    renderCriticas(obligaciones) {
        const container = document.querySelector('[data-section="criticas"]');
        if (!container) return;

        container.innerHTML = '';

        obligaciones.slice(0, 6).forEach(obl => {
            const diasRestantes = obl.dias_restantes;
            const badgeText = diasRestantes === 0 ? 'Vence hoy' : 
                            diasRestantes === 1 ? 'Vence en 24h' : 
                            `Vence en ${diasRestantes}h`;

            const card = document.createElement('div');
            card.className = 'criticidad-card border-primary';
            card.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-primary text-base">notifications</span>
                        <span class="text-xs font-black text-primary-black">ID: ${obl.id}</span>
                    </div>
                    <span class="h-6 flex items-center px-3 bg-primary text-white text-[10px] font-bold uppercase tracking-wider rounded-sm">${badgeText}</span>
                </div>
                <div class="mb-2">
                    <span class="h-6 inline-flex items-center gap-2 px-3 border border-primary/20 bg-red-50 text-primary text-[10px] font-bold uppercase tracking-wider rounded-sm">
                        <span class="size-2 bg-primary rounded-full"></span>
                        Requiere envío
                    </span>
                </div>
                <p class="text-sm font-medium text-text-muted mb-3 leading-tight">${obl.descripcion || obl.nombre}</p>
                <div class="flex justify-between items-center text-[10px] font-bold uppercase text-text-muted border-t border-neutral-50 pt-3">
                    <span>Responsable: ${obl.responsable}</span>
                    <span>Área: ${obl.area}</span>
                </div>
            `;
            container.appendChild(card);
        });

        // Actualizar contador
        const countEl = document.querySelector('[data-count="criticas"]');
        if (countEl) {
            countEl.textContent = `${obligaciones.length} REGISTROS`;
        }
    }

    /**
     * Renderizar obligaciones en ventana
     */
    renderEnVentana(obligaciones) {
        const container = document.querySelector('[data-section="en-ventana"]');
        if (!container) return;

        container.innerHTML = '';

        obligaciones.slice(0, 12).forEach(obl => {
            const diasRestantes = obl.dias_restantes;
            const ventanaDias = Math.ceil(diasRestantes / 1);

            const card = document.createElement('div');
            card.className = 'criticidad-card border-primary-black';
            card.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-primary-black text-base">notifications</span>
                        <span class="text-xs font-black text-primary-black">ID: ${obl.id}</span>
                    </div>
                    <span class="h-6 flex items-center px-3 bg-primary-black text-white text-[10px] font-bold uppercase tracking-wider rounded-sm">Ventana: ${ventanaDias} Días</span>
                </div>
                <div class="mb-2">
                    <span class="h-6 inline-flex items-center gap-2 px-3 border border-yellow-200 bg-yellow-50 text-yellow-700 text-[10px] font-bold uppercase tracking-wider rounded-sm">
                        <span class="material-symbols-outlined text-[14px]">warning</span>
                        En ventana
                    </span>
                </div>
                <p class="text-sm font-medium text-text-muted mb-3 leading-tight">${obl.descripcion || obl.nombre}</p>
                <div class="flex justify-between items-center text-[10px] font-bold uppercase text-text-muted border-t border-neutral-50 pt-3">
                    <span>Responsable: ${obl.responsable}</span>
                    <span>Área: ${obl.area}</span>
                </div>
            `;
            container.appendChild(card);
        });

        // Actualizar contador
        const countEl = document.querySelector('[data-count="en-ventana"]');
        if (countEl) {
            countEl.textContent = `${obligaciones.length} REGISTROS`;
        }
    }

    /**
     * Cargar estado reciente de alertas
     */
    async loadEstadoReciente() {
        try {
            const envios = await this.enviosService.getAll();
            const recientes = envios.slice(0, 5);

            const tbody = document.querySelector('[data-table="estado-reciente"] tbody');
            if (!tbody) return;

            tbody.innerHTML = '';

            recientes.forEach(envio => {
                const row = document.createElement('tr');
                row.className = 'hover:bg-neutral-50 transition-colors';
                
                const fecha = Utils.formatDate(envio.fecha, 'DD/MM/YYYY HH:mm');
                const estadoClass = envio.estado === 'completado' ? 'bg-green-500' : 
                                  envio.estado === 'fallido' ? 'bg-red-500' : 
                                  'bg-primary animate-pulse';
                const estadoText = envio.estado === 'completado' ? 'Completado' :
                                 envio.estado === 'fallido' ? 'Fallido' :
                                 'preparado, pendiente de envío manual';

                row.innerHTML = `
                    <td class="px-6 py-5">
                        <div class="flex items-center gap-3">
                            <span class="material-symbols-outlined text-base text-primary-black">notifications</span>
                            <span class="font-black text-primary-black uppercase">Envío ${envio.id}</span>
                        </div>
                    </td>
                    <td class="px-6 py-5 text-text-muted font-medium italic">
                        <div class="flex items-center gap-2">
                            <span class="material-symbols-outlined text-sm">mail</span>
                            <span>${fecha}</span>
                        </div>
                    </td>
                    <td class="px-6 py-5">
                        <span class="text-[10px] font-bold uppercase tracking-tighter text-primary-black bg-neutral-100 px-2 py-1">${envio.correos_enviados} Correos</span>
                    </td>
                    <td class="px-6 py-5">
                        <div class="flex items-center gap-2">
                            <span class="size-2 rounded-full ${estadoClass}"></span>
                            <span class="text-[10px] font-black uppercase text-primary-black">${estadoText}</span>
                        </div>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error('Error al cargar estado reciente:', error);
        }
    }

    /**
     * Cargar última ejecución manual
     */
    async loadUltimaEjecucion() {
        try {
            const envios = await this.enviosService.getAll();
            const ultimo = envios.find(e => e.estado === 'completado');

            if (ultimo) {
                const fecha = Utils.formatDate(ultimo.fecha, 'DD/MM/YYYY, HH:mm A');
                const fechaEl = document.querySelector('[data-info="ultima-ejecucion-fecha"]');
                const usuarioEl = document.querySelector('[data-info="ultima-ejecucion-usuario"]');
                const volumenEl = document.querySelector('[data-info="ultima-ejecucion-volumen"]');

                if (fechaEl) fechaEl.textContent = fecha;
                if (usuarioEl) usuarioEl.textContent = ultimo.usuario;
                if (volumenEl) volumenEl.textContent = `${ultimo.correos_enviados} Correos`;
            }
        } catch (error) {
            console.error('Error al cargar última ejecución:', error);
        }
    }
}

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
