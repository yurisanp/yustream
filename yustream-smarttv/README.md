# YuStream Smart TV

Aplicação de streaming otimizada para Smart TVs, compatível com **Tizen OS** (Samsung), **webOS** (LG), **Android TV** e qualquer Smart TV via PWA.

## 🎯 Características

- ✅ **Navegação por Controle Remoto** - Otimizada para D-pad e controles de TV
- ✅ **Streaming HLS/LLHLS** - Baixa latência e alta qualidade
- ✅ **Autenticação Segura** - Sistema JWT integrado
- ✅ **Multi-Plataforma** - Tizen, webOS, Android TV e PWA universal
- ✅ **Interface TV-First** - Design 10-foot UI otimizado para TVs
- ✅ **Performance Nativa** - Aceleração de hardware quando disponível

## 🏗️ Arquitetura

```
yustream-smarttv/
├── src/                    # Código fonte
│   ├── index.html         # Interface principal
│   ├── css/               # Estilos otimizados para TV
│   ├── js/
│   │   ├── core/          # Lógica principal (auth, player)
│   │   ├── ui/            # Interface e navegação
│   │   └── utils/         # Utilitários e detecção de dispositivo
│   └── manifest.json      # PWA manifest
├── platforms/             # Configurações específicas
│   ├── tizen/            # Samsung Tizen OS
│   └── webos/            # LG webOS
├── scripts/              # Scripts de build
└── dist/                 # Builds gerados
```

## 🚀 Instalação Rápida

### Pré-requisitos

```bash
# Node.js 16+ e npm
node --version
npm --version

# Para desenvolvimento
npm install -g live-server http-server
```

### 1. Clonar e Instalar

```bash
git clone <seu-repositorio>
cd yustream-smarttv
npm install
```

### 2. Desenvolvimento

```bash
# Servidor de desenvolvimento
npm run dev

# Acessar em: http://localhost:3000
```

### 3. Build para Produção

```bash
# Build todas as plataformas
npm run build

# Ou builds específicos
npm run build:universal  # PWA Universal
npm run build:tizen      # Samsung Tizen
npm run build:webos      # LG webOS
```

## 📱 Deploy por Plataforma

### 🌐 PWA Universal (Recomendado)

Funciona em **qualquer Smart TV** com navegador moderno.

#### Deploy Integrado com Nginx YuStream

```bash
# Build e deploy automático
npm run deploy:docker

# Ou deploy manual
npm run build:universal
./deploy-to-nginx.sh     # Linux/Mac
deploy-to-nginx.bat      # Windows
```

#### Deploy Manual

```bash
# Build
npm run build:universal

# Copiar para nginx (já configurado no docker-compose)
# Os arquivos vão automaticamente para /usr/share/nginx/html/smarttv
```

**Acesso:** 
- **HTTP**: `http://yustream.yurisp.com.br/tv`
- **HTTPS**: `https://yustream.yurisp.com.br/tv`

### 📱 Samsung Tizen OS

Para TVs Samsung 2015+ com Tizen 2.3+.

#### Pré-requisitos

```bash
# Instalar Tizen Studio
# Download: https://developer.tizen.org/development/tizen-studio/download

# Configurar certificados
tizen security-profiles add -n YuStream -a author.p12 -p password
tizen certificate -a YuStream -p password
```

#### Deploy

```bash
# Build
npm run build:tizen

# Instalar no dispositivo
cd dist/tizen
tizen install -n yustream-tv-tizen.wgt -t [DEVICE_ID]

# Ou via Tizen Studio
# 1. Abrir Tizen Studio
# 2. Import > Existing Projects into Workspace
# 3. Selecionar dist/tizen/package
# 4. Run As > Tizen Web Application
```

#### Certificação para Samsung Store

```bash
# Assinar para distribuição
tizen package -t wgt -s [CERTIFICATE_PROFILE] -- dist/tizen/package
```

### 📺 LG webOS

Para TVs LG 2014+ com webOS 3.0+.

#### Pré-requisitos

```bash
# Instalar webOS TV SDK
# Download: https://webostv.developer.lge.com/sdk/download/

# Instalar CLI tools
npm install -g @webosose/ares-cli

# Configurar dispositivo
ares-setup-device
```

#### Deploy

```bash
# Build
npm run build:webos

# Criar pacote IPK
cd dist/webos
ares-package package

# Instalar no dispositivo
ares-install com.yustream.tv_1.0.0_all.ipk -d [DEVICE_NAME]

# Iniciar aplicação
ares-launch com.yustream.tv -d [DEVICE_NAME]
```

#### Deploy Automático

```bash
cd dist/webos
chmod +x deploy.sh
./deploy.sh
```

### 📺 Android TV

Use a versão PWA universal ou desenvolva com React Native TV.

```bash
# PWA via browser Android TV
npm run build:universal

# Ou usar via Chrome no Android TV
# 1. Abrir Chrome na Android TV
# 2. Navegar para o endereço do servidor
# 3. Adicionar à tela inicial
```

## ⚙️ Configuração

### Configuração do Servidor

O projeto está pré-configurado para usar o servidor **yustream.yurisp.com.br**:

- **Auth Server**: `https://yustream.yurisp.com.br`
- **Stream Server**: `https://yustream.yurisp.com.br:8443`

Para usar um servidor diferente, edite os scripts de build ou a configuração global:

```javascript
// Configuração global (inserida automaticamente no build)
window.YUSTREAM_CONFIG = {
    SERVER_URL: 'https://seu-servidor.com:3001',
    STREAM_URL: 'https://seu-servidor.com:8443',
    ENVIRONMENT: 'production'
};
```

### Verificação do Servidor

Certifique-se que o servidor YuStream está rodando:

```bash
# Verificar servidor de autenticação
curl https://yustream.yurisp.com.br/health

# Verificar stream (se estiver online)
curl https://yustream.yurisp.com.br:8443/live/live/abr.m3u8
```

### CORS e Proxy

Para desenvolvimento local, configure o proxy no `vite.config.ts`:

```javascript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, '')
    }
  }
}
```

## 🎮 Controles

### Navegação Universal

- **Setas**: Navegar entre elementos
- **OK/Enter**: Selecionar
- **Voltar/Escape**: Voltar ou mostrar controles
- **Play/Pause**: Controlar reprodução

### Controles Específicos

#### Samsung Tizen
- **Botões Coloridos**: Funções personalizadas
- **Menu**: Mostrar/esconder controles
- **Home**: Minimizar aplicação

#### LG webOS  
- **Magic Remote**: Suporte a ponteiro
- **Botões Coloridos**: Funções personalizadas
- **Back**: Navegar para trás

#### Android TV
- **D-pad**: Navegação tradicional
- **Media Keys**: Controle de reprodução

## 🐛 Troubleshooting

### Problemas Comuns

#### "Stream não carrega"

```bash
# Verificar conectividade
ping seu-servidor.com

# Verificar certificados SSL
openssl s_client -connect seu-servidor.com:8443

# Logs do player
# Abrir DevTools na TV (se disponível) ou verificar logs
```

#### "Navegação não funciona"

```javascript
// Verificar se elementos têm classe 'focusable'
<button class="focusable" tabindex="0">Botão</button>

// Verificar detecção de plataforma
console.log(window.deviceUtils.getInfo());
```

#### "Autenticação falha"

```bash
# Verificar servidor auth
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Debug Mode

```javascript
// Ativar modo debug
localStorage.setItem('YUSTREAM_DEBUG', 'true');

// Ou adicionar ?debug=true na URL
// http://localhost:3000?debug=true
```

### Logs

```javascript
// Verificar logs do player
window.yuStreamApp.getInfo();

// Verificar dispositivo
window.deviceUtils.getInfo();

// Verificar autenticação
window.authService.getUser();
```

## 📊 Performance

### Otimizações Implementadas

- **Lazy Loading**: Componentes carregados sob demanda
- **Hardware Acceleration**: Quando disponível na plataforma
- **Buffer Otimizado**: Configurado por tipo de dispositivo
- **CSS Optimized**: Animações e transições suaves
- **Memory Management**: Cleanup automático de recursos

### Monitoramento

```javascript
// Performance metrics
console.log('Dispositivo:', window.deviceUtils.getInfo());
console.log('Player:', window.tvInterface?.streamPlayer?.status);
console.log('Memória:', performance.memory); // Chrome only
```

## 🔧 Desenvolvimento

### Estrutura de Código

```javascript
// Adicionar nova funcionalidade
class NovaFuncionalidade {
    constructor() {
        this.init();
    }
    
    init() {
        // Configuração inicial
    }
}

// Registrar globalmente
window.novaFuncionalidade = new NovaFuncionalidade();
```

### Testes

```bash
# Testar em diferentes resoluções
# 1920x1080 (Full HD)
# 3840x2160 (4K)

# Testar navegação
# - Apenas teclado
# - Apenas controle remoto
# - Magic Remote (webOS)
```

### Build Customizado

```javascript
// Modificar scripts/build-universal.js para customizações
const customConfig = {
    features: ['streaming', 'auth'],
    platforms: ['tizen', 'webos'],
    optimizations: true
};
```

## 📚 Recursos Adicionais

### Documentação das Plataformas

- [Samsung Tizen](https://developer.samsung.com/smarttv/develop/specifications/tv-model-groups.html)
- [LG webOS](https://webostv.developer.lge.com/develop/specifications/tv-model-groups)
- [Android TV](https://developer.android.com/tv)

### Ferramentas Úteis

- **Tizen Studio**: IDE oficial Samsung
- **webOS TV SDK**: SDK oficial LG  
- **Chrome DevTools**: Debug remoto
- **Lighthouse**: Auditoria de performance

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/nova-funcionalidade`
3. Commit: `git commit -m 'Adicionar nova funcionalidade'`
4. Push: `git push origin feature/nova-funcionalidade`
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🆘 Suporte

- **Issues**: Reporte bugs via GitHub Issues
- **Discussões**: Use GitHub Discussions para dúvidas
- **Email**: contato@yustream.com

---

**YuStream Smart TV** - Streaming otimizado para a era das Smart TVs 📺✨
