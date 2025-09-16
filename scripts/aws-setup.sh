#!/bin/bash

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log "🚀 Iniciando configuração da instância AWS para Yustream..."

# Detectar distribuição
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
fi

# Verificar se está rodando como ec2-user (Amazon Linux) ou usuário correto
if [ "$USER" != "ec2-user" ] && [ "$USER" != "centos" ] && [ "$USER" != "root" ]; then
    error "Este script deve ser executado como usuário ec2-user (Amazon Linux) ou centos"
    exit 1
fi

log "Sistema detectado: $OS $VER"

# Atualizar sistema
log "📦 Atualizando sistema..."
if command -v yum &> /dev/null; then
    sudo yum update -y
elif command -v dnf &> /dev/null; then
    sudo dnf update -y
else
    error "Gerenciador de pacotes não suportado"
    exit 1
fi

# Instalar Docker
log "🐳 Instalando Docker..."
if ! command -v docker &> /dev/null; then
    if command -v yum &> /dev/null; then
        # Amazon Linux 2
        sudo yum install -y docker
        sudo systemctl start docker
        sudo systemctl enable docker
        sudo usermod -aG docker $USER
    elif command -v dnf &> /dev/null; then
        # Amazon Linux 2023 ou Fedora
        sudo dnf install -y docker
        sudo systemctl start docker
        sudo systemctl enable docker
        sudo usermod -aG docker $USER
    else
        # Fallback para script universal
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER
        rm get-docker.sh
    fi
    success "Docker instalado com sucesso"
else
    warning "Docker já está instalado"
fi

# Instalar Docker Compose
log "🔧 Instalando Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    success "Docker Compose instalado com sucesso"
else
    warning "Docker Compose já está instalado"
fi

# Instalar Node.js
log "📦 Instalando Node.js..."
if ! command -v node &> /dev/null; then
    if command -v yum &> /dev/null; then
        # Amazon Linux 2
        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo yum install -y nodejs
    elif command -v dnf &> /dev/null; then
        # Amazon Linux 2023
        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo dnf install -y nodejs
    fi
    success "Node.js instalado com sucesso"
else
    warning "Node.js já está instalado"
fi

# Instalar dependências adicionais
log "🔧 Instalando dependências adicionais..."
if command -v yum &> /dev/null; then
    sudo yum install -y git htop curl wget unzip tar gzip python3 python3-pip
elif command -v dnf &> /dev/null; then
    sudo dnf install -y git htop curl wget unzip tar gzip python3 python3-pip
fi

# Instalar Certbot
log "🔐 Instalando Certbot..."
if ! command -v certbot &> /dev/null; then
    if command -v yum &> /dev/null; then
        # Amazon Linux 2
        sudo yum install -y certbot python3-certbot-nginx
    elif command -v dnf &> /dev/null; then
        # Amazon Linux 2023
        sudo dnf install -y certbot python3-certbot-nginx
    else
        # Fallback usando pip
        sudo python3 -m pip install certbot certbot-nginx
    fi
    success "Certbot instalado com sucesso"
else
    warning "Certbot já está instalado"
fi

# Criar diretório do projeto
log "📁 Configurando diretório do projeto..."
PROJECT_DIR="/opt/yustream"
if [ ! -d "$PROJECT_DIR" ]; then
    sudo mkdir -p "$PROJECT_DIR"
    sudo chown $USER:$USER "$PROJECT_DIR"
    success "Diretório do projeto criado: $PROJECT_DIR"
else
    warning "Diretório do projeto já existe"
fi

# Criar diretórios necessários
cd "$PROJECT_DIR"
mkdir -p logs backups ssl/certbot/www

# Configurar firewall básico
log "🔥 Configurando firewall..."
if command -v firewall-cmd &> /dev/null; then
    # Amazon Linux/CentOS usa firewalld
    sudo systemctl start firewalld
    sudo systemctl enable firewalld
    sudo firewall-cmd --permanent --add-service=ssh
    sudo firewall-cmd --permanent --add-service=http
    sudo firewall-cmd --permanent --add-service=https
    sudo firewall-cmd --permanent --add-port=1935/tcp  # RTMP
    sudo firewall-cmd --permanent --add-port=8080/tcp  # OME HTTP
    sudo firewall-cmd --permanent --add-port=8443/tcp  # OME HTTPS
    sudo firewall-cmd --reload
    success "Firewall configurado com firewalld"
elif command -v ufw &> /dev/null; then
    # Fallback para ufw se disponível
    sudo ufw --force enable
    sudo ufw allow ssh
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw allow 1935/tcp
    sudo ufw allow 8080/tcp
    sudo ufw allow 8443/tcp
    success "Firewall configurado com ufw"
else
    warning "Firewall não configurado - configure manualmente as regras de segurança"
fi

# Configurar logrotate
log "📋 Configurando logrotate..."
sudo tee /etc/logrotate.d/yustream > /dev/null <<EOF
/opt/yustream/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 $USER $USER
}
EOF

# Configurar crontab para backup
log "⏰ Configurando backup automático..."
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/yustream/scripts/backup.sh") | crontab -

# Configurar swap se necessário
log "💾 Verificando swap..."
if [ $(free | grep Swap | awk '{print $2}') -eq 0 ]; then
    log "Criando arquivo de swap de 2GB..."
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    success "Swap configurado"
else
    warning "Swap já está configurado"
fi

# Configurar limites do sistema
log "⚙️  Configurando limites do sistema..."
sudo tee -a /etc/security/limits.conf > /dev/null <<EOF
$USER soft nofile 65536
$USER hard nofile 65536
$USER soft nproc 32768
$USER hard nproc 32768
ec2-user soft nofile 65536
ec2-user hard nofile 65536
ec2-user soft nproc 32768
ec2-user hard nproc 32768
centos soft nofile 65536
centos hard nofile 65536
centos soft nproc 32768
centos hard nproc 32768
EOF

# Otimizar configurações de rede
log "🌐 Otimizando configurações de rede..."
sudo tee -a /etc/sysctl.conf > /dev/null <<EOF
# Otimizações para streaming
net.core.rmem_default = 262144
net.core.rmem_max = 16777216
net.core.wmem_default = 262144
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_congestion_control = bbr
EOF
sudo sysctl -p

# Criar arquivo de ambiente base
log "📝 Criando arquivos de configuração base..."

# Prompt para configurações
read -p "Digite o domínio principal (ex: yustream.yurisp.com.br): " DOMAIN
read -s -p "Digite uma senha segura para MongoDB: " MONGODB_PASSWORD
echo
read -s -p "Digite uma chave JWT secreta: " JWT_SECRET
echo

# Criar arquivo .env para produção
cat > "$PROJECT_DIR/.env.production" <<EOF
# Configurações de Produção
DOMAIN=$DOMAIN
MONGODB_PASSWORD=$MONGODB_PASSWORD
JWT_SECRET=$JWT_SECRET
WEBHOOK_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)
OME_ACCESS_TOKEN=$(openssl rand -hex 16)
EOF

chmod 600 "$PROJECT_DIR/.env.production"

success "✅ Configuração inicial da AWS concluída!"

log "📋 Próximos passos:"
log "1. Configure o DNS para apontar $DOMAIN para este servidor"
log "2. Execute: sudo certbot certonly --standalone -d $DOMAIN -d portainer.$DOMAIN"
log "3. Clone o repositório do projeto neste diretório"
log "4. Configure as variáveis de ambiente nos arquivos .env"
log "5. Execute o primeiro deploy"

warning "⚠️  IMPORTANTE: Reinicie a sessão SSH para aplicar as mudanças do grupo docker"
warning "⚠️  IMPORTANTE: Guarde o arquivo .env.production em local seguro"

log "🎉 Setup concluído! Servidor pronto para receber deploys automáticos."
