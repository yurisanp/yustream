# YuStream - Sistema de Autenticação

## 📋 Visão Geral

O YuStream agora possui um sistema completo de autenticação que protege o acesso às streams tanto na interface web quanto para clientes externos como VLC, OBS e outros players.

## 🔐 Funcionalidades Implementadas

### 1. **Sistema de Login Web**
- Interface moderna e responsiva
- Autenticação via JWT (JSON Web Tokens)
- Sessão persistente com localStorage
- Logout seguro

### 2. **Validação de Stream Offline**
- Verificação automática do status da stream
- Notificações em tempo real
- Retry automático quando a stream volta online
- Interface visual para diferentes estados (conectando, online, offline, erro)

### 3. **Proteção de Streams**
- Todas as rotas de streaming protegidas por autenticação
- Tokens temporários para acesso às streams
- Suporte para clientes externos (VLC, etc.)

## 👥 Usuários Padrão

### Administrador
- **Usuário:** `admin`
- **Senha:** `admin123`
- **Permissões:** Acesso total ao sistema

### Usuário Comum
- **Usuário:** `user`
- **Senha:** `password`
- **Permissões:** Acesso à visualização de streams

## 🚀 Como Usar

### Iniciando o Sistema

#### Windows:
```bash
start-auth.bat
```

#### Linux/macOS:
```bash
chmod +x start.sh
./start.sh
```

### Acessando a Interface Web

1. Abra o navegador em `http://localhost`
2. Faça login com um dos usuários padrão
3. Aguarde a verificação da stream
4. Aproveite a transmissão!

### Usando com Clientes Externos (VLC, etc.)

#### Passo 1: Obter Token de Acesso
Faça uma requisição POST para obter o token:

```bash
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

#### Passo 2: Obter Token de Stream
Com o token de autenticação, obtenha o token da stream:

```bash
curl -X GET http://localhost/api/stream/token \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

#### Passo 3: Acessar Stream
Use o token da stream na URL:

**HLS (recomendado):**
```
http://localhost/hls/live/abr.m3u8?token=SEU_STREAM_TOKEN_AQUI
```

**WebRTC:**
```
ws://localhost/ws/live/abr_webrtc?token=SEU_STREAM_TOKEN_AQUI
```

## 🔧 Configuração do OBS Studio

1. **Servidor RTMP:** `rtmp://localhost:1935/live`
2. **Chave da Stream:** `live`
3. **Configurações Recomendadas:**
   - Bitrate: 2500-6000 kbps
   - Encoder: x264
   - Preset: veryfast
   - Profile: main

## 📱 Exemplo com VLC Player

### Método 1: Via Interface
1. Abra o VLC
2. Vá em Mídia > Abrir Fluxo de Rede
3. Cole a URL com token: `http://localhost/hls/live/abr.m3u8?token=SEU_TOKEN`

### Método 2: Via Linha de Comando
```bash
vlc "http://localhost/hls/live/abr.m3u8?token=SEU_TOKEN"
```

## 🛡️ Segurança

### Tokens JWT
- **Duração:** 24 horas (token de autenticação)
- **Duração:** 1 hora (token de stream)
- **Algoritmo:** HS256
- **Renovação:** Automática no frontend

### Rate Limiting
- **Login:** 5 tentativas por 15 minutos
- **API Geral:** 100 requests por 15 minutos

### Headers de Segurança
- CORS configurado
- Helmet.js para headers de segurança
- Validação de entrada

## 🔍 Monitoramento

### Logs do Sistema
```bash
# Ver logs de todos os serviços
docker-compose logs -f

# Ver logs específicos
docker-compose logs -f yustream-auth
docker-compose logs -f nginx
docker-compose logs -f ovenmediaengine
```

### Status dos Serviços
```bash
# Verificar status
docker-compose ps

# Health checks
curl http://localhost/api/health
curl http://localhost/status
```

## 🐛 Solução de Problemas

### Stream Não Carrega
1. Verifique se está logado
2. Confirme se a stream está sendo transmitida (OBS)
3. Verifique os logs: `docker-compose logs -f`

### Erro de Autenticação
1. Limpe o cache do navegador
2. Tente fazer logout e login novamente
3. Verifique se os serviços estão rodando

### Token Expirado
- Os tokens são renovados automaticamente
- Se persistir, faça logout e login novamente

### VLC Não Reproduz
1. Verifique se o token não expirou (1 hora de validade)
2. Obtenha um novo token de stream
3. Teste com curl primeiro:
   ```bash
   curl -I "http://localhost/hls/live/abr.m3u8?token=SEU_TOKEN"
   ```

## 🔄 Atualizações

### Parar Sistema
```bash
docker-compose down
```

### Reconstruir Imagens
```bash
docker-compose up --build -d
```

### Limpar Dados
```bash
docker-compose down -v
docker system prune -f
```

## 📞 Suporte

Para problemas ou dúvidas:
1. Verifique os logs primeiro
2. Consulte este documento
3. Teste com os usuários padrão
4. Verifique se todos os serviços estão rodando

---

**🎯 Sistema totalmente funcional com autenticação completa!**
