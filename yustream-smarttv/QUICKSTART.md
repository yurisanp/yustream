# 🚀 YuStream Smart TV - Início Rápido

## Servidor Configurado: **yustream.yurisp.com.br**

### ⚡ Instalação Rápida (5 minutos)

```bash
# 1. Clonar e instalar
git clone <repositorio>
cd yustream-smarttv
npm install

# 2. Deploy integrado com nginx YuStream (RECOMENDADO)
npm run deploy:docker

# OU deploy manual
npm run build:universal
./deploy-to-nginx.sh      # Linux/Mac
deploy-to-nginx.bat       # Windows
```

**✅ Pronto!** Acesse `https://yustream.yurisp.com.br/tv` no navegador da Smart TV.

### 🔑 Login de Teste

Use as credenciais do seu sistema YuStream existente:
- **Usuário**: `admin` (ou seu usuário)
- **Senha**: `admin123` (ou sua senha)

### 📱 Instalação por Plataforma

#### 🌐 Universal (Qualquer Smart TV)
```bash
# Deploy integrado
npm run deploy:docker

# Ou deploy manual
npm run build:universal
./deploy-to-nginx.sh

# Acessar: https://yustream.yurisp.com.br/tv
```

#### 📱 Samsung Tizen
```bash
npm run build:tizen
# Arquivo: dist/tizen/yustream-tv-tizen.wgt
# Instalar via Tizen Studio
```

#### 📺 LG webOS
```bash
npm run build:webos
cd dist/webos
ares-package package
ares-install com.yustream.tv_1.0.0_all.ipk -d [DEVICE]
```

### 🎮 Como Usar

1. **Abrir** navegador da Smart TV
2. **Navegar** para o endereço do servidor
3. **Fazer login** com suas credenciais
4. **Usar controle remoto** para navegar:
   - **Setas**: Navegar
   - **OK**: Selecionar
   - **Voltar**: Voltar/Controles
   - **Play/Pause**: Controlar stream

### 🔧 Configuração

**Servidor já configurado para:**
- **Auth**: `https://yustream.yurisp.com.br`
- **Stream**: `https://yustream.yurisp.com.br:8443`

Para mudar servidor, edite `config/server.js`.

### 📊 Status do Sistema

```bash
# Verificar servidor
curl https://yustream.yurisp.com.br/health

# Verificar stream
curl https://yustream.yurisp.com.br:8443/live/live/abr.m3u8
```

### 🐛 Problemas Comuns

#### "Não consegue conectar"
- Verificar se servidor YuStream está online
- Verificar firewall/rede local
- Tentar versão universal primeiro

#### "Stream não carrega"
- Verificar se stream está transmitindo
- Verificar certificados SSL
- Tentar qualidade diferente

#### "Navegação não funciona"
- Usar setas do controle remoto
- Verificar se elementos estão focáveis
- Pressionar OK para selecionar

### 🆘 Suporte Rápido

1. **Debug Mode**: Adicionar `?debug=true` na URL
2. **Logs**: Abrir DevTools se disponível na TV
3. **Teste**: Usar versão desktop primeiro
4. **Reset**: Limpar cache/cookies da TV

---

**🎉 YuStream TV pronto para usar!**

Configurado para `yustream.yurisp.com.br` - funciona imediatamente após build.
