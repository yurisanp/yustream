# 🎥 Yustream - Servidor de Streaming

Um servidor de streaming profissional baseado no **OvenMediaEngine**, configurado para receber streams do OBS Studio e disponibilizar múltiplas qualidades através de WebRTC, HLS e LLHLS com player web otimizado.

## 🚀 Características

- **OvenMediaEngine**: Servidor de streaming open-source profissional
- **Múltiplas Qualidades**: 4K, 1440p, 1080p, 720p, 480p, 360p automáticas
- **Três Protocolos**: WebRTC (ultra baixa latência), LLHLS (baixa latência), HLS (compatível)
- **Stream Player Avançado**: Interface React com seleção de qualidade e protocolo
- **Auto-Play Inteligente**: Inicia automaticamente com fallback de protocolos
- **Ultra Responsivo**: Otimizado para smartphones, tablets e Smart TVs
- **Controles Profissionais**: Touch, teclado e mouse otimizados
- **Latência Sub-Segundo**: WebRTC com ~200ms de latência
- **Transcodificação Automática**: Múltiplas qualidades geradas automaticamente
- **Docker Otimizado**: Deploy profissional com configurações avançadas

## 📋 Pré-requisitos

- Docker e Docker Compose instalados
- Node.js 18+ (para desenvolvimento React)
- npm ou yarn (para gerenciar dependências)
- Portas disponíveis: 80, 443, 1935, 3333, 3334, 8080, 10000-10005/UDP

## 🛠️ Instalação

### 1. Clone ou baixe os arquivos
```bash
git clone <seu-repositorio>
cd yustream
```

### 2. Inicie os serviços
```bash
docker-compose up -d
```

### 3. Aguarde a inicialização
O Ant Media Server pode levar alguns minutos para inicializar completamente.

### 4. Acesse o Stream Player
Abra seu navegador e acesse: `http://localhost`

O OvenMediaEngine pode levar alguns minutos para inicializar e começar a transcodificar as qualidades.

## 💻 Desenvolvimento React

### Modo Desenvolvimento
Para desenvolver a interface React com hot-reload:

```bash
# Windows
dev-react.bat

# Linux/macOS
cd yustream-react && npm run dev
```

A aplicação ficará disponível em `http://localhost:3000` com proxy automático para a API.

### Build de Produção
Para fazer build e deploy da aplicação:

```bash
# Windows
build-react.bat

# Linux/macOS
cd yustream-react && npm run build && cd .. && cp -r yustream-react/dist web && docker-compose restart nginx
```

### Estrutura do Projeto React
```
yustream-react/
├── src/
│   ├── components/          # Componentes React
│   │   ├── Header.tsx      # Cabeçalho da aplicação
│   │   ├── VideoPlayer.tsx # Player de vídeo principal
│   │   ├── ConnectionInfo.tsx # Informações de conexão
│   │   ├── Instructions.tsx # Instruções de uso
│   │   ├── Footer.tsx      # Rodapé
│   │   └── Toast.tsx       # Notificações
│   ├── App.tsx             # Componente principal
│   ├── App.css            # Estilos globais
│   └── main.tsx           # Ponto de entrada
├── package.json           # Dependências npm
└── vite.config.ts        # Configuração do Vite
```

### Dependências Principais
- **React 18** + **TypeScript**: Framework e tipagem
- **OvenPlayer**: Player JavaScript oficial do AirenSoft para OvenMediaEngine
- **WebRTC + LLHLS + HLS**: Suporte completo a todos os protocolos
- **lucide-react**: Ícones modernos
- **Vite**: Build tool rápido

## 🎮 Como Usar

### 📺 Configurando o OBS Studio

1. **Abra o OBS Studio**
2. **Vá em Configurações → Stream**
3. **Selecione "Custom..." como serviço**
4. **Configure:**
   - **Servidor**: `rtmp://SEU_IP:1935/live`
   - **Chave da Stream**: `live` (stream padrão única do sistema)
5. **Clique em "OK" e depois "Iniciar Streaming"**

### 🖥️ Assistindo no VLC Media Player

#### Opção 1: HLS (Recomendado)
1. **Abra o VLC**
2. **Vá em Mídia → Abrir Fluxo de Rede**
3. **Cole a URL**: `http://SEU_IP/ome-hls/live/live/abr.m3u8` (ABR - Múltiplas qualidades)
4. **Clique em "Reproduzir"**

#### Opção 2: RTMP
1. **Abra o VLC**
2. **Vá em Mídia → Abrir Fluxo de Rede**
3. **Cole a URL**: `rtmp://SEU_IP:1935/live/live`
4. **Clique em "Reproduzir"**

### 🌐 Stream Player Web

1. **Acesse**: `http://SEU_IP`
2. **A stream inicia automaticamente** (auto-play)
3. **Controles avançados disponíveis:**
   - **Play/Pause**: Controle de reprodução
   - **Volume**: Ajuste de áudio (desktop)
   - **Protocolo**: WebRTC, LLHLS ou HLS
   - **Qualidade**: Auto, 4K, 1440p, 1080p, 720p, 480p, 360p
   - **Fullscreen**: Tela cheia para melhor experiência
4. **Três protocolos com fallback automático:**
   - **WebRTC**: Ultra baixa latência (~200ms) - Sub-segundo
   - **LLHLS**: Baixa latência (~2s) - Low Latency HLS
   - **HLS**: Compatível (~10s) - Máxima compatibilidade
5. **Powered by OvenPlayer**: Player oficial do AirenSoft otimizado para OME

## 🔧 Configuração Avançada

### Alterando IDs de Stream

Para usar diferentes IDs de stream:

1. **No OBS**: Use o ID desejado como "Chave da Stream"
2. **No Player Web**: Digite o mesmo ID no campo correspondente
3. **No VLC**: Substitua "stream1" pelo seu ID nas URLs

### Configurando IP Externo

Para acesso externo, edite os arquivos:

1. **docker-compose.yml**: Ajuste as portas se necessário
2. **web/script.js**: Altere `window.location.hostname` para seu IP fixo
3. **Firewall**: Libere as portas necessárias

### Configurações do Ant Media Server

Acesse o painel administrativo em: `http://SEU_IP:5080`

- **Usuário**: admin
- **Senha**: (será solicitada na primeira configuração)

## 📊 Monitoramento

### Status do Servidor
- **Interface Web**: Mostra status em tempo real
- **API REST**: `http://SEU_IP:5080/live/rest/v2`
- **Logs**: `docker-compose logs ant-media-server`

### Streams Ativas
A interface web mostra automaticamente:
- Status do servidor (Online/Offline)
- Número de streams ativas
- Atualização automática a cada 30 segundos

## 🐛 Solução de Problemas

### Stream não inicia no OBS
1. Verifique se o servidor está rodando: `docker-compose ps`
2. Confirme as configurações de RTMP no OBS
3. Verifique os logs: `docker-compose logs ant-media-server`

### Player web não reproduz
1. Verifique se a stream está ativa no OBS
2. Teste com modo HLS se WebRTC não funcionar
3. Verifique o console do navegador (F12)

### VLC não conecta
1. Aguarde alguns segundos após iniciar a stream no OBS
2. Teste ambas as URLs (HLS e RTMP)
3. Verifique se as portas estão abertas

### Latência alta
1. Use WebRTC no player web para menor latência
2. Ajuste configurações de encoding no OBS
3. Verifique a qualidade da conexão de rede

## 📁 Estrutura do Projeto

```
yustream/
├── docker-compose.yml          # Configuração dos containers
├── nginx/
│   ├── nginx.conf             # Configuração principal do Nginx
│   └── conf.d/
│       └── streaming.conf     # Configuração do proxy
├── web/
│   ├── index.html            # Interface principal
│   ├── style.css             # Estilos da interface
│   └── script.js             # Lógica do player
├── ant-media-data/           # Dados persistentes (criado automaticamente)
├── logs/                     # Logs do sistema (criado automaticamente)
└── README.md                 # Esta documentação
```

## 🔒 Segurança

### Recomendações de Produção
1. **Configure HTTPS** com certificados SSL
2. **Altere senhas padrão** do Ant Media Server
3. **Configure firewall** adequadamente
4. **Use autenticação** para streams privadas
5. **Monitore logs** regularmente

### Configuração SSL (Opcional)
1. Obtenha certificados SSL (Let's Encrypt recomendado)
2. Coloque os certificados na pasta `ssl/`
3. Descomente as configurações HTTPS no nginx

## 🚀 Performance

### Otimizações Recomendadas
- **CPU**: Mínimo 2 cores, recomendado 4+ cores
- **RAM**: Mínimo 2GB, recomendado 4GB+
- **Rede**: Banda larga estável (upload importante)
- **Disco**: SSD recomendado para melhor I/O

### Configurações do OBS
- **Encoder**: x264 ou NVENC (se disponível)
- **Rate Control**: CBR
- **Bitrate**: 2000-6000 kbps dependendo da qualidade desejada
- **Keyframe Interval**: 2 segundos

## 📞 Suporte

Para problemas específicos:

1. **Verifique os logs**: `docker-compose logs`
2. **Consulte a documentação** do Ant Media Server
3. **Teste conectividade** das portas
4. **Verifique recursos** do sistema (CPU, RAM, rede)

## 📄 Licença

Este projeto utiliza o Ant Media Server Community Edition, que é gratuito para uso não comercial. Para uso comercial, considere a versão Enterprise do Ant Media Server.

## 🤝 Contribuições

Contribuições são bem-vindas! Sinta-se à vontade para:
- Reportar bugs
- Sugerir melhorias
- Enviar pull requests
- Melhorar a documentação

---

**Desenvolvido com ❤️ para a comunidade de streaming**
