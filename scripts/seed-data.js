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
        const data = await response.json();

        // Cargar obligaciones
        if (data.obligaciones && data.obligaciones.length > 0) {
            for (const obligacion of data.obligaciones) {
                await dataAdapter.saveObligacion(obligacion);
            }
            console.log(`✅ ${data.obligaciones.length} obligaciones cargadas`);
        }

        // Cargar configuración
        if (data.configuracion) {
            await dataAdapter.saveConfiguracion(data.configuracion);
            console.log('✅ Configuración cargada');
        }

        // Cargar usuario actual
        if (data.usuarios && data.usuarios.current) {
            await dataAdapter.setCurrentUser(data.usuarios.current);
            console.log('✅ Usuario actual configurado');
        }

        console.log('✅ Datos iniciales cargados correctamente');
    } catch (error) {
        console.error('Error al cargar datos iniciales:', error);
    }
}

// Si se ejecuta en navegador
if (typeof window !== 'undefined') {
    window.seedInitialData = seedInitialData;
}

// Si se ejecuta en Node.js (para testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { seedInitialData };
}
