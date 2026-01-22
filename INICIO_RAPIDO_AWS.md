# ⚡ Inicio Rápido - Despliegue a AWS

## 🎯 Objetivo
Desplegar AlertIA en AWS y comenzar a enviar correos con Amazon SES.

## 📝 Checklist Rápido

### Antes de empezar:
- [ ] Tienes cuenta de AWS
- [ ] Tienes un email que puedes verificar
- [ ] Tienes acceso a la terminal

### Pasos esenciales:

1. **Configurar AWS CLI** (5 minutos)
   ```bash
   aws configure
   # Ingresa tus credenciales cuando te las pida
   ```

2. **Verificar email en SES** (2 minutos)
   - Ve a AWS Console → SES → Verified identities
   - Create identity → Email address
   - Verifica el email que recibes

3. **Crear bucket S3** (1 minuto)
   ```bash
   BUCKET_NAME="alertia-frontend-prod-$(date +%s)"
   aws s3 mb s3://$BUCKET_NAME --region us-east-1
   echo "Guarda este nombre: $BUCKET_NAME"
   ```

4. **Desplegar Backend** (5 minutos)
   ```bash
   cd "/Users/aure/Documents/Experimentación IA/AlertIA"
   sam build
   sam deploy --guided
   # Cuando te pregunte FromEmail, usa el email que verificaste
   ```

5. **Obtener URL de API**
   ```bash
   aws cloudformation describe-stacks \
     --stack-name alertia-stack \
     --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayApi`].OutputValue' \
     --output text
   ```

6. **Actualizar frontend/js/config/env.js**
   - Reemplaza `YOUR_API_ID` con la URL que obtuviste arriba

7. **Desplegar Frontend**
   ```bash
   export S3_BUCKET_NAME="tu-bucket-name-aqui"
   ./scripts/deploy-aws.sh --frontend
   ```

8. **Configurar GitHub Secrets** (para CI/CD automático)
   - Ve a GitHub → Settings → Secrets → Actions
   - Agrega: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME, SES_FROM_EMAIL

## 🧪 Probar

```bash
# Reemplaza API_URL con tu URL real
API_URL="https://abc123.execute-api.us-east-1.amazonaws.com/Prod"

curl -X POST $API_URL/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "tu-email-verificado@ejemplo.com",
    "subject": "Prueba",
    "body": "Hola desde AlertIA!",
    "from": "noreply@tudominio.com",
    "fromName": "AlertIA"
  }'
```

## 📚 Documentación Completa

Para más detalles, lee: **GUIA_DESPLIEGUE_AWS.md**

## 🆘 ¿Problemas?

1. Revisa los logs: `sam logs -n SendEmailFunction --stack-name alertia-stack --tail`
2. Verifica que el email esté verificado en SES
3. Revisa la consola del navegador (F12) si pruebas desde la web

¡Mucha suerte! 🚀
