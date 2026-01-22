# 🚀 Guía Completa de Despliegue a AWS - AlertIA

Esta guía te llevará paso a paso para desplegar AlertIA en AWS y comenzar a enviar correos con Amazon SES.

## 📋 Tabla de Contenidos

1. [Prerrequisitos](#prerrequisitos)
2. [Paso 1: Configurar AWS](#paso-1-configurar-aws)
3. [Paso 2: Verificar Email en SES](#paso-2-verificar-email-en-ses)
4. [Paso 3: Crear Bucket S3](#paso-3-crear-bucket-s3)
5. [Paso 4: Instalar Herramientas](#paso-4-instalar-herramientas)
6. [Paso 5: Desplegar Backend](#paso-5-desplegar-backend)
7. [Paso 6: Desplegar Frontend](#paso-6-desplegar-frontend)
8. [Paso 7: Configurar GitHub Actions (CI/CD)](#paso-7-configurar-github-actions-cicd)
9. [Paso 8: Probar el Sistema](#paso-8-probar-el-sistema)
10. [Solución de Problemas](#solución-de-problemas)

---

## Prerrequisitos

Antes de comenzar, necesitas:

- ✅ Una cuenta de AWS (si no tienes una, créala en https://aws.amazon.com/)
- ✅ Acceso a la consola de AWS
- ✅ Un email que puedas verificar en SES (para enviar correos)
- ✅ Un repositorio en GitHub (ya lo tienes)
- ✅ Terminal/Command Line en tu Mac

---

## Paso 1: Configurar AWS

### 1.1 Crear Usuario IAM

Necesitas crear un usuario en AWS con permisos para desplegar recursos.

1. Ve a la **Consola de AWS** → **IAM** → **Users** → **Add users**
2. Nombre de usuario: `alertia-deploy` (o el que prefieras)
3. Selecciona: **Access key - Programmatic access**
4. Click en **Next: Permissions**

5. Selecciona **Attach policies directly** y agrega estas políticas:
   - `AdministratorAccess` (para empezar, luego puedes restringir)
   - O si prefieres ser más específico:
     - `AmazonS3FullAccess`
     - `AWSLambda_FullAccess`
     - `AmazonAPIGatewayAdministrator`
     - `AmazonDynamoDBFullAccess`
     - `AmazonSESFullAccess`
     - `CloudFormationFullAccess`
     - `IAMFullAccess`

6. Click en **Next** → **Next** → **Create user**

7. **⚠️ IMPORTANTE**: Copia y guarda en un lugar seguro:
   - **Access Key ID**
   - **Secret Access Key**
   
   ⚠️ **No podrás ver la Secret Key de nuevo**, así que guárdala bien.

### 1.2 Configurar AWS CLI en tu Mac

Abre la Terminal y ejecuta:

```bash
# Instalar AWS CLI (si no lo tienes)
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /

# Verificar instalación
aws --version

# Configurar credenciales
aws configure
```

Cuando te pregunte, ingresa:
- **AWS Access Key ID**: [La que copiaste arriba]
- **AWS Secret Access Key**: [La que copiaste arriba]
- **Default region name**: `us-east-1` (o la región que prefieras)
- **Default output format**: `json`

### 1.3 Verificar que funciona

```bash
aws sts get-caller-identity
```

Deberías ver información sobre tu usuario. Si funciona, ¡perfecto! ✅

---

## Paso 2: Verificar Email en SES

Amazon SES requiere que verifiques el email desde el cual enviarás correos.

### 2.1 Verificar Email Individual (Recomendado para empezar)

1. Ve a **AWS Console** → **SES** → **Verified identities** → **Create identity**
2. Selecciona **Email address**
3. Ingresa tu email (ej: `noreply@tudominio.com` o tu email personal)
4. Click en **Create identity**

5. **Revisa tu bandeja de entrada** (y spam) del email que ingresaste
6. Abre el email de AWS SES y haz click en el enlace de verificación
7. ✅ El email quedará verificado

### 2.2 Verificar Dominio (Opcional, para producción)

Si tienes un dominio propio, puedes verificarlo completo:

1. En SES → **Verified identities** → **Create identity**
2. Selecciona **Domain**
3. Ingresa tu dominio (ej: `tudominio.com`)
4. Sigue las instrucciones para agregar registros DNS

### 2.3 Salir del Sandbox (IMPORTANTE)

Por defecto, SES está en "sandbox mode" y solo puedes enviar a emails verificados.

Para enviar a cualquier email:

1. Ve a **SES** → **Account dashboard**
2. Click en **Request production access**
3. Completa el formulario explicando tu caso de uso
4. AWS revisará tu solicitud (puede tardar 24-48 horas)

**Mientras tanto**, puedes probar enviando a emails que hayas verificado.

---

## Paso 3: Crear Bucket S3

El bucket S3 almacenará los archivos del frontend.

```bash
# Crear bucket (reemplaza 'alertia-frontend-prod' con un nombre único)
# Los nombres de bucket deben ser únicos globalmente en AWS
BUCKET_NAME="alertia-frontend-prod-$(date +%s)"
aws s3 mb s3://$BUCKET_NAME --region us-east-1

# Habilitar hosting estático
aws s3 website s3://$BUCKET_NAME/ \
  --index-document index.html \
  --error-document error.html

# Configurar permisos públicos (para que se pueda acceder)
aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::'$BUCKET_NAME'/*"
    }
  ]
}'

echo "✅ Bucket creado: $BUCKET_NAME"
echo "📝 Guarda este nombre, lo necesitarás para GitHub Secrets"
```

**Guarda el nombre del bucket**, lo necesitarás más adelante.

---

## Paso 4: Instalar Herramientas

### 4.1 Instalar AWS SAM CLI

```bash
# Instalar Homebrew si no lo tienes
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Instalar SAM CLI
brew install aws-sam-cli

# Verificar instalación
sam --version
```

### 4.2 Instalar Node.js (si no lo tienes)

```bash
# Instalar Node.js
brew install node

# Verificar instalación
node --version
npm --version
```

---

## Paso 5: Desplegar Backend

### 5.1 Preparar el despliegue

Desde la raíz del proyecto:

```bash
cd "/Users/aure/Documents/Experimentación IA/AlertIA"

# Verificar que los archivos estén en su lugar
ls backend/lambda/send-email/
ls backend/lambda/obligaciones/
ls template.yaml
```

### 5.2 Construir la aplicación

```bash
# Build de la aplicación SAM
sam build

# Si todo va bien, verás:
# ✅ Build Succeeded
```

### 5.3 Desplegar (Primera vez)

```bash
# Desplegar con guía interactiva
sam deploy --guided
```

Te preguntará:

1. **Stack Name**: `alertia-stack` (o el que prefieras)
2. **AWS Region**: `us-east-1` (o la que configuraste)
3. **Parameter FromEmail**: Ingresa el email que verificaste en SES (ej: `noreply@tudominio.com`)
4. **Parameter FromName**: `AlertIA` (o el que prefieras)
5. **Confirm changes before deploy**: `Y` (para revisar)
6. **Allow SAM CLI IAM role creation**: `Y` (necesario para crear roles)
7. **Disable rollback**: `N` (déjalo en No)
8. **Save arguments to configuration file**: `Y` (guardará en samconfig.toml)

El despliegue tomará unos 2-3 minutos. ⏳

### 5.4 Obtener la URL de la API

Después del despliegue, ejecuta:

```bash
# Obtener la URL de la API
aws cloudformation describe-stacks \
  --stack-name alertia-stack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayApi`].OutputValue' \
  --output text
```

**Copia esta URL**, la necesitarás para actualizar el frontend.

Debería verse algo así:
```
https://abc123xyz.execute-api.us-east-1.amazonaws.com/Prod
```

### 5.5 Despliegues siguientes

Una vez configurado, los siguientes despliegues son más simples:

```bash
sam build
sam deploy
```

---

## Paso 6: Desplegar Frontend

### 6.1 Actualizar URL de API

Edita el archivo `frontend/js/config/env.js` y reemplaza la URL placeholder:

```javascript
// Cambiar esta línea:
return 'https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/Prod';

// Por la URL real que obtuviste en el paso 5.4:
return 'https://abc123xyz.execute-api.us-east-1.amazonaws.com/Prod';
```

### 6.2 Subir frontend a S3

```bash
# Reemplaza BUCKET_NAME con el nombre que guardaste en el paso 3
BUCKET_NAME="alertia-frontend-prod-XXXXX"  # Tu nombre real

# Subir archivos
aws s3 sync frontend/ s3://$BUCKET_NAME/ \
  --delete \
  --exclude "*.git*" \
  --exclude "*.md" \
  --exclude ".DS_Store"

echo "✅ Frontend desplegado"
```

### 6.3 Acceder a tu aplicación

Tu aplicación estará disponible en:

```
http://$BUCKET_NAME.s3-website-us-east-1.amazonaws.com
```

O si configuraste CloudFront:

```
https://tu-distribucion-cloudfront.cloudfront.net
```

---

## Paso 7: Configurar GitHub Actions (CI/CD)

### 7.1 Agregar Secrets en GitHub

1. Ve a tu repositorio en GitHub
2. Click en **Settings** → **Secrets and variables** → **Actions**
3. Click en **New repository secret**

Agrega estos secrets (uno por uno):

| Secret Name | Valor | Descripción |
|------------|-------|-------------|
| `AWS_ACCESS_KEY_ID` | Tu Access Key ID | La que copiaste en el paso 1.1 |
| `AWS_SECRET_ACCESS_KEY` | Tu Secret Access Key | La que copiaste en el paso 1.1 |
| `S3_BUCKET_NAME` | `alertia-frontend-prod-XXXXX` | El nombre del bucket del paso 3 |
| `SES_FROM_EMAIL` | `noreply@tudominio.com` | El email verificado en SES |
| `SES_FROM_NAME` | `AlertIA` | Nombre del remitente |
| `CLOUDFRONT_DIST_ID` | (opcional) | Si usas CloudFront, el ID de distribución |

### 7.2 Verificar que el workflow existe

El archivo `.github/workflows/deploy.yml` ya está creado. Verifica que esté en tu repositorio:

```bash
ls -la .github/workflows/
```

### 7.3 Hacer commit y push

```bash
# Agregar todos los cambios
git add .

# Commit
git commit -m "Configurar despliegue CI/CD a AWS"

# Push a GitHub
git push origin main
```

### 7.4 Verificar el despliegue automático

1. Ve a tu repositorio en GitHub
2. Click en la pestaña **Actions**
3. Deberías ver un workflow ejecutándose llamado "Deploy AlertIA to AWS"
4. Click en él para ver el progreso

El workflow:
- ✅ Desplegará el backend (Lambda + API Gateway)
- ✅ Actualizará la URL de API en el frontend
- ✅ Subirá el frontend a S3
- ✅ Invalidará la caché de CloudFront (si está configurado)

---

## Paso 8: Probar el Sistema

### 8.1 Probar el endpoint de email directamente

```bash
# Reemplaza API_URL con tu URL real
API_URL="https://abc123xyz.execute-api.us-east-1.amazonaws.com/Prod"

# Probar envío de correo
curl -X POST $API_URL/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "tu-email-verificado@ejemplo.com",
    "subject": "Prueba desde AlertIA",
    "body": "Este es un correo de prueba desde AlertIA desplegado en AWS.",
    "from": "noreply@tudominio.com",
    "fromName": "AlertIA"
  }'
```

Si funciona, deberías recibir el correo en unos segundos. ✅

### 8.2 Probar desde la aplicación web

1. Abre tu aplicación en el navegador (URL de S3 o CloudFront)
2. Inicia sesión
3. Intenta enviar un correo desde la aplicación
4. Verifica que llegue el correo

### 8.3 Ver logs de Lambda

Si algo no funciona, revisa los logs:

```bash
# Ver logs de la función de email
sam logs -n SendEmailFunction --stack-name alertia-stack --tail

# Ver logs de la función de obligaciones
sam logs -n ObligacionesFunction --stack-name alertia-stack --tail
```

---

## Solución de Problemas

### ❌ Error: "Email address is not verified"

**Problema**: Intentas enviar desde un email no verificado en SES.

**Solución**: 
- Verifica el email en SES (Paso 2)
- O cambia el parámetro `FromEmail` en el despliegue

### ❌ Error: "MessageRejected - Email address not verified"

**Problema**: Intentas enviar a un email no verificado (estás en sandbox).

**Solución**:
- Envía solo a emails verificados en SES
- O solicita salir del sandbox (Paso 2.3)

### ❌ Error: "Access Denied" al subir a S3

**Problema**: El usuario IAM no tiene permisos.

**Solución**:
- Verifica que el usuario tenga `AmazonS3FullAccess`
- O agrega permisos específicos al bucket

### ❌ Error: "Stack already exists"

**Problema**: Ya existe un stack con ese nombre.

**Solución**:
```bash
# Eliminar stack existente
aws cloudformation delete-stack --stack-name alertia-stack

# Esperar a que se elimine (puede tardar unos minutos)
aws cloudformation wait stack-delete-complete --stack-name alertia-stack

# Desplegar de nuevo
sam deploy
```

### ❌ Los correos no se envían desde la aplicación

**Problema**: La URL de API no está actualizada.

**Solución**:
1. Verifica que `frontend/js/config/env.js` tenga la URL correcta
2. Verifica en la consola del navegador (F12) si hay errores
3. Revisa los logs de Lambda

### ❌ GitHub Actions falla

**Problema**: Los secrets no están configurados correctamente.

**Solución**:
1. Verifica que todos los secrets estén en GitHub
2. Verifica que los nombres sean exactos (case-sensitive)
3. Revisa los logs del workflow en GitHub Actions

---

## 🎉 ¡Felicidades!

Si llegaste hasta aquí, tu aplicación está desplegada en AWS y lista para enviar correos con SES.

### Próximos pasos:

1. **Monitorear costos**: Revisa la consola de AWS para ver los costos
2. **Configurar CloudFront**: Para mejor rendimiento y HTTPS
3. **Agregar más funciones Lambda**: Según necesites
4. **Configurar alertas**: Para monitorear el sistema

### Recursos útiles:

- [Documentación de AWS SAM](https://docs.aws.amazon.com/serverless-application-model/)
- [Documentación de Amazon SES](https://docs.aws.amazon.com/ses/)
- [Documentación de Lambda](https://docs.aws.amazon.com/lambda/)

---

## 📞 ¿Necesitas ayuda?

Si encuentras algún problema, revisa:
1. Los logs de Lambda
2. Los logs de CloudWatch
3. La consola del navegador (F12)
4. Los logs de GitHub Actions

¡Mucha suerte con tu despliegue! 🚀
