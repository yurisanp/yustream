# 🧪 Teste Rápido - YuStream Smart TV

## ✅ Erros Corrigidos

- ❌ ~~`testPlayer already declared`~~ → ✅ Renomeado para `playerInstance`
- ❌ ~~`testAuth is not defined`~~ → ✅ Event listeners configurados
- ❌ ~~Conexão abortada~~ → ✅ Player simplificado sem AbortController
- ❌ ~~Player não aparece~~ → ✅ CSS melhorado e video element direto

## 🚀 Como Testar

### 1. Teste Local (Desenvolvimento)

```bash
cd yustream-smarttv

# Build (já feito)
npm run build:universal

# Servir localmente
npm run serve
```

**Abrir no navegador**: `http://localhost:3000`

### 2. Teste com Página de Debug

```bash
# Servir arquivos fonte
npx live-server --port=8000 --cors

# Abrir: http://localhost:8000/test-player.html
```

**Sequência de teste**:
1. ✅ **Clicar "1. Testar Autenticação"**
2. ✅ **Clicar "2. Testar Status Stream"**  
3. ✅ **Clicar "3. Inicializar Player"**
4. ✅ **Verificar se vídeo aparece**

### 3. Deploy para Nginx

```bash
# Deploy automático
npm run deploy:docker

# Ou deploy manual
./deploy-to-nginx.bat    # Windows
./deploy-to-nginx.sh     # Linux/Mac
```

**Acessar**: `https://yustream.yurisp.com.br/tv`

## 🔍 Debug Console

### Verificações Básicas

```javascript
// 1. Verificar configuração
console.log('Config:', window.YUSTREAM_CONFIG);

// 2. Verificar autenticação
console.log('Auth:', window.authService?.isAuthenticated());

// 3. Verificar player
console.log('Player:', window.tvInterface?.streamPlayer?.getInfo());

// 4. Verificar video element
const video = document.getElementById('video-player');
console.log('Video:', {
    element: video,
    src: video?.src,
    error: video?.error,
    readyState: video?.readyState
});
```

### Teste Manual do Player

```javascript
// Criar player manualmente
const testPlayer = new TVStreamPlayer({
    onStatusChange: (status) => console.log('Status:', status),
    onError: (error) => console.error('Erro:', error),
    getStreamToken: () => window.authService.getStreamToken()
});

// Inicializar
await testPlayer.initialize();

// Verificar info
console.log('Player info:', testPlayer.getInfo());
```

## 🎯 Principais Mudanças

### ✅ Player Ultra Simplificado

```javascript
// Antes: Complexo com AbortController
class StreamPlayer {
    async initializePlayer() {
        const abortController = new AbortController(); // ❌ Causava abort
        // ... lógica complexa
    }
}

// Agora: Simples e direto
class TVStreamPlayer {
    async initialize() {
        const token = await this.getToken();      // 1. Token
        const isOnline = await this.checkStream(); // 2. Verificar
        await this.createPlayer(source);           // 3. Criar
    }
}
```

### ✅ Video Element Direto

```javascript
// Antes: OvenPlayer complexo
ovenPlayerRef.current = OvenPlayer.create("ovenPlayer", config);

// Agora: HTML5 Video direto
videoElement.src = source;
videoElement.load();
```

### ✅ Baseado no Mobile

```javascript
// Similar ao expo-video que funciona
const videoPlayer = useVideoPlayer(videoSource, (player) => {
    player.play(); // Funciona no mobile
});

// Adaptado para Smart TV
videoElement.autoplay = true;
videoElement.play(); // Funciona na TV
```

## 📱 URLs de Teste

### Desenvolvimento
- **App**: `http://localhost:3000`
- **Debug**: `http://localhost:8000/test-player.html`
- **Status**: `http://localhost:3000/tv/status`

### Produção
- **App**: `https://yustream.yurisp.com.br/tv`
- **Status**: `https://yustream.yurisp.com.br/tv/status`

## 🎮 Como Usar na Smart TV

1. **Abrir navegador** da Smart TV
2. **Navegar** para `https://yustream.yurisp.com.br/tv`
3. **Fazer login** com credenciais YuStream
4. **Usar controle remoto**:
   - **Setas**: Navegar
   - **OK**: Selecionar
   - **Voltar**: Mostrar/esconder controles
   - **Play/Pause**: Controlar stream

## 🆘 Se Ainda Não Funcionar

### Teste de Emergência

```html
<!-- Cole no console da TV -->
const video = document.getElementById('video-player');
video.src = 'https://yustream.yurisp.com.br:8443/live/live/abr.m3u8?token=SEU_TOKEN';
video.play();
```

### Verificar Logs

```bash
# Logs do nginx
docker-compose logs nginx

# Logs do auth server  
docker-compose logs yustream-auth

# Status do sistema
curl https://yustream.yurisp.com.br/health
```

---

**🎉 Player revisado e pronto!** Use a página de teste para verificar cada etapa.
