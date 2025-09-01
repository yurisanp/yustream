#!/bin/bash

echo "========================================"
echo "       Yustream - Servidor de Streaming"
echo "========================================"
echo

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "ERRO: Docker não encontrado. Por favor, instale o Docker."
    echo "Ubuntu/Debian: sudo apt-get install docker.io docker-compose"
    echo "CentOS/RHEL: sudo yum install docker docker-compose"
    echo "macOS: Instale Docker Desktop"
    exit 1
fi

# Verificar se Docker Compose está instalado
if ! command -v docker-compose &> /dev/null; then
    echo "ERRO: Docker Compose não encontrado."
    echo "Instale com: sudo apt-get install docker-compose"
    exit 1
fi

# Verificar se Docker está rodando
if ! docker info &> /dev/null; then
    echo "ERRO: Docker não está rodando. Inicie o serviço Docker."
    echo "sudo systemctl start docker"
    exit 1
fi

echo "Criando diretórios necessários..."
mkdir -p ant-media-data logs ssl

echo
echo "Iniciando serviços..."
docker-compose up -d

echo
echo "Aguardando inicialização dos serviços..."
sleep 15

# Verificar se os containers estão rodando
if docker-compose ps | grep -q "Up"; then
    echo
    echo "========================================"
    echo "           Serviços Iniciados!"
    echo "========================================"
    echo
    echo "Interface Web: http://localhost"
    echo "Admin Panel:   http://localhost:5080"
    echo
    echo "Para OBS Studio:"
    echo "  Servidor RTMP: rtmp://localhost:1935/live"
    echo "  Chave Stream:  live (stream padrão única)"
    echo
    echo "Para VLC Player:"
    echo "  URL HLS:  http://localhost/live/streams/live.m3u8"
    echo "  URL RTMP: rtmp://localhost:1935/live/live"
    echo
    echo "Stream Player Web: http://localhost (auto-play ativado)"
    echo
    echo "Comandos úteis:"
    echo "  Parar serviços: docker-compose down"
    echo "  Ver logs:       docker-compose logs"
    echo "  Status:         docker-compose ps"
    echo
    echo "========================================"
else
    echo "ERRO: Falha ao iniciar os serviços."
    echo "Verifique os logs com: docker-compose logs"
fi
