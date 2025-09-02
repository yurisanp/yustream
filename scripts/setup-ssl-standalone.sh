#!/bin/bash

# Script para configurar SSL usando método standalone do Certbot
# Este método é mais confiável pois não depende do Nginx estar funcionando

set -e

DOMAIN="yustream.yurisp.com.br"
EMAIL="admin@yurisp.com.br"  # Substitua pelo seu email

echo "🔐 Configurando SSL usando método standalone para $DOMAIN..."

# Verificar se o domínio está resolvendo corretamente
echo "📡 Verificando resolução DNS..."
if ! nslookup $DOMAIN > /dev/null 2>&1; then
    echo "❌ Erro: O domínio $DOMAIN não está resolvendo corretamente."
    echo "   Certifique-se de que o DNS está configurado antes de continuar."
    exit 1
fi

echo "✅ DNS configurado corretamente."

# Parar todos os serviços que usam as portas 80 e 443
echo "⏸️ Parando serviços que usam portas 80 e 443..."
docker compose down

# Verificar se as portas estão livres
echo "🔍 Verificando se as portas 80 e 443 estão livres..."
if lsof -i :80 > /dev/null 2>&1; then
    echo "❌ Erro: A porta 80 está em uso. Pare o serviço que está usando esta porta."
    lsof -i :80
    exit 1
fi

if lsof -i :443 > /dev/null 2>&1; then
    echo "❌ Erro: A porta 443 está em uso. Pare o serviço que está usando esta porta."
    lsof -i :443
    exit 1
fi

echo "✅ Portas 80 e 443 estão livres."

# Criar diretório para certificados
echo "📁 Criando diretórios para certificados..."
mkdir -p ./ssl/letsencrypt/live
mkdir -p ./ssl/letsencrypt/archive
mkdir -p ./ssl/letsencrypt/renewal

# Obter certificados SSL usando método standalone
echo "🔐 Obtendo certificados SSL do Let's Encrypt usando método standalone..."
docker run --rm \
    -p 80:80 \
    -p 443:443 \
    -v "$(pwd)/ssl/letsencrypt:/etc/letsencrypt" \
    certbot/certbot certonly \
    --standalone \
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

# Configurar renovação automática
echo "🔄 Configurando renovação automática..."
cat > scripts/renew-ssl-standalone.sh << 'EOF'
#!/bin/bash

# Script para renovar certificados SSL automaticamente usando método standalone

DOMAIN="yustream.yurisp.com.br"

echo "🔄 Verificando renovação de certificados SSL..."

# Verificar se os certificados expiram em menos de 30 dias
if docker run --rm \
    -v "$(pwd)/ssl/letsencrypt:/etc/letsencrypt" \
    certbot/certbot certificates | grep -q "VALID: 30 days"; then
    
    echo "🔐 Renovando certificados SSL..."
    
    # Parar serviços
    docker compose down
    
    # Renovar certificados
    docker run --rm \
        -p 80:80 \
        -p 443:443 \
        -v "$(pwd)/ssl/letsencrypt:/etc/letsencrypt" \
        certbot/certbot renew \
        --standalone
    
    # Reiniciar serviços
    docker compose up -d
    
    echo "✅ Certificados renovados com sucesso!"
else
    echo "ℹ️ Certificados ainda válidos, não é necessário renovar."
fi
EOF

chmod +x scripts/renew-ssl-standalone.sh

# Adicionar cron job para renovação automática
echo "⏰ Configurando cron job para renovação automática..."
(crontab -l 2>/dev/null; echo "0 3 * * * $(pwd)/scripts/renew-ssl-standalone.sh >> $(pwd)/logs/ssl-renewal.log 2>&1") | crontab -

# Iniciar serviços com SSL
echo "🚀 Iniciando serviços com SSL..."
docker compose up -d

echo ""
echo "🎉 SSL configurado com sucesso usando método standalone!"
echo ""
echo "📋 Próximos passos:"
echo "   1. Acesse https://$DOMAIN para verificar o SSL"
echo "   2. Os certificados serão renovados automaticamente"
echo ""
echo "🔧 Comandos úteis:"
echo "   - Verificar certificados: docker run --rm -v $(pwd)/ssl/letsencrypt:/etc/letsencrypt certbot/certbot certificates"
echo "   - Renovar manualmente: ./scripts/renew-ssl-standalone.sh"
echo "   - Ver logs de renovação: tail -f logs/ssl-renewal.log"
echo ""
