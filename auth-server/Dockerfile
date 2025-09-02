FROM node:18-alpine

# Instalar dependências do sistema
RUN apk add --no-cache \
    curl \
    dumb-init

# Criar diretório da aplicação
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências incluindo devDependencies para nodemon
RUN npm install && \
    npm cache clean --force

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S yustream -u 1001

# Alterar proprietário do diretório
RUN chown -R yustream:nodejs /app
USER yustream

# Expor porta
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Comando de inicialização (usar nodemon em desenvolvimento)
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start"]
