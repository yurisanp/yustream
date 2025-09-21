# YuStream VNC Proxy Service

Serviço de proxy VNC para acesso remoto seguro a computadores de streaming.

## 🚀 Início Rápido

### Docker (Recomendado)

```bash
# Construir e iniciar
docker-compose up -d --build

# Verificar logs
docker-compose logs -f vnc-proxy
```

### Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env

# Iniciar em modo desenvolvimento
npm run dev
```

## 📁 Estrutura

```
vnc-proxy-service/
├── server.js                 # Servidor principal
├── client/
│   ├── vnc-client.py         # Cliente Python
│   ├── install.sh            # Instalador Linux/macOS
│   ├── install.bat           # Instalador Windows
│   └── *.config.json         # Configurações
├── logs/                     # Logs do servidor
├── uploads/                  # Arquivos transferidos
├── package.json              # Dependências Node.js
└── Dockerfile               # Container Docker
```

## 🔧 Configuração

### Variáveis de Ambiente

```bash
VNC_PROXY_PORT=3003
JWT_SECRET=your-jwt-secret
AUTH_SERVER_URL=http://localhost:3001
VNC_REGISTER_TOKEN=your-register-token
```

### Portas Utilizadas

- `3003`: API REST
- `6080-6180`: WebSockets VNC

## 📡 API Endpoints

### Admin (Requer autenticação)

- `GET /api/admin/vnc/connections` - Listar conexões
- `POST /api/admin/vnc/session` - Criar sessão VNC
- `POST /api/admin/vnc/upload` - Upload de arquivo
- `GET /api/admin/vnc/download/:id/:file` - Download de arquivo

### Cliente Remoto

- `POST /api/vnc/register` - Registrar máquina
- `PUT /api/vnc/heartbeat/:id` - Enviar heartbeat

### Sistema

- `GET /health` - Health check

## 🖥️ Cliente VNC

### Instalação Automática

**Linux/macOS:**
```bash
curl -fsSL https://your-server.com/install.sh | bash
```

**Windows:**
```cmd
powershell -c "iwr https://your-server.com/install.bat -o install.bat && install.bat"
```

### Instalação Manual

1. Baixar `vnc-client.py`
2. Instalar Python 3.7+
3. Instalar dependências: `pip install requests`
4. Configurar: `python vnc-client.py --setup`
5. Executar: `python vnc-client.py`

## 🔒 Segurança

- Autenticação JWT obrigatória
- Apenas administradores podem acessar
- Logs de auditoria completos
- Comunicação criptografada
- Timeouts de sessão automáticos

## 📊 Monitoramento

### Health Check

```bash
curl http://localhost:3003/health
```

### Logs

```bash
# Via Docker
docker-compose logs -f vnc-proxy

# Local
tail -f logs/combined.log
```

## 🐛 Troubleshooting

### Problemas Comuns

1. **Porta em uso**: Altere `VNC_PROXY_PORT`
2. **Falha de autenticação**: Verifique `JWT_SECRET`
3. **Cliente não conecta**: Confirme `VNC_REGISTER_TOKEN`
4. **Performance lenta**: Ajuste qualidade VNC

### Debug

```bash
# Habilitar logs debug
DEBUG=* npm start

# Verificar conexões ativas
curl http://localhost:3003/health
```

## 📈 Performance

### Limites Recomendados

- Conexões simultâneas: 20
- Tamanho de arquivo: 100MB
- Timeout de sessão: 30min
- Retenção de logs: 1000 entradas

### Otimizações

- Use compressão VNC
- Configure qualidade baseada na rede
- Monitore uso de recursos
- Implemente cache se necessário

## 🔄 Atualizações

```bash
# Parar serviços
docker-compose down

# Atualizar código
git pull

# Reconstruir e iniciar
docker-compose up -d --build
```

## 📚 Documentação Completa

Consulte `VNC_REMOTE_ACCESS_DOCUMENTATION.md` para documentação completa.

## 🆘 Suporte

- **Logs**: `/app/logs/` no container
- **Configuração**: Verifique variáveis de ambiente
- **Rede**: Confirme portas e firewall
- **VNC**: Teste conexão local primeiro

## 📄 Licença

MIT License - Veja LICENSE para detalhes.
