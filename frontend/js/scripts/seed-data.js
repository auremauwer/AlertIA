/**
 * Script para cargar datos iniciales
 * Ejecutar en consola del navegador o como script
 */
async function seedInitialData() {
    if (!window.dataAdapter) {
        console.error('dataAdapter no está disponible');
        return;
    }

    try {
        // Cargar datos iniciales
        const response = await fetch('/data/initial-data.json');
        if (!response.ok) {
            console.warn('No se pudo cargar initial-data.json, usando datos por defecto');
            return;
        }

        const data = await response.json();

        // Verificar si ya hay datos
        const obligacionesExistentes = await window.dataAdapter.getObligaciones();
        if (obligacionesExistentes && obligacionesExistentes.length > 0) {
            console.log('ℹ️ Ya existen datos, omitiendo carga inicial');
            return;
        }

        // Cargar obligaciones
        if (data.obligaciones && data.obligaciones.length > 0) {
            for (const obligacion of data.obligaciones) {
                await window.dataAdapter.saveObligacion(obligacion);
            }
            console.log(`✅ ${data.obligaciones.length} obligaciones cargadas`);
        }

        // Cargar configuración
        if (data.configuracion) {
            await window.dataAdapter.saveConfiguracion(data.configuracion);
            console.log('✅ Configuración cargada');
        }

        // Cargar usuario actual
        if (data.usuarios && data.usuarios.current) {
            if (window.dataAdapter.setCurrentUser) {
                await window.dataAdapter.setCurrentUser(data.usuarios.current);
                console.log('✅ Usuario actual configurado');
            }
        }

        console.log('✅ Datos iniciales cargados correctamente');
    } catch (error) {
        console.error('Error al cargar datos iniciales:', error);
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.seedInitialData = seedInitialData;
}
