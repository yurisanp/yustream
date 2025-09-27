/**
 * YuStream Smart TV Player - Versão Simplificada
 * Baseado no useStreamPlayer do mobile, otimizado para Smart TVs
 * Remove complexidades que causam abort, foco na simplicidade e performance
 */

class SimpleStreamPlayer {
    constructor(options = {}) {
        this.options = {
            onStatusChange: options.onStatusChange || (() => {}),
            onError: options.onError || (() => {}),
            onStreamOnlineChange: options.onStreamOnlineChange || (() => {}),
            getStreamToken: options.getStreamToken || (() => Promise.resolve(null)),
            ...options
        };

        // Estados simples
        this.status = 'connecting';
        this.retryCount = 0;
        this.currentToken = null;
        this.videoElement = null;
        this.hlsInstance = null;
        this.streamSources = [];
        this.isBuffering = false;
        
        // Constantes
        this.MAX_RETRY_ATTEMPTS = 3;
        this.MIN_RETRY_INTERVAL = 10000; // 10 segundos
        
        // Detectar dispositivo
        this.deviceInfo = this.detectDevice();
        
        console.log('[SimplePlayer] Inicializado para:', this.deviceInfo.platform);
    }

    detectDevice() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        let platform = 'universal';
        let capabilities = {
            nativeHLS: false,
            preferredFormat: 'hls'
        };

        if (userAgent.includes('tizen')) {
            platform = 'tizen';
            capabilities.nativeHLS = true;
        } else if (userAgent.includes('webos')) {
            platform = 'webos';
            capabilities.nativeHLS = true;
        } else if (userAgent.includes('android') && userAgent.includes('tv')) {
            platform = 'androidtv';
            capabilities.nativeHLS = false; // Usar hls.js
        }

        return { platform, capabilities, userAgent };
    }

    updateStatus(newStatus) {
        if (this.status !== newStatus) {
            console.log(`[SimplePlayer] Status: ${this.status} → ${newStatus}`);
            this.status = newStatus;
            this.options.onStatusChange(newStatus);
        }
    }

    async getStreamToken() {
        try {
            const token = await this.options.getStreamToken();
            if (token) {
                this.currentToken = token;
                console.log('[SimplePlayer] Token obtido:', token.substring(0, 20) + '...');
                return token;
            } else {
                throw new Error('Token não obtido');
            }
        } catch (error) {
            console.error('[SimplePlayer] Erro ao obter token:', error);
            throw error;
        }
    }

    async checkStreamStatus(token) {
        try {
            let serverUrl = 'https://yustream.yurisp.com.br';
            if (window.YUSTREAM_CONFIG && window.YUSTREAM_CONFIG.SERVER_URL) {
                serverUrl = window.YUSTREAM_CONFIG.SERVER_URL;
            }
            
            const response = await fetch(`${serverUrl}/stream/status`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('[SimplePlayer] Status da stream:', data.online ? 'ONLINE' : 'OFFLINE');
                this.options.onStreamOnlineChange(data.online);
                return data.online;
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('[SimplePlayer] Erro ao verificar status:', error);
            return false;
        }
    }

    async loadStreamSources(token) {
        try {
            // Configuração baseada no servidor
            let streamUrl = 'https://yustream.yurisp.com.br:8443';
            if (window.YUSTREAM_CONFIG && window.YUSTREAM_CONFIG.STREAM_URL) {
                streamUrl = window.YUSTREAM_CONFIG.STREAM_URL;
            }
            
            const url = new URL(streamUrl);
            const hostname = url.hostname;
            const protocol = url.protocol;
            const port = url.port || (protocol === 'https:' ? '8443' : '8080');
            const tokenParam = token ? `?token=${token}` : '';

            // Criar fontes de stream simples - similar ao mobile
            const sources = [
                {
                    label: 'Baixa Latência',
                    uri: `${protocol}//${hostname}:${port}/live/live/abr.m3u8${tokenParam}`,
                    type: 'hls'
                },
                {
                    label: 'Padrão',
                    uri: `${protocol}//${hostname}:${port}/live/live/ts:abr.m3u8${tokenParam}`,
                    type: 'hls'
                }
            ];

            this.streamSources = sources;
            console.log('[SimplePlayer] Fontes carregadas:', sources.length);
            return sources;
            
        } catch (error) {
            console.error('[SimplePlayer] Erro ao carregar fontes:', error);
            throw error;
        }
    }

    async initializePlayer() {
        try {
            console.log('[SimplePlayer] Iniciando inicialização...');
            this.updateStatus('connecting');

            // 1. Obter token
            const token = await this.getStreamToken();
            
            // 2. Verificar se stream está online
            const isOnline = await this.checkStreamStatus(token);
            if (!isOnline) {
                this.updateStatus('offline');
                this.options.onError('Stream está offline');
                return;
            }

            // 3. Carregar fontes
            await this.loadStreamSources(token);
            
            // 4. Criar player
            await this.createVideoPlayer();
            
            console.log('[SimplePlayer] Inicialização concluída');
            
        } catch (error) {
            console.error('[SimplePlayer] Erro na inicialização:', error);
            this.updateStatus('error');
            this.options.onError(error.message || error);
            this.scheduleRetry();
        }
    }

    async createVideoPlayer() {
        const videoElement = document.getElementById('video-player');
        if (!videoElement) {
            throw new Error('Elemento video-player não encontrado');
        }

        this.videoElement = videoElement;
        
        // Configurar atributos básicos
        videoElement.autoplay = true;
        videoElement.muted = false;
        videoElement.playsInline = true;
        videoElement.controls = false;
        
        // Platform-specific optimizations
        if (this.deviceInfo.platform === 'tizen') {
            videoElement.setAttribute('data-tizen-optimized', 'true');
        }

        // Setup event listeners simples
        this.setupVideoEvents();

        // Escolher melhor fonte (primeira por simplicidade)
        const source = this.streamSources[0];
        if (!source) {
            throw new Error('Nenhuma fonte disponível');
        }

        console.log('[SimplePlayer] Usando fonte:', source.label, source.uri);

        // Usar HLS nativo ou hls.js baseado na capacidade
        if (this.deviceInfo.capabilities.nativeHLS && source.uri.includes('.m3u8')) {
            await this.setupNativeHLS(source.uri);
        } else {
            await this.setupHlsJs(source.uri);
        }
    }

    setupVideoEvents() {
        if (!this.videoElement) return;

        // Eventos essenciais apenas
        this.videoElement.addEventListener('loadstart', () => {
            console.log('[SimplePlayer] Carregando...');
            this.updateStatus('connecting');
        });

        this.videoElement.addEventListener('canplay', () => {
            console.log('[SimplePlayer] Pronto para reproduzir');
        });

        this.videoElement.addEventListener('playing', () => {
            console.log('[SimplePlayer] Reproduzindo');
            this.updateStatus('playing');
            this.retryCount = 0; // Reset em caso de sucesso
        });

        this.videoElement.addEventListener('pause', () => {
            console.log('[SimplePlayer] Pausado');
            this.updateStatus('paused');
        });

        this.videoElement.addEventListener('waiting', () => {
            console.log('[SimplePlayer] Buffering...');
            this.isBuffering = true;
        });

        this.videoElement.addEventListener('canplaythrough', () => {
            console.log('[SimplePlayer] Buffer OK');
            this.isBuffering = false;
        });

        this.videoElement.addEventListener('error', (e) => {
            const error = e.target.error;
            console.error('[SimplePlayer] Erro de vídeo:', error);
            this.updateStatus('error');
            this.options.onError(`Erro de vídeo: ${error?.message || 'Desconhecido'}`);
            this.scheduleRetry();
        });
    }

    async setupNativeHLS(url) {
        console.log('[SimplePlayer] Configurando HLS nativo');
        
        this.videoElement.src = url;
        
        try {
            await this.videoElement.load();
            // Não fazer play automático aqui, deixar o evento canplay fazer
        } catch (error) {
            console.error('[SimplePlayer] Erro no HLS nativo:', error);
            throw error;
        }
    }

    async setupHlsJs(url) {
        console.log('[SimplePlayer] Configurando hls.js');
        
        // Carregar hls.js se não estiver disponível
        if (typeof Hls === 'undefined') {
            await this.loadHlsJs();
        }

        if (Hls.isSupported()) {
            this.hlsInstance = new Hls({
                enableWorker: true,
                lowLatencyMode: url.includes('abr.m3u8'),
                backBufferLength: 90,
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                liveSyncDurationCount: 3,
                liveMaxLatencyDurationCount: 10
            });

            this.hlsInstance.loadSource(url);
            this.hlsInstance.attachMedia(this.videoElement);

            this.hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('[SimplePlayer] Manifest carregado');
                // Não fazer play automático aqui, deixar o autoplay do video fazer
            });

            this.hlsInstance.on(Hls.Events.ERROR, (event, data) => {
                console.error('[SimplePlayer] Erro HLS:', data);
                if (data.fatal) {
                    this.handleHlsError(data);
                }
            });

        } else if (this.videoElement.canPlayType('application/vnd.apple.mpegurl')) {
            // Fallback para HLS nativo
            await this.setupNativeHLS(url);
        } else {
            throw new Error('HLS não suportado neste dispositivo');
        }
    }

    async loadHlsJs() {
        return new Promise((resolve, reject) => {
            if (typeof Hls !== 'undefined') {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Falha ao carregar hls.js'));
            document.head.appendChild(script);
        });
    }

    handleHlsError(data) {
        console.error('[SimplePlayer] Erro fatal do HLS:', data);
        
        switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('[SimplePlayer] Erro de rede, tentando recuperar...');
                this.hlsInstance.startLoad();
                break;
            case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('[SimplePlayer] Erro de mídia, tentando recuperar...');
                this.hlsInstance.recoverMediaError();
                break;
            default:
                console.log('[SimplePlayer] Erro irrecuperável');
                this.updateStatus('error');
                this.options.onError('Erro fatal no player HLS');
                this.scheduleRetry();
                break;
        }
    }

    scheduleRetry() {
        if (this.retryCount >= this.MAX_RETRY_ATTEMPTS) {
            console.log('[SimplePlayer] Máximo de tentativas atingido');
            this.updateStatus('offline');
            return;
        }

        this.retryCount++;
        console.log(`[SimplePlayer] Agendando retry ${this.retryCount}/${this.MAX_RETRY_ATTEMPTS} em 5s...`);
        
        setTimeout(() => {
            this.initializePlayer();
        }, 5000);
    }

    async handleManualRetry() {
        console.log('[SimplePlayer] Retry manual solicitado');
        
        // Verificar stream antes de tentar
        if (this.currentToken) {
            const isOnline = await this.checkStreamStatus(this.currentToken);
            if (!isOnline) {
                this.updateStatus('offline');
                this.options.onError('Stream está offline');
                return;
            }
        }

        this.retryCount = 0;
        await this.initializePlayer();
    }

    cleanup() {
        console.log('[SimplePlayer] Limpando player...');

        // Limpar HLS.js
        if (this.hlsInstance) {
            this.hlsInstance.destroy();
            this.hlsInstance = null;
        }

        // Limpar video element
        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.removeAttribute('src');
            this.videoElement.load();
        }
    }

    destroy() {
        console.log('[SimplePlayer] Destruindo player...');
        this.cleanup();
        this.videoElement = null;
        this.options = null;
    }

    // Métodos de controle simples
    play() {
        if (this.videoElement) {
            return this.videoElement.play().catch(error => {
                console.error('[SimplePlayer] Erro no play:', error);
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
                return this.play();
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

    // Getters
    get isPlaying() {
        return this.videoElement && !this.videoElement.paused;
    }

    get isMuted() {
        return this.videoElement && this.videoElement.muted;
    }

    get volume() {
        return this.videoElement ? this.videoElement.volume : 0;
    }

    get currentTime() {
        return this.videoElement ? this.videoElement.currentTime : 0;
    }

    get duration() {
        return this.videoElement ? this.videoElement.duration : 0;
    }

    // Informações do stream
    getStreamInfo() {
        return {
            status: this.status,
            retryCount: this.retryCount,
            sources: this.streamSources,
            isBuffering: this.isBuffering,
            platform: this.deviceInfo.platform,
            isPlaying: this.isPlaying,
            currentTime: this.currentTime,
            duration: this.duration
        };
    }
}

// Export para uso global
window.SimpleStreamPlayer = SimpleStreamPlayer;
