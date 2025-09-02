#!/bin/bash

# Script para configurar SSL automaticamente para yustream.yurisp.com.br
# Este script deve ser executado no servidor onde o domínio está configurado

set -e

DOMAIN="yustream.yurisp.com.br"
EMAIL="admin@yurisp.com.br"  # Substitua pelo seu email
NGINX_CONTAINER="nginx-proxy"

echo "🔐 Configurando SSL para $DOMAIN..."

# Verificar se o domínio está resolvendo corretamente
echo "📡 Verificando resolução DNS..."
if ! nslookup $DOMAIN > /dev/null 2>&1; then
    echo "❌ Erro: O domínio $DOMAIN não está resolvendo corretamente."
    echo "   Certifique-se de que o DNS está configurado antes de continuar."
    exit 1
fi

echo "✅ DNS configurado corretamente."

# Parar o container nginx temporariamente
echo "⏸️ Parando container Nginx..."
docker compose stop nginx

# Criar diretório para certificados
echo "📁 Criando diretórios para certificados..."
mkdir -p ./ssl/letsencrypt/live
mkdir -p ./ssl/letsencrypt/archive
mkdir -p ./ssl/letsencrypt/renewal
mkdir -p ./ssl/certbot/www

# Configurar Nginx temporário para validação
echo "🔧 Configurando Nginx temporário para validação..."
cat > nginx/conf.d/temp-ssl.conf << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 200 'SSL setup in progress...';
        add_header Content-Type text/plain;
    }
}
EOF

# Iniciar Nginx temporário
echo "🚀 Iniciando Nginx temporário..."
docker compose up -d nginx

# Aguardar Nginx estar pronto
echo "⏳ Aguardando Nginx estar pronto..."
sleep 10

# Obter certificados SSL
echo "🔐 Obtendo certificados SSL do Let's Encrypt..."
docker run --rm \
    -v "$(pwd)/ssl/letsencrypt:/etc/letsencrypt" \
    -v "$(pwd)/ssl/certbot/www:/var/www/certbot" \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d $DOMAIN

# Verificar se os certificados foram criados
if [ ! -f "./ssl/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "❌ Erro: Certificados SSL não foram criados."
    exit 1
fi

echo "✅ Certificados SSL obtidos com sucesso!"

# Parar Nginx temporário
echo "⏸️ Parando Nginx temporário..."
docker compose stop nginx

# Remover configuração temporária
rm -f nginx/conf.d/temp-ssl.conf

# Configurar renovação automática
echo "🔄 Configurando renovação automática..."
cat > scripts/renew-ssl.sh << 'EOF'
#!/bin/bash

# Script para renovar certificados SSL automaticamente

DOMAIN="yustream.yurisp.com.br"

echo "🔄 Verificando renovação de certificados SSL..."

# Verificar se os certificados expiram em menos de 30 dias
if docker run --rm \
    -v "$(pwd)/ssl/letsencrypt:/etc/letsencrypt" \
    certbot/certbot certificates | grep -q "VALID: 30 days"; then
    
    echo "🔐 Renovando certificados SSL..."
    
    # Parar Nginx
    docker compose stop nginx
    
    # Renovar certificados
    docker run --rm \
        -v "$(pwd)/ssl/letsencrypt:/etc/letsencrypt" \
        -v "$(pwd)/ssl/certbot/www:/var/www/certbot" \
        certbot/certbot renew \
        --webroot \
        --webroot-path=/var/www/certbot
    
    # Reiniciar Nginx
    docker compose start nginx
    
    echo "✅ Certificados renovados com sucesso!"
else
    echo "ℹ️ Certificados ainda válidos, não é necessário renovar."
fi
EOF

chmod +x scripts/renew-ssl.sh

# Adicionar cron job para renovação automática
echo "⏰ Configurando cron job para renovação automática..."
(crontab -l 2>/dev/null; echo "0 3 * * * $(pwd)/scripts/renew-ssl.sh >> $(pwd)/logs/ssl-renewal.log 2>&1") | crontab -

# Iniciar serviços com SSL
echo "🚀 Iniciando serviços com SSL..."
docker compose up -d

echo ""
echo "🎉 SSL configurado com sucesso!"
echo ""
echo "📋 Próximos passos:"
echo "   1. Acesse https://$DOMAIN para verificar o SSL"
echo "   2. Configure o DNS do seu domínio para apontar para este servidor"
echo "   3. Os certificados serão renovados automaticamente"
echo ""
echo "🔧 Comandos úteis:"
echo "   - Verificar certificados: docker run --rm -v $(pwd)/ssl/letsencrypt:/etc/letsencrypt certbot/certbot certificates"
echo "   - Renovar manualmente: ./scripts/renew-ssl.sh"
echo "   - Ver logs de renovação: tail -f logs/ssl-renewal.log"
echo ""
