#!/bin/bash

# Script para verificar DNS e conectividade antes de configurar SSL

set -e

DOMAIN="yustream.yurisp.com.br"

echo "🔍 Verificando DNS e conectividade para $DOMAIN..."
echo "=================================================="

# Verificar resolução DNS
echo "📡 Verificando resolução DNS..."
if nslookup $DOMAIN > /dev/null 2>&1; then
    echo "✅ DNS resolvendo corretamente"
    nslookup $DOMAIN
else
    echo "❌ Erro: DNS não está resolvendo"
    echo "   Configure o DNS para apontar para este servidor:"
    echo "   A record: $DOMAIN -> $(curl -s ifconfig.me)"
    exit 1
fi

# Verificar se o domínio aponta para este servidor
echo ""
echo "🌐 Verificando se o domínio aponta para este servidor..."
SERVER_IP=$(curl -s ifconfig.me)
DOMAIN_IP=$(nslookup $DOMAIN | grep -A1 "Name:" | tail -1 | awk '{print $2}')

echo "   IP do servidor: $SERVER_IP"
echo "   IP do domínio: $DOMAIN_IP"

if [ "$SERVER_IP" = "$DOMAIN_IP" ]; then
    echo "✅ Domínio aponta corretamente para este servidor"
else
    echo "❌ Erro: Domínio não aponta para este servidor"
    echo "   Configure o DNS para apontar para: $SERVER_IP"
    exit 1
fi

# Verificar conectividade HTTP
echo ""
echo "🔗 Verificando conectividade HTTP..."
if curl -s -o /dev/null -w "%{http_code}" "http://$DOMAIN" | grep -q "200\|301\|302\|404"; then
    echo "✅ Conectividade HTTP funcionando"
else
    echo "⚠️ Aviso: Conectividade HTTP pode não estar funcionando"
    echo "   Verifique se o Nginx está rodando e configurado corretamente"
fi

# Verificar portas
echo ""
echo "🔌 Verificando portas..."
if netstat -tlnp | grep -q ":80 "; then
    echo "✅ Porta 80 está em uso"
else
    echo "⚠️ Porta 80 não está em uso (necessário para validação SSL)"
fi

if netstat -tlnp | grep -q ":443 "; then
    echo "✅ Porta 443 está em uso"
else
    echo "ℹ️ Porta 443 não está em uso (será usada após SSL)"
fi

# Verificar firewall
echo ""
echo "🔥 Verificando firewall..."
if command -v ufw &> /dev/null; then
    UFW_STATUS=$(ufw status | head -1)
    echo "   Status UFW: $UFW_STATUS"
    
    if ufw status | grep -q "80/tcp"; then
        echo "✅ Porta 80 permitida no firewall"
    else
        echo "⚠️ Porta 80 pode não estar permitida no firewall"
    fi
    
    if ufw status | grep -q "443/tcp"; then
        echo "✅ Porta 443 permitida no firewall"
    else
        echo "⚠️ Porta 443 pode não estar permitida no firewall"
    fi
else
    echo "ℹ️ UFW não está instalado"
fi

# Verificar serviços Docker
echo ""
echo "🐳 Verificando serviços Docker..."
if docker compose ps | grep -q "nginx"; then
    echo "✅ Nginx está rodando"
else
    echo "⚠️ Nginx não está rodando"
fi

if docker compose ps | grep -q "ovenmediaengine"; then
    echo "✅ OvenMediaEngine está rodando"
else
    echo "⚠️ OvenMediaEngine não está rodando"
fi

# Teste de validação Let's Encrypt
echo ""
echo "🔐 Testando validação Let's Encrypt..."
mkdir -p ./ssl/certbot/www/.well-known/acme-challenge
echo "test-file" > ./ssl/certbot/www/.well-known/acme-challenge/test

if curl -s "http://$DOMAIN/.well-known/acme-challenge/test" | grep -q "test-file"; then
    echo "✅ Validação Let's Encrypt funcionando"
    rm -f ./ssl/certbot/www/.well-known/acme-challenge/test
else
    echo "❌ Erro: Validação Let's Encrypt não está funcionando"
    echo "   Verifique se o Nginx está configurado para servir /.well-known/acme-challenge/"
    rm -f ./ssl/certbot/www/.well-known/acme-challenge/test
fi

echo ""
echo "📋 Resumo da verificação:"
echo "   - DNS: $(nslookup $DOMAIN > /dev/null 2>&1 && echo "✅ OK" || echo "❌ ERRO")"
echo "   - IP correto: $([ "$SERVER_IP" = "$DOMAIN_IP" ] && echo "✅ OK" || echo "❌ ERRO")"
echo "   - HTTP: $(curl -s -o /dev/null -w "%{http_code}" "http://$DOMAIN" | grep -q "200\|301\|302\|404" && echo "✅ OK" || echo "⚠️ AVISO")"
echo "   - Validação LE: $(curl -s "http://$DOMAIN/.well-known/acme-challenge/test" > /dev/null 2>&1 && echo "✅ OK" || echo "❌ ERRO")"

echo ""
echo "🎯 Próximos passos:"
if [ "$SERVER_IP" = "$DOMAIN_IP" ] && nslookup $DOMAIN > /dev/null 2>&1; then
    echo "   ✅ DNS configurado corretamente"
    echo "   🚀 Pode prosseguir com a configuração SSL:"
    echo "      sudo ./scripts/setup-ssl-standalone.sh"
else
    echo "   ❌ Configure o DNS primeiro:"
    echo "      A record: $DOMAIN -> $SERVER_IP"
    echo "   ⏳ Aguarde a propagação DNS (pode levar até 24h)"
fi
echo ""
