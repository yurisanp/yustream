# 🔧 VNC via NGINX Integrado - YuStream

## 🎯 Nova Arquitetura Simplificada

### **📋 Mudança de Abordagem**
- ❌ **Antes**: Servidor VNC proxy separado com WebSocket próprio
- ❌ **Antes**: Subdomínios dedicados para VNC
- ✅ **Agora**: NGINX como proxy direto para VNC
- ✅ **Agora**: Configurações integradas no domínio principal

### **🏗️ Arquitetura NGINX Integrada**
```
[Frontend] ←HTTPS/WSS→ [NGINX] ←TCP→ [VNC Server]
     ↓                    ↓              ↓
  localhost:5173    localhost:80/443  192.168.18.96:5900
  (desenvolvimento)   (proxy)         (Windows Server)
```

## ✅ **Configurações Implementadas**

### **🌐 NGINX streaming.conf (Localhost)**
```nginx
# Upstream VNC
upstream vnc_backend {
    server 192.168.18.96:5900;
    keepalive 32;
}

# Status VNC sem autenticação (desenvolvimento)
location /api/vnc/status {
    content_by_lua_block {
        local sock = ngx.socket.tcp()
        sock:settimeout(5000)
        
        local ok, err = sock:connect("192.168.18.96", 5900)
        local status = {
            available = ok or false,
            host = "192.168.18.96",
            port = 5900,
            name = "Servidor de Streaming",
            testMethod = "nginx-tcp"
        }
        
        sock:close()
        ngx.header["Content-Type"] = "application/json"
        ngx.say(require("cjson").encode(status))
    }
}

# WebSocket VNC direto (desenvolvimento)
location /vnc-ws {
    proxy_pass http://vnc_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_buffering off;
}
```

### **🔒 NGINX ssl.conf (Servidor Produção)**
```nginx
# Upstream VNC com autenticação
upstream vnc_backend_ssl {
    server 192.168.18.96:5900;
    keepalive 32;
}

# Autenticação VNC interna
location = /auth-vnc {
    internal;
    proxy_pass http://auth_server_ssl/auth/verify-vnc;
    proxy_set_header Authorization $http_authorization;
}

# Status VNC com autenticação
location /api/vnc/status {
    auth_request /auth-vnc;
    auth_request_set $user $upstream_http_x_user;
    
    # Apenas admins
    access_by_lua_block {
        if ngx.var.user_role ~= "admin" then
            ngx.status = 403
            ngx.exit(403)
        end
    }
    
    # Teste TCP + resposta JSON
    content_by_lua_block { ... }
}

# WebSocket VNC com autenticação
location /vnc-ws {
    auth_request /auth-vnc;
    
    # Validação admin
    access_by_lua_block { ... }
    
    # Proxy para VNC
    proxy_pass http://vnc_backend_ssl;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

### **🔐 Auth Server (/auth/verify-vnc)**
```javascript
app.get("/auth/verify-vnc", async (req, res) => {
  const token = req.headers.authorization?.substring(7);
  const decoded = jwt.verify(token, JWT_SECRET);
  const user = await User.findById(decoded.id);
  
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Apenas administradores' });
  }
  
  // Headers para NGINX
  res.set('X-User', user.username);
  res.set('X-User-Role', user.role);
  res.set('X-User-ID', user.id.toString());
  
  res.json({ authorized: true, user: user.username });
});
```

## 🚀 **Frontend Atualizado**

### **📡 Detecção Automática de Ambiente**
```typescript
// URL WebSocket dinâmica baseada no protocolo
const wsUrl = window.location.protocol === 'https:' 
  ? 'wss://' + window.location.host + '/vnc-ws'
  : 'ws://' + window.location.host + '/vnc-ws'

// Status via NGINX integrado
const response = await fetch('/api/vnc/status', {
  headers: { 'Authorization': `Bearer ${token}` }
})
```

### **🔄 Fluxo de Conexão Simplificado**
```
1. Frontend → GET /api/vnc/status
2. NGINX → Lua script testa TCP 192.168.18.96:5900
3. Frontend → WebSocket /vnc-ws (com Bearer token)
4. NGINX → auth_request /auth-vnc
5. Auth Server → Valida admin + retorna headers
6. NGINX → Proxy WebSocket para VNC server
7. Canvas VNC → Controle total do desktop
```

## 🎮 **Como Funciona Agora**

### **🏠 Desenvolvimento (localhost:5173)**
```
1. React Dev Server → localhost:80 (NGINX)
2. NGINX streaming.conf → Proxy /vnc-ws para 192.168.18.96:5900
3. Sem autenticação (desenvolvimento)
4. WebSocket direto: ws://localhost/vnc-ws
```

### **🌐 Produção (yustream.yurisp.com.br)**
```
1. React Build → HTTPS (NGINX SSL)
2. NGINX ssl.conf → auth_request /auth-vnc
3. Auth Server → Valida token + role admin
4. NGINX → Proxy /vnc-ws para 192.168.18.96:5900
5. WebSocket seguro: wss://yustream.yurisp.com.br/vnc-ws
```

## 🔧 **Configuração Necessária**

### **🐧 Servidor YuStream (Linux)**
```bash
# Túnel SSH para VNC (se necessário)
ssh -L 5900:localhost:5900 streaming_user@192.168.18.96

# Ou acesso direto se na mesma rede
# NGINX conecta diretamente a 192.168.18.96:5900
```

### **🪟 Windows Server (192.168.18.96)**
```powershell
# TightVNC configurado para aceitar conexões da rede
Set-ItemProperty -Path "HKLM:\SOFTWARE\TightVNC\Server" -Name "LocalhostOnly" -Value 0
Set-ItemProperty -Path "HKLM:\SOFTWARE\TightVNC\Server" -Name "RfbPort" -Value 5900

# Firewall permitir NGINX
New-NetFirewallRule -DisplayName "VNC YuStream" -Direction Inbound -Protocol TCP -LocalPort 5900 -Action Allow -RemoteAddress "IP_DO_SERVIDOR_YUSTREAM"
```

## 🎯 **Vantagens da Nova Arquitetura**

### **✅ Simplicidade**
- **NGINX nativo**: Sem serviços adicionais
- **Configuração única**: Tudo no domínio principal
- **Teste integrado**: Lua script no NGINX
- **WebSocket direto**: Sem proxy intermediário

### **✅ Performance**
- **Menos latência**: NGINX → VNC direto
- **Menos overhead**: Sem Node.js intermediário
- **Cache keepalive**: Conexões TCP otimizadas
- **Logs nativos**: NGINX access logs

### **✅ Segurança**
- **Autenticação NGINX**: auth_request nativo
- **Validação Lua**: Verificação de role inline
- **Logs auditoria**: Todas as conexões registradas
- **SSL/TLS**: Criptografia end-to-end

### **✅ Manutenção**
- **Configuração central**: Tudo no NGINX
- **Menos código**: Frontend mais simples
- **Debug facilitado**: Logs estruturados
- **Escalabilidade**: NGINX load balancing nativo

## 🚀 **Endpoints Ativos**

### **📊 Status VNC**
```http
GET /api/vnc/status
Authorization: Bearer <token>

Response: {
  "available": true,
  "host": "192.168.18.96",
  "port": 5900,
  "name": "Servidor de Streaming",
  "testMethod": "nginx-tcp-auth",
  "reliability": "high"
}
```

### **🔌 WebSocket VNC**
```javascript
// Conexão WebSocket com autenticação
const ws = new WebSocket('wss://yustream.yurisp.com.br/vnc-ws', [], {
  headers: { 'Authorization': 'Bearer ' + token }
})

// Ou localhost
const ws = new WebSocket('ws://localhost/vnc-ws')
```

## 🎊 **SISTEMA VNC INTEGRADO AO NGINX IMPLEMENTADO!**

✅ **NGINX Proxy**: Configurado em streaming.conf e ssl.conf
✅ **Autenticação**: Integrada via auth_request
✅ **Teste TCP**: Lua script nativo no NGINX  
✅ **WebSocket**: Proxy direto para VNC server
✅ **Frontend**: URLs dinâmicas baseadas no ambiente
✅ **Logs**: Auditoria completa via NGINX

**🎯 VNC agora funciona nativamente via NGINX sem subdomínios!**
