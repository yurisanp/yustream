# Guia de Instalação YuStream Smart TV

Este guia detalha como instalar e configurar o YuStream TV em diferentes plataformas de Smart TV.

## 📋 Índice

1. [Preparação do Ambiente](#preparação-do-ambiente)
2. [Instalação Universal (PWA)](#instalação-universal-pwa)
3. [Instalação Samsung Tizen](#instalação-samsung-tizen)
4. [Instalação LG webOS](#instalação-lg-webos)
5. [Configuração do Servidor](#configuração-do-servidor)
6. [Verificação da Instalação](#verificação-da-instalação)
7. [Solução de Problemas](#solução-de-problemas)

## 🔧 Preparação do Ambiente

### Requisitos do Sistema

- **Node.js 16+** e **npm**
- **Servidor YuStream** rodando (docker-compose)
- **Rede local** ou **servidor público** acessível

### Verificar Pré-requisitos

```bash
# Verificar Node.js
node --version  # deve ser 16+
npm --version

# Verificar servidor YuStream
curl https://yustream.yurisp.com.br/health
# Deve retornar: {"status":"OK","timestamp":"..."}

# Verificar streaming
curl https://yustream.yurisp.com.br:8443/live/live/abr.m3u8
# Deve retornar playlist HLS ou erro 404 se stream offline
```

### Baixar e Preparar Projeto

```bash
# Clonar projeto
git clone <seu-repositorio>
cd yustream-smarttv

# Instalar dependências
npm install

# Verificar estrutura
ls -la src/
```

## 🌐 Instalação Universal (PWA)

**Recomendado para**: Qualquer Smart TV com navegador moderno

### 1. Build da Aplicação

```bash
# Gerar build otimizado
npm run build:universal

# Verificar arquivos gerados
ls -la dist/universal/
```

### 2. Configurar Servidor Web

#### Opção A: Nginx (Recomendado)

```nginx
# /etc/nginx/sites-available/yustream-tv
server {
    listen 80;
    server_name yustream-tv.local;
    
    root /var/www/html/yustream-tv;
    index index.html;
    
    # PWA headers
    location / {
        try_files $uri $uri/ /index.html;
        
        # Cache headers
        expires 1h;
        add_header Cache-Control "public, immutable";
    }
    
    # Service Worker
    location /sw.js {
        expires 0;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    # API Proxy para auth server
    location /api/ {
        proxy_pass http://localhost:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
# Ativar site
sudo ln -s /etc/nginx/sites-available/yustream-tv /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Copiar arquivos
sudo cp -r dist/universal/* /var/www/html/yustream-tv/
sudo chown -R www-data:www-data /var/www/html/yustream-tv/
```

#### Opção B: Servidor Node.js Simples

```bash
# Usar servidor HTTP simples
npm install -g http-server

# Servir arquivos
cd dist/universal
http-server -p 3000 -c-1 --cors

# Acessível em: http://localhost:3000
```

### 3. Configurar DNS Local (Opcional)

```bash
# Adicionar ao /etc/hosts do servidor
echo "192.168.1.100 yustream-tv.local" | sudo tee -a /etc/hosts

# Ou configurar no roteador para toda rede
```

### 4. Acessar na Smart TV

1. **Abrir navegador** da Smart TV
2. **Navegar** para `http://yustream-tv.local` ou `http://IP:3000`
3. **Fazer login** com credenciais do YuStream
4. **Adicionar à tela inicial** (se suportado)

## 📱 Instalação Samsung Tizen

**Para**: TVs Samsung 2015+ com Tizen 2.3+

### 1. Instalar Tizen Studio

```bash
# Download do site oficial
wget https://download.tizen.org/sdk/Installer/tizen-studio_4.6/web-cli_Tizen_Studio_4.6_ubuntu-64.zip

# Extrair e instalar
unzip web-cli_Tizen_Studio_4.6_ubuntu-64.zip
cd tizen-studio_4.6
./install.sh

# Adicionar ao PATH
echo 'export PATH=$PATH:$HOME/tizen-studio/tools' >> ~/.bashrc
source ~/.bashrc
```

### 2. Configurar Certificados

```bash
# Gerar certificado de autor
tizen security-profiles add -n YuStreamProfile -a author.p12 -p password123

# Gerar certificado de distribuidor
tizen certificate -a YuStreamProfile -p password123 -c BR -st SP -ct "São Paulo" -o "YuStream" -n "YuStream Dev"
```

### 3. Configurar TV Samsung

#### Habilitar Modo Desenvolvedor

1. **Smart Hub** → **Apps**
2. **Digitar**: `12345` (código desenvolvedor)
3. **Ativar** "Developer Mode"
4. **Inserir IP** do computador de desenvolvimento
5. **Reiniciar** a TV

#### Conectar via SDB

```bash
# Conectar à TV
sdb connect [IP_DA_TV]:26101

# Verificar conexão
sdb devices
# Deve mostrar: [IP_DA_TV]:26101    device    [DEVICE_NAME]
```

### 4. Build e Deploy

```bash
# Gerar build Tizen
npm run build:tizen

# Verificar arquivos
ls -la dist/tizen/

# Instalar na TV
cd dist/tizen
tizen install -n yustream-tv-tizen.wgt -t [DEVICE_NAME]

# Iniciar aplicação
tizen run -p yustream.tv -t [DEVICE_NAME]
```

### 5. Deploy para Samsung Store (Opcional)

```bash
# Assinar para distribuição
tizen package -t wgt -s YuStreamProfile -- dist/tizen/package

# Upload para Samsung Seller Office
# https://seller.samsungapps.com/
```

## 📺 Instalação LG webOS

**Para**: TVs LG 2014+ com webOS 3.0+

### 1. Instalar webOS TV SDK

```bash
# Instalar CLI tools
npm install -g @webosose/ares-cli

# Verificar instalação
ares-setup-device --version
```

### 2. Configurar TV LG

#### Habilitar Modo Desenvolvedor

1. **LG Content Store** → **Buscar** "Developer Mode"
2. **Instalar** "Developer Mode" app
3. **Abrir** app e fazer login com conta LG
4. **Ativar** "Dev Mode Status"
5. **Configurar** "Key Server" (IP do computador)

#### Configurar Dispositivo

```bash
# Configurar conexão
ares-setup-device

# Seguir wizard:
# - Device Name: LG_TV
# - Device IP: [IP_DA_TV]
# - Port: 9922
# - Username: developer
# - Password: (deixar vazio)

# Testar conexão
ares-device-info -d LG_TV
```

### 3. Build e Deploy

```bash
# Gerar build webOS
npm run build:webos

# Verificar arquivos
ls -la dist/webos/package/

# Criar pacote IPK
cd dist/webos
ares-package package

# Instalar na TV
ares-install com.yustream.tv_1.0.0_all.ipk -d LG_TV

# Iniciar aplicação
ares-launch com.yustream.tv -d LG_TV
```

### 4. Script de Deploy Automático

```bash
# Usar script incluído
cd dist/webos
chmod +x deploy.sh
./deploy.sh
```

### 5. Deploy para LG Content Store (Opcional)

```bash
# Preparar para distribuição
ares-package package --excludeFiles "*.md,*.txt"

# Upload para LG Seller Lounge
# https://seller.lgappstv.com/
```

## ⚙️ Configuração do Servidor

### 1. Configuração do Servidor

O projeto já está configurado para usar **yustream.yurisp.com.br**:

- **Auth Server**: `https://yustream.yurisp.com.br`
- **Stream Server**: `https://yustream.yurisp.com.br:8443`

A configuração é inserida automaticamente durante o build. Para usar um servidor diferente, edite os scripts de build:

```javascript
// Em scripts/build-universal.js, build-tizen.js, build-webos.js
window.YUSTREAM_CONFIG = {
    SERVER_URL: 'https://seu-servidor.com:3001',
    STREAM_URL: 'https://seu-servidor.com:8443',
    ENVIRONMENT: 'production'
};
```

### 2. Configurar CORS

```javascript
// No servidor auth-server/server.js
app.use(cors({
    origin: [
        'https://yustream.yurisp.com.br',
        'http://yustream-tv.local',
        'tizen://yustream.tv',
        'file://',  // Para apps Tizen/webOS
        '*'  // Permitir todas as origens para Smart TVs
    ],
    credentials: true
}));
```

### 3. Configurar SSL (Recomendado)

```bash
# Gerar certificados para desenvolvimento
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Configurar nginx com HTTPS
server {
    listen 443 ssl;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    # ... resto da configuração
}
```

## ✅ Verificação da Instalação

### 1. Testes Básicos

```bash
# Testar conectividade
ping [IP_DA_TV]

# Testar servidor web
curl http://[IP_SERVIDOR]:3000

# Testar API
curl http://[IP_SERVIDOR]:3001/health
```

### 2. Testes na TV

1. **Abrir aplicação** na Smart TV
2. **Verificar navegação** com controle remoto
3. **Fazer login** com usuário teste
4. **Testar streaming** (se stream estiver online)
5. **Verificar controles** (play, pause, qualidade)

### 3. Debug

```javascript
// No console do navegador (se disponível)
console.log('Device:', window.deviceUtils.getInfo());
console.log('Auth:', window.authService.isAuthenticated());
console.log('Player:', window.tvInterface?.streamPlayer?.status);

// Ativar modo debug
localStorage.setItem('YUSTREAM_DEBUG', 'true');
window.location.reload();
```

## 🔧 Solução de Problemas

### Problemas de Conectividade

```bash
# Verificar firewall
sudo ufw status
sudo ufw allow 3000
sudo ufw allow 3001
sudo ufw allow 8080
sudo ufw allow 8443

# Verificar portas abertas
netstat -tlnp | grep :3001
```

### Problemas de CORS

```javascript
// Adicionar headers no nginx
add_header Access-Control-Allow-Origin "*";
add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
add_header Access-Control-Allow-Headers "Authorization, Content-Type";
```

### Problemas de Certificado Tizen

```bash
# Recriar certificados
rm -rf ~/.tizen-cli-config
tizen security-profiles add -n YuStreamProfile -a author.p12 -p password123
```

### Problemas de Conexão webOS

```bash
# Resetar configuração
ares-setup-device --reset

# Verificar serviço na TV
# Ir em Developer Mode app → Key Server → Restart
```

### Problemas de Performance

```javascript
// Reduzir qualidade de buffer
// Em src/js/core/streamPlayer.js
const config = {
    bufferSize: 5,  // Reduzir para TVs mais antigas
    maxBitrate: 4000000  // 4Mbps máximo
};
```

## 📞 Suporte

Se encontrar problemas:

1. **Verificar logs** do servidor YuStream
2. **Consultar documentação** da plataforma específica
3. **Abrir issue** no GitHub com detalhes do erro
4. **Contactar suporte** via email

---

**Instalação concluída!** 🎉 Sua Smart TV agora está pronta para usar o YuStream.
