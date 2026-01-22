#!/bin/bash

# Script para desplegar AlertIA a AWS
# Uso: ./scripts/deploy-aws.sh [--backend] [--frontend]

set -e  # Salir si hay algún error

echo "🚀 Desplegando AlertIA a AWS..."
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar que estamos en el directorio correcto
if [ ! -f "template.yaml" ]; then
    echo -e "${RED}❌ Error: No se encontró template.yaml${NC}"
    echo "   Asegúrate de ejecutar este script desde el directorio raíz del proyecto"
    exit 1
fi

# Verificar que AWS CLI está instalado
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ Error: AWS CLI no está instalado${NC}"
    echo "   Instala AWS CLI: https://aws.amazon.com/cli/"
    exit 1
fi

# Verificar que SAM CLI está instalado
if ! command -v sam &> /dev/null; then
    echo -e "${RED}❌ Error: AWS SAM CLI no está instalado${NC}"
    echo "   Instala SAM CLI: brew install aws-sam-cli"
    exit 1
fi

# Verificar credenciales de AWS
echo "🔐 Verificando credenciales de AWS..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ Error: No se pudieron verificar las credenciales de AWS${NC}"
    echo "   Ejecuta: aws configure"
    exit 1
fi
echo -e "${GREEN}✅ Credenciales verificadas${NC}"
echo ""

# Determinar qué desplegar
DEPLOY_BACKEND=false
DEPLOY_FRONTEND=false

if [ "$1" == "--backend" ] || [ "$1" == "--all" ] || [ -z "$1" ]; then
    DEPLOY_BACKEND=true
fi

if [ "$1" == "--frontend" ] || [ "$1" == "--all" ] || [ -z "$1" ]; then
    DEPLOY_FRONTEND=true
fi

# Desplegar Backend
if [ "$DEPLOY_BACKEND" = true ]; then
    echo "📦 Desplegando Backend (Lambda + API Gateway + DynamoDB)..."
    echo ""
    
    # Build
    echo "🔨 Construyendo aplicación..."
    sam build
    echo -e "${GREEN}✅ Build completado${NC}"
    echo ""
    
    # Deploy
    echo "🚀 Desplegando a AWS..."
    sam deploy --no-confirm-changeset --no-fail-on-empty-changeset
    
    echo -e "${GREEN}✅ Backend desplegado${NC}"
    echo ""
    
    # Obtener URL de API
    echo "📋 Obteniendo URL de API Gateway..."
    API_URL=$(aws cloudformation describe-stacks \
        --stack-name alertia-stack \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayApi`].OutputValue' \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$API_URL" ]; then
        echo -e "${GREEN}✅ URL de API: $API_URL${NC}"
        echo ""
        echo "📝 Actualiza frontend/js/config/env.js con esta URL:"
        echo "   $API_URL"
        echo ""
    else
        echo -e "${YELLOW}⚠️  No se pudo obtener la URL de la API${NC}"
        echo "   Puedes obtenerla manualmente con:"
        echo "   aws cloudformation describe-stacks --stack-name alertia-stack --query 'Stacks[0].Outputs[?OutputKey==\`ApiGatewayApi\`].OutputValue' --output text"
        echo ""
    fi
fi

# Desplegar Frontend
if [ "$DEPLOY_FRONTEND" = true ]; then
    echo "🎨 Desplegando Frontend (S3)..."
    echo ""
    
    # Verificar que existe el bucket
    if [ -z "$S3_BUCKET_NAME" ]; then
        echo -e "${YELLOW}⚠️  Variable S3_BUCKET_NAME no está configurada${NC}"
        echo "   Configúrala con: export S3_BUCKET_NAME=tu-bucket-name"
        echo "   O pásala como argumento: S3_BUCKET_NAME=tu-bucket ./scripts/deploy-aws.sh --frontend"
        exit 1
    fi
    
    echo "📦 Subiendo archivos a S3 bucket: $S3_BUCKET_NAME"
    aws s3 sync frontend/ s3://$S3_BUCKET_NAME/ \
        --delete \
        --exclude "*.git*" \
        --exclude "*.md" \
        --exclude ".DS_Store" \
        --exclude "*.log"
    
    echo -e "${GREEN}✅ Frontend desplegado${NC}"
    echo ""
    
    # Invalidar CloudFront si está configurado
    if [ -n "$CLOUDFRONT_DIST_ID" ]; then
        echo "🔄 Invalidando caché de CloudFront..."
        aws cloudfront create-invalidation \
            --distribution-id $CLOUDFRONT_DIST_ID \
            --paths "/*"
        echo -e "${GREEN}✅ Caché invalidado${NC}"
        echo ""
    fi
    
    # Mostrar URL
    REGION=$(aws configure get region || echo "us-east-1")
    echo "🌐 Tu aplicación está disponible en:"
    echo "   http://$S3_BUCKET_NAME.s3-website-$REGION.amazonaws.com"
    if [ -n "$CLOUDFRONT_DIST_ID" ]; then
        CLOUDFRONT_URL=$(aws cloudfront get-distribution --id $CLOUDFRONT_DIST_ID --query 'Distribution.DomainName' --output text 2>/dev/null || echo "")
        if [ -n "$CLOUDFRONT_URL" ]; then
            echo "   https://$CLOUDFRONT_URL"
        fi
    fi
    echo ""
fi

echo -e "${GREEN}🎉 Despliegue completado!${NC}"
