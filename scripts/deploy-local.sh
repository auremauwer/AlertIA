#!/bin/bash

# Script para ejecutar la aplicación en local
# Uso: ./scripts/deploy-local.sh

echo "🚀 Iniciando AlertIA en modo local..."
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -d "frontend" ]; then
    echo "❌ Error: No se encontró el directorio frontend"
    echo "   Asegúrate de ejecutar este script desde el directorio raíz del proyecto"
    exit 1
fi

# Verificar Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python3 no está instalado"
    exit 1
fi

echo "✅ Python3 encontrado"
echo ""
echo "📦 Servidor HTTP iniciado en http://localhost:8000"
echo ""
echo "📋 Pantallas disponibles:"
echo "   - Dashboard: http://localhost:8000/frontend/Dashboard.html"
echo "   - Obligaciones: http://localhost:8000/frontend/Obligaciones.html"
echo "   - Envío de correos: http://localhost:8000/frontend/Correos.html"
echo "   - Historial: http://localhost:8000/frontend/Historial.html"
echo "   - Auditoría: http://localhost:8000/frontend/Auditoria.html"
echo "   - Configuración: http://localhost:8000/frontend/Configuración.html"
echo ""
echo "💡 Presiona Ctrl+C para detener el servidor"
echo ""

# Iniciar servidor HTTP desde el directorio raíz
python3 -m http.server 8000
