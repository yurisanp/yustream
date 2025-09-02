# Configuração SSL para YuStream

Este documento explica como configurar SSL/TLS para o domínio `yustream.yurisp.com.br` usando Let's Encrypt.

## 📋 Pré-requisitos

1. **Domínio configurado**: O domínio `yustream.yurisp.com.br` deve estar apontando para o IP do servidor
2. **Acesso root**: O script precisa ser executado com privilégios de administrador
3. **Portas abertas**: 80 e 443 devem estar acessíveis externamente

## 🚀 Configuração Automática

### Opção 1: Script Completo (Recomendado)

```bash
# Tornar o script executável
chmod +x setup-ssl-complete.sh

# Executar configuração completa
sudo ./setup-ssl-complete.sh
```

Este script irá:
- Instalar dependências necessárias
- Configurar certificados SSL com Let's Encrypt
- Configurar SSL no Nginx
- Configurar SSL no OvenMediaEngine
- Configurar renovação automática
- Configurar firewall
- Iniciar todos os serviços

### Opção 2: Configuração Manual

Se preferir configurar manualmente:

```bash
# 1. Configurar SSL básico
sudo ./scripts/setup-ssl.sh

# 2. Configurar SSL no OvenMediaEngine
sudo ./scripts/setup-ome-ssl.sh

# 3. Configurar firewall
sudo ./scripts/setup-firewall.sh

# 4. Iniciar serviços
docker-compose up -d
```

## 🔧 Configuração Manual Detalhada

### 1. Configurar DNS

Certifique-se de que o domínio está apontando para o servidor:

```bash
# Verificar resolução DNS
nslookup yustream.yurisp.com.br
```

### 2. Obter Certificados SSL

```bash
# Parar serviços
docker-compose down

# Obter certificados
sudo certbot certonly --webroot \
  --webroot-path=./ssl/certbot/www \
  --email admin@yurisp.com.br \
  --agree-tos \
  --no-eff-email \
  -d yustream.yurisp.com.br
```

### 3. Configurar Nginx

O arquivo `nginx/conf.d/ssl.conf` já está configurado para usar os certificados SSL.

### 4. Configurar OvenMediaEngine

Os certificados SSL são automaticamente montados no container do OME.

## 🔄 Renovação Automática

Os certificados SSL são renovados automaticamente via cron job:

```bash
# Verificar cron job
crontab -l

# Ver logs de renovação
tail -f logs/ssl-renewal.log

# Renovar manualmente
./scripts/renew-ssl.sh
```

## 📊 Verificação

### Verificar Certificados

```bash
# Ver certificados instalados
sudo certbot certificates

# Verificar expiração
openssl x509 -in ./ssl/letsencrypt/live/yustream.yurisp.com.br/fullchain.pem -text -noout | grep "Not After"
```

### Verificar Serviços

```bash
# Verificar Nginx
curl -I https://yustream.yurisp.com.br

# Verificar API
curl -I https://yustream.yurisp.com.br/api/health

# Verificar OME
curl -k -I https://yustream.yurisp.com.br:8443/live/live/abr.m3u8
```

## 🌐 URLs Disponíveis

Após a configuração SSL, as seguintes URLs estarão disponíveis:

- **Site principal**: https://yustream.yurisp.com.br
- **Configuração Stremio**: https://yustream.yurisp.com.br/configure
- **API**: https://yustream.yurisp.com.br/api/
- **Stream HTTP**: http://yustream.yurisp.com.br:8080/live/live/abr.m3u8
- **Stream HTTPS**: https://yustream.yurisp.com.br:8443/live/live/abr.m3u8

## 🔥 Configuração de Firewall

O script `scripts/setup-firewall.sh` configura automaticamente o UFW para permitir as portas necessárias:

- 22/tcp (SSH)
- 80/tcp (HTTP)
- 443/tcp (HTTPS)
- 1935/tcp (RTMP)
- 8080/tcp (HLS HTTP)
- 8443/tcp (HLS HTTPS)
- 3333/tcp (WebRTC Signaling)
- 3334/tcp (WebRTC Signaling TLS)
- 9999/tcp (RTMP over WebSocket)
- 10000-10005/udp (WebRTC ICE)

## 🐛 Solução de Problemas

### Certificados não são obtidos

```bash
# Verificar se o domínio está resolvendo
nslookup yustream.yurisp.com.br

# Verificar se a porta 80 está acessível
telnet yustream.yurisp.com.br 80

# Verificar logs do Certbot
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

### Nginx não inicia

```bash
# Verificar configuração
sudo nginx -t

# Ver logs
docker-compose logs nginx
```

### OME não funciona com SSL

```bash
# Verificar certificados
ls -la ./ssl/letsencrypt/live/yustream.yurisp.com.br/

# Ver logs do OME
docker-compose logs ovenmediaengine
```

### Firewall bloqueando conexões

```bash
# Verificar status do firewall
sudo ufw status verbose

# Ver logs do firewall
sudo tail -f /var/log/ufw.log
```

## 📝 Manutenção

### Atualizar Certificados

```bash
# Renovar manualmente
sudo certbot renew

# Reiniciar serviços
docker-compose restart nginx ovenmediaengine
```

### Backup dos Certificados

```bash
# Criar backup
tar -czf ssl-backup-$(date +%Y%m%d).tar.gz ./ssl/letsencrypt/
```

### Monitoramento

```bash
# Verificar status dos serviços
docker-compose ps

# Ver logs em tempo real
docker-compose logs -f

# Verificar uso de recursos
docker stats
```

## 🔒 Segurança

- Os certificados SSL são renovados automaticamente
- O firewall está configurado para permitir apenas as portas necessárias
- Headers de segurança estão configurados no Nginx
- Conexões são forçadas para HTTPS

## 📞 Suporte

Em caso de problemas:

1. Verifique os logs: `docker-compose logs -f`
2. Verifique o status dos certificados: `sudo certbot certificates`
3. Verifique a configuração do firewall: `sudo ufw status verbose`
4. Verifique a resolução DNS: `nslookup yustream.yurisp.com.br`
