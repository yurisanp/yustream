# 📺 Guia de Configuração do OBS Studio

Este guia detalha como configurar o OBS Studio para streaming com o Yustream.

## 🚀 Configuração Rápida

### 1. Configurações de Stream
1. **Abra o OBS Studio**
2. **Clique em "Configurações"** (ou pressione `Ctrl + ,`)
3. **Selecione "Stream" no menu lateral**
4. **Configure:**
   - **Serviço**: `Custom...`
   - **Servidor**: `rtmp://SEU_IP:1935/live`
   - **Chave da Stream**: `live` (stream padrão única do sistema)

### 2. Configurações de Saída
1. **Selecione "Saída" no menu lateral**
2. **Configure:**
   - **Modo de Saída**: `Simples` (para iniciantes) ou `Avançado` (para usuários experientes)

#### Modo Simples:
- **Qualidade de Vídeo**: `Indistinguível da Qualidade, Grande Tamanho de Arquivo`
- **Encoder**: `Software (x264)` ou `Hardware (NVENC)` se disponível
- **Controle de Taxa**: `CBR`
- **Bitrate**: `2500 Kbps` (ajuste conforme sua internet)

#### Modo Avançado (Aba Streaming):
- **Encoder**: `x264` ou `NVENC H.264`
- **Controle de Taxa**: `CBR`
- **Bitrate**: `2500 Kbps`
- **Intervalo de Keyframe**: `2`
- **Preset**: `veryfast` (x264) ou `Quality` (NVENC)
- **Perfil**: `high`

### 3. Configurações de Vídeo
1. **Selecione "Vídeo" no menu lateral**
2. **Configure:**
   - **Resolução Base**: `1920x1080` (sua resolução de tela)
   - **Resolução de Saída**: `1920x1080` ou `1280x720`
   - **Filtro de Redimensionamento**: `Bicúbico`
   - **FPS**: `30` ou `60` (30 FPS é suficiente para a maioria dos casos)

### 4. Configurações de Áudio
1. **Selecione "Áudio" no menu lateral**
2. **Configure:**
   - **Taxa de Amostragem**: `44.1 kHz`
   - **Canais**: `Estéreo`
   - **Bitrate de Áudio**: `160 Kbps`

## 🎯 Configurações Otimizadas por Tipo de Conteúdo

### Gaming (Jogos)
```
Resolução: 1920x1080 ou 1280x720
FPS: 60
Bitrate: 4000-6000 Kbps
Encoder: NVENC (se disponível) ou x264 fast
Preset: Quality/Performance
```

### Webcam/Conversa
```
Resolução: 1280x720
FPS: 30
Bitrate: 2000-3000 Kbps
Encoder: x264
Preset: veryfast
```

### Apresentações/Desktop
```
Resolução: 1920x1080
FPS: 30
Bitrate: 2500-4000 Kbps
Encoder: x264
Preset: fast
```

## 🔧 Configurações Avançadas

### Para Conexões Lentas (< 5 Mbps upload)
```
Resolução: 1280x720
FPS: 30
Bitrate: 1500-2500 Kbps
Encoder: x264
Preset: veryfast
Perfil: baseline
```

### Para Máxima Qualidade (> 10 Mbps upload)
```
Resolução: 1920x1080
FPS: 60
Bitrate: 6000-8000 Kbps
Encoder: NVENC (se disponível)
Preset: Quality
Perfil: high
```

### Configurações de NVENC (GPU NVIDIA)
Se você tem uma placa NVIDIA GTX 1060 ou superior:
```
Encoder: NVENC H.264
Rate Control: CBR
Bitrate: 4000-6000 Kbps
Keyframe Interval: 2
Preset: Quality
Profile: high
Level: auto
Max B-frames: 2
```

## 🎬 Configurando Fontes

### Captura de Tela
1. **Clique no "+" em Fontes**
2. **Selecione "Captura de Tela"**
3. **Configure:**
   - **Monitor**: Selecione o monitor desejado
   - **Capturar Cursor**: Marque se quiser mostrar o cursor

### Webcam
1. **Clique no "+" em Fontes**
2. **Selecione "Dispositivo de Captura de Vídeo"**
3. **Configure:**
   - **Dispositivo**: Selecione sua webcam
   - **Resolução**: 1920x1080 ou máxima suportada
   - **FPS**: 30

### Áudio
1. **Clique no "+" em Fontes**
2. **Selecione "Captura de Áudio de Entrada"** (microfone)
3. **Configure:**
   - **Dispositivo**: Selecione seu microfone
   - **Use Device Timestamps**: Marque

## 🎮 Configurações para Jogos

### Captura de Jogo
1. **Clique no "+" em Fontes**
2. **Selecione "Captura de Jogo"**
3. **Configure:**
   - **Modo**: `Capturar janela específica`
   - **Janela**: Selecione o jogo
   - **Prioridade de Correspondência**: `Corresponder título, caso contrário encontrar janela`

### Configurações Anti-Cheat
Para jogos com anti-cheat (Valorant, etc.):
- Use **"Captura de Tela"** em vez de **"Captura de Jogo"**
- Configure região específica se necessário

## 📊 Monitoramento

### Estatísticas Importantes
No OBS, monitore:
- **FPS**: Deve estar estável no valor configurado
- **Frames Perdidos**: Deve ser 0% ou muito baixo
- **CPU Usage**: Deve ficar abaixo de 80%

### Indicadores de Problema
- **Frames perdidos por renderização**: CPU sobrecarregada
- **Frames perdidos por encoding**: Configurações muito altas
- **Frames perdidos por rede**: Bitrate muito alto ou internet instável

## 🔍 Solução de Problemas

### Stream não inicia
1. Verifique se o servidor Yustream está rodando
2. Confirme o endereço RTMP: `rtmp://SEU_IP:1935/WebRTCAppEE`
3. Verifique se a porta 1935 está aberta

### Qualidade ruim
1. Reduza o bitrate
2. Diminua a resolução
3. Use preset mais rápido (veryfast)
4. Verifique a velocidade de upload da internet

### Lag/Travamentos
1. Feche programas desnecessários
2. Use encoder de hardware (NVENC/QuickSync)
3. Diminua configurações do jogo
4. Verifique temperatura do PC

### Áudio dessincronizado
1. Configure **"Use Device Timestamps"** nas fontes de áudio
2. Ajuste **"Sync Offset"** se necessário
3. Use taxa de amostragem consistente (44.1kHz)

## 📝 Checklist Pré-Stream

- [ ] Servidor Yustream rodando
- [ ] Configurações de stream corretas
- [ ] Fontes configuradas (tela, webcam, áudio)
- [ ] Teste de áudio funcionando
- [ ] Bitrate adequado para sua internet
- [ ] Resolução e FPS configurados
- [ ] Preview funcionando corretamente

## 🎯 Dicas Profissionais

1. **Sempre teste** antes de streams importantes
2. **Use cenas** para alternar entre diferentes layouts
3. **Configure hotkeys** para controles rápidos
4. **Monitore recursos** do sistema durante a stream
5. **Tenha backup** das configurações (Perfil → Exportar)
6. **Use filtros** para melhorar áudio e vídeo
7. **Configure transições** suaves entre cenas

---

**💡 Dica**: Salve diferentes perfis no OBS para diferentes tipos de conteúdo!
