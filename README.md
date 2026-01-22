# AlertIA - Sistema de Alertamiento Normativo v3.0.7

Sistema de gestión y alertamiento de obligaciones normativas con arquitectura híbrida (LocalStorage local / AWS en producción).

## 🚀 Inicio Rápido

### Desarrollo Local

1. **Iniciar servidor HTTP:**
   ```bash
   ./scripts/deploy-local.sh
   ```
   
   O manualmente:
   ```bash
   python3 -m http.server 8000
   ```

2. **Abrir en navegador:**
   - Dashboard: http://localhost:8000/frontend/Dashboard.html
   - Obligaciones: http://localhost:8000/frontend/Obligaciones.html
   - Envío de correos: http://localhost:8000/frontend/Correos.html
   - Escritos: http://localhost:8000/frontend/Escritos.html
   - Auditoría: http://localhost:8000/frontend/Auditoria.html
   - Configuración: http://localhost:8000/frontend/Configuración.html

3. **Cargar datos iniciales:**
   - Los datos se cargan automáticamente la primera vez que se abre la aplicación
   - O manualmente desde la consola del navegador: `seedInitialData()`

## 📁 Estructura del Proyecto

```
AlertIA/
├── frontend/                    # Frontend (HTML/CSS/JS)
│   ├── *.html                   # Pantallas de la aplicación
│   ├── js/
│   │   ├── config/              # Configuración
│   │   │   └── env.js          # Detección de entorno
│   │   ├── core/                # Núcleo del sistema
│   │   │   ├── data-adapter.js # Capa de abstracción
│   │   │   ├── api-client.js   # Cliente API REST
│   │   │   └── local-storage.js # Manager LocalStorage
│   │   ├── services/           # Servicios de negocio
│   │   ├── controllers/        # Controladores de pantallas
│   │   └── scripts/            # Scripts auxiliares
│   └── index.html              # Página de inicio
├── backend/                     # Backend AWS (Lambda)
├── data/
│   └── initial-data.json       # Datos iniciales
└── scripts/
    └── deploy-local.sh         # Script de deploy local
```

## 🏗️ Arquitectura

### Modo Local (Desarrollo)
- **Almacenamiento:** LocalStorage del navegador
- **Backend:** No requiere servidor
- **Datos:** Se cargan desde `data/initial-data.json`

### Modo Producción (AWS)
- **Frontend:** S3 + CloudFront
- **Backend:** API Gateway + Lambda + DynamoDB
- **Email:** Amazon SES
- **Envío Automático:** EventBridge + Lambda programada (ejecuta diariamente)

## 🔧 Configuración

La aplicación detecta automáticamente el entorno:
- **Local:** `localhost` o `127.0.0.1` → Usa LocalStorage
- **Producción:** Otro dominio → Usa API REST

## 📝 Funcionalidades

### Fase 1 (Implementado)
- ✅ Dashboard con KPIs y estado del sistema
- ✅ Gestión de obligaciones (ver, pausar, reanudar, marcar atendida)
- ✅ Cálculo manual de alertas
- ✅ Envío manual de correos (flujo de 4 pasos)
- ✅ Envío automático programado de correos (EventBridge + Lambda)
- ✅ Historial de envíos
- ✅ Auditoría de eventos
- ✅ Configuración del sistema

## 🛠️ Desarrollo

### Agregar nueva funcionalidad

1. **Crear servicio** en `frontend/js/services/`
2. **Crear controlador** en `frontend/js/controllers/`
3. **Actualizar HTML** para incluir scripts
4. **Probar en local** con LocalStorage

### Migrar a AWS

1. Implementar funciones Lambda en `backend/lambda/`
2. Configurar API Gateway
3. Crear tablas DynamoDB
4. Actualizar `env.js` con URL de API
5. Deploy frontend a S3

## 📚 Documentación

- Ver `INCONSISTENCIAS_Y_PLAN_CORRECCIONES.md` para detalles de implementación
- Ver plan de arquitectura para detalles de AWS

## 🐛 Troubleshooting

### Los datos no se cargan
- Verificar que `data/initial-data.json` existe
- Abrir consola del navegador y ejecutar `seedInitialData()`
- Verificar que LocalStorage está habilitado

### Errores de CORS
- Asegurarse de usar un servidor HTTP (no `file://`)
- Verificar que el servidor está corriendo en el puerto 8000

### Scripts no cargan
- Verificar rutas relativas en los HTML
- Verificar que `js/app-init.js` está siendo cargado primero
- Revisar consola del navegador para errores

## 📄 Licencia

Proyecto interno - AlertIA Systems
