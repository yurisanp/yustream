# 🚀 Configuração AWS para Deploy Automático do Yustream

Este guia mostra como configurar uma instância AWS EC2 com Amazon Linux para receber deploys automáticos do GitHub Actions.

## 📋 Pré-requisitos

- Conta AWS ativa
- Domínio configurado (yustream.yurisp.com.br)
- Repositório GitHub com o projeto

## 🖥️ 1. Configuração da Instância EC2

### 1.1 Criar Instância EC2

1. **Acesse o Console AWS EC2**
2. **Clique em "Launch Instance"**
3. **Configurações recomendadas:**
   - **Nome:** `yustream-production`
   - **AMI:** Amazon Linux 2023 ou Amazon Linux 2 (64-bit x86)
   - **Tipo:** `t3.medium` ou superior (mín. 4GB RAM para Docker)
   - **Par de chaves:** Criar novo ou usar existente
   - **Armazenamento:** 30GB GP3 (mínimo recomendado)

### 1.2 Configurar Security Groups

Criar um Security Group com as seguintes regras:

| Tipo | Protocolo | Porta | Origem | Descrição |
|------|-----------|-------|---------|-----------|
| SSH | TCP | 22 | Seu IP | Acesso SSH |
| HTTP | TCP | 80 | 0.0.0.0/0 | Tráfego web |
| HTTPS | TCP | 443 | 0.0.0.0/0 | Tráfego web seguro |
| Custom TCP | TCP | 1935 | 0.0.0.0/0 | RTMP (OBS) |
| Custom TCP | TCP | 8080 | 0.0.0.0/0 | OME HTTP |
| Custom TCP | TCP | 8443 | 0.0.0.0/0 | OME HTTPS |

## 🔧 2. Configuração do Servidor

### 2.1 Conectar via SSH

```bash
ssh -i "sua-chave.pem" ec2-user@seu-ip-publico
```

### 2.2 Executar Script de Configuração Automática

```bash
# Fazer download e executar o script de setup
wget https://raw.githubusercontent.com/SEU_USUARIO/yustream/main/scripts/aws-setup.sh
chmod +x aws-setup.sh
./aws-setup.sh
```

**Ou configuração manual:**

### 2.3 Atualizar Sistema (Manual)

```bash
sudo yum update -y
sudo yum install -y epel-release
```

### 2.4 Instalar Docker e Docker Compose (Manual)

```bash
# Instalar Docker
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker

# Adicionar usuário ao grupo docker
sudo usermod -aG docker ec2-user

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Reiniciar sessão SSH para aplicar mudanças do grupo
exit
# Conectar novamente via SSH
```

### 2.5 Instalar Dependências Adicionais (Manual)

```bash
# Git e outras dependências
sudo yum install -y git htop curl wget unzip tar gzip python3 python3-pip

# Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Certbot
sudo yum install -y certbot python3-certbot-nginx
```

### 2.6 Configurar Diretório do Projeto

```bash
# Criar diretório do projeto
sudo mkdir -p /opt/yustream
sudo chown ec2-user:ec2-user /opt/yustream
cd /opt/yustream

# Clonar repositório (primeira vez)
git clone https://github.com/SEU_USUARIO/yustream.git .

# Criar diretórios necessários
mkdir -p logs backups ssl/certbot/www
```

## 🔐 3. Configuração SSL com Let's Encrypt

### 3.1 Gerar Certificados

```bash
# Parar nginx se estiver rodando
sudo systemctl stop nginx 2>/dev/null || true
docker-compose stop nginx 2>/dev/null || true

# Gerar certificado (Certbot já foi instalado pelo script)
sudo certbot certonly --standalone -d yustream.yurisp.com.br -d portainer.yustream.yurisp.com.br

# Configurar renovação automática
sudo crontab -e
# Adicionar linha:
# 0 12 * * * /usr/bin/certbot renew --quiet && docker-compose restart nginx
```

### 3.2 Configurar Firewall (se não foi executado o script automático)

```bash
# Configurar firewalld (Amazon Linux/CentOS)
sudo systemctl start firewalld
sudo systemctl enable firewalld
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-port=1935/tcp  # RTMP
sudo firewall-cmd --permanent --add-port=8080/tcp  # OME HTTP
sudo firewall-cmd --permanent --add-port=8443/tcp  # OME HTTPS
sudo firewall-cmd --reload
```

## 🔑 4. Configuração do GitHub

### 4.1 Secrets do Repositório

No GitHub, vá em **Settings > Secrets and variables > Actions** e adicione:

| Nome | Valor | Descrição |
|------|-------|-----------|
| `AWS_ACCESS_KEY_ID` | Sua Access Key | Credenciais AWS |
| `AWS_SECRET_ACCESS_KEY` | Sua Secret Key | Credenciais AWS |
| `AWS_REGION` | `us-east-1` | Região AWS |
| `EC2_SSH_PRIVATE_KEY` | Conteúdo da chave .pem | Chave SSH privada |
| `EC2_HOST` | IP público da instância | IP da EC2 |
| `EC2_USER` | `ec2-user` | Usuário SSH (Amazon Linux) |
| `EC2_PROJECT_PATH` | `/opt/yustream` | Caminho do projeto |

### 4.2 Gerar Chaves AWS (IAM)

1. **Acesse AWS IAM Console**
2. **Crie um novo usuário:** `yustream-deploy`
3. **Permissões mínimas necessárias:**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "ec2:DescribeInstances",
           "ec2:DescribeInstanceStatus"
         ],
         "Resource": "*"
       }
     ]
   }
   ```
4. **Gerar Access Key** e adicionar aos secrets do GitHub

## 🌐 5. Configuração DNS

Configure os seguintes registros DNS:

| Tipo | Nome | Valor |
|------|------|-------|
| A | yustream.yurisp.com.br | IP_PUBLICO_EC2 |
| A | portainer.yurisp.com.br | IP_PUBLICO_EC2 |
| CNAME | www.yustream.yurisp.com.br | yustream.yurisp.com.br |

## 🚀 6. Primeiro Deploy Manual

```bash
cd /opt/yustream

# Criar arquivo de ambiente de produção
cp auth-server/env.production auth-server/.env
cp stremio-addon/env.production stremio-addon/.env

# Editar variáveis de ambiente conforme necessário
nano auth-server/.env
nano stremio-addon/.env

# Fazer primeiro build do React
cd yustream-react
npm install
npm run build
cd ..

# Tornar script executável
chmod +x scripts/deploy.sh
chmod +x scripts/backup.sh

# Converter quebras de linha (se necessário)
sudo yum install -y dos2unix
dos2unix scripts/deploy.sh
dos2unix scripts/backup.sh

# Primeiro deploy usando configuração de produção
docker-compose -f docker-compose.production.yml up -d
```

## 📊 7. Monitoramento

### 7.1 Verificar Status dos Serviços

```bash
# Status dos containers
docker-compose ps

# Logs dos serviços
docker-compose logs -f [nome_do_serviço]

# Uso de recursos
docker stats

# Espaço em disco
df -h
```

### 7.2 Acessar Portainer

- **URL:** https://portainer.yustream.yurisp.com.br
- **Primeira configuração:** Criar usuário admin
- **Endpoint:** Docker (local)

## 🔧 8. Configurações Avançadas

### 8.1 Backup Automático

Criar script de backup em `/opt/yustream/scripts/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/opt/yustream/backups"
DATE=$(date +%Y%m%d-%H%M%S)

# Backup MongoDB
docker exec yustream-mongodb mongodump --out /tmp/backup
docker cp yustream-mongodb:/tmp/backup $BACKUP_DIR/mongodb-$DATE

# Backup configurações
tar -czf $BACKUP_DIR/configs-$DATE.tar.gz \
  docker-compose.yml \
  nginx/ \
  ome-config/ \
  auth-server/.env \
  stremio-addon/.env

# Manter apenas últimos 7 dias
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

Adicionar ao crontab:
```bash
0 2 * * * /opt/yustream/scripts/backup.sh
```

### 8.2 Logs Centralizados

Configurar logrotate em `/etc/logrotate.d/yustream`:

```
/opt/yustream/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 ubuntu ubuntu
}
```

## ✅ 9. Checklist de Verificação

- [ ] Instância EC2 criada e configurada
- [ ] Security Groups configurados
- [ ] Docker e Docker Compose instalados
- [ ] Certificados SSL configurados
- [ ] DNS apontando para a instância
- [ ] Secrets do GitHub configurados
- [ ] Primeiro deploy manual realizado
- [ ] Todos os serviços funcionando
- [ ] Portainer acessível
- [ ] Backup automático configurado

## 🆘 10. Troubleshooting

### Problemas Comuns:

1. **Docker não inicia:**
   ```bash
   sudo systemctl status docker
   sudo systemctl start docker
   ```

2. **Permissões SSH:**
   ```bash
   chmod 600 sua-chave.pem
   ```

3. **Portas bloqueadas:**
   - Verificar Security Groups
   - Verificar firewall local: `sudo ufw status`

4. **SSL não funciona:**
   - Verificar se certificados existem em `/etc/letsencrypt/live/`
   - Renovar certificados: `sudo certbot renew`

5. **Deploy falha:**
   - Verificar logs do GitHub Actions
   - Verificar se o usuário ubuntu tem permissões no diretório
   - Verificar se o script deploy.sh tem permissão de execução

## 📞 Suporte

Para problemas específicos, verifique:
- Logs do GitHub Actions
- Logs dos containers: `docker-compose logs`
- Status dos serviços: `docker-compose ps`
- Recursos do sistema: `htop`, `df -h`
