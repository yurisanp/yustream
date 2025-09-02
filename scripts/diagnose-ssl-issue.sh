#!/bin/bash

# Script para diagnosticar problemas de SSL com Let's Encrypt

set -e

DOMAIN="yustream.yurisp.com.br"

echo "🔍 Diagnosticando problema de SSL para $DOMAIN..."
echo "=============================================="

# 1. Verificar DNS
echo "1️⃣ Verificando DNS..."
if nslookup $DOMAIN > /dev/null 2>&1; then
    echo "✅ DNS resolvendo"
    DOMAIN_IP=$(nslookup $DOMAIN | grep -A1 "Name:" | tail -1 | awk '{print $2}')
    echo "   IP do domínio: $DOMAIN_IP"
else
    echo "❌ DNS não resolvendo"
    exit 1
fi

# 2. Verificar se aponta para este servidor
echo ""
echo "2️⃣ Verificando se aponta para este servidor..."
SERVER_IP=$(curl -s ifconfig.me)
echo "   IP do servidor: $SERVER_IP"

if [ "$SERVER_IP" = "$DOMAIN_IP" ]; then
    echo "✅ Domínio aponta para este servidor"
else
    echo "❌ Domínio NÃO aponta para este servidor"
    echo "   Configure o DNS: A record $DOMAIN -> $SERVER_IP"
    exit 1
fi

# 3. Verificar se as portas estão livres
echo ""
echo "3️⃣ Verificando portas 80 e 443..."
if lsof -i :80 > /dev/null 2>&1; then
    echo "⚠️ Porta 80 em uso:"
    lsof -i :80
    echo "   Pare o serviço que está usando a porta 80"
else
    echo "✅ Porta 80 livre"
fi

if lsof -i :443 > /dev/null 2>&1; then
    echo "⚠️ Porta 443 em uso:"
    lsof -i :443
    echo "   Pare o serviço que está usando a porta 443"
else
    echo "✅ Porta 443 livre"
fi

# 4. Verificar conectividade externa
echo ""
echo "4️⃣ Verificando conectividade externa..."
if curl -s -o /dev/null -w "%{http_code}" "http://$DOMAIN" | grep -q "200\|301\|302\|404"; then
    echo "✅ Conectividade HTTP funcionando"
else
    echo "❌ Conectividade HTTP não funcionando"
    echo "   Teste manual: curl -I http://$DOMAIN"
fi

# 5. Verificar se o Nginx está configurado corretamente
echo ""
echo "5️⃣ Verificando configuração do Nginx..."
if [ -f "nginx/conf.d/streaming.conf" ]; then
    if grep -q "server_name.*$DOMAIN" nginx/conf.d/streaming.conf; then
        echo "✅ Nginx configurado para o domínio"
    else
        echo "⚠️ Nginx pode não estar configurado para o domínio"
    fi
else
    echo "❌ Arquivo de configuração do Nginx não encontrado"
fi

# 6. Testar validação Let's Encrypt
echo ""
echo "6️⃣ Testando validação Let's Encrypt..."
mkdir -p ./ssl/certbot/www/.well-known/acme-challenge
echo "test-validation" > ./ssl/certbot/www/.well-known/acme-challenge/test

# Verificar se o Nginx está servindo o arquivo de teste
if curl -s "http://$DOMAIN/.well-known/acme-challenge/test" | grep -q "test-validation"; then
    echo "✅ Validação Let's Encrypt funcionando"
else
    echo "❌ Validação Let's Encrypt NÃO funcionando"
    echo "   Verifique se o Nginx está configurado para servir /.well-known/acme-challenge/"
    echo "   Teste manual: curl http://$DOMAIN/.well-known/acme-challenge/test"
fi

rm -f ./ssl/certbot/www/.well-known/acme-challenge/test

# 7. Verificar logs do Nginx
echo ""
echo "7️⃣ Verificando logs do Nginx..."
if docker compose ps | grep -q "nginx"; then
    echo "✅ Nginx está rodando"
    echo "   Últimas linhas dos logs:"
    docker compose logs --tail=10 nginx
else
    echo "❌ Nginx não está rodando"
fi

# 8. Sugestões de correção
echo ""
echo "🔧 Sugestões de correção:"
echo "========================="

if [ "$SERVER_IP" != "$DOMAIN_IP" ]; then
    echo "1. Configure o DNS:"
    echo "   A record: $DOMAIN -> $SERVER_IP"
    echo "   Aguarde a propagação DNS (pode levar até 24h)"
fi

if lsof -i :80 > /dev/null 2>&1; then
    echo "2. Pare o serviço que está usando a porta 80:"
    echo "   sudo systemctl stop apache2  # se for Apache"
    echo "   sudo systemctl stop nginx    # se for Nginx do sistema"
    echo "   docker compose down          # se for Docker"
fi

if ! curl -s "http://$DOMAIN/.well-known/acme-challenge/test" | grep -q "test-validation"; then
    echo "3. Configure o Nginx para servir /.well-known/acme-challenge/:"
    echo "   Adicione ao nginx/conf.d/streaming.conf:"
    echo "   location /.well-known/acme-challenge/ {"
    echo "       root /var/www/certbot;"
    echo "   }"
fi

echo ""
echo "4. Use o método standalone (mais confiável):"
echo "   sudo ./scripts/setup-ssl-standalone.sh"

echo ""
echo "5. Ou use o método webroot (após corrigir o Nginx):"
echo "   sudo ./scripts/setup-ssl.sh"

echo ""
echo "📞 Se o problema persistir:"
echo "   - Verifique os logs: docker compose logs nginx"
echo "   - Teste manualmente: curl -I http://$DOMAIN"
echo "   - Verifique o firewall: sudo ufw status"
echo ""
