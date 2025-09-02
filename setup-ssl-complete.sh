#!/bin/bash

# Script completo para configurar SSL no YuStream
# Este script configura SSL para o domínio yustream.yurisp.com.br

set -e

DOMAIN="yustream.yurisp.com.br"
EMAIL="admin@yurisp.com.br"  # Substitua pelo seu email

echo "🚀 Configuração completa de SSL para YuStream"
echo "=============================================="
echo "Domínio: $DOMAIN"
echo "Email: $EMAIL"
echo ""

# Verificar se está sendo executado como root ou com sudo
if [ "$EUID" -ne 0 ]; then
    echo "❌ Este script precisa ser executado como root ou com sudo"
    echo "   Execute: sudo ./setup-ssl-complete.sh"
    exit 1
fi

# Verificar se o domínio está resolvendo
echo "📡 Verificando resolução DNS..."
if ! nslookup $DOMAIN > /dev/null 2>&1; then
    echo "❌ Erro: O domínio $DOMAIN não está resolvendo corretamente."
    echo "   Configure o DNS para apontar para este servidor antes de continuar."
    exit 1
fi
echo "✅ DNS configurado corretamente."

# Instalar dependências necessárias
echo "📦 Instalando dependências..."
apt-get update
apt-get install -y curl wget certbot

# Parar serviços
echo "⏸️ Parando serviços..."
docker compose down

# Criar diretórios necessários
echo "📁 Criando diretórios..."
mkdir -p ./ssl/letsencrypt/live
mkdir -p ./ssl/letsencrypt/archive
mkdir -p ./ssl/letsencrypt/renewal
mkdir -p ./ssl/certbot/www
mkdir -p ./logs

# Tornar scripts executáveis
chmod +x ./scripts/setup-ssl.sh
chmod +x ./scripts/setup-ome-ssl.sh

# Configurar SSL
echo "🔐 Configurando SSL..."
./scripts/setup-ssl.sh

# Configurar SSL no OME
echo "🔐 Configurando SSL no OvenMediaEngine..."
./scripts/setup-ome-ssl.sh

# Construir e iniciar serviços
echo "🏗️ Construindo e iniciando serviços..."
cd yustream-react
npm run build
cd ..

docker compose up -d

# Aguardar serviços estarem prontos
echo "⏳ Aguardando serviços estarem prontos..."
sleep 30

# Verificar se tudo está funcionando
echo "🔍 Verificando se os serviços estão funcionando..."

# Verificar Nginx
if curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN" | grep -q "200"; then
    echo "✅ Nginx com SSL funcionando"
else
    echo "⚠️ Nginx pode não estar funcionando corretamente"
fi

# Verificar API
if curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/api/health" | grep -q "200"; then
    echo "✅ API funcionando"
else
    echo "⚠️ API pode não estar funcionando corretamente"
fi

# Verificar OME
if curl -k -s -o /dev/null -w "%{http_code}" "https://$DOMAIN:8443/live/live/abr.m3u8" | grep -q "200"; then
    echo "✅ OvenMediaEngine com SSL funcionando"
else
    echo "⚠️ OvenMediaEngine pode não estar funcionando corretamente"
fi

echo ""
echo "🎉 Configuração SSL concluída com sucesso!"
echo ""
echo "📋 URLs disponíveis:"
echo "   - Site principal: https://$DOMAIN"
echo "   - Configuração Stremio: https://$DOMAIN/configure"
echo "   - API: https://$DOMAIN/api/"
echo "   - Stream HTTP: http://$DOMAIN:8080/live/live/abr.m3u8"
echo "   - Stream HTTPS: https://$DOMAIN:8443/live/live/abr.m3u8"
echo ""
echo "🔧 Comandos úteis:"
echo "   - Ver logs: docker compose logs -f"
echo "   - Renovar SSL: ./scripts/renew-ssl.sh"
echo "   - Verificar certificados: docker run --rm -v $(pwd)/ssl/letsencrypt:/etc/letsencrypt certbot/certbot certificates"
echo ""
echo "⚠️ Importante:"
echo "   - Os certificados serão renovados automaticamente via cron job"
echo "   - Verifique os logs em ./logs/ssl-renewal.log"
echo "   - Configure o firewall para permitir as portas 80, 443, 8080, 8443, 3333, 3334"
echo ""
