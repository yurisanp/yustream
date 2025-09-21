# YuStream - Sistema de Acesso VNC Remoto

## 📋 Visão Geral

O YuStream agora inclui um sistema completo de acesso VNC remoto que permite aos administradores controlar computadores de streaming remotos através de uma interface web segura. O sistema utiliza noVNC para renderização no navegador e um serviço de proxy para túneis seguros.

## 🏗️ Arquitetura

```
[Computador Remoto] → [Servidor YuStream] → [Frontend Web]
       ↓                        ↓                ↓
   VNC Server              VNC Proxy         noVNC Client
   SSH Tunnel              WebSocket         Interface Web
```

### Componentes:

1. **Frontend (yustream-react)**
   - Nova aba "VNC Remoto" no painel admin
   - Interface noVNC integrada
   - Controles para múltiplos monitores
   - Sistema de transferência de arquivos
   - Logs de conexão em tempo real

2. **Backend (vnc-proxy-service)**
   - Serviço Node.js com WebSocket
   - Proxy reverso seguro para VNC
   - Autenticação JWT
   - Sistema de sessões temporárias
   - Logs de auditoria

3. **Cliente VNC (Python)**
   - Script para máquinas remotas
   - Auto-configuração de servidor VNC
   - Heartbeat automático
   - Suporte multiplataforma

## 🚀 Instalação e Configuração

### 1. Configuração do Servidor

O serviço VNC já está integrado ao `docker-compose.yml`. Para inicializar:

```bash
# Construir e iniciar todos os serviços
docker-compose up -d --build

# Verificar se o serviço VNC está rodando
docker-compose logs vnc-proxy
```

### 2. Configuração de Máquina Remota

#### Pré-requisitos:
- Python 3.7+
- Servidor VNC instalado (x11vnc no Linux, TightVNC/UltraVNC no Windows)
- SSH habilitado (opcional, mas recomendado)

#### Instalação do Cliente:

**Linux/macOS:**
```bash
# Baixar o cliente VNC
wget https://your-yustream-server.com/vnc-client.py
# ou
curl -O https://your-yustream-server.com/vnc-client.py

# Instalar dependências
pip3 install requests

# Tornar executável
chmod +x vnc-client.py
```

**Windows Server 2025 (Recomendado):**
```powershell
# Executar como Administrador
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force

# Instalação automática completa
Invoke-WebRequest -Uri "https://your-yustream-server.com/install-windows-server.ps1" -OutFile "install-vnc.ps1"
.\install-vnc.ps1 -ServerUrl "https://your-yustream-server.com" -RegisterToken "your-token" -InstallAsService
```

**Windows (Método alternativo):**
```cmd
# Baixar instalador
curl -O https://your-yustream-server.com/install.bat
install.bat
```

#### Configuração Inicial:

```bash
# Executar configuração interativa
python3 vnc-client.py --setup
```

Isso criará um arquivo `vnc-client.config.json` com as configurações:

```json
{
  "server_url": "https://your-yustream-server.com",
  "register_token": "yustream-vnc-register-token-change-in-production",
  "machine_name": "Streaming-PC-01",
  "vnc_port": 5900,
  "monitors": 2,
  "ssh_enabled": true,
  "ssh_port": 22,
  "ssh_username": "streaming_user",
  "ssh_password": "secure_password",
  "ssh_private_key_path": "/home/user/.ssh/id_rsa",
  "heartbeat_interval": 30,
  "auto_start_vnc": true,
  "vnc_password": "vnc_secure_pass",
  "display": ":0"
}
```

#### Executar Cliente:

```bash
# Modo interativo (para testes)
python3 vnc-client.py

# Modo daemon (produção)
nohup python3 vnc-client.py &
```

## 🔧 Configuração Avançada

### Variáveis de Ambiente do Servidor

```bash
# docker-compose.yml ou .env
VNC_PROXY_PORT=3003
JWT_SECRET=yustream-jwt-secret-change-in-production-2024
AUTH_SERVER_URL=http://yustream-auth:3001
VNC_REGISTER_TOKEN=yustream-vnc-register-token-change-in-production
```

### Configuração de Firewall

```bash
# Servidor YuStream
sudo ufw allow 3003/tcp  # API VNC Proxy
sudo ufw allow 6080:6180/tcp  # WebSocket VNC

# Máquina remota
sudo ufw allow 5900/tcp  # VNC Server
sudo ufw allow 22/tcp    # SSH (se usado)
```

### SSL/TLS (Produção)

O sistema utiliza o certificado SSL já configurado no nginx. Para HTTPS:

```nginx
# nginx/conf.d/streaming.conf
server {
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/your-domain/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain/privkey.pem;
    
    # ... outras configurações
}
```

## 🖥️ Uso do Sistema

### Acesso ao Painel VNC

1. Faça login como administrador no YuStream
2. Navegue para `/admin`
3. Clique na aba "VNC Remoto"
4. Selecione uma conexão disponível
5. Use os controles para:
   - Alternar entre monitores
   - Transferir arquivos
   - Visualizar logs
   - Encerrar sessão

### Controles Disponíveis

- **Monitor**: Dropdown para selecionar monitor (1, 2, 3...)
- **Escala**: Local (redimensiona no navegador) ou Remota (redimensiona na origem)
- **Arquivos**: Upload/download de arquivos
- **Logs**: Visualizar histórico de conexões
- **Desconectar**: Encerrar sessão VNC

### Transferência de Arquivos

- **Upload**: Selecione arquivo local → botão "Enviar Arquivo"
- **Download**: Use o gerenciador de arquivos na sessão VNC

## 🔒 Segurança

### Autenticação
- Apenas usuários com `role: "admin"` podem acessar
- Tokens JWT com expiração de 1 hora
- Autenticação obrigatória em todas as rotas

### Comunicação Segura
- Todas as comunicações via HTTPS/WSS
- Tokens de sessão únicos e temporários
- Criptografia end-to-end para dados VNC

### Logs de Auditoria
- Todas as conexões são registradas
- Logs incluem: usuário, IP, horário, ações
- Retenção automática de logs (últimos 1000 por conexão)

### Isolamento
- Cada sessão VNC é isolada
- Timeouts automáticos (30 minutos de inatividade)
- Limpeza automática de sessões expiradas

## 🔍 Monitoramento e Troubleshooting

### Logs do Servidor

```bash
# Logs do serviço VNC
docker-compose logs -f vnc-proxy

# Logs específicos
docker exec yustream-vnc-proxy tail -f /app/logs/combined.log
```

### Logs do Cliente

```bash
# Na máquina remota
tail -f vnc-client.log
```

### Health Check

```bash
# Verificar status do serviço
curl http://localhost:3003/health

# Resposta esperada:
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "connections": 2,
  "activeSessions": 1
}
```

### Problemas Comuns

#### 1. Conexão não aparece na lista
- Verificar se o cliente está rodando
- Confirmar token de registro
- Checar conectividade de rede

#### 2. Falha na autenticação VNC
- Verificar senha VNC
- Confirmar porta VNC (padrão: 5900)
- Testar conexão VNC local

#### 3. Performance lenta
- Reduzir qualidade VNC
- Usar compressão
- Verificar largura de banda

#### 4. Erro de túnel SSH
- Confirmar credenciais SSH
- Verificar conectividade SSH
- Testar chaves privadas

## 📱 Suporte Multiplataforma

### Linux
- **VNC Server**: x11vnc (recomendado)
- **Instalação**: `sudo apt-get install x11vnc`
- **Configuração**: Automática via cliente Python

### Windows
- **VNC Server**: TightVNC (recomendado) ou UltraVNC
- **Instalação**: Automática via script PowerShell ou manual
- **Configuração**: Automática via cliente Python
- **Windows Server 2025**: Suporte completo com cliente otimizado

### macOS
- **VNC Server**: Screen Sharing nativo
- **Ativação**: System Preferences → Sharing → Screen Sharing
- **Configuração**: Automática via cliente Python

## 🔧 Desenvolvimento e Customização

### Estrutura do Projeto

```
yustream-react/src/components/
├── VNCViewer.tsx          # Componente principal VNC
└── VNCViewer.css          # Estilos VNC

vnc-proxy-service/
├── server.js              # Servidor proxy principal
├── client/
│   └── vnc-client.py     # Cliente para máquinas remotas
├── package.json          # Dependências Node.js
└── Dockerfile            # Container do serviço
```

### Adicionando Novos Recursos

1. **Frontend**: Editar `VNCViewer.tsx`
2. **Backend**: Adicionar rotas em `server.js`
3. **Cliente**: Estender `vnc-client.py`

### APIs Disponíveis

```javascript
// Listar conexões
GET /api/admin/vnc/connections

// Criar sessão
POST /api/admin/vnc/session
{
  "connectionId": "vnc_123",
  "monitor": 0
}

// Upload arquivo
POST /api/admin/vnc/upload
FormData: file, connectionId

// Download arquivo
GET /api/admin/vnc/download/:connectionId/:filename

// Registrar cliente (máquina remota)
POST /api/vnc/register
{
  "name": "PC-Streaming",
  "host": "192.168.1.100",
  "vncPort": 5900,
  "monitors": 2,
  "authToken": "registro-token"
}

// Heartbeat
PUT /api/vnc/heartbeat/:connectionId
{
  "status": "connected"
}
```

## 📊 Performance e Escalabilidade

### Limites Recomendados
- **Conexões simultâneas**: 10-20 por servidor
- **Sessões por usuário**: 3 máximo
- **Tamanho de arquivo**: 100MB máximo
- **Timeout de sessão**: 30 minutos

### Otimizações
- Use compressão VNC quando possível
- Configure qualidade baseada na largura de banda
- Monitore uso de CPU/memória
- Implemente balanceamento de carga para múltiplos servidores

## 🖥️ Windows Server 2025 - Configuração Específica

Para máquinas Windows Server 2025, recomendamos usar o cliente otimizado e o script de instalação automática:

### Instalação Rápida
```powershell
# Execute como Administrador
.\install-windows-server.ps1 -ServerUrl "https://your-server.com" -RegisterToken "your-token" -InstallAsService -AutoStart
```

### Recursos Específicos do Windows Server
- **Serviço Windows nativo**: Instalação e gerenciamento via Services.msc
- **Integração com Event Viewer**: Logs centralizados do Windows
- **Suporte a múltiplas sessões**: Compatível com Terminal Services
- **Configuração via Registry**: TightVNC configurado automaticamente
- **Firewall automático**: Regras criadas durante instalação
- **Monitoramento avançado**: Scripts PowerShell para monitoramento

### Comandos de Gerenciamento
```powershell
# Status do serviço
Get-Service -Name "YuStreamVNCClient"

# Iniciar/Parar serviço
Start-Service -Name "YuStreamVNCClient"
Stop-Service -Name "YuStreamVNCClient"

# Logs
Get-Content -Path "C:\Program Files\YuStreamVNCClient\vnc-client.log" -Tail 50
```

### Documentação Completa
Consulte `WINDOWS_SERVER_2025_SETUP.md` para instruções detalhadas.

## 🆘 Suporte

### Contato
- **Documentação**: Este arquivo
- **Documentação Windows Server**: `WINDOWS_SERVER_2025_SETUP.md`
- **Logs**: `/app/logs/` no container (servidor) ou arquivos locais (cliente)
- **Issues**: Verifique logs antes de reportar

### Backup e Recuperação
- Configurações armazenadas em volumes Docker
- Backup regular de `vnc_uploads` e `vnc_logs`
- Configurações de cliente em arquivos JSON locais
- Windows: Backup automático via Task Scheduler

---

**⚠️ Importante**: Este sistema fornece acesso completo aos computadores remotos. Use apenas em redes confiáveis e com credenciais seguras. Sempre monitore os logs de acesso.
