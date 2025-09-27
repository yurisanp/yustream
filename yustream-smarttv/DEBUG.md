# 🐛 Debug YuStream Smart TV

## Player Simplificado - Resolução de Problemas

### 🔍 Página de Teste

Use a página de teste para debug:
```bash
# Abrir no navegador
open test-player.html
# Ou servir via HTTP
python -m http.server 8000
# Acessar: http://localhost:8000/test-player.html
```

### 📊 Diagnóstico Passo-a-Passo

#### 1. Testar Autenticação
```javascript
// No console do navegador
await window.authService.login('admin', 'admin123');
console.log('Token:', window.authService.getToken());
```

#### 2. Testar Status da Stream
```javascript
// Verificar se stream está online
const status = await window.authService.getStreamStatus();
console.log('Stream online:', status.online);
```

#### 3. Testar Player Básico
```javascript
// Criar player simples
const player = new TVStreamPlayer({
    onStatusChange: (status) => console.log('Status:', status),
    onError: (error) => console.error('Erro:', error),
    getStreamToken: () => window.authService.getStreamToken()
});

await player.initialize();
```

### 🔧 Problemas Comuns e Soluções

#### ❌ "Conexão sendo abortada antes de carregar"

**Causa**: AbortController ou inicialização complexa
**Solução**: Usar `TVStreamPlayer` (versão ultra simplificada)

```javascript
// ❌ Versão complexa (com abort)
const complexPlayer = new StreamPlayer(); // Pode abortar

// ✅ Versão simples (sem abort)
const simplePlayer = new TVStreamPlayer(); // Não aborta
```

#### ❌ "Player inicializa mas não aparece na tela"

**Causa**: Problemas de CSS ou elemento DOM
**Soluções**:

1. **Verificar elemento video:**
```javascript
const video = document.getElementById('video-player');
console.log('Video element:', video);
console.log('Video src:', video?.src);
console.log('Video error:', video?.error);
```

2. **Verificar CSS:**
```css
#video-player {
    width: 100% !important;
    height: 100% !important;
    display: block !important;
    background: red; /* Para debug - deve aparecer vermelho */
}
```

3. **Forçar visibilidade:**
```javascript
const video = document.getElementById('video-player');
video.style.width = '100%';
video.style.height = '400px';
video.style.background = 'blue';
video.style.display = 'block';
```

#### ❌ "Stream não carrega"

**Verificações**:

1. **URL da stream:**
```javascript
console.log('Config:', window.YUSTREAM_CONFIG);
// Deve mostrar: SERVER_URL e STREAM_URL corretos
```

2. **Token válido:**
```javascript
const token = await window.authService.getStreamToken();
console.log('Stream token:', token);
```

3. **Conectividade:**
```bash
# Testar URLs manualmente
curl https://yustream.yurisp.com.br/health
curl https://yustream.yurisp.com.br:8443/live/live/abr.m3u8
```

#### ❌ "CORS errors"

**Solução**: Verificar headers nginx
```nginx
add_header Access-Control-Allow-Origin "*" always;
add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization" always;
```

### 🎯 Debugging por Plataforma

#### Samsung Tizen
```javascript
// Verificar se Tizen está disponível
console.log('Tizen:', typeof window.tizen !== 'undefined');

// Registrar teclas
if (window.tizen) {
    tizen.tvinputdevice.registerKey('MediaPlayPause');
}
```

#### LG webOS
```javascript
// Verificar se webOS está disponível
console.log('webOS:', typeof window.webOS !== 'undefined');

// Verificar serviços
if (window.webOS && window.webOS.service) {
    console.log('webOS services available');
}
```

#### Android TV
```javascript
// Verificar user agent
console.log('Android TV:', navigator.userAgent.includes('android') && navigator.userAgent.includes('tv'));
```

### 📱 Debug no Smart TV

#### Tizen (Samsung)
1. Conectar via SDB: `sdb connect [IP_TV]:26101`
2. Abrir Web Inspector: `sdb shell 0 debug [APP_ID]`
3. Usar Chrome DevTools

#### webOS (LG)
1. Habilitar Developer Mode na TV
2. Usar webOS TV SDK
3. Debug via `ares-inspect`

#### Android TV
1. Habilitar Developer Options
2. USB Debugging
3. Chrome DevTools via `chrome://inspect`

### 🔍 Logs Úteis

#### Logs do Player
```javascript
// Informações do player
console.log('Player info:', testPlayer?.getInfo());

// Status detalhado
console.log('Video element:', document.getElementById('video-player'));
console.log('HLS instance:', testPlayer?.hlsInstance);
```

#### Logs do Sistema
```javascript
// Configuração
console.log('Config:', window.YUSTREAM_CONFIG);

// Dispositivo
console.log('Device:', window.deviceUtils?.getInfo());

// Autenticação
console.log('Auth:', {
    authenticated: window.authService?.isAuthenticated(),
    user: window.authService?.getUser(),
    token: window.authService?.getToken()?.substring(0, 20) + '...'
});
```

### 🛠️ Ferramentas de Debug

#### Console Commands
```javascript
// Ativar debug mode
localStorage.setItem('YUSTREAM_DEBUG', 'true');

// Informações completas
window.yuStreamApp.getInfo();

// Reiniciar player
window.tvInterface?.streamPlayer?.retry();

// Verificar elementos focáveis
window.tvNavigation?.focusableElements;
```

#### Network Debug
```javascript
// Interceptar requests
const originalFetch = window.fetch;
window.fetch = function(...args) {
    console.log('Fetch:', args[0]);
    return originalFetch.apply(this, args)
        .then(response => {
            console.log('Response:', response.status, args[0]);
            return response;
        });
};
```

### 🚨 Solução de Emergência

Se nada funcionar, use player HTML5 puro:

```html
<video id="emergency-player" controls autoplay style="width:100%;height:400px;">
    <source src="https://yustream.yurisp.com.br:8443/live/live/abr.m3u8?token=SEU_TOKEN" type="application/x-mpegURL">
    Seu dispositivo não suporta este formato de vídeo.
</video>
```

### 📞 Suporte

1. **Usar página de teste** primeiro
2. **Verificar logs** no console
3. **Testar em desktop** antes da TV
4. **Reportar problema** com logs completos

---

**Debug concluído!** Use as ferramentas acima para identificar e resolver problemas.
