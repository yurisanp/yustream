/**
 * YuStream Smart TV Player
 * Adaptado do useStreamPlayer.ts do projeto React
 * Otimizado para Smart TVs com suporte a Tizen, WebOS e Android TV
 */

class StreamPlayer {
    constructor(options = {}) {
        this.options = {
            onStatusChange: options.onStatusChange || (() => {}),
            onError: options.onError || (() => {}),
            onStreamOnlineChange: options.onStreamOnlineChange || (() => {}),
            getStreamToken: options.getStreamToken || (() => Promise.resolve(null)),
            ...options
        };

        // Estados do player
        this.status = 'connecting';
        this.retryCount = 0;
        this.lastInitTime = 0;
        this.currentToken = null;
        this.isInitializing = false;
        this.videoElement = null;
        this.hlsInstance = null;
        this.initializationAbortController = null;
        
        // Constantes
        this.MAX_RETRY_ATTEMPTS = 2;
        this.MIN_RETRY_INTERVAL = 15000;
        this.STREAM_ID = 'live';
        
        // Detectar dispositivo
        this.deviceInfo = this.detectDevice();
        
        // Stream status checker
        this.streamStatus = {
            isOnline: false,
            isLoading: false,
            error: null,
            lastChecked: null
        };
        
        console.log('[StreamPlayer] Inicializado para dispositivo:', this.deviceInfo.platform);
    }

    detectDevice() {
        const userAgent = navigator.userAgent.toLowerCase();
        const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        const isTV = /smart-tv|smarttv|tv|tizen|webos/i.test(userAgent) || window.innerWidth > 1920;
        
        let platform = 'universal';
        let capabilities = {
            nativeHLS: false,
            hardwareAcceleration: false,
            preferredFormat: 'hls'
        };

        if (userAgent.includes('tizen')) {
            platform = 'tizen';
            capabilities.nativeHLS = true;
            capabilities.hardwareAcceleration = true;
        } else if (userAgent.includes('webos')) {
            platform = 'webos';
            capabilities.nativeHLS = true;
            capabilities.hardwareAcceleration = true;
        } else if (userAgent.includes('android') && isTV) {
            platform = 'androidtv';
            capabilities.nativeHLS = false; // Usar hls.js
            capabilities.hardwareAcceleration = true;
        }

        return {
            isMobile,
            isTV,
            platform,
            capabilities,
            userAgent
        };
    }

    getPlayerConfig(streamToken) {
        // Usar configuração global se disponível
        let streamUrl = 'https://yustream.yurisp.com.br:8443';
        if (window.YUSTREAM_CONFIG && window.YUSTREAM_CONFIG.STREAM_URL) {
            streamUrl = window.YUSTREAM_CONFIG.STREAM_URL;
        }
        
        const url = new URL(streamUrl);
        const hostname = url.hostname;
        const isSecure = url.protocol === 'https:';
        const httpProtocol = url.protocol;
        const httpPort = url.port || (isSecure ? '8443' : '8080');
        const tokenParam = streamToken ? `?token=${streamToken}` : '';

        const sources = [
            {
                label: 'Baixa latência',
                type: 'llhls',
                url: `${httpProtocol}//${hostname}:${httpPort}/live/${this.STREAM_ID}/abr.m3u8${tokenParam}`,
                lowLatency: true
            },
            {
                label: 'Padrão',
                type: 'hls',
                url: `${httpProtocol}//${hostname}:${httpPort}/live/${this.STREAM_ID}/ts:abr.m3u8${tokenParam}`,
                lowLatency: false
            }
        ];

        return {
            autoStart: true,
            muted: false,
            sources,
            platform: this.deviceInfo.platform,
            capabilities: this.deviceInfo.capabilities
        };
    }

    updateStatus(newStatus) {
        if (this.status !== newStatus) {
            console.log(`[StreamPlayer] Status: ${this.status} -> ${newStatus}`);
            this.status = newStatus;
            this.options.onStatusChange(newStatus);
        }
    }

    async checkStreamStatus(token) {
        try {
            this.streamStatus.isLoading = true;
            
            // Usar configuração global se disponível
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
                this.streamStatus.isOnline = data.online;
                this.streamStatus.lastChecked = new Date();
                this.streamStatus.error = null;
                
                this.options.onStreamOnlineChange(data.online);
                return data.online;
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('[StreamPlayer] Erro ao verificar status:', error);
            this.streamStatus.isOnline = false;
            this.streamStatus.error = error.message;
            return false;
        } finally {
            this.streamStatus.isLoading = false;
        }
    }

    async initializePlayer() {
        console.log('[StreamPlayer] Inicializando player...');
        
        if (this.isInitializing) {
            console.log('[StreamPlayer] Já está inicializando, ignorando...');
            return;
        }

        // Cancelar inicialização anterior se existir
        if (this.initializationAbortController) {
            this.initializationAbortController.abort();
        }
        
        this.initializationAbortController = new AbortController();
        const signal = this.initializationAbortController.signal;

        try {
            this.isInitializing = true;
            this.updateStatus('connecting');

            // Verificar se foi cancelado
            if (signal.aborted) return;

            // Limpar player anterior
            this.cleanup();

            // Obter token
            console.log('[StreamPlayer] Obtendo token...');
            const token = await this.options.getStreamToken();
            if (!token) {
                throw new Error('Token não obtido');
            }

            this.currentToken = token;
            console.log('[StreamPlayer] Token obtido:', token.substring(0, 20) + '...');

            // Verificar se foi cancelado
            if (signal.aborted) return;

            // Verificar status da stream
            console.log('[StreamPlayer] Verificando status da stream...');
            const isOnline = await this.checkStreamStatus(token);
            
            if (!isOnline) {
                this.updateStatus('offline');
                this.options.onError('Stream está offline');
                return;
            }

            // Verificar se foi cancelado
            if (signal.aborted) return;

            // Criar player
            console.log('[StreamPlayer] Criando player...');
            await this.createPlayer();

        } catch (error) {
            if (!signal.aborted) {
                console.error('[StreamPlayer] Erro na inicialização:', error);
                this.options.onError(error.message || error);
                this.scheduleRetry();
            }
        } finally {
            this.isInitializing = false;
            if (this.initializationAbortController?.signal === signal) {
                this.initializationAbortController = null;
            }
        }
    }

    async createPlayer() {
        const config = this.getPlayerConfig(this.currentToken);
        const videoElement = document.getElementById('video-player');
        
        if (!videoElement) {
            throw new Error('Elemento de vídeo não encontrado');
        }

        this.videoElement = videoElement;
        
        // Configurar atributos do vídeo
        videoElement.autoplay = true;
        videoElement.muted = false;
        videoElement.playsInline = true;
        videoElement.controls = false;

        // Platform-specific optimizations
        if (this.deviceInfo.platform === 'tizen') {
            videoElement.setAttribute('data-tizen-optimized', 'true');
        }

        // Event listeners
        this.setupVideoEventListeners();

        // Escolher fonte baseada na capacidade do dispositivo
        const source = this.selectBestSource(config.sources);
        console.log('[StreamPlayer] Usando fonte:', source.label, source.url);

        if (this.deviceInfo.capabilities.nativeHLS || source.url.includes('.m3u8')) {
            // Usar HLS nativo
            await this.setupNativeHLS(source.url);
        } else {
            // Usar hls.js
            await this.setupHlsJs(source.url);
        }
    }

    selectBestSource(sources) {
        // Para Smart TVs, preferir baixa latência se disponível
        if (this.deviceInfo.isTV) {
            return sources.find(s => s.lowLatency) || sources[0];
        }
        return sources[0];
    }

    async setupNativeHLS(url) {
        console.log('[StreamPlayer] Configurando HLS nativo');
        
        this.videoElement.src = url;
        
        try {
            await this.videoElement.load();
            await this.videoElement.play();
        } catch (error) {
            console.error('[StreamPlayer] Erro no HLS nativo:', error);
            throw error;
        }
    }

    async setupHlsJs(url) {
        console.log('[StreamPlayer] Configurando hls.js');
        
        if (typeof Hls === 'undefined') {
            // Carregar hls.js dinamicamente se não estiver disponível
            await this.loadHlsJs();
        }

        if (Hls.isSupported()) {
            this.hlsInstance = new Hls({
                enableWorker: true,
                lowLatencyMode: url.includes('abr.m3u8'),
                backBufferLength: 90,
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                maxBufferSize: 60 * 1000 * 1000,
                maxBufferHole: 0.5,
                highBufferWatchdogPeriod: 2,
                nudgeOffset: 0.1,
                nudgeMaxRetry: 3,
                maxFragLookUpTolerance: 0.25,
                liveSyncDurationCount: 3,
                liveMaxLatencyDurationCount: 10
            });

            this.hlsInstance.loadSource(url);
            this.hlsInstance.attachMedia(this.videoElement);

            this.hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('[StreamPlayer] Manifest carregado');
                this.videoElement.play().catch(error => {
                    console.error('[StreamPlayer] Erro no play:', error);
                });
            });

            this.hlsInstance.on(Hls.Events.ERROR, (event, data) => {
                console.error('[StreamPlayer] Erro HLS:', data);
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
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    setupVideoEventListeners() {
        if (!this.videoElement) return;

        this.videoElement.addEventListener('loadstart', () => {
            console.log('[StreamPlayer] Carregando...');
            this.updateStatus('connecting');
        });

        this.videoElement.addEventListener('loadedmetadata', () => {
            console.log('[StreamPlayer] Metadata carregada');
        });

        this.videoElement.addEventListener('canplay', () => {
            console.log('[StreamPlayer] Pronto para reproduzir');
        });

        this.videoElement.addEventListener('playing', () => {
            console.log('[StreamPlayer] Reproduzindo');
            this.updateStatus('playing');
            this.retryCount = 0; // Reset retry count on success
        });

        this.videoElement.addEventListener('pause', () => {
            console.log('[StreamPlayer] Pausado');
            this.updateStatus('paused');
        });

        this.videoElement.addEventListener('waiting', () => {
            console.log('[StreamPlayer] Buffering...');
            this.updateStatus('buffering');
        });

        this.videoElement.addEventListener('error', (e) => {
            const error = e.target.error;
            console.error('[StreamPlayer] Erro de vídeo:', error);
            this.updateStatus('error');
            this.options.onError(`Erro de vídeo: ${error.message}`);
            this.scheduleRetry();
        });

        this.videoElement.addEventListener('ended', () => {
            console.log('[StreamPlayer] Stream finalizada');
            this.updateStatus('offline');
        });

        this.videoElement.addEventListener('stalled', () => {
            console.log('[StreamPlayer] Stream travada');
        });
    }

    handleHlsError(data) {
        console.error('[StreamPlayer] Erro fatal do HLS:', data);
        
        switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('[StreamPlayer] Erro de rede, tentando recuperar...');
                this.hlsInstance.startLoad();
                break;
            case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('[StreamPlayer] Erro de mídia, tentando recuperar...');
                this.hlsInstance.recoverMediaError();
                break;
            default:
                console.log('[StreamPlayer] Erro irrecuperável');
                this.updateStatus('error');
                this.options.onError('Erro fatal no player HLS');
                this.scheduleRetry();
                break;
        }
    }

    scheduleRetry() {
        const now = Date.now();
        
        if (now - this.lastInitTime < this.MIN_RETRY_INTERVAL) {
            console.log('[StreamPlayer] Retry muito rápido, ignorando...');
            return;
        }

        if (this.retryCount >= this.MAX_RETRY_ATTEMPTS) {
            console.log('[StreamPlayer] Máximo de tentativas atingido');
            this.updateStatus('offline');
            return;
        }

        this.retryCount++;
        this.lastInitTime = now;
        
        console.log(`[StreamPlayer] Agendando retry ${this.retryCount}/${this.MAX_RETRY_ATTEMPTS} em 5s...`);
        
        setTimeout(() => {
            this.initializePlayer();
        }, 5000);
    }

    async handleManualRetry() {
        console.log('[StreamPlayer] Retry manual solicitado');
        
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
        this.lastInitTime = 0;
        await this.initializePlayer();
    }

    cleanup() {
        console.log('[StreamPlayer] Limpando player...');

        // Cancelar inicialização em andamento
        if (this.initializationAbortController) {
            this.initializationAbortController.abort();
            this.initializationAbortController = null;
        }

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
        console.log('[StreamPlayer] Destruindo player...');
        this.cleanup();
        this.videoElement = null;
        this.options = null;
    }

    // Métodos públicos para controle
    play() {
        if (this.videoElement) {
            return this.videoElement.play();
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

    mute() {
        if (this.videoElement) {
            this.videoElement.muted = true;
        }
    }

    unmute() {
        if (this.videoElement) {
            this.videoElement.muted = false;
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
}

// Export para uso global
window.StreamPlayer = StreamPlayer;
