#!/bin/bash

# Script para configurar certificados SSL no OvenMediaEngine
# Este script deve ser executado após a obtenção dos certificados SSL

set -e

DOMAIN="yustream.yurisp.com.br"
SSL_DIR="./ssl/letsencrypt/live/$DOMAIN"
OME_SSL_DIR="./ome-config/ssl"

echo "🔐 Configurando SSL no OvenMediaEngine para $DOMAIN..."

# Verificar se os certificados existem
if [ ! -f "$SSL_DIR/fullchain.pem" ] || [ ! -f "$SSL_DIR/privkey.pem" ]; then
    echo "❌ Erro: Certificados SSL não encontrados em $SSL_DIR"
    echo "   Execute primeiro o script setup-ssl.sh"
    exit 1
fi

# Criar diretório SSL para OME
echo "📁 Criando diretório SSL para OME..."
mkdir -p "$OME_SSL_DIR"

# Copiar certificados para OME
echo "📋 Copiando certificados para OME..."
cp "$SSL_DIR/fullchain.pem" "$OME_SSL_DIR/cert.pem"
cp "$SSL_DIR/privkey.pem" "$OME_SSL_DIR/key.pem"
cp "$SSL_DIR/chain.pem" "$OME_SSL_DIR/chain.pem"

# Verificar permissões
echo "🔒 Configurando permissões..."
chmod 644 "$OME_SSL_DIR/cert.pem"
chmod 600 "$OME_SSL_DIR/key.pem"
chmod 644 "$OME_SSL_DIR/chain.pem"

# Atualizar configuração do OME
echo "⚙️ Atualizando configuração do OME..."
sed -i "s|/opt/ovenmediaengine/bin/ssl_conf/cert.pem|/opt/ovenmediaengine/bin/ssl_conf/ssl/cert.pem|g" ome-config/Server.xml
sed -i "s|/opt/ovenmediaengine/bin/ssl_conf/key.pem|/opt/ovenmediaengine/bin/ssl_conf/ssl/key.pem|g" ome-config/Server.xml
sed -i "s|/opt/ovenmediaengine/bin/ssl_conf/chain.pem|/opt/ovenmediaengine/bin/ssl_conf/ssl/chain.pem|g" ome-config/Server.xml

# Reiniciar OME
echo "🔄 Reiniciando OvenMediaEngine..."
docker compose restart ovenmediaengine

# Aguardar OME estar pronto
echo "⏳ Aguardando OME estar pronto..."
sleep 10

# Verificar se OME está funcionando com SSL
echo "🔍 Verificando se OME está funcionando com SSL..."
if curl -k -s "https://localhost:8443/live/live/abr.m3u8" > /dev/null; then
    echo "✅ OME configurado com SSL com sucesso!"
else
    echo "⚠️ Aviso: OME pode não estar respondendo via HTTPS ainda."
    echo "   Verifique os logs: docker compose logs ovenmediaengine"
fi

echo ""
echo "🎉 Configuração SSL do OME concluída!"
echo ""
echo "📋 URLs disponíveis:"
echo "   - HTTP: http://$DOMAIN:8080/live/live/abr.m3u8"
echo "   - HTTPS: https://$DOMAIN:8443/live/live/abr.m3u8"
echo ""
echo "🔧 Para verificar os logs do OME:"
echo "   docker compose logs -f ovenmediaengine"
echo ""
