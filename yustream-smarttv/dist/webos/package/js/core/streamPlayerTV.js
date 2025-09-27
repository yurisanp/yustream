/**
 * YuStream Smart TV Player - Versão Ultra Simplificada
 * Baseado diretamente no padrão do mobile (expo-video)
 * Foco na simplicidade e funcionamento garantido
 */

class TVStreamPlayer {
    constructor(options = {}) {
        this.options = options;
        
        // Estados básicos
        this.status = 'idle';
        this.retryCount = 0;
        this.videoElement = null;
        this.hlsInstance = null;
        this.currentSource = null;
        this.isReady = false;
        
        // Constantes
        this.MAX_RETRY_ATTEMPTS = 3;
        
        console.log('[TVPlayer] Inicializado');
    }

    updateStatus(newStatus) {
        if (this.status !== newStatus) {
            console.log(`[TVPlayer] ${this.status} → ${newStatus}`);
            this.status = newStatus;
            this.options.onStatusChange?.(newStatus);
        }
    }

    async initialize() {
        try {
            console.log('[TVPlayer] 🚀 Inicializando...');
            this.updateStatus('connecting');
            
            // Passo 1: Obter token
            const token = await this.options.getStreamToken();
            if (!token) {
                throw new Error('Token não obtido');
            }
            console.log('[TVPlayer] ✅ Token obtido');
            
            // Passo 2: Verificar stream
            const isOnline = await this.checkStream(token);
            if (!isOnline) {
                this.updateStatus('offline');
                this.options.onError?.('Stream offline');
                return;
            }
            console.log('[TVPlayer] ✅ Stream online');
            
            // Passo 3: Preparar fonte
            const source = this.prepareSource(token);
            console.log('[TVPlayer] ✅ Fonte preparada:', source.substring(0, 50) + '...');
            
            // Passo 4: Criar player
            await this.createPlayer(source);
            console.log('[TVPlayer] ✅ Player criado');
            
            this.isReady = true;
            
        } catch (error) {
            console.error('[TVPlayer] ❌ Erro:', error);
            this.updateStatus('error');
            this.options.onError?.(error.message || error);
            this.scheduleRetry();
        }
    }

    async checkStream(token) {
        try {
            const serverUrl = window.YUSTREAM_CONFIG?.SERVER_URL || 'https://yustream.yurisp.com.br';
            
            const response = await fetch(`${serverUrl}/stream/status`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.options.onStreamOnlineChange?.(data.online);
                return data.online;
            }
            
            return false;
        } catch (error) {
            console.error('[TVPlayer] Erro ao verificar stream:', error);
            return false;
        }
    }

    prepareSource(token) {
        const streamUrl = window.YUSTREAM_CONFIG?.STREAM_URL || 'https://yustream.yurisp.com.br:8080';
        const url = new URL(streamUrl);
        
        // Usar fonte de baixa latência por padrão para Smart TVs
        const source = `${url.protocol}//${url.hostname}:${url.port}/fonte/fonte/fonte.m3u8?token=${token}`;
        this.currentSource = source;
        
        return source;
    }

    async createPlayer(source) {
        const videoElement = document.getElementById('video-player');
        if (!videoElement) {
            throw new Error('Elemento video-player não encontrado');
        }

        this.videoElement = videoElement;
        
        // Configuração básica para Smart TV
        videoElement.autoplay = true;
        videoElement.muted = false;
        videoElement.playsInline = true;
        videoElement.controls = false;
        
        // Event listeners essenciais
        this.setupEvents();
        
        // Detectar se deve usar HLS nativo ou hls.js
        const userAgent = navigator.userAgent.toLowerCase();
        const useNativeHLS = userAgent.includes('tizen') || userAgent.includes('webos') || 
                           videoElement.canPlayType('application/vnd.apple.mpegurl');

        if (useNativeHLS) {
            console.log('[TVPlayer] Usando HLS nativo');
            await this.setupNative(source);
        } else {
            console.log('[TVPlayer] Usando hls.js');
            await this.setupHlsJs(source);
        }
    }

    setupEvents() {
        if (!this.videoElement) return;

        this.videoElement.addEventListener('loadstart', () => {
            console.log('[TVPlayer] 📡 Carregando...');
            this.updateStatus('connecting');
        });

        this.videoElement.addEventListener('canplay', () => {
            console.log('[TVPlayer] 🎬 Pronto para reproduzir');
        });

        this.videoElement.addEventListener('playing', () => {
            console.log('[TVPlayer] ▶️ Reproduzindo');
            this.updateStatus('playing');
            this.retryCount = 0; // Reset retry count
        });

        this.videoElement.addEventListener('pause', () => {
            console.log('[TVPlayer] ⏸️ Pausado');
            this.updateStatus('paused');
        });

        this.videoElement.addEventListener('waiting', () => {
            console.log('[TVPlayer] ⏳ Buffering...');
        });

        this.videoElement.addEventListener('error', (e) => {
            const error = e.target.error;
            console.error('[TVPlayer] ❌ Erro de vídeo:', error);
            this.updateStatus('error');
            this.options.onError?.(`Erro: ${error?.message || 'Desconhecido'}`);
            this.scheduleRetry();
        });

        this.videoElement.addEventListener('ended', () => {
            console.log('[TVPlayer] 🏁 Stream finalizada');
            this.updateStatus('offline');
        });
    }

    async setupNative(source) {
        this.videoElement.src = source;
        this.videoElement.load();
        
        // Aguardar um pouco para o elemento processar
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    async setupHlsJs(source) {
        // Carregar hls.js se necessário
        if (typeof Hls === 'undefined') {
            await this.loadHlsJs();
        }

        if (!Hls.isSupported()) {
            throw new Error('HLS.js não suportado');
        }

        this.hlsInstance = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            maxBufferLength: 30,
            liveSyncDurationCount: 3
        });

        this.hlsInstance.loadSource(source);
        this.hlsInstance.attachMedia(this.videoElement);

        this.hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('[TVPlayer] 📋 Manifest carregado');
        });

        this.hlsInstance.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                console.error('[TVPlayer] ❌ Erro fatal HLS:', data);
                this.handleHlsError(data);
            }
        });
    }

    async loadHlsJs() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Falha ao carregar hls.js'));
            document.head.appendChild(script);
        });
    }

    handleHlsError(data) {
        switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('[TVPlayer] 🔄 Tentando recuperar erro de rede...');
                this.hlsInstance.startLoad();
                break;
            case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('[TVPlayer] 🔄 Tentando recuperar erro de mídia...');
                this.hlsInstance.recoverMediaError();
                break;
            default:
                this.updateStatus('error');
                this.options.onError?.('Erro irrecuperável no HLS');
                this.scheduleRetry();
                break;
        }
    }

    scheduleRetry() {
        if (this.retryCount >= this.MAX_RETRY_ATTEMPTS) {
            console.log('[TVPlayer] 🚫 Máximo de tentativas atingido');
            this.updateStatus('offline');
            return;
        }

        this.retryCount++;
        console.log(`[TVPlayer] 🔄 Retry ${this.retryCount}/${this.MAX_RETRY_ATTEMPTS} em 5s...`);
        
        setTimeout(() => {
            this.initialize();
        }, 5000);
    }

    async retry() {
        console.log('[TVPlayer] 🔄 Retry manual');
        this.retryCount = 0;
        await this.initialize();
    }

    // Controles simples
    play() {
        if (this.videoElement) {
            this.videoElement.play().catch(error => {
                console.error('[TVPlayer] Erro no play:', error);
            });
        }
    }

    pause() {
        if (this.videoElement) {
            this.videoElement.pause();
        }
    }

    togglePlayPause() {
        if (this.videoElement) {
            if (this.videoElement.paused) {
                this.play();
            } else {
                this.pause();
            }
        }
    }

    setVolume(volume) {
        if (this.videoElement) {
            this.videoElement.volume = Math.max(0, Math.min(1, volume));
        }
    }

    toggleMute() {
        if (this.videoElement) {
            this.videoElement.muted = !this.videoElement.muted;
        }
    }

    cleanup() {
        console.log('[TVPlayer] 🧹 Limpando...');

        if (this.hlsInstance) {
            this.hlsInstance.destroy();
            this.hlsInstance = null;
        }

        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.removeAttribute('src');
            this.videoElement.load();
        }
    }

    destroy() {
        console.log('[TVPlayer] 🗑️ Destruindo...');
        this.cleanup();
        this.videoElement = null;
        this.options = null;
    }

    // Getters
    get isPlaying() {
        return this.videoElement && !this.videoElement.paused;
    }

    get isMuted() {
        return this.videoElement && this.videoElement.muted;
    }

    getInfo() {
        return {
            status: this.status,
            retryCount: this.retryCount,
            isReady: this.isReady,
            isPlaying: this.isPlaying,
            isMuted: this.isMuted,
            volume: this.videoElement?.volume || 0,
            currentTime: this.videoElement?.currentTime || 0,
            duration: this.videoElement?.duration || 0,
            source: this.currentSource
        };
    }
}

// Export global
window.TVStreamPlayer = TVStreamPlayer;
