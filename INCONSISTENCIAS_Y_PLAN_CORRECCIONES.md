# Análisis de Inconsistencias - AlertIA Fase 1

## Resumen Ejecutivo

Este documento identifica las inconsistencias encontradas entre las pantallas HTML implementadas y el Manual de Funcionalidades Técnicas de AlertIA (Fase 1), así como el plan de correcciones necesario.

---

## 1. INCONSISTENCIAS FUNCIONALES

### 1.1 Dashboard (`Dashboard.html`)

**Problemas encontrados:**
- ❌ **Botón "Ver y enviar"** en la tarjeta de "Alertas Listas para Enviar" - Viola la restricción: *"No se permiten acciones operativas desde el dashboard"* y *"No se permite envío directo"*
- ⚠️ Navegación no funcional (todos los enlaces son `#`)

**Correcciones necesarias:**
- Eliminar el botón "Ver y enviar" o convertirlo en un enlace de solo lectura que redirija a la pantalla de Envío de correos
- Implementar navegación funcional entre pantallas

---

### 1.2 Obligaciones (`Obligaciones.html`)

**Problemas encontrados:**
- ❌ **Botón "Nueva Obligación"** presente en la interfaz - Viola la restricción: *"No se permite eliminar obligaciones"* y el principio de que las obligaciones vienen de Excel
- ⚠️ Filtros no completamente implementados según especificación:
  - Faltan filtros explícitos por "Área" y "Periodicidad" (solo hay chips de estado)
- ⚠️ Navegación no funcional

**Correcciones necesarias:**
- Eliminar el botón "Nueva Obligación"
- Agregar filtros desplegables o chips para Área y Periodicidad según especificación
- Implementar navegación funcional

---

### 1.3 Detalle de Obligación (`DetalleObligaciones.html`)

**Problemas encontrados:**
- ⚠️ Implementado como modal sobre la pantalla de Obligaciones, no como pantalla independiente
- ⚠️ No hay navegación de retorno clara

**Correcciones necesarias:**
- Evaluar si debe ser modal o pantalla independiente (el manual no especifica, pero modal es aceptable si funciona bien)
- Asegurar que el botón "Cerrar detalle" funcione correctamente

---

### 1.4 Envío de Correos (`Correos.html`)

**Problemas encontrados:**
- ❌ **Flujo incompleto**: Solo muestra el Paso 1 (Cálculo) y Paso 2 (Selección)
- ❌ **Faltan los Pasos 3 y 4**: Vista previa y Confirmación no están integrados en el flujo
- ⚠️ El botón "Siguiente: Preparar Contenido" no tiene destino claro
- ⚠️ No se muestra claramente que es un proceso de 4 pasos
- ⚠️ Falta indicador de progreso del flujo

**Correcciones necesarias:**
- Integrar los 4 pasos en un flujo continuo:
  - Paso 1: Cálculo manual (actual)
  - Paso 2: Selección (actual)
  - Paso 3: Vista previa (debe integrarse desde `VistaPreviaCorreo.html`)
  - Paso 4: Confirmación final (debe integrarse desde `ConfirmaciónFinal.html`)
- Agregar indicador de progreso (steps/wizard)
- Implementar navegación entre pasos
- Agregar lock para evitar doble envío (mencionado en controles técnicos)

---

### 1.5 Vista Previa de Correo (`VistaPreviaCorreo.html`)

**Problemas encontrados:**
- ❌ **No está integrada en el flujo** de envío de correos
- ⚠️ Implementada como modal independiente, no como paso del proceso
- ⚠️ Contenido de ejemplo no relacionado con obligaciones normativas (muestra "estado de cuenta")

**Correcciones necesarias:**
- Integrar como Paso 3 del flujo de envío de correos
- Actualizar contenido de ejemplo para reflejar alertas normativas
- Asegurar que muestre variables sustituidas correctamente

---

### 1.6 Confirmación Final (`ConfirmaciónFinal.html`)

**Problemas encontrados:**
- ❌ **No está integrada en el flujo** de envío de correos
- ⚠️ Implementada como modal independiente
- ⚠️ Muestra datos de ejemplo no relacionados (1,250 correos, remitentes genéricos)
- ⚠️ Falta registro del usuario ejecutor en el resumen (aunque está mencionado en el texto)

**Correcciones necesarias:**
- Integrar como Paso 4 del flujo de envío de correos
- Asegurar que muestre:
  - Número de correos (del lote seleccionado)
  - Usuario ejecutor (capturado del sistema)
  - Timestamp (generado al momento)
- Implementar el botón de envío real con lock

---

### 1.7 Historial de Envíos (`Historial.html`)

**Problemas encontrados:**
- ⚠️ Muestra registros con **"Sistema Auto"** como usuario ejecutor - Viola el principio: *"El sistema NO envía correos automáticamente"* en Fase 1
- ⚠️ Tipos de alerta inconsistentes: "Masiva", "Final" no están en el manual
- ⚠️ Navegación no funcional

**Correcciones necesarias:**
- Eliminar o corregir registros que muestren "Sistema Auto"
- Asegurar que todos los envíos muestren un usuario real
- Revisar tipos de alerta para que coincidan con el manual (1ra Alerta, 2da Alerta, Crítica)
- Implementar navegación funcional

---

### 1.8 Auditoría / Logs (`Auditoria.html`)

**Problemas encontrados:**
- ⚠️ **Navegación diferente**: Incluye opciones "Usuarios" y "Reportes" que no están en el manual
- ⚠️ Muestra acciones que no deberían estar en Fase 1:
  - "Eliminó parámetro Global" (no se permite edición de reglas)
  - "Modificó permisos" (no está en el alcance de Fase 1)
- ⚠️ Navegación no funcional

**Correcciones necesarias:**
- Ajustar navegación para que coincida con el manual (sin "Usuarios" ni "Reportes")
- Filtrar o eliminar eventos que no corresponden a Fase 1:
  - Solo mostrar: Envíos, Pausas, Reanudaciones, Cambios de estado (marcar atendida)
- Implementar navegación funcional

---

### 1.9 Configuración (`Configuración.html`)

**Problemas encontrados:**
- ✅ Funcionalidad correcta según manual
- ⚠️ Navegación no funcional
- ⚠️ Falta sección de "Horario de Envío" mencionada en el diseño pero no en el manual (debe eliminarse o marcarse como no funcional en Fase 1)

**Correcciones necesarias:**
- Implementar navegación funcional
- Revisar si "Horario de Envío" debe estar (no está en el manual de Fase 1)

---

## 2. INCONSISTENCIAS DE DISEÑO Y NAVEGACIÓN

### 2.1 Estilos Inconsistentes

**Problemas encontrados:**
- Diferentes paletas de colores primarios:
  - `#ec0000` (Dashboard, Obligaciones, Historial)
  - `#db0606` (Vista Previa)
  - `#f90606` (Confirmación Final)
  - `#d41111` (Auditoría)
  - `#e60000` (Configuración)
- Diferentes fuentes:
  - Manrope (Dashboard, Detalle, Vista Previa, Confirmación, Auditoría, Configuración)
  - Inter (Correos)
  - Noto Sans (Dashboard también)
- Diferentes estructuras de sidebar:
  - Dashboard: sidebar con logo arriba
  - Obligaciones: sidebar con logo arriba (similar)
  - Correos: sidebar más compacto
  - Historial: sidebar con logo arriba
  - Auditoría: sidebar diferente
  - Configuración: sidebar diferente
- Diferentes estructuras de header:
  - Algunos tienen búsqueda, otros no
  - Algunos tienen notificaciones, otros no
  - Diferentes alturas y estilos

**Correcciones necesarias:**
- Estandarizar color primario: `#ec0000` (rojo corporativo)
- Estandarizar fuente: Manrope para títulos, Noto Sans o Inter para cuerpo
- Crear componente de sidebar reutilizable
- Crear componente de header reutilizable
- Estandarizar espaciados y tamaños

---

### 2.2 Navegación No Funcional

**Problemas encontrados:**
- Todos los enlaces de navegación son `href="#"` (no funcionales)
- No hay rutas definidas entre pantallas
- Los botones de acción no tienen funcionalidad

**Correcciones necesarias:**
- Implementar sistema de navegación (puede ser simple con archivos HTML o con JavaScript)
- Crear estructura de rutas:
  - `Dashboard.html` → `Obligaciones.html` → `DetalleObligaciones.html`
  - `Dashboard.html` → `Correos.html` → (flujo de 4 pasos) → `Historial.html`
  - `Dashboard.html` → `Configuración.html`
  - `Dashboard.html` → `Auditoria.html`
- Implementar navegación de retorno en modales y flujos

---

### 2.3 Consistencia de Componentes

**Problemas encontrados:**
- Botones con diferentes estilos
- Tablas con diferentes estilos
- Cards/KPIs con diferentes estilos
- Badges/Status pills inconsistentes

**Correcciones necesarias:**
- Crear sistema de componentes reutilizables
- Estandarizar:
  - Botones primarios, secundarios, terciarios
  - Tablas con mismo estilo
  - Cards con mismo estilo
  - Badges de estado consistentes

---

## 3. INCONSISTENCIAS DE CONTENIDO

### 3.1 Datos de Ejemplo

**Problemas encontrados:**
- Contenido de correos no relacionado con obligaciones normativas
- IDs de obligaciones inconsistentes (OBL-2023-0045, REF-2023-0102, OB-2023-001)
- Nombres de usuarios inconsistentes entre pantallas

**Correcciones necesarias:**
- Estandarizar formato de IDs: `OBL-YYYY-XXXX`
- Crear datos de ejemplo consistentes y relacionados con obligaciones normativas
- Estandarizar nombres de usuarios entre todas las pantallas

---

### 3.2 Terminología

**Problemas encontrados:**
- "Cálculo de Envíos" vs "Envío de correos"
- "Vista Previa" vs "Vista Previa de Correo"
- Diferentes formas de referirse a las mismas entidades

**Correcciones necesarias:**
- Estandarizar terminología según manual:
  - "Envío de correos" (no "Cálculo de Envíos")
  - "Vista previa de correo"
  - "Historial de envíos"
  - "Auditoría / Logs"

---

## 4. PLAN DE CORRECCIONES

### Fase 1: Correcciones Funcionales Críticas

1. **Dashboard**
   - Eliminar botón "Ver y enviar"
   - Convertir en enlace de solo lectura

2. **Obligaciones**
   - Eliminar botón "Nueva Obligación"
   - Agregar filtros faltantes (Área, Periodicidad)

3. **Envío de Correos**
   - Integrar flujo de 4 pasos completo
   - Agregar indicador de progreso
   - Implementar lock para evitar doble envío

4. **Historial**
   - Eliminar registros con "Sistema Auto"
   - Corregir tipos de alerta

5. **Auditoría**
   - Ajustar navegación (eliminar "Usuarios" y "Reportes")
   - Filtrar eventos no correspondientes a Fase 1

---

### Fase 2: Estandarización de Diseño

1. **Sistema de Diseño**
   - Crear archivo de configuración de Tailwind compartido
   - Estandarizar colores primarios
   - Estandarizar fuentes

2. **Componentes Reutilizables**
   - Crear componentes de sidebar
   - Crear componentes de header
   - Crear componentes de botones, tablas, cards

3. **Aplicar a todas las pantallas**
   - Refactorizar cada pantalla para usar componentes estandarizados

---

### Fase 3: Navegación y Funcionalidad

1. **Sistema de Navegación**
   - Implementar navegación entre pantallas
   - Crear sistema de rutas simple

2. **Integración de Flujos**
   - Integrar Vista Previa en flujo de envío
   - Integrar Confirmación Final en flujo de envío
   - Implementar navegación de retorno

---

### Fase 4: Contenido y Datos

1. **Datos de Ejemplo**
   - Crear conjunto de datos de ejemplo consistente
   - Estandarizar IDs de obligaciones
   - Estandarizar nombres de usuarios

2. **Contenido de Correos**
   - Actualizar ejemplos para reflejar obligaciones normativas
   - Asegurar variables sustituidas correctamente

---

## 5. PRIORIZACIÓN

### Alta Prioridad (Bloqueantes)
1. Eliminar funcionalidades no permitidas (botones de creación, envío desde dashboard)
2. Integrar flujo completo de envío de correos (4 pasos)
3. Eliminar referencias a automatización en Historial

### Media Prioridad (Importantes)
1. Estandarizar diseño y componentes
2. Implementar navegación funcional
3. Corregir datos de ejemplo

### Baja Prioridad (Mejoras)
1. Optimización de estilos
2. Mejoras de UX menores
3. Documentación adicional

---

## 6. ARCHIVOS A MODIFICAR

### Archivos Principales
- `Dashboard.html` - Eliminar botón, estandarizar
- `Obligaciones.html` - Eliminar botón, agregar filtros, estandarizar
- `DetalleObligaciones.html` - Estandarizar, mejorar navegación
- `Correos.html` - Refactorizar para flujo de 4 pasos
- `VistaPreviaCorreo.html` - Integrar en flujo, actualizar contenido
- `ConfirmaciónFinal.html` - Integrar en flujo, corregir datos
- `Historial.html` - Eliminar "Sistema Auto", corregir tipos
- `Auditoria.html` - Ajustar navegación, filtrar eventos
- `Configuración.html` - Estandarizar, revisar horario

### Archivos Nuevos (Opcionales)
- `components/sidebar.html` - Componente reutilizable
- `components/header.html` - Componente reutilizable
- `config/tailwind-config.js` - Configuración compartida
- `data/ejemplos.json` - Datos de ejemplo consistentes

---

## 7. NOTAS ADICIONALES

### Consideraciones Técnicas
- Las pantallas están implementadas como HTML estático
- No hay backend implementado
- La navegación puede implementarse con JavaScript simple o con enlaces HTML directos
- Los datos de ejemplo están hardcodeados en cada archivo

### Recomendaciones
- Considerar crear un sistema de componentes compartidos (puede ser con JavaScript o con includes si se usa un servidor)
- Para producción, considerar un framework o sistema de build
- Los datos de ejemplo deberían venir de un archivo JSON compartido para mantener consistencia

---

**Fecha de análisis:** 2024
**Versión del manual:** Fase 1
**Estado:** Pendiente de implementación
