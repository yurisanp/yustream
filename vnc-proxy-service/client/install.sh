#!/bin/bash

# Script de instalação do Cliente VNC YuStream
# Compatível com Linux e macOS

set -e

echo "=== Instalação do Cliente VNC YuStream ==="

# Detectar sistema operacional
OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    CYGWIN*)    MACHINE=Cygwin;;
    MINGW*)     MACHINE=MinGw;;
    *)          MACHINE="UNKNOWN:${OS}"
esac

echo "Sistema detectado: ${MACHINE}"

# Verificar se Python está instalado
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 não encontrado. Por favor, instale Python 3.7 ou superior."
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
echo "✅ Python ${PYTHON_VERSION} encontrado"

# Verificar se pip está instalado
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 não encontrado. Instalando..."
    
    if [[ "$MACHINE" == "Linux" ]]; then
        if command -v apt-get &> /dev/null; then
            sudo apt-get update
            sudo apt-get install -y python3-pip
        elif command -v yum &> /dev/null; then
            sudo yum install -y python3-pip
        elif command -v dnf &> /dev/null; then
            sudo dnf install -y python3-pip
        else
            echo "❌ Não foi possível instalar pip3 automaticamente. Instale manualmente."
            exit 1
        fi
    elif [[ "$MACHINE" == "Mac" ]]; then
        if command -v brew &> /dev/null; then
            brew install python3
        else
            echo "❌ Homebrew não encontrado. Instale Python 3 manualmente."
            exit 1
        fi
    fi
fi

echo "✅ pip3 disponível"

# Instalar dependências Python
echo "📦 Instalando dependências Python..."
pip3 install --user requests

# Configurar servidor VNC baseado no sistema
if [[ "$MACHINE" == "Linux" ]]; then
    echo "🖥️ Configurando VNC para Linux..."
    
    # Verificar se x11vnc está instalado
    if ! command -v x11vnc &> /dev/null; then
        echo "📦 Instalando x11vnc..."
        
        if command -v apt-get &> /dev/null; then
            sudo apt-get update
            sudo apt-get install -y x11vnc
        elif command -v yum &> /dev/null; then
            sudo yum install -y x11vnc
        elif command -v dnf &> /dev/null; then
            sudo dnf install -y x11vnc
        elif command -v pacman &> /dev/null; then
            sudo pacman -S x11vnc
        else
            echo "⚠️ Não foi possível instalar x11vnc automaticamente."
            echo "   Instale manualmente: sudo apt-get install x11vnc"
        fi
    else
        echo "✅ x11vnc já está instalado"
    fi
    
elif [[ "$MACHINE" == "Mac" ]]; then
    echo "🖥️ Configurando VNC para macOS..."
    echo "ℹ️ macOS usa Screen Sharing nativo. Será configurado automaticamente."
    
    # Verificar se Screen Sharing está habilitado
    if sudo launchctl list | grep -q com.apple.screensharing; then
        echo "✅ Screen Sharing já está habilitado"
    else
        echo "⚠️ Screen Sharing não está habilitado."
        echo "   Execute: sudo launchctl load -w /System/Library/LaunchDaemons/com.apple.screensharing.plist"
    fi
fi

# Criar diretório de instalação
INSTALL_DIR="$HOME/yustream-vnc-client"
mkdir -p "$INSTALL_DIR"

# Baixar arquivo de configuração de exemplo se não existir
if [[ ! -f "$INSTALL_DIR/vnc-client.config.json" ]]; then
    echo "📄 Criando arquivo de configuração..."
    cat > "$INSTALL_DIR/vnc-client.config.json" << 'EOF'
{
  "server_url": "https://your-yustream-server.com",
  "register_token": "yustream-vnc-register-token-change-in-production",
  "machine_name": "Streaming-PC-01",
  "vnc_port": 5900,
  "monitors": 1,
  "ssh_enabled": true,
  "ssh_port": 22,
  "ssh_username": "",
  "ssh_password": "",
  "ssh_private_key_path": "",
  "heartbeat_interval": 30,
  "auto_start_vnc": true,
  "vnc_password": "",
  "display": ":0"
}
EOF
fi

# Copiar script principal se estiver no mesmo diretório
if [[ -f "vnc-client.py" ]]; then
    cp vnc-client.py "$INSTALL_DIR/"
    chmod +x "$INSTALL_DIR/vnc-client.py"
    echo "✅ Cliente VNC copiado para $INSTALL_DIR"
else
    echo "⚠️ vnc-client.py não encontrado no diretório atual"
    echo "   Baixe manualmente de: https://your-yustream-server.com/vnc-client.py"
fi

# Criar script de inicialização
cat > "$INSTALL_DIR/start.sh" << EOF
#!/bin/bash
cd "$INSTALL_DIR"
python3 vnc-client.py "\$@"
EOF

chmod +x "$INSTALL_DIR/start.sh"

# Criar script de configuração
cat > "$INSTALL_DIR/configure.sh" << EOF
#!/bin/bash
cd "$INSTALL_DIR"
python3 vnc-client.py --setup
EOF

chmod +x "$INSTALL_DIR/configure.sh"

# Criar serviço systemd (apenas Linux)
if [[ "$MACHINE" == "Linux" ]] && command -v systemctl &> /dev/null; then
    echo "🔧 Criando serviço systemd..."
    
    SERVICE_FILE="$HOME/.config/systemd/user/yustream-vnc-client.service"
    mkdir -p "$(dirname "$SERVICE_FILE")"
    
    cat > "$SERVICE_FILE" << EOF
[Unit]
Description=YuStream VNC Client
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/start.sh
Restart=always
RestartSec=10
Environment=HOME=$HOME

[Install]
WantedBy=default.target
EOF
    
    # Recarregar systemd e habilitar serviço
    systemctl --user daemon-reload
    systemctl --user enable yustream-vnc-client.service
    
    echo "✅ Serviço systemd criado e habilitado"
    echo "   Iniciar: systemctl --user start yustream-vnc-client"
    echo "   Status:  systemctl --user status yustream-vnc-client"
    echo "   Logs:    journalctl --user -f -u yustream-vnc-client"
fi

echo ""
echo "🎉 Instalação concluída!"
echo ""
echo "📁 Arquivos instalados em: $INSTALL_DIR"
echo ""
echo "📋 Próximos passos:"
echo "1. Configure o cliente: $INSTALL_DIR/configure.sh"
echo "2. Inicie o cliente: $INSTALL_DIR/start.sh"
echo ""
echo "📖 Para mais informações, consulte a documentação:"
echo "   VNC_REMOTE_ACCESS_DOCUMENTATION.md"
echo ""

# Perguntar se quer executar configuração agora
read -p "Deseja executar a configuração agora? (s/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    cd "$INSTALL_DIR"
    python3 vnc-client.py --setup
fi

echo "✅ Instalação finalizada!"
