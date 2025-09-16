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

# Verificar se estamos no diretório correto
if [ ! -f "docker-compose.yml" ]; then
    error "docker-compose.yml não encontrado. Verifique se está no diretório correto."
    exit 1
fi

log "🚀 Iniciando deploy automático..."

# Ler arquivos modificados
CHANGED_FILES=""
if [ -f "changed_files.txt" ]; then
    CHANGED_FILES=$(cat changed_files.txt)
    log "Arquivos modificados detectados:"
    echo "$CHANGED_FILES"
else
    warning "Arquivo changed_files.txt não encontrado. Fazendo deploy completo."
fi

# Função para verificar se um serviço precisa ser reiniciado
needs_restart() {
    local service=$1
    local patterns=$2
    
    if [ -z "$CHANGED_FILES" ]; then
        return 0  # Se não há lista de mudanças, reiniciar tudo
    fi
    
    echo "$CHANGED_FILES" | grep -qE "$patterns"
}

# Fazer backup do docker-compose atual
if [ -f "docker-compose.yml.bak" ]; then
    rm docker-compose.yml.bak
fi
cp docker-compose.yml docker-compose.yml.bak

# Serviços a serem verificados
SERVICES_TO_RESTART=""

# Verificar mudanças no React
if needs_restart "react" "yustream-react/|nginx/"; then
    log "📱 Mudanças detectadas no frontend React ou Nginx"
    SERVICES_TO_RESTART="$SERVICES_TO_RESTART nginx"
fi

# Verificar mudanças no Auth Server
if needs_restart "auth" "auth-server/"; then
    log "🔐 Mudanças detectadas no servidor de autenticação"
    SERVICES_TO_RESTART="$SERVICES_TO_RESTART yustream-auth"
fi

# Verificar mudanças no Stremio Addon
if needs_restart "stremio" "stremio-addon/"; then
    log "📺 Mudanças detectadas no addon Stremio"
    SERVICES_TO_RESTART="$SERVICES_TO_RESTART yustream-stremio"
fi

# Verificar mudanças no Docker Compose
if needs_restart "compose" "docker-compose.yml"; then
    log "🐳 Mudanças detectadas no docker-compose.yml"
    SERVICES_TO_RESTART="ovenmediaengine mongodb yustream-auth yustream-stremio portainer nginx"
fi

# Verificar mudanças nos configs do OME
if needs_restart "ome" "ome-config/"; then
    log "🎥 Mudanças detectadas na configuração do OvenMediaEngine"
    SERVICES_TO_RESTART="$SERVICES_TO_RESTART ovenmediaengine"
fi

# Se nenhum serviço específico foi detectado, fazer deploy completo
if [ -z "$SERVICES_TO_RESTART" ]; then
    warning "Nenhuma mudança específica detectada. Fazendo deploy completo."
    SERVICES_TO_RESTART="ovenmediaengine mongodb yustream-auth yustream-stremio portainer nginx"
fi

# Remover duplicatas
SERVICES_TO_RESTART=$(echo $SERVICES_TO_RESTART | tr ' ' '\n' | sort -u | tr '\n' ' ')

log "🔄 Serviços que serão reiniciados: $SERVICES_TO_RESTART"

# Determinar qual docker-compose usar
COMPOSE_FILE="docker-compose.yml"
if [ -f "docker-compose.production.yml" ]; then
    COMPOSE_FILE="docker-compose.production.yml"
    log "🏭 Usando configuração de produção: $COMPOSE_FILE"
fi

# Fazer pull das imagens mais recentes
log "📥 Fazendo pull das imagens Docker..."
docker-compose -f "$COMPOSE_FILE" pull

# Fazer backup dos volumes importantes antes de reiniciar
log "💾 Fazendo backup dos dados importantes..."
if docker volume ls | grep -q "yustream_mongodb_data"; then
    docker run --rm -v yustream_mongodb_data:/data -v $(pwd)/backups:/backup alpine tar czf /backup/mongodb-backup-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
fi

# Parar serviços que serão atualizados
for service in $SERVICES_TO_RESTART; do
    log "⏹️  Parando serviço: $service"
    docker-compose -f "$COMPOSE_FILE" stop $service || warning "Falha ao parar $service (pode não estar rodando)"
done

# Remover containers antigos dos serviços que serão atualizados
for service in $SERVICES_TO_RESTART; do
    log "🗑️  Removendo container antigo: $service"
    docker-compose -f "$COMPOSE_FILE" rm -f $service || warning "Falha ao remover $service (pode não existir)"
done

# Rebuild serviços que têm build (auth-server e stremio-addon) se necessário
if echo "$SERVICES_TO_RESTART" | grep -q "yustream-auth"; then
    log "🔨 Fazendo rebuild do yustream-auth..."
    docker-compose -f "$COMPOSE_FILE" build yustream-auth
fi

if echo "$SERVICES_TO_RESTART" | grep -q "yustream-stremio"; then
    log "🔨 Fazendo rebuild do yustream-stremio..."
    docker-compose -f "$COMPOSE_FILE" build yustream-stremio
fi

# Iniciar serviços na ordem correta
log "🚀 Iniciando serviços atualizados..."

# Ordem de inicialização
STARTUP_ORDER="mongodb ovenmediaengine yustream-auth yustream-stremio portainer nginx"

for service in $STARTUP_ORDER; do
    if echo "$SERVICES_TO_RESTART" | grep -q "$service"; then
        log "▶️  Iniciando serviço: $service"
        docker-compose -f "$COMPOSE_FILE" up -d $service
        
        # Aguardar um pouco para o serviço inicializar
        sleep 5
        
        # Verificar se o serviço está rodando
        if docker-compose -f "$COMPOSE_FILE" ps $service | grep -q "Up"; then
            success "✅ Serviço $service iniciado com sucesso"
        else
            error "❌ Falha ao iniciar $service"
            docker-compose -f "$COMPOSE_FILE" logs --tail=20 $service
        fi
    fi
done

# Limpeza de imagens antigas
log "🧹 Limpando imagens Docker antigas..."
docker image prune -f

# Verificar status final
log "🔍 Verificando status dos serviços..."
docker-compose -f "$COMPOSE_FILE" ps

# Verificar logs recentes para erros
log "📋 Verificando logs recentes para erros..."
for service in $SERVICES_TO_RESTART; do
    if docker-compose -f "$COMPOSE_FILE" logs --tail=10 $service 2>/dev/null | grep -i error; then
        warning "Possíveis erros detectados em $service"
    fi
done

# Teste de conectividade básico
log "🔗 Testando conectividade básica..."

# Testar nginx
if curl -s -o /dev/null -w "%{http_code}" http://localhost | grep -q "200\|301\|302"; then
    success "✅ Nginx respondendo corretamente"
else
    warning "⚠️  Nginx pode não estar respondendo corretamente"
fi

# Testar auth server através do nginx
if curl -s -o /dev/null -w "%{http_code}" http://localhost/api/health | grep -q "200"; then
    success "✅ Auth server respondendo corretamente"
else
    warning "⚠️  Auth server pode não estar respondendo corretamente"
fi

# Testar Portainer
if curl -s -o /dev/null -w "%{http_code}" http://localhost/portainer/ | grep -q "200\|301\|302"; then
    success "✅ Portainer respondendo corretamente"
else
    warning "⚠️  Portainer pode não estar respondendo corretamente"
fi

success "🎉 Deploy concluído com sucesso!"
log "📊 Resumo do deploy:"
log "   - Serviços reiniciados: $SERVICES_TO_RESTART"
log "   - Timestamp: $(date)"
log "   - Commit: $(git rev-parse --short HEAD 2>/dev/null || echo 'N/A')"

# Limpar arquivos temporários
rm -f changed_files.txt

success "✅ Deploy automático finalizado!"
