/**
 * YuStream Smart TV Interface
 * Gerenciador de telas e interface do usuário
 * Integra navegação, autenticação e player
 */

class TVInterface {
    constructor() {
        this.currentScreen = 'loading';
        this.streamPlayer = null;
        this.qualitySelector = null;
        this.controlsVisible = false;
        this.controlsTimeout = null;
        this.isPlayerReady = false;
        this.isFullscreen = false;
        
        console.log('[Interface] Inicializando interface...');
        this.init();
    }

    async init() {
        // Aguardar DOM estar pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
            return;
        }

        // Setup event listeners
        this.setupEventListeners();
        
        // Verificar autenticação
        await this.checkAuthentication();
    }

    setupEventListeners() {
        // Eventos de navegação customizados
        window.addEventListener('tvBack', () => this.handleBackButton());
        window.addEventListener('tvPlayPause', () => this.handlePlayPause());
        window.addEventListener('tvHome', () => this.handleHomeButton());
        window.addEventListener('tvMenu', () => this.handleMenuButton());
        window.addEventListener('tvFullscreen', () => this.toggleFullscreen());
        
        // Eventos de autenticação
        window.addEventListener('auth:tokenExpired', () => this.handleTokenExpired());
        
        // Form de login
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Botões da interface
        this.setupButtonListeners();
        
        // Eventos do player
        this.setupPlayerEventListeners();
        
        console.log('[Interface] Event listeners configurados');
    }

    setupButtonListeners() {
        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Player controls
        const playPauseBtn = document.getElementById('play-pause-btn');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        }

        const reloadBtn = document.getElementById('reload-btn');
        if (reloadBtn) {
            reloadBtn.addEventListener('click', () => this.reloadStream());
        }

        const qualityBtn = document.getElementById('quality-btn');
        if (qualityBtn) {
            qualityBtn.addEventListener('click', () => this.toggleQualityMenu());
        }

        // Retry buttons
        const retryBtn = document.getElementById('retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.retryConnection());
        }

        const checkBtn = document.getElementById('check-btn');
        if (checkBtn) {
            checkBtn.addEventListener('click', () => this.checkStreamStatus());
        }

        // Fullscreen button
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }

        // Logout button overlay (fullscreen)
        const logoutBtnOverlay = document.getElementById('logout-btn-overlay');
        if (logoutBtnOverlay) {
            logoutBtnOverlay.addEventListener('click', () => this.handleLogout());
        }

        // Player container para mostrar/esconder controles
        const playerContainer = document.getElementById('player-container');
        if (playerContainer) {
            playerContainer.addEventListener('click', () => this.toggleControls());
        }
    }

    setupPlayerEventListeners() {
        // Eventos customizados do player
        window.addEventListener('playerStatusChange', (e) => {
            this.handlePlayerStatusChange(e.detail);
        });

        window.addEventListener('playerError', (e) => {
            this.handlePlayerError(e.detail);
        });

        window.addEventListener('streamOnlineChange', (e) => {
            this.handleStreamOnlineChange(e.detail);
        });
    }

    // Gerenciamento de telas
    showScreen(screenId) {
        console.log('[Interface] Mudando para tela:', screenId);
        
        // Esconder todas as telas
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // Mostrar tela solicitada
        const targetScreen = document.getElementById(`${screenId}-screen`);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenId;
            
            // Atualizar elementos focáveis após mudança de tela
            setTimeout(() => {
                if (window.tvNavigation) {
                    window.tvNavigation.updateFocusableElements();
                }
            }, 100);
        } else {
            console.error('[Interface] Tela não encontrada:', screenId);
        }
    }

    // Autenticação
    async checkAuthentication() {
        console.log('[Interface] Verificando autenticação...');
        
        if (window.authService.isAuthenticated()) {
            console.log('[Interface] Usuário já autenticado');
            await this.initializePlayer();
        } else {
            console.log('[Interface] Usuário não autenticado');
            this.showLoginScreen();
        }
    }

    showLoginScreen() {
        this.showScreen('login');
        
        // Focar no campo username
        setTimeout(() => {
            const usernameField = document.getElementById('username');
            if (usernameField) {
                usernameField.focus();
            }
        }, 300);
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const loginBtn = document.querySelector('.login-btn');
        const errorDiv = document.getElementById('login-error');
        
        if (!username || !password) {
            this.showError('Por favor, preencha todos os campos');
            return;
        }

        // Mostrar loading
        this.setLoginLoading(true);
        this.hideError();

        try {
            console.log('[Interface] Tentando fazer login...');
            const result = await window.authService.login(username, password);
            
            if (result.success) {
                console.log('[Interface] Login realizado com sucesso');
                this.showToast('Login realizado com sucesso!', 'success');
                
                // Atualizar nome do usuário na interface
                this.updateUserInfo(result.user);
                
                // Inicializar player
                await this.initializePlayer();
                
            } else {
                console.error('[Interface] Erro no login:', result.error);
                this.showError(result.error);
            }
            
        } catch (error) {
            console.error('[Interface] Erro inesperado no login:', error);
            this.showError('Erro de conexão. Verifique sua internet.');
        } finally {
            this.setLoginLoading(false);
        }
    }

    async handleLogout() {
        console.log('[Interface] Fazendo logout...');
        
        try {
            // Parar player se estiver rodando
            if (this.streamPlayer) {
                this.streamPlayer.destroy();
                this.streamPlayer = null;
            }

            // Fazer logout
            await window.authService.logout();
            
            this.showToast('Logout realizado com sucesso', 'info');
            this.showLoginScreen();
            
        } catch (error) {
            console.error('[Interface] Erro no logout:', error);
            this.showToast('Erro no logout', 'error');
        }
    }

    handleTokenExpired() {
        console.log('[Interface] Token expirado');
        this.showToast('Sessão expirada. Faça login novamente.', 'info');
        
        if (this.streamPlayer) {
            this.streamPlayer.destroy();
            this.streamPlayer = null;
        }
        
        this.showLoginScreen();
    }

    // Player
    async initializePlayer() {
        console.log('[Interface] Inicializando player simplificado...');
        
        try {
            this.showScreen('player');
            this.updateStreamStatus('Conectando...', 'connecting');
            
            // Criar instância do player avançado com seletor de qualidades
            this.streamPlayer = new AdvancedStreamPlayer({
                onStatusChange: (status) => {
                    this.handlePlayerStatusChange(status);
                },
                onError: (error) => {
                    this.handlePlayerError(error);
                },
                onStreamOnlineChange: (isOnline) => {
                    this.handleStreamOnlineChange(isOnline);
                },
                getStreamToken: () => window.authService.getStreamToken()
            });

            // Criar seletor de qualidades simplificado
            this.qualitySelector = new SimpleQualitySelector({
                onQualityChange: (qualityName) => this.changeQuality(qualityName),
                onQualitiesUpdate: () => this.updateQualityDisplay()
            });

            // Inicializar player
            await this.streamPlayer.initialize();
            
            // Atualizar seletor de qualidades após inicialização
            if (this.streamPlayer.isReady) {
                this.updateQualitySelector();
            }
            this.isPlayerReady = true;
            
            // Entrar automaticamente em fullscreen para Smart TVs
            setTimeout(() => {
                if (window.deviceUtils && window.deviceUtils.isSmartTV()) {
                    this.enterFullscreen();
                }
            }, 2000);
            
        } catch (error) {
            console.error('[Interface] Erro ao inicializar player:', error);
            this.showToast('Erro ao inicializar player: ' + error.message, 'error');
            this.showOverlay('error');
        }
    }

    // Handlers do player
    handlePlayerStatusChange(status) {
        console.log('[Interface] Status do player mudou:', status);
        
        switch (status) {
            case 'connecting':
                this.updateStreamStatus('Conectando...', 'connecting');
                this.hideOverlays();
                break;
            case 'playing':
                this.updateStreamStatus('Stream Online', 'online');
                this.hideOverlays();
                this.showToast('Conectado à stream', 'success');
                
                // Atualizar seletor de qualidades quando player estiver funcionando
                setTimeout(() => {
                    this.updateQualitySelector();
                }, 1000);
                break;
            case 'paused':
                this.updateStreamStatus('Pausado', 'online');
                break;
            case 'error':
                this.updateStreamStatus('Erro na Conexão', 'error');
                this.showOverlay('error');
                break;
            case 'offline':
                this.updateStreamStatus('Stream Offline', 'offline');
                this.showOverlay('offline');
                break;
            case 'buffering':
                this.updateStreamStatus('Carregando...', 'connecting');
                break;
        }
    }

    handlePlayerError(error) {
        console.error('[Interface] Erro do player:', error);
        this.showToast('Erro no player: ' + error, 'error');
    }

    handleStreamOnlineChange(isOnline) {
        console.log('[Interface] Status da stream mudou:', isOnline ? 'ONLINE' : 'OFFLINE');
        
        if (isOnline) {
            this.showToast('Stream está online', 'success');
        } else {
            this.showToast('Stream foi desconectada', 'info');
        }
    }

    // Controles do player
    togglePlayPause() {
        if (this.streamPlayer && this.isPlayerReady) {
            this.streamPlayer.togglePlayPause();
            this.updatePlayPauseButton();
        }
    }

    reloadStream() {
        if (this.streamPlayer) {
            console.log('[Interface] Recarregando stream...');
            this.showToast('Recarregando stream...', 'info');
            this.streamPlayer.retry();
        }
    }

    retryConnection() {
        this.reloadStream();
    }

    async checkStreamStatus() {
        try {
            this.showToast('Verificando status da stream...', 'info');
            const status = await window.authService.getStreamStatus();
            
            if (status.online) {
                this.showToast('Stream está online', 'success');
                this.reloadStream();
            } else {
                this.showToast('Stream ainda está offline', 'info');
            }
        } catch (error) {
            console.error('[Interface] Erro ao verificar status:', error);
            this.showToast('Erro ao verificar status', 'error');
        }
    }

    // Controles de interface
    toggleControls() {
        if (this.currentScreen !== 'player') return;

        const controlsOverlay = document.getElementById('controls-overlay');
        if (!controlsOverlay) return;

        this.controlsVisible = !this.controlsVisible;
        
        if (this.controlsVisible) {
            controlsOverlay.classList.add('visible');
            this.autoHideControls();
        } else {
            controlsOverlay.classList.remove('visible');
            this.clearControlsTimeout();
        }
    }

    showControls() {
        if (this.currentScreen !== 'player') return;

        const controlsOverlay = document.getElementById('controls-overlay');
        if (controlsOverlay) {
            controlsOverlay.classList.add('visible');
            this.controlsVisible = true;
            
            // Se estiver em fullscreen, mostrar também o status overlay
            if (this.isFullscreen) {
                this.showStatusOverlay();
            }
            
            this.autoHideControls();
        }
    }

    hideControls() {
        const controlsOverlay = document.getElementById('controls-overlay');
        if (controlsOverlay) {
            controlsOverlay.classList.remove('visible');
            this.controlsVisible = false;
            this.clearControlsTimeout();
        }
    }

    autoHideControls() {
        this.clearControlsTimeout();
        this.controlsTimeout = setTimeout(() => {
            this.hideControls();
        }, 5000); // Esconder após 5 segundos
    }

    clearControlsTimeout() {
        if (this.controlsTimeout) {
            clearTimeout(this.controlsTimeout);
            this.controlsTimeout = null;
        }
    }

    toggleQualityMenu() {
        console.log('[Interface] 🎬 Toggle quality menu solicitado');
        
        if (!this.qualitySelector) {
            console.log('[Interface] ❌ QualitySelector não inicializado');
            this.showToast('Seletor de qualidades não disponível', 'error');
            return;
        }
        
        if (!this.streamPlayer || !this.streamPlayer.isReady) {
            console.log('[Interface] ❌ Player não está pronto');
            this.showToast('Player não está pronto', 'error');
            return;
        }
        
        // Atualizar qualidades antes de mostrar
        this.updateQualitySelector();
        
        // Mostrar menu
        this.qualitySelector.toggle();
        this.autoHideControls(); // Resetar timer dos controles
    }

    async changeQuality(qualityName) {
        try {
            console.log('[Interface] 🎯 Mudando qualidade para:', qualityName);
            this.showToast(`Mudando para ${qualityName}...`, 'info');
            
            if (this.streamPlayer) {
                await this.streamPlayer.changeQuality(qualityName);
                this.showToast(`Qualidade alterada: ${qualityName}`, 'success');
                this.updateQualityDisplay();
            }
        } catch (error) {
            console.error('[Interface] Erro ao mudar qualidade:', error);
            this.showToast('Erro ao mudar qualidade', 'error');
        }
    }

    updateQualitySelector() {
        console.log('[Interface] 🔄 Atualizando seletor de qualidades...');
        
        if (!this.qualitySelector) {
            console.log('[Interface] ❌ QualitySelector não existe');
            return;
        }
        
        if (!this.streamPlayer) {
            console.log('[Interface] ❌ StreamPlayer não existe');
            return;
        }
        
        if (!this.streamPlayer.isReady) {
            console.log('[Interface] ❌ StreamPlayer não está pronto');
            return;
        }
        
        const qualities = this.streamPlayer.getAvailableQualities();
        console.log('[Interface] 📊 Qualidades obtidas do player:', qualities);
        
        if (!qualities || qualities.length === 0) {
            console.log('[Interface] ⚠️ Nenhuma qualidade disponível');
            // Criar qualidades de teste para debug
            const testQualities = [
                {
                    name: 'teste',
                    displayName: 'Teste - Nenhuma qualidade carregada',
                    description: 'Player inicializado mas sem qualidades da API',
                    active: false,
                    current: false,
                    priority: 1,
                    lowLatency: false
                }
            ];
            this.qualitySelector.updateQualities(testQualities);
        } else {
            this.qualitySelector.updateQualities(qualities);
        }
        
        this.updateQualityDisplay();
        console.log('[Interface] ✅ Seletor atualizado');
    }

    updateQualityDisplay() {
        const qualityBtn = document.getElementById('quality-btn');
        const currentQualityEl = document.getElementById('current-quality');
        
        if (this.streamPlayer && this.streamPlayer.getCurrentQuality()) {
            const current = this.streamPlayer.getCurrentQuality();
            const displayName = current.name || 'Auto';
            
            if (currentQualityEl) {
                currentQualityEl.textContent = displayName;
            }
            
            if (qualityBtn) {
                qualityBtn.title = `Qualidade atual: ${current.displayName || displayName}`;
            }
        }
    }

    // Overlays
    showOverlay(type) {
        this.hideOverlays();
        
        const overlay = document.getElementById(`${type}-overlay`);
        if (overlay) {
            overlay.classList.remove('hidden');
        }
    }

    hideOverlays() {
        document.querySelectorAll('.overlay').forEach(overlay => {
            overlay.classList.add('hidden');
        });
    }

    // UI Updates
    updateStreamStatus(text, status) {
        const statusText = document.getElementById('status-text');
        const statusIndicator = document.getElementById('status-indicator');
        
        if (statusText) {
            statusText.textContent = text;
        }
        
        if (statusIndicator) {
            statusIndicator.className = 'status-dot';
            statusIndicator.classList.add(status);
        }
    }

    updateUserInfo(user) {
        const userNameEl = document.getElementById('user-name');
        if (userNameEl && user) {
            userNameEl.textContent = user.username || user.email || 'Usuário';
        }
    }

    updatePlayPauseButton() {
        const playIcon = document.querySelector('.play-icon');
        const pauseIcon = document.querySelector('.pause-icon');
        
        if (this.streamPlayer && playIcon && pauseIcon) {
            if (this.streamPlayer.isPlaying) {
                playIcon.classList.add('hidden');
                pauseIcon.classList.remove('hidden');
            } else {
                playIcon.classList.remove('hidden');
                pauseIcon.classList.add('hidden');
            }
        }
    }

    // Navegação por controle remoto
    handleBackButton() {
        if (this.currentScreen === 'player') {
            if (this.isFullscreen) {
                // Em fullscreen, back sai do fullscreen
                this.exitFullscreen();
            } else if (this.controlsVisible) {
                this.hideControls();
            } else {
                // Mostrar controles
                this.showControls();
            }
        } else if (this.currentScreen === 'login') {
            // Não fazer nada ou sair do app
        }
    }

    handlePlayPause() {
        if (this.currentScreen === 'player') {
            this.togglePlayPause();
            this.showControls();
        }
    }

    handleHomeButton() {
        // Implementar se necessário
        console.log('[Interface] Botão Home pressionado');
    }

    handleMenuButton() {
        if (this.currentScreen === 'player') {
            this.toggleControls();
        }
    }

    // Utilitários
    setLoginLoading(loading) {
        const loginBtn = document.querySelector('.login-btn');
        const btnText = document.querySelector('.btn-text');
        const btnLoading = document.querySelector('.btn-loading');
        
        if (loginBtn) {
            loginBtn.disabled = loading;
        }
        
        if (btnText && btnLoading) {
            if (loading) {
                btnText.classList.add('hidden');
                btnLoading.classList.remove('hidden');
            } else {
                btnText.classList.remove('hidden');
                btnLoading.classList.add('hidden');
            }
        }
    }

    showError(message) {
        const errorDiv = document.getElementById('login-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
        }
    }

    hideError() {
        const errorDiv = document.getElementById('login-error');
        if (errorDiv) {
            errorDiv.classList.add('hidden');
        }
    }

    showToast(message, type = 'info') {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            console.log(`[Toast] ${type.toUpperCase()}: ${message}`);
        }
    }

    // Fullscreen
    toggleFullscreen() {
        if (this.isFullscreen) {
            this.exitFullscreen();
        } else {
            this.enterFullscreen();
        }
    }

    enterFullscreen() {
        console.log('[Interface] 🖥️ Entrando em fullscreen...');
        
        const playerScreen = document.getElementById('player-screen');
        if (playerScreen) {
            playerScreen.classList.add('fullscreen');
            this.isFullscreen = true;
            
            // Mostrar controles overlay
            this.showControls();
            
            // Atualizar botão fullscreen
            this.updateFullscreenButton();
            
            // Auto-esconder controles após 3 segundos
            this.autoHideControls(3000);
            
            console.log('[Interface] ✅ Fullscreen ativado');
        }
    }

    exitFullscreen() {
        console.log('[Interface] 🖥️ Saindo de fullscreen...');
        
        const playerScreen = document.getElementById('player-screen');
        if (playerScreen) {
            playerScreen.classList.remove('fullscreen');
            this.isFullscreen = false;
            
            // Esconder overlay de status
            this.hideStatusOverlay();
            
            // Atualizar botão fullscreen
            this.updateFullscreenButton();
            
            console.log('[Interface] ✅ Fullscreen desativado');
        }
    }

    updateFullscreenButton() {
        const enterIcon = document.querySelector('.fullscreen-enter');
        const exitIcon = document.querySelector('.fullscreen-exit');
        
        if (enterIcon && exitIcon) {
            if (this.isFullscreen) {
                enterIcon.classList.add('hidden');
                exitIcon.classList.remove('hidden');
            } else {
                enterIcon.classList.remove('hidden');
                exitIcon.classList.add('hidden');
            }
        }
    }

    showStatusOverlay() {
        const overlay = document.getElementById('status-bar-overlay');
        if (overlay) {
            overlay.classList.add('visible');
            
            // Sincronizar informações com status bar principal
            this.syncStatusOverlay();
        }
    }

    hideStatusOverlay() {
        const overlay = document.getElementById('status-bar-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
        }
    }

    syncStatusOverlay() {
        // Sincronizar status
        const statusText = document.getElementById('status-text');
        const statusTextOverlay = document.getElementById('status-text-overlay');
        if (statusText && statusTextOverlay) {
            statusTextOverlay.textContent = statusText.textContent;
        }

        // Sincronizar indicador
        const statusIndicator = document.getElementById('status-indicator');
        const statusIndicatorOverlay = document.getElementById('status-indicator-overlay');
        if (statusIndicator && statusIndicatorOverlay) {
            statusIndicatorOverlay.className = statusIndicator.className;
        }

        // Sincronizar nome do usuário
        const userName = document.getElementById('user-name');
        const userNameOverlay = document.getElementById('user-name-overlay');
        if (userName && userNameOverlay) {
            userNameOverlay.textContent = userName.textContent;
        }
    }

    autoHideControls(delay = 5000) {
        this.clearControlsTimeout();
        this.controlsTimeout = setTimeout(() => {
            this.hideControls();
            if (this.isFullscreen) {
                this.hideStatusOverlay();
            }
        }, delay);
    }

    destroy() {
        if (this.streamPlayer) {
            this.streamPlayer.destroy();
        }
        
        this.clearControlsTimeout();
        
        // Sair de fullscreen se estiver ativo
        if (this.isFullscreen) {
            this.exitFullscreen();
        }
        
        console.log('[Interface] Interface destruída');
    }
}

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.tvInterface = new TVInterface();
});

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TVInterface;
}
