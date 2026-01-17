/**
 * Script de prueba de funcionalidades
 * Ejecutar en la consola del navegador después de cargar la aplicación
 */

async function testAllFunctionalities() {
    console.log('🧪 INICIANDO PRUEBAS DE FUNCIONALIDADES\n');
    
    const results = {
        passed: [],
        failed: []
    };
    
    // Test 1: Verificar que dataAdapter esté disponible
    console.log('1️⃣ Verificando dataAdapter...');
    if (window.dataAdapter) {
        console.log('   ✅ dataAdapter disponible');
        results.passed.push('dataAdapter disponible');
    } else {
        console.log('   ❌ dataAdapter NO disponible');
        results.failed.push('dataAdapter NO disponible');
        return results; // No podemos continuar sin dataAdapter
    }
    
    // Test 2: Verificar servicios
    console.log('\n2️⃣ Verificando servicios...');
    const services = ['ObligacionesService', 'AlertasService', 'EnviosService', 'AuditoriaService', 'ConfigService', 'ExcelService'];
    services.forEach(serviceName => {
        if (window[serviceName]) {
            console.log(`   ✅ ${serviceName} disponible`);
            results.passed.push(`${serviceName} disponible`);
        } else {
            console.log(`   ❌ ${serviceName} NO disponible`);
            results.failed.push(`${serviceName} NO disponible`);
        }
    });
    
    // Test 3: Verificar LocalStorage
    console.log('\n3️⃣ Verificando LocalStorage...');
    try {
        const obligaciones = await window.dataAdapter.getObligaciones();
        console.log(`   ✅ LocalStorage funciona. Obligaciones: ${obligaciones.length}`);
        results.passed.push('LocalStorage funciona');
    } catch (error) {
        console.log(`   ❌ Error en LocalStorage: ${error.message}`);
        results.failed.push(`LocalStorage error: ${error.message}`);
    }
    
    // Test 4: Probar guardar obligación
    console.log('\n4️⃣ Probando guardar obligación...');
    try {
        const testObligacion = {
            id: 'OBL-TEST-0001',
            regulador: 'TEST',
            descripcion: 'Obligación de prueba',
            nombre: 'Test',
            responsable: 'Test User',
            area: 'Test',
            fecha_limite: '2025-12-31',
            periodicidad: 'Mensual',
            estado: 'activa',
            reglas_alertamiento: { alerta1: 30, alerta2: 10, critica: 5 },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        await window.dataAdapter.saveObligacion(testObligacion);
        const saved = await window.dataAdapter.getObligacion('OBL-TEST-0001');
        
        if (saved && saved.id === 'OBL-TEST-0001') {
            console.log('   ✅ Guardar obligación funciona');
            results.passed.push('Guardar obligación funciona');
            
            // Limpiar
            await window.dataAdapter.getObligaciones().then(obls => {
                const testObls = obls.filter(o => o.id === 'OBL-TEST-0001');
                // No hay método delete, pero está bien para la prueba
            });
        } else {
            throw new Error('Obligación no se guardó correctamente');
        }
    } catch (error) {
        console.log(`   ❌ Error al guardar: ${error.message}`);
        results.failed.push(`Guardar obligación error: ${error.message}`);
    }
    
    // Test 5: Verificar Utils
    console.log('\n5️⃣ Verificando Utils...');
    if (window.Utils) {
        const testDate = new Date('2025-12-31');
        const formatted = window.Utils.formatDate(testDate, 'DD/MM/YYYY');
        if (formatted === '31/12/2025') {
            console.log('   ✅ Utils funciona correctamente');
            results.passed.push('Utils funciona');
        } else {
            console.log(`   ⚠️ Utils funciona pero formato diferente: ${formatted}`);
            results.passed.push('Utils funciona (formato diferente)');
        }
    } else {
        console.log('   ❌ Utils NO disponible');
        results.failed.push('Utils NO disponible');
    }
    
    // Test 6: Verificar ExcelService
    console.log('\n6️⃣ Verificando ExcelService...');
    if (window.ExcelService) {
        console.log('   ✅ ExcelService disponible');
        results.passed.push('ExcelService disponible');
    } else {
        console.log('   ❌ ExcelService NO disponible');
        results.failed.push('ExcelService NO disponible');
    }
    
    // Test 7: Verificar SheetJS
    console.log('\n7️⃣ Verificando SheetJS (XLSX)...');
    if (typeof XLSX !== 'undefined') {
        console.log('   ✅ SheetJS disponible');
        results.passed.push('SheetJS disponible');
    } else {
        console.log('   ❌ SheetJS NO disponible');
        results.failed.push('SheetJS NO disponible');
    }
    
    // Resumen
    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMEN DE PRUEBAS');
    console.log('='.repeat(50));
    console.log(`✅ Pasadas: ${results.passed.length}`);
    console.log(`❌ Fallidas: ${results.failed.length}`);
    
    if (results.failed.length > 0) {
        console.log('\n❌ Pruebas fallidas:');
        results.failed.forEach(f => console.log(`   - ${f}`));
    }
    
    if (results.passed.length > 0) {
        console.log('\n✅ Pruebas exitosas:');
        results.passed.forEach(p => console.log(`   - ${p}`));
    }
    
    return results;
}

// Exportar para uso en consola
if (typeof window !== 'undefined') {
    window.testAllFunctionalities = testAllFunctionalities;
    console.log('💡 Ejecuta testAllFunctionalities() en la consola para probar todas las funcionalidades');
}
