#!/bin/bash
# webOS Deploy Script

echo "📦 Criando pacote webOS..."
ares-package package

echo "📱 Instalando no dispositivo..."
# ares-install com.yustream.tv_1.0.0_all.ipk -d [DEVICE_NAME]

echo "🚀 Iniciando aplicação..."
# ares-launch com.yustream.tv -d [DEVICE_NAME]

echo "✅ Deploy concluído!"
