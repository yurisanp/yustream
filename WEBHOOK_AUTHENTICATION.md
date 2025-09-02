# YuStream - Sistema de Autenticação via Webhooks

## 🎯 **Nova Abordagem Implementada**

Migrei do sistema de autenticação via Nginx para **Admission Webhooks** do OvenMediaEngine, que é a abordagem nativa e mais eficiente para controle de acesso em streaming.

## 🔧 **Como Funciona**

### **1. Fluxo de Autenticação**
```
Cliente → OvenMediaEngine → Webhook → API Auth → Resposta (allow/deny)
```

### **2. Tipos de Requisições**
- **Incoming (RTMP):** Streams de entrada (OBS) - **permitidas sem token**
- **Outgoing (WebRTC/LLHLS):** Visualização - **requer token válido**

### **3. Validação por Webhook**
- OvenMediaEngine chama `/webhook/admission` antes de permitir conexões
- API valida o token JWT no parâmetro `?token=`
- Retorna `allowed: true/false` com `lifetime` em segundos

## ⚙️ **Configuração Implementada**

### **OvenMediaEngine (VHost.xml)**
```xml
<AdmissionWebhooks>
    <ControlServerUrl>http://yustream-auth:3001/webhook/admission</ControlServerUrl>
    <SecretKey>yustream-webhook-secret-2024</SecretKey>
    <Timeout>5000</Timeout>
    <Enables>
        <Providers>rtmp</Providers>
        <Publishers>webrtc,llhls</Publishers>
    </Enables>
</AdmissionWebhooks>
```

### **API de Autenticação**
```javascript
// Webhook de admissão
app.post('/webhook/admission', (req, res) => {
  const { direction, protocol, url, stream, ip } = req.body.request;
  
  // RTMP entrada (OBS) - sempre permitir
  if (direction === 'incoming') {
    return res.json({ allowed: true, new_url: url, lifetime: 0 });
  }
  
  // WebRTC/LLHLS saída - validar token
  if (direction === 'outgoing') {
    const token = extrairTokenDaURL(url);
    
    if (validarToken(token)) {
      return res.json({ 
        allowed: true, 
        new_url: removerToken(url), 
        lifetime: 3600 
      });
    }
  }
  
  return res.json({ allowed: false, new_url: url, lifetime: 0 });
});
```

### **Nginx Simplificado**
```nginx
# Sem auth_request - apenas proxy simples
location /hls/ {
    proxy_pass http://ovenmediaengine_hls/live/;
    # Headers básicos apenas
}

location /ws {
    proxy_pass http://ovenmediaengine_webrtc/live;
    # WebSocket headers
}
```

## 🚀 **Vantagens da Nova Abordagem**

### ✅ **Performance**
- **Sem proxy complexo** no Nginx
- **Validação nativa** do OvenMediaEngine
- **Menos overhead** de rede

### ✅ **Compatibilidade**
- **WebRTC funciona perfeitamente** (sem problemas de proxy)
- **LLHLS sem interferência** do Nginx
- **Suporte nativo** para todos os protocolos

### ✅ **Controle Granular**
- **Diferentes políticas** para entrada/saída
- **Lifetime configurável** por sessão
- **Logs detalhados** de todas as tentativas

### ✅ **Simplicidade**
- **Uma única validação** no OvenMediaEngine
- **Nginx apenas como proxy** simples
- **Menos pontos de falha**

## 🔑 **URLs de Acesso**

### **Para Web Player**
```javascript
// WebRTC
ws://localhost/ws/live/abr_webrtc?token=SEU_TOKEN

// LLHLS  
http://localhost/hls/live/abr.m3u8?token=SEU_TOKEN
```

### **Para VLC/Clientes Externos**
```bash
# Obter token
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Obter stream token
curl -X GET http://localhost/api/stream/token \
  -H "Authorization: Bearer SEU_AUTH_TOKEN"

# Usar no VLC
vlc "http://localhost/hls/live/abr.m3u8?token=SEU_STREAM_TOKEN"
```

### **Para OBS (Entrada)**
```
Servidor: rtmp://localhost:1935/live
Chave: live
(Sem necessidade de token)
```

## 📊 **Logs de Debug**

### **Webhook de Admissão**
```
=== ADMISSION WEBHOOK ===
📡 Webhook Request: outgoing webrtc ws://localhost/ws/live/abr_webrtc?token=...
🎥 Stream: live
🌐 IP: 172.18.0.1
🔑 Token extraído: presente
✅ Acesso permitido para usuário: admin
```

### **Validação de Token**
- ✅ Token JWT válido
- ✅ `streamAccess: true`
- ✅ Usuário autenticado
- ✅ Lifetime: 3600s (1 hora)

## 🛠️ **Comandos de Teste**

### **Verificar Logs**
```bash
# Logs do OvenMediaEngine
docker-compose logs -f ovenmediaengine

# Logs da API Auth
docker-compose logs -f yustream-auth

# Logs do Nginx
docker-compose logs -f nginx
```

### **Testar Webhook Diretamente**
```bash
curl -X POST http://localhost/api/webhook/admission \
  -H "Content-Type: application/json" \
  -d '{
    "request": {
      "direction": "outgoing",
      "protocol": "webrtc", 
      "url": "ws://localhost/ws/live/abr_webrtc?token=SEU_TOKEN",
      "stream": {"name": "live"},
      "ip": "127.0.0.1"
    }
  }'
```

## 🎉 **Sistema Otimizado**

### **Antes (Problemático):**
- ❌ Nginx proxy complexo com auth_request
- ❌ Incompatibilidades com WebRTC
- ❌ Loops de validação
- ❌ Múltiplos pontos de falha

### **Depois (Otimizado):**
- ✅ OvenMediaEngine controla acesso nativamente
- ✅ Webhooks simples e eficientes
- ✅ WebRTC/LLHLS funcionam perfeitamente
- ✅ Um único ponto de validação
- ✅ Logs claros e informativos
- ✅ Performance otimizada

**O sistema agora usa a abordagem nativa do OvenMediaEngine para autenticação, eliminando os problemas de compatibilidade do Nginx!** 🚀
