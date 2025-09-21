# Dockerfile para o serviço VNC Proxy do YuStream
FROM node:18-alpine

# Instalar dependências do sistema
RUN apk add --no-cache \
    python3 \
    py3-pip \
    openssh-client \
    curl \
    bash \
    supervisor \
    make \
    g++ \
    python3-dev

# Instalar websockify globalmente
RUN npm install -g websockify

# Criar usuário não-root
RUN addgroup -g 1001 -S yustream && \
    adduser -S yustream -u 1001 -G yustream

# Definir diretório de trabalho
WORKDIR /app

# Copiar package.json e instalar dependências
COPY package*.json ./
RUN npm ci --only=production && npm rebuild

# Copiar código fonte
COPY . .

# Criar diretórios necessários
RUN mkdir -p logs uploads /etc/supervisor/conf.d

# Configurar supervisor
COPY supervisor.conf /etc/supervisor/conf.d/vnc-proxy.conf

# Alterar proprietário dos arquivos
RUN chown -R yustream:yustream /app

# Expor porta
EXPOSE 3003

# Definir usuário
USER yustream

# Comando de inicialização - executar diretamente o Node.js
CMD ["node", "server.js"]

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3003/health || exit 1
