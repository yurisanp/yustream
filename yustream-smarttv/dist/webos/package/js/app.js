/**
 * YuStream Smart TV Application
 * Aplicação principal que integra todos os componentes
 */

class YuStreamTVApp {
    constructor() {
        this.version = '1.0.0';
        this.initialized = false;
        
        console.log(`[App] YuStream TV v${this.version} iniciando...`);
        console.log(`[App] User Agent: ${navigator.userAgent}`);
        console.log(`[App] Screen: ${window.screen.width}x${window.screen.height}`);
        
        this.init();
    }

    async init() {
        try {
            // Aguardar DOM estar pronto
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.init());
                return;
            }

            console.log('[App] Inicializando componentes...');

            // Verificar dependências
            await this.checkDependencies();

            // Configurar tratamento de erros globais
            this.setupErrorHandling();


            // Aguardar inicialização dos componentes
            await this.waitForComponents();

            // Configurar eventos da aplicação
            this.setupAppEvents();

            // Aplicação pronta
            this.initialized = true;
            console.log('[App] YuStream TV inicializado com sucesso!');

            // Esconder tela de loading
            this.hideLoadingScreen();

        } catch (error) {
            console.error('[App] Erro na inicialização:', error);
            this.showInitializationError(error);
        }
    }

    async checkDependencies() {
        const requiredGlobals = [
            'authService',
            'AdvancedStreamPlayer',
            'SimpleQualitySelector',
            'tvNavigation',
            'deviceUtils',
            'showToast'
        ];

        const missingDeps = [];

        for (const dep of requiredGlobals) {
            if (typeof window[dep] === 'undefined') {
                missingDeps.push(dep);
            }
        }

        if (missingDeps.length > 0) {
            throw new Error(`Dependências não encontradas: ${missingDeps.join(', ')}`);
        }

        console.log('[App] Todas as dependências verificadas');
    }

    async waitForComponents() {
        // Aguardar componentes estarem prontos
        const maxWait = 5000; // 5 segundos
        const startTime = Date.now();

        while (!this.areComponentsReady() && (Date.now() - startTime) < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!this.areComponentsReady()) {
            throw new Error('Timeout aguardando componentes');
        }

        console.log('[App] Componentes prontos');
    }

    areComponentsReady() {
        return !!(
            window.authService &&
            window.AdvancedStreamPlayer &&
            window.SimpleQualitySelector &&
            window.tvNavigation &&
            window.deviceUtils &&
            window.showToast
        );
    }

    setupErrorHandling() {
        // Erros JavaScript não capturados
        window.addEventListener('error', (event) => {
            console.error('[App] Erro JavaScript:', event.error);
            this.handleGlobalError(event.error);
        });

        // Promises rejeitadas não capturadas
        window.addEventListener('unhandledrejection', (event) => {
            console.error('[App] Promise rejeitada:', event.reason);
            this.handleGlobalError(event.reason);
            event.preventDefault(); // Prevenir log no console
        });

        // Erros de recursos (imagens, scripts, etc)
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                console.error('[App] Erro de recurso:', event.target.src || event.target.href);
            }
        }, true);

        console.log('[App] Tratamento de erros configurado');
    }

    handleGlobalError(error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Evitar spam de toasts
        if (!this.lastErrorTime || (Date.now() - this.lastErrorTime) > 5000) {
            if (window.showToast) {
                window.showToast(`Erro inesperado: ${errorMessage}`, 'error');
            }
            this.lastErrorTime = Date.now();
        }

        // Log detalhado para debug
        console.error('[App] Erro detalhado:', {
            message: errorMessage,
            stack: error instanceof Error ? error.stack : null,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        });
    }


    setupAppEvents() {
        // Eventos de visibilidade da página
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('[App] App foi para background');
                this.onAppBackground();
            } else {
                console.log('[App] App voltou para foreground');
                this.onAppForeground();
            }
        });

        // Eventos de redimensionamento (mudança de orientação em alguns dispositivos)
        window.addEventListener('resize', () => {
            console.log('[App] Tela redimensionada:', window.innerWidth, 'x', window.innerHeight);
            this.onScreenResize();
        });

        // Evento antes da página ser fechada
        window.addEventListener('beforeunload', (event) => {
            this.onAppExit();
        });

        // Eventos customizados da aplicação
        window.addEventListener('app:restart', () => {
            this.restart();
        });

        window.addEventListener('app:reset', () => {
            this.reset();
        });

        console.log('[App] Eventos da aplicação configurados');
    }

    onAppBackground() {
        // Pausar player se estiver rodando
        if (window.tvInterface && window.tvInterface.streamPlayer) {
            window.tvInterface.streamPlayer.pause();
        }
    }

    onAppForeground() {
        // Verificar se precisa reconectar
        if (window.tvInterface && window.tvInterface.streamPlayer) {
            // Não fazer play automático, deixar usuário decidir
            console.log('[App] App voltou, player disponível para retomar');
        }
    }

    onScreenResize() {
        // Atualizar elementos focáveis após redimensionamento
        if (window.tvNavigation) {
            setTimeout(() => {
                window.tvNavigation.updateFocusableElements();
            }, 300);
        }
    }

    onAppExit() {
        console.log('[App] App sendo fechado');
        
        // Cleanup se necessário
        if (window.tvInterface) {
            try {
                window.tvInterface.destroy();
            } catch (error) {
                console.error('[App] Erro no cleanup:', error);
            }
        }
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            // Aguardar um pouco para suavizar transição
            setTimeout(() => {
                loadingScreen.classList.remove('active');
                
                // Remover do DOM após animação
                setTimeout(() => {
                    if (loadingScreen.parentNode) {
                        loadingScreen.parentNode.removeChild(loadingScreen);
                    }
                }, 300);
            }, 500);
        }
    }

    showInitializationError(error) {
        console.error('[App] Erro na inicialização:', error);
        
        // Esconder loading screen
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.remove('active');
        }

        // Mostrar tela de erro
        const errorHTML = `
            <div id="init-error-screen" class="screen active">
                <div class="error-container">
                    <div class="error-icon" style="font-size: 4rem; margin-bottom: 2rem;">⚠️</div>
                    <h1 style="color: #FF3B30; margin-bottom: 1rem;">Erro de Inicialização</h1>
                    <p style="color: #CCCCCC; margin-bottom: 2rem; text-align: center; max-width: 600px;">
                        Não foi possível inicializar o YuStream TV. Verifique sua conexão com a internet e tente novamente.
                    </p>
                    <p style="color: #666666; font-size: 0.9rem; margin-bottom: 2rem;">
                        Erro: ${error.message || error}
                    </p>
                    <button onclick="window.location.reload()" 
                            style="padding: 1rem 2rem; font-size: 1.2rem; background: linear-gradient(45deg, #007AFF, #00D4FF); 
                                   border: none; border-radius: 10px; color: white; cursor: pointer;">
                        Tentar Novamente
                    </button>
                </div>
            </div>
        `;

        document.getElementById('app').innerHTML += errorHTML;
    }

    // Métodos públicos
    restart() {
        console.log('[App] Reiniciando aplicação...');
        window.location.reload();
    }

    reset() {
        console.log('[App] Resetando aplicação...');
        
        // Limpar dados locais
        if (window.authService) {
            window.authService.clearAuth();
        }

        // Limpar localStorage se disponível
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.clear();
            }
        } catch (error) {
            console.warn('[App] Erro ao limpar localStorage:', error);
        }

        // Recarregar página
        window.location.reload();
    }

    getInfo() {
        return {
            version: this.version,
            initialized: this.initialized,
            device: window.deviceUtils ? window.deviceUtils.getInfo() : null,
            timestamp: new Date().toISOString()
        };
    }

    // Debug helpers
    enableDebugMode() {
        window.YUSTREAM_DEBUG = true;
        console.log('[App] Modo debug ativado');
        
        // Mostrar informações detalhadas
        console.log('[App] Informações da aplicação:', this.getInfo());
        
        // Adicionar classe CSS para debug
        document.body.classList.add('debug-mode');
    }

    disableDebugMode() {
        window.YUSTREAM_DEBUG = false;
        console.log('[App] Modo debug desativado');
        document.body.classList.remove('debug-mode');
    }
}

// Inicializar aplicação
window.yuStreamApp = new YuStreamTVApp();

// Funções globais de conveniência
window.restartApp = () => window.yuStreamApp.restart();
window.resetApp = () => window.yuStreamApp.reset();
window.debugApp = () => window.yuStreamApp.enableDebugMode();

// Expor informações para debug no console
if (window.location.hostname === 'localhost' || window.location.search.includes('debug=true')) {
    window.yuStreamApp.enableDebugMode();
    
    console.log(`
    🎬 YuStream TV Debug Mode
    
    Comandos disponíveis:
    - restartApp(): Reiniciar aplicação
    - resetApp(): Resetar dados e reiniciar
    - debugApp(): Ativar modo debug
    - window.yuStreamApp.getInfo(): Informações da app
    - window.deviceUtils.getInfo(): Informações do dispositivo
    - window.authService: Serviço de autenticação
    
    Dispositivo: ${window.deviceUtils ? window.deviceUtils.getInfo().brand : 'detectando...'}
    `);
}
