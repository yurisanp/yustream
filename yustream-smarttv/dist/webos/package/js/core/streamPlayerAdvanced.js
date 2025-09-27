/**
 * YuStream Smart TV Player - Versão Avançada com Seletor de Qualidades
 * Baseado no addon Stremio - usa API /stream/qualities
 * Suporta seleção manual de qualidades individuais
 */

class AdvancedStreamPlayer {
    constructor(options = {}) {
        this.options = options;
        
        // Estados
        this.status = 'idle';
        this.retryCount = 0;
        this.currentToken = null;
        this.videoElement = null;
        this.hlsInstance = null;
        this.availableQualities = [];
        this.currentQuality = null;
        this.isReady = false;
        
        // Constantes
        this.MAX_RETRY_ATTEMPTS = 3;
        
        // Detectar dispositivo
        this.deviceInfo = this.detectDevice();
        
        console.log('[AdvancedPlayer] Inicializado para:', this.deviceInfo.platform);
    }

    detectDevice() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        let platform = 'universal';
        let capabilities = {
            nativeHLS: false,
            preferredFormat: 'hls',
            maxResolution: '1080p'
        };

        if (userAgent.includes('tizen')) {
            platform = 'tizen';
            capabilities.nativeHLS = true;
            capabilities.maxResolution = '4K';
        } else if (userAgent.includes('webos')) {
            platform = 'webos';
            capabilities.nativeHLS = true;
            capabilities.maxResolution = '4K';
        } else if (userAgent.includes('android') && userAgent.includes('tv')) {
            platform = 'androidtv';
            capabilities.nativeHLS = false;
            capabilities.maxResolution = '4K';
        }

        return { platform, capabilities, userAgent };
    }

    updateStatus(newStatus) {
        if (this.status !== newStatus) {
            console.log(`[AdvancedPlayer] ${this.status} → ${newStatus}`);
            this.status = newStatus;
            this.options.onStatusChange?.(newStatus);
        }
    }

    async initialize() {
        try {
            console.log('[AdvancedPlayer] 🚀 Inicializando...');
            this.updateStatus('connecting');
            
            // 1. Obter token
            const token = await this.getStreamToken();
            
            // 2. Verificar stream
            const isOnline = await this.checkStreamStatus(token);
            if (!isOnline) {
                this.updateStatus('offline');
                this.options.onError?.('Stream offline');
                return;
            }
            
            // 3. Carregar qualidades disponíveis (como o addon Stremio)
            await this.loadAvailableQualities(token);
            
            // 4. Selecionar melhor qualidade
            const selectedQuality = this.selectBestQuality();
            if (!selectedQuality) {
                throw new Error('Nenhuma qualidade disponível');
            }
            
            // 5. Criar player com qualidade específica
            await this.createPlayerWithQuality(selectedQuality);
            
            this.isReady = true;
            console.log('[AdvancedPlayer] ✅ Inicialização concluída');
            
        } catch (error) {
            console.error('[AdvancedPlayer] ❌ Erro:', error);
            this.updateStatus('error');
            this.options.onError?.(error.message || error);
            this.scheduleRetry();
        }
    }

    async getStreamToken() {
        try {
            const token = await this.options.getStreamToken();
            if (token) {
                this.currentToken = token;
                console.log('[AdvancedPlayer] ✅ Token obtido');
                return token;
            } else {
                throw new Error('Token não obtido');
            }
        } catch (error) {
            console.error('[AdvancedPlayer] Erro ao obter token:', error);
            throw error;
        }
    }

    async checkStreamStatus(token) {
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
                console.log('[AdvancedPlayer] Stream status:', data.online ? 'ONLINE' : 'OFFLINE');
                this.options.onStreamOnlineChange?.(data.online);
                return data.online;
            }
            
            return false;
        } catch (error) {
            console.error('[AdvancedPlayer] Erro ao verificar stream:', error);
            return false;
        }
    }

    async loadAvailableQualities(token) {
        try {
            console.log('[AdvancedPlayer] 🎯 Carregando qualidades disponíveis...');
            
            const serverUrl = window.YUSTREAM_CONFIG?.SERVER_URL || 'https://yustream.yurisp.com.br';
            
            const response = await fetch(`${serverUrl}/stream/qualities`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('[AdvancedPlayer] 📊 Resposta completa da API:', data);
            
            if (!data.qualities || !Array.isArray(data.qualities)) {
                console.error('[AdvancedPlayer] ❌ Formato inválido da API:', data);
                throw new Error('Formato inválido da API de qualidades');
            }
            
            // Filtrar apenas qualidades ativas (como no addon Stremio)
            this.availableQualities = data.qualities.filter(q => q.active);
            
            console.log(`[AdvancedPlayer] ✅ ${this.availableQualities.length} qualidades ativas de ${data.qualities.length} total`);
            
            // Log detalhado das qualidades para debug
            this.availableQualities.forEach((q, index) => {
                console.log(`  ${index + 1}. ${q.displayName}:`);
                console.log(`     - Name: ${q.name}`);
                console.log(`     - URL: ${q.url}`);
                console.log(`     - Active: ${q.active}`);
                console.log(`     - Priority: ${q.priority}`);
            });
            
            if (this.availableQualities.length === 0) {
                console.log('[AdvancedPlayer] ⚠️ Todas as qualidades estão inativas');
                console.log('[AdvancedPlayer] 📋 Qualidades recebidas:', data.qualities.map(q => ({
                    name: q.name,
                    active: q.active,
                    state: q.state
                })));
                throw new Error('Nenhuma qualidade ativa encontrada');
            }
            
            return this.availableQualities;
            
        } catch (error) {
            console.error('[AdvancedPlayer] Erro ao carregar qualidades:', error);
            throw error;
        }
    }

    selectBestQuality() {
        if (this.availableQualities.length === 0) {
            return null;
        }

        // Ordenar por prioridade (menor número = maior prioridade)
        const sortedQualities = [...this.availableQualities].sort((a, b) => a.priority - b.priority);
        
        // Para Smart TVs, preferir qualidades de baixa latência primeiro
        const lowLatencyQualities = sortedQualities.filter(q => 
            q.displayName.includes('Baixa latencia') || q.displayName.includes('baixa latência')
        );
        
        let selectedQuality;
        
        if (lowLatencyQualities.length > 0) {
            // Preferir qualidade média com baixa latência para Smart TVs
            selectedQuality = lowLatencyQualities.find(q => q.name === '720p') || 
                            lowLatencyQualities.find(q => q.name === '1080p') ||
                            lowLatencyQualities[0];
        } else {
            // Fallback para qualidades normais
            selectedQuality = sortedQualities.find(q => q.name === '720p') || 
                            sortedQualities.find(q => q.name === '1080p') ||
                            sortedQualities[0];
        }
        
        this.currentQuality = selectedQuality;
        console.log('[AdvancedPlayer] 🎯 Qualidade selecionada:', selectedQuality.displayName);
        
        return selectedQuality;
    }

    async createPlayerWithQuality(quality) {
        const videoElement = document.getElementById('video-player');
        if (!videoElement) {
            throw new Error('Elemento video-player não encontrado');
        }

        this.videoElement = videoElement;
        
        // Configuração para Smart TV
        videoElement.autoplay = true;
        videoElement.muted = false;
        videoElement.playsInline = true;
        videoElement.controls = false;
        
        // Otimizações por plataforma
        if (this.deviceInfo.platform === 'tizen') {
            videoElement.setAttribute('data-tizen-optimized', 'true');
        }

        // Event listeners
        this.setupVideoEvents();
        
        // Usar URL específica da qualidade (não ABR)
        const streamUrl = quality.url;
        console.log('[AdvancedPlayer] 🎬 Carregando qualidade:', quality.displayName);
        console.log('[AdvancedPlayer] 📡 URL:', streamUrl);
        
        // Detectar se é HLS e usar player apropriado
        if (streamUrl.includes('.m3u8')) {
            if (this.deviceInfo.capabilities.nativeHLS) {
                await this.setupNativeHLS(streamUrl);
            } else {
                await this.setupHlsJs(streamUrl);
            }
        } else {
            // Fallback para outros formatos
            await this.setupNativeVideo(streamUrl);
        }
    }

    setupVideoEvents() {
        if (!this.videoElement) return;

        this.videoElement.addEventListener('loadstart', () => {
            console.log('[AdvancedPlayer] 📡 Carregando...');
            this.updateStatus('connecting');
        });

        this.videoElement.addEventListener('canplay', () => {
            console.log('[AdvancedPlayer] 🎬 Pronto para reproduzir');
        });

        this.videoElement.addEventListener('playing', () => {
            console.log('[AdvancedPlayer] ▶️ Reproduzindo');
            this.updateStatus('playing');
            this.retryCount = 0;
        });

        this.videoElement.addEventListener('pause', () => {
            console.log('[AdvancedPlayer] ⏸️ Pausado');
            this.updateStatus('paused');
        });

        this.videoElement.addEventListener('waiting', () => {
            console.log('[AdvancedPlayer] ⏳ Buffering...');
        });

        this.videoElement.addEventListener('error', (e) => {
            const error = e.target.error;
            console.error('[AdvancedPlayer] ❌ Erro de vídeo:', error);
            this.updateStatus('error');
            this.options.onError?.(`Erro: ${error?.message || 'Desconhecido'}`);
            this.scheduleRetry();
        });
    }

    async setupNativeHLS(url) {
        console.log('[AdvancedPlayer] 🎵 Configurando HLS nativo');
        this.videoElement.src = url;
        this.videoElement.load();
    }

    async setupHlsJs(url) {
        console.log('[AdvancedPlayer] 🎵 Configurando hls.js');
        
        if (typeof Hls === 'undefined') {
            await this.loadHlsJs();
        }

        if (!Hls.isSupported()) {
            throw new Error('HLS.js não suportado');
        }

        this.hlsInstance = new Hls({
            enableWorker: true,
            lowLatencyMode: url.includes('abr.m3u8') || url.includes('/live/'),
            backBufferLength: 90,
            maxBufferLength: 30,
            liveSyncDurationCount: 3,
            liveMaxLatencyDurationCount: 10
        });

        this.hlsInstance.loadSource(url);
        this.hlsInstance.attachMedia(this.videoElement);

        this.hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('[AdvancedPlayer] 📋 Manifest HLS carregado');
        });

        this.hlsInstance.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                console.error('[AdvancedPlayer] ❌ Erro fatal HLS:', data);
                this.handleHlsError(data);
            }
        });
    }

    async setupNativeVideo(url) {
        console.log('[AdvancedPlayer] 🎵 Configurando vídeo nativo');
        this.videoElement.src = url;
        this.videoElement.load();
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
        switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('[AdvancedPlayer] 🔄 Recuperando erro de rede...');
                this.hlsInstance.startLoad();
                break;
            case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('[AdvancedPlayer] 🔄 Recuperando erro de mídia...');
                this.hlsInstance.recoverMediaError();
                break;
            default:
                this.updateStatus('error');
                this.options.onError?.('Erro irrecuperável no HLS');
                this.scheduleRetry();
                break;
        }
    }

    // Método para trocar qualidade (similar ao mobile)
    async changeQuality(qualityName) {
        try {
            console.log('[AdvancedPlayer] 🔄 Mudando para qualidade:', qualityName);
            
            const quality = this.availableQualities.find(q => q.name === qualityName);
            if (!quality) {
                throw new Error(`Qualidade '${qualityName}' não encontrada`);
            }
            
            if (!quality.active) {
                throw new Error(`Qualidade '${qualityName}' não está ativa`);
            }
            
            // Salvar posição atual se possível
            const currentTime = this.videoElement?.currentTime || 0;
            
            // Limpar player atual
            this.cleanup();
            
            // Recriar com nova qualidade
            this.currentQuality = quality;
            await this.createPlayerWithQuality(quality);
            
            // Tentar voltar à posição (para streams não-live isso pode funcionar)
            if (currentTime > 0 && this.videoElement) {
                this.videoElement.currentTime = currentTime;
            }
            
            console.log('[AdvancedPlayer] ✅ Qualidade alterada com sucesso');
            
        } catch (error) {
            console.error('[AdvancedPlayer] ❌ Erro ao trocar qualidade:', error);
            this.options.onError?.(`Erro ao trocar qualidade: ${error.message}`);
        }
    }

    // Obter lista de qualidades para UI
    getQualitiesForUI() {
        return this.availableQualities.map(quality => ({
            name: quality.name,
            displayName: quality.displayName,
            description: quality.description,
            active: quality.active,
            current: this.currentQuality?.name === quality.name,
            priority: quality.priority,
            lowLatency: quality.displayName.includes('Baixa latencia')
        })).sort((a, b) => a.priority - b.priority);
    }

    scheduleRetry() {
        if (this.retryCount >= this.MAX_RETRY_ATTEMPTS) {
            console.log('[AdvancedPlayer] 🚫 Máximo de tentativas atingido');
            this.updateStatus('offline');
            return;
        }

        this.retryCount++;
        console.log(`[AdvancedPlayer] 🔄 Retry ${this.retryCount}/${this.MAX_RETRY_ATTEMPTS} em 5s...`);
        
        setTimeout(() => {
            this.initialize();
        }, 5000);
    }

    async retry() {
        console.log('[AdvancedPlayer] 🔄 Retry manual');
        this.retryCount = 0;
        await this.initialize();
    }

    cleanup() {
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
        console.log('[AdvancedPlayer] 🗑️ Destruindo...');
        this.cleanup();
        this.videoElement = null;
        this.options = null;
    }

    // Controles
    play() {
        if (this.videoElement) {
            return this.videoElement.play().catch(error => {
                console.error('[AdvancedPlayer] Erro no play:', error);
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

    getCurrentQuality() {
        return this.currentQuality;
    }

    getAvailableQualities() {
        return this.getQualitiesForUI();
    }

    getStreamInfo() {
        return {
            status: this.status,
            retryCount: this.retryCount,
            isReady: this.isReady,
            isPlaying: this.isPlaying,
            currentQuality: this.currentQuality,
            availableQualities: this.availableQualities.length,
            platform: this.deviceInfo.platform,
            capabilities: this.deviceInfo.capabilities
        };
    }
}

// Export global
window.AdvancedStreamPlayer = AdvancedStreamPlayer;
