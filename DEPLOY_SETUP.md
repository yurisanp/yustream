# 🚀 Deploy Automático do Yustream - Guia Completo

Sistema de deploy automático configurado com GitHub Actions para instâncias AWS EC2 com Amazon Linux.

## 📁 Arquivos Criados

### 🔧 Scripts de Deploy
- `.github/workflows/deploy.yml` - Workflow do GitHub Actions
- `scripts/deploy.sh` - Script inteligente de deploy (detecta mudanças)
- `scripts/aws-setup.sh` - Script de configuração inicial da AWS
- `scripts/backup.sh` - Script de backup automático

### ⚙️ Configurações de Produção
- `docker-compose.production.yml` - Docker Compose otimizado para produção
- `auth-server/env.production` - Template de variáveis do auth server
- `stremio-addon/env.production` - Template de variáveis do addon
- `AWS_SETUP.md` - Documentação completa da configuração AWS

## 🎯 Como Funciona

### 1. **Deploy Inteligente**
O sistema detecta automaticamente quais arquivos foram modificados e reinicia apenas os serviços necessários:

| Mudança Detectada | Serviços Reiniciados |
|-------------------|---------------------|
| `yustream-react/` ou `nginx/` | nginx |
| `auth-server/` | yustream-auth |
| `stremio-addon/` | yustream-stremio |
| `docker-compose.yml` | Todos os serviços |
| `ome-config/` | ovenmediaengine |

### 2. **Workflow Automático**
- **Trigger:** Push para branch `main` ou `production`
- **Build:** Compila o React automaticamente
- **Deploy:** Envia arquivos para AWS e executa deploy
- **Verificação:** Testa se os serviços estão funcionando

## 🔧 Configuração Inicial

### 1. **Configurar AWS EC2**
```bash
# Na sua instância Amazon Linux, execute:
wget https://raw.githubusercontent.com/SEU_USUARIO/yustream/main/scripts/aws-setup.sh
chmod +x aws-setup.sh
./aws-setup.sh
```

### 2. **Configurar Secrets no GitHub**
Vá em `Settings > Secrets and variables > Actions` e adicione:

| Secret | Descrição | Exemplo |
|--------|-----------|---------|
| `AWS_ACCESS_KEY_ID` | Access Key da AWS | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | Secret Key da AWS | `xyz...` |
| `AWS_REGION` | Região AWS | `us-east-1` |
| `EC2_SSH_PRIVATE_KEY` | Chave SSH privada | Conteúdo do arquivo .pem |
| `EC2_HOST` | IP público da EC2 | `1.2.3.4` |
| `EC2_USER` | Usuário SSH | `ec2-user` |
| `EC2_PROJECT_PATH` | Caminho do projeto | `/opt/yustream` |

### 3. **Configurar Certificados SSL**
```bash
# Na instância AWS:
sudo certbot certonly --standalone -d yustream.yurisp.com.br -d portainer.yustream.yurisp.com.br

# Configurar renovação automática
sudo crontab -e
# Adicionar: 0 12 * * * /usr/bin/certbot renew --quiet && docker-compose restart nginx
```

### 4. **Primeiro Deploy Manual**
```bash
# Na instância Amazon Linux:
cd /opt/yustream
git clone https://github.com/SEU_USUARIO/yustream.git .

# Configurar variáveis de ambiente
cp auth-server/env.production auth-server/.env
cp stremio-addon/env.production stremio-addon/.env

# Editar as variáveis conforme necessário
nano auth-server/.env
nano stremio-addon/.env

# Converter quebras de linha e executar primeiro deploy
sudo yum install -y dos2unix
dos2unix scripts/deploy.sh
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

## 🔄 Fluxo de Deploy

### 1. **Desenvolvimento Local**
```bash
# Fazer mudanças no código
git add .
git commit -m "feat: nova funcionalidade"
git push origin main
```

### 2. **Deploy Automático**
- GitHub Actions detecta o push
- Compila o React
- Detecta arquivos modificados
- Envia para AWS
- Executa deploy inteligente
- Reinicia apenas serviços necessários

### 3. **Verificação**
- Testa conectividade dos serviços
- Verifica logs para erros
- Notifica status do deploy

## 📊 Monitoramento

### **Portainer** (Interface Web)
- **URL:** https://portainer.yustream.yurisp.com.br
- **Funcionalidades:**
  - Monitorar containers em tempo real
  - Ver logs de todos os serviços
  - Gerenciar volumes e redes
  - Estatísticas de uso

### **Logs do Sistema**
```bash
# Logs do deploy
tail -f /opt/yustream/logs/deploy.log

# Logs dos containers
docker-compose logs -f [nome_do_serviço]

# Status dos serviços
docker-compose ps
```

### **Backup Automático**
- **Frequência:** Diário às 2:00 AM
- **Retenção:** 7 dias
- **Inclui:** MongoDB, configurações, volumes, certificados SSL
- **Localização:** `/opt/yustream/backups/`

## 🛠️ Comandos Úteis

### **Deploy Manual**
```bash
cd /opt/yustream
git pull origin main
./scripts/deploy.sh
```

### **Backup Manual**
```bash
cd /opt/yustream
./scripts/backup.sh
```

### **Verificar Status**
```bash
# Status dos containers
docker-compose ps

# Logs em tempo real
docker-compose logs -f

# Uso de recursos
docker stats

# Espaço em disco
df -h
```

### **Rollback (se necessário)**
```bash
# Voltar para commit anterior
git reset --hard HEAD~1
./scripts/deploy.sh

# Ou restaurar backup
cd /opt/yustream/backups
# Restaurar arquivos do backup mais recente
```

## 🔐 Segurança

### **Firewall Configurado**
- SSH (22) - Apenas seu IP
- HTTP (80) - Público
- HTTPS (443) - Público  
- RTMP (1935) - Público (streaming)
- OME (8080, 8443) - Público (streaming)

### **SSL/TLS**
- Certificados Let's Encrypt
- Renovação automática
- HSTS habilitado
- Redirecionamento HTTP → HTTPS

### **Backup Seguro**
- Backups criptografados
- Rotação automática
- Múltiplas cópias
- Verificação de integridade

## 🚨 Troubleshooting

### **Deploy Falha**
1. Verificar logs do GitHub Actions
2. Verificar conectividade SSH
3. Verificar espaço em disco na AWS
4. Verificar se os secrets estão corretos

### **Serviços Não Iniciam**
1. Verificar logs: `docker-compose logs [serviço]`
2. Verificar configurações: `docker-compose config`
3. Verificar recursos: `docker stats`
4. Reiniciar manualmente: `docker-compose restart [serviço]`

### **SSL Não Funciona**
1. Verificar DNS: `nslookup yustream.yurisp.com.br`
2. Verificar certificados: `sudo certbot certificates`
3. Renovar certificados: `sudo certbot renew`
4. Reiniciar nginx: `docker-compose restart nginx`

## 📈 Otimizações Futuras

- [ ] Implementar cache Redis
- [ ] Configurar CDN (CloudFlare)
- [ ] Monitoramento com Prometheus/Grafana
- [ ] Alertas via Telegram/Slack
- [ ] Deploy blue-green
- [ ] Testes automatizados
- [ ] Backup para S3

## ✅ Checklist Final

- [ ] Instância AWS configurada
- [ ] Secrets do GitHub configurados
- [ ] DNS apontando para a instância
- [ ] Certificados SSL configurados
- [ ] Primeiro deploy manual realizado
- [ ] Todos os serviços funcionando
- [ ] Portainer acessível
- [ ] Backup automático funcionando
- [ ] Monitoramento ativo

---

🎉 **Parabéns!** Seu sistema de deploy automático está configurado e funcionando!

Para suporte, verifique os logs e a documentação em `AWS_SETUP.md`.
