#!/bin/bash

# Script para configurar firewall para YuStream com SSL
# Este script configura o UFW (Uncomplicated Firewall) para permitir as portas necessárias

set -e

echo "🔥 Configurando firewall para YuStream..."

# Verificar se UFW está instalado
if ! command -v ufw &> /dev/null; then
    echo "📦 Instalando UFW..."
    apt-get update
    apt-get install -y ufw
fi

# Resetar configurações do UFW
echo "🔄 Resetando configurações do firewall..."
ufw --force reset

# Configurar políticas padrão
echo "⚙️ Configurando políticas padrão..."
ufw default deny incoming
ufw default allow outgoing

# Permitir SSH (importante para não perder acesso)
echo "🔐 Permitindo SSH..."
ufw allow ssh
ufw allow 22/tcp

# Permitir portas HTTP e HTTPS
echo "🌐 Permitindo HTTP e HTTPS..."
ufw allow 80/tcp
ufw allow 443/tcp

# Permitir portas do OvenMediaEngine
echo "📺 Permitindo portas do OvenMediaEngine..."
ufw allow 1935/tcp    # RTMP
ufw allow 8080/tcp    # HLS HTTP
ufw allow 8443/tcp    # HLS HTTPS
ufw allow 3333/tcp    # WebRTC Signaling
ufw allow 3334/tcp    # WebRTC Signaling TLS
ufw allow 9999/tcp    # RTMP over WebSocket

# Permitir portas UDP do WebRTC
echo "📡 Permitindo portas UDP do WebRTC..."
ufw allow 10000:10005/udp

# Permitir MongoDB (apenas localmente)
echo "🗄️ Permitindo MongoDB (local)..."
ufw allow from 172.16.0.0/12 to any port 27017

# Habilitar UFW
echo "✅ Habilitando firewall..."
ufw --force enable

# Mostrar status
echo ""
echo "📋 Status do firewall:"
ufw status verbose

echo ""
echo "🎉 Firewall configurado com sucesso!"
echo ""
echo "📋 Portas abertas:"
echo "   - 22/tcp (SSH)"
echo "   - 80/tcp (HTTP)"
echo "   - 443/tcp (HTTPS)"
echo "   - 1935/tcp (RTMP)"
echo "   - 8080/tcp (HLS HTTP)"
echo "   - 8443/tcp (HLS HTTPS)"
echo "   - 3333/tcp (WebRTC Signaling)"
echo "   - 3334/tcp (WebRTC Signaling TLS)"
echo "   - 9999/tcp (RTMP over WebSocket)"
echo "   - 10000-10005/udp (WebRTC ICE)"
echo "   - 27017/tcp (MongoDB - apenas local)"
echo ""
echo "⚠️ Importante:"
echo "   - Certifique-se de que o SSH está funcionando antes de aplicar o firewall"
echo "   - Para desabilitar o firewall: sudo ufw disable"
echo "   - Para ver logs: sudo ufw status verbose"
echo ""
