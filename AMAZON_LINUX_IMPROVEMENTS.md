# 🚀 Melhorias para Amazon Linux - Resumo das Configurações

## ✅ Principais Melhorias Implementadas

### 🔧 **Script de Configuração AWS (`scripts/aws-setup.sh`)**

#### **Detecção Automática de Sistema**
- Detecta automaticamente Amazon Linux 2, Amazon Linux 2023, ou CentOS
- Suporte para gerenciadores de pacote `yum` e `dnf`
- Configuração específica para usuários `ec2-user` ou `centos`

#### **Instalação Otimizada de Dependências**
```bash
# Docker - Método nativo para Amazon Linux
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker

# Node.js - Repositório oficial RPM
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Certbot - Pacote nativo
sudo yum install -y certbot python3-certbot-nginx
```

#### **Firewall com firewalld**
- Configuração automática do `firewalld` (padrão no Amazon Linux/CentOS)
- Fallback para `ufw` se disponível
- Portas configuradas: SSH, HTTP, HTTPS, RTMP (1935), OME (8080, 8443)

### 🐳 **Workflow GitHub Actions (`.github/workflows/deploy.yml`)**

#### **Compatibilidade com Amazon Linux**
- Upload do `docker-compose.production.yml`
- Conversão automática de quebras de linha com `dos2unix`
- Comando adaptado para `yum` ao invés de `apt`

```yaml
ssh -o StrictHostKeyChecking=no -i private_key ${USER_NAME}@${HOSTNAME} \
  "cd ${PROJECT_PATH} && chmod +x scripts/deploy.sh && sudo yum install -y dos2unix && dos2unix scripts/deploy.sh && ./scripts/deploy.sh"
```

### 🔄 **Script de Deploy (`scripts/deploy.sh`)**

#### **Suporte a Docker Compose de Produção**
- Detecção automática do arquivo `docker-compose.production.yml`
- Uso consistente da variável `$COMPOSE_FILE` em todos os comandos
- Configurações otimizadas para ambiente de produção

```bash
COMPOSE_FILE="docker-compose.yml"
if [ -f "docker-compose.production.yml" ]; then
    COMPOSE_FILE="docker-compose.production.yml"
    log "🏭 Usando configuração de produção: $COMPOSE_FILE"
fi
```

### 💾 **Script de Backup (`scripts/backup.sh`)**

#### **Detecção Dinâmica de Volumes**
- Identifica automaticamente nomes de volumes Docker
- Compatível com diferentes configurações de compose
- Backup inteligente de volumes Portainer

```bash
VOLUME_NAME=$(docker volume ls | grep portainer | awk '{print $2}' | head -1)
```

### 📋 **Configuração de Produção (`docker-compose.production.yml`)**

#### **Otimizações para Ambiente de Produção**
- **Logging estruturado** com rotação automática
- **Health checks** para todos os serviços críticos
- **Volumes persistentes** corretamente mapeados
- **Variáveis de ambiente** seguras

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"

healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### 📚 **Documentação Atualizada**

#### **AWS_SETUP.md**
- Instruções específicas para Amazon Linux 2/2023
- Comandos `yum`/`dnf` ao invés de `apt`
- Configuração do `firewalld`
- Usuário `ec2-user` ao invés de `ubuntu`

#### **DEPLOY_SETUP.md**
- Fluxo adaptado para Amazon Linux
- Secrets corretos para GitHub Actions
- Comandos de troubleshooting específicos

### 🔐 **Templates de Ambiente**

#### **Arquivos de Configuração de Produção**
- `auth-server/env.production` - Configurações seguras do servidor de auth
- `stremio-addon/env.production` - Configurações do addon Stremio
- Variáveis de ambiente com valores padrão seguros

## 🎯 **Benefícios das Melhorias**

### **Compatibilidade Total**
- ✅ Amazon Linux 2
- ✅ Amazon Linux 2023
- ✅ CentOS 7/8
- ✅ RHEL 7/8

### **Automação Completa**
- 🤖 Detecção automática do sistema
- 🔧 Instalação de dependências otimizada
- 🔥 Configuração automática de firewall
- 📦 Gerenciamento inteligente de pacotes

### **Produção Ready**
- 🏭 Docker Compose otimizado para produção
- 📊 Logging estruturado e rotacionado
- 💾 Backup automático com retenção
- 🔍 Health checks para monitoramento

### **Segurança Aprimorada**
- 🔐 Firewalld configurado corretamente
- 🛡️ Variáveis de ambiente seguras
- 🔒 Certificados SSL automáticos
- 👤 Usuários e permissões corretos

## 🚀 **Como Usar**

### **1. Setup Inicial (Uma vez)**
```bash
# Na instância Amazon Linux
wget https://raw.githubusercontent.com/SEU_USUARIO/yustream/main/scripts/aws-setup.sh
chmod +x aws-setup.sh
./aws-setup.sh
```

### **2. Configurar GitHub Secrets**
- `EC2_USER`: `ec2-user` (ao invés de ubuntu)
- Demais secrets conforme documentação

### **3. Deploy Automático**
```bash
git push origin main  # Deploy automático ativado!
```

## 📊 **Comparação: Antes vs Depois**

| Aspecto | Antes (Ubuntu) | Depois (Amazon Linux) |
|---------|----------------|------------------------|
| **Usuário** | ubuntu | ec2-user |
| **Gerenciador** | apt | yum/dnf |
| **Firewall** | ufw | firewalld |
| **Docker** | Script externo | Pacote nativo |
| **Node.js** | PPA Ubuntu | RPM oficial |
| **Certbot** | Snap | Pacote nativo |
| **Compose** | docker-compose.yml | docker-compose.production.yml |

## ✅ **Checklist de Verificação**

- [ ] Script `aws-setup.sh` detecta sistema corretamente
- [ ] Docker instalado via pacote nativo
- [ ] Firewalld configurado com portas corretas
- [ ] Certificados SSL funcionando
- [ ] Deploy automático via GitHub Actions
- [ ] Backup automático configurado
- [ ] Portainer acessível
- [ ] Todos os serviços com health checks
- [ ] Logs rotacionando corretamente

---

🎉 **Sistema completamente otimizado para Amazon Linux!**

Todas as configurações foram adaptadas para funcionar nativamente com Amazon Linux, aproveitando as ferramentas e pacotes oficiais da distribuição.
