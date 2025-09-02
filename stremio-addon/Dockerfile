FROM node:18-alpine

# Instalar dependências do sistema
RUN apk add --no-cache curl dumb-init

# Criar diretório da aplicação
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm install && npm cache clean --force

# Copiar código da aplicação
COPY . .

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S stremio -u 1001

# Alterar proprietário dos arquivos
RUN chown -R stremio:nodejs /app
USER stremio

# Expor porta
EXPOSE 7000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:7000/manifest.json || exit 1

# Comando de inicialização
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "dev"]
