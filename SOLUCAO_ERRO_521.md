# 🔧 Solução para Erro 521 - Let's Encrypt

## 📋 Problema Identificado

O erro `521` indica que o Let's Encrypt não conseguiu acessar o arquivo de validação em:
`http://yustream.yurisp.com.br/.well-known/acme-challenge/`

## 🔍 Causas Possíveis

1. **DNS não configurado**: O domínio não aponta para o servidor
2. **Porta 80 bloqueada**: Firewall ou outro serviço usando a porta 80
3. **Nginx não configurado**: Falta configuração para servir `.well-known`
4. **Conectividade**: Problemas de rede ou proxy

## 🚀 Soluções

### Solução 1: Método Standalone (Recomendado)

Este método é mais confiável pois não depende do Nginx:

```bash
# 1. Verificar DNS e conectividade
sudo ./scripts/check-dns-connectivity.sh

# 2. Configurar SSL usando método standalone
sudo ./scripts/setup-ssl-standalone.sh
```

### Solução 2: Corrigir Método Webroot

Se preferir usar o método webroot:

```bash
# 1. Diagnosticar o problema
sudo ./scripts/diagnose-ssl-issue.sh

# 2. Corrigir baseado no diagnóstico
# 3. Executar novamente
sudo ./scripts/setup-ssl.sh
```

### Solução 3: Configuração Manual

Se os scripts não funcionarem:

```bash
# 1. Parar todos os serviços
docker compose down

# 2. Verificar se as portas estão livres
sudo lsof -i :80
sudo lsof -i :443

# 3. Obter certificados usando standalone
sudo docker run --rm \
    -p 80:80 \
    -p 443:443 \
    -v "$(pwd)/ssl/letsencrypt:/etc/letsencrypt" \
    certbot/certbot certonly \
    --standalone \
    --email admin@yurisp.com.br \
    --agree-tos \
    --no-eff-email \
    -d yustream.yurisp.com.br

# 4. Iniciar serviços
docker compose up -d
```

## 🔍 Verificações Importantes

### 1. DNS
```bash
# Verificar se o domínio aponta para o servidor
nslookup yustream.yurisp.com.br
curl -s ifconfig.me  # IP do servidor
```

### 2. Portas
```bash
# Verificar se as portas estão livres
sudo lsof -i :80
sudo lsof -i :443
```

### 3. Conectividade
```bash
# Testar conectividade HTTP
curl -I http://yustream.yurisp.com.br

# Testar validação Let's Encrypt
mkdir -p ./ssl/certbot/www/.well-known/acme-challenge
echo "test" > ./ssl/certbot/www/.well-known/acme-challenge/test
curl http://yustream.yurisp.com.br/.well-known/acme-challenge/test
```

### 4. Firewall
```bash
# Verificar firewall
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## 🐛 Solução de Problemas Específicos

### Erro: "Porta 80 em uso"
```bash
# Parar Apache (se instalado)
sudo systemctl stop apache2

# Parar Nginx do sistema (se instalado)
sudo systemctl stop nginx

# Parar Docker
docker compose down
```

### Erro: "DNS não resolvendo"
```bash
# Configurar DNS no provedor
# A record: yustream.yurisp.com.br -> [IP_DO_SERVIDOR]
# Aguardar propagação (até 24h)
```

### Erro: "Firewall bloqueando"
```bash
# Configurar firewall
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

### Erro: "Nginx não configurado"
```bash
# Adicionar ao nginx/conf.d/streaming.conf:
location /.well-known/acme-challenge/ {
    root /var/www/certbot;
}

# Reiniciar Nginx
docker compose restart nginx
```

## 📞 Comandos de Diagnóstico

```bash
# Diagnóstico completo
sudo ./scripts/diagnose-ssl-issue.sh

# Verificar DNS
sudo ./scripts/check-dns-connectivity.sh

# Ver logs do Nginx
docker compose logs nginx

# Ver status dos serviços
docker compose ps

# Testar conectividade
curl -I http://yustream.yurisp.com.br
```

## 🎯 Próximos Passos

1. **Execute o diagnóstico**: `sudo ./scripts/diagnose-ssl-issue.sh`
2. **Corrija os problemas identificados**
3. **Use o método standalone**: `sudo ./scripts/setup-ssl-standalone.sh`
4. **Verifique se funcionou**: `curl -I https://yustream.yurisp.com.br`

## ⚠️ Importante

- O método standalone é mais confiável
- Certifique-se de que o DNS está configurado corretamente
- As portas 80 e 443 devem estar livres durante a validação
- Aguarde a propagação DNS se necessário

## 🔄 Renovação Automática

Após configurar com sucesso, a renovação será automática:

```bash
# Verificar cron job
crontab -l

# Renovar manualmente
sudo ./scripts/renew-ssl-standalone.sh
```
