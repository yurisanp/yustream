#!/bin/bash

set -e

# Configurações
BACKUP_DIR="/opt/yustream/backups"
DATE=$(date +%Y%m%d-%H%M%S)
RETENTION_DAYS=7

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

log "🔄 Iniciando backup automático do Yustream..."

# Criar diretório de backup se não existir
mkdir -p "$BACKUP_DIR"

# Verificar se os containers estão rodando
if ! docker-compose ps | grep -q "Up"; then
    warning "Nem todos os containers estão rodando. Continuando com backup..."
fi

# Backup do MongoDB
log "📊 Fazendo backup do MongoDB..."
if docker-compose ps mongodb | grep -q "Up"; then
    # Criar backup dentro do container
    docker-compose exec -T mongodb mongodump --quiet --gzip --archive > "$BACKUP_DIR/mongodb-$DATE.gz"
    
    if [ $? -eq 0 ]; then
        success "✅ Backup do MongoDB concluído: mongodb-$DATE.gz"
    else
        error "❌ Falha no backup do MongoDB"
    fi
else
    warning "⚠️  Container MongoDB não está rodando, pulando backup"
fi

# Backup das configurações
log "⚙️  Fazendo backup das configurações..."
tar -czf "$BACKUP_DIR/configs-$DATE.tar.gz" \
    --exclude="node_modules" \
    --exclude="dist" \
    --exclude="logs" \
    --exclude="backups" \
    --exclude=".git" \
    docker-compose.yml \
    docker-compose.production.yml \
    nginx/ \
    ome-config/ \
    auth-server/ \
    stremio-addon/ \
    scripts/ \
    .env.production 2>/dev/null || true

if [ $? -eq 0 ]; then
    success "✅ Backup das configurações concluído: configs-$DATE.tar.gz"
else
    error "❌ Falha no backup das configurações"
fi

# Backup dos volumes Docker
log "💾 Fazendo backup dos volumes Docker..."
if docker volume ls | grep -q "portainer_data"; then
    # Usar volume correto baseado no compose file usado
    VOLUME_NAME=$(docker volume ls | grep portainer | awk '{print $2}' | head -1)
    if [ -n "$VOLUME_NAME" ]; then
        docker run --rm \
            -v "$VOLUME_NAME":/data:ro \
            -v "$BACKUP_DIR":/backup \
            alpine tar -czf "/backup/portainer-data-$DATE.tar.gz" -C /data .
        
        if [ $? -eq 0 ]; then
            success "✅ Backup do Portainer concluído: portainer-data-$DATE.tar.gz"
        else
            warning "⚠️  Falha no backup do Portainer"
        fi
    fi
fi

# Backup dos logs importantes
log "📋 Fazendo backup dos logs..."
if [ -d "/opt/yustream/logs" ] && [ "$(ls -A /opt/yustream/logs)" ]; then
    tar -czf "$BACKUP_DIR/logs-$DATE.tar.gz" logs/ 2>/dev/null || true
    
    if [ $? -eq 0 ]; then
        success "✅ Backup dos logs concluído: logs-$DATE.tar.gz"
    else
        warning "⚠️  Falha no backup dos logs"
    fi
fi

# Backup dos certificados SSL
log "🔐 Fazendo backup dos certificados SSL..."
if [ -d "/etc/letsencrypt" ]; then
    sudo tar -czf "$BACKUP_DIR/ssl-certs-$DATE.tar.gz" -C /etc letsencrypt/ 2>/dev/null || true
    sudo chown ubuntu:ubuntu "$BACKUP_DIR/ssl-certs-$DATE.tar.gz" 2>/dev/null || true
    
    if [ $? -eq 0 ]; then
        success "✅ Backup dos certificados SSL concluído: ssl-certs-$DATE.tar.gz"
    else
        warning "⚠️  Falha no backup dos certificados SSL"
    fi
fi

# Criar manifest do backup
log "📝 Criando manifest do backup..."
cat > "$BACKUP_DIR/backup-manifest-$DATE.txt" <<EOF
Backup do Yustream - $(date)
===============================

Arquivos incluídos neste backup:
- mongodb-$DATE.gz (Banco de dados MongoDB)
- configs-$DATE.tar.gz (Configurações do sistema)
- portainer-data-$DATE.tar.gz (Dados do Portainer)
- logs-$DATE.tar.gz (Logs do sistema)
- ssl-certs-$DATE.tar.gz (Certificados SSL)

Informações do sistema:
- Hostname: $(hostname)
- Usuário: $(whoami)
- Versão Docker: $(docker --version 2>/dev/null || echo "N/A")
- Versão Docker Compose: $(docker-compose --version 2>/dev/null || echo "N/A")
- Espaço em disco: $(df -h / | tail -1)
- Memória: $(free -h | grep Mem)
- Uptime: $(uptime)

Status dos containers:
$(docker-compose ps 2>/dev/null || echo "Não foi possível obter status dos containers")

Commit atual:
$(git rev-parse HEAD 2>/dev/null || echo "N/A")
$(git log -1 --oneline 2>/dev/null || echo "N/A")
EOF

# Calcular tamanhos dos backups
log "📏 Calculando tamanhos dos backups..."
TOTAL_SIZE=0
for file in "$BACKUP_DIR"/*-$DATE.*; do
    if [ -f "$file" ]; then
        size=$(stat -c%s "$file" 2>/dev/null || echo "0")
        TOTAL_SIZE=$((TOTAL_SIZE + size))
        echo "$(basename "$file"): $(du -h "$file" | cut -f1)" >> "$BACKUP_DIR/backup-manifest-$DATE.txt"
    fi
done

echo "Total: $(echo $TOTAL_SIZE | awk '{printf "%.2f MB", $1/1024/1024}')" >> "$BACKUP_DIR/backup-manifest-$DATE.txt"

# Limpeza de backups antigos
log "🧹 Limpando backups antigos (mais de $RETENTION_DAYS dias)..."
find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "backup-manifest-*.txt" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

DELETED_COUNT=$(find "$BACKUP_DIR" -name "*" -mtime +$RETENTION_DAYS 2>/dev/null | wc -l)
if [ $DELETED_COUNT -gt 0 ]; then
    success "🗑️  $DELETED_COUNT arquivos antigos removidos"
fi

# Verificar espaço em disco
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 85 ]; then
    warning "⚠️  Espaço em disco baixo: ${DISK_USAGE}% usado"
fi

# Resumo final
log "📊 Resumo do backup:"
log "   - Data/Hora: $(date)"
log "   - Localização: $BACKUP_DIR"
log "   - Arquivos criados: $(ls -1 "$BACKUP_DIR"/*-$DATE.* 2>/dev/null | wc -l)"
log "   - Tamanho total: $(echo $TOTAL_SIZE | awk '{printf "%.2f MB", $1/1024/1024}')"
log "   - Espaço em disco usado: ${DISK_USAGE}%"

success "✅ Backup automático concluído com sucesso!"

# Opcional: Enviar notificação (descomente se tiver configurado)
# curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
#   -d "chat_id=$TELEGRAM_CHAT_ID" \
#   -d "text=✅ Backup do Yustream concluído em $(date)" 2>/dev/null || true
