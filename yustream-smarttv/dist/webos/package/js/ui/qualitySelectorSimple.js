/**
 * YuStream Smart TV Quality Selector - Versão Simplificada
 * Versão que garante funcionamento mesmo se a API falhar
 */

class SimpleQualitySelector {
    constructor(options = {}) {
        this.options = options;
        this.isVisible = false;
        this.qualities = [];
        this.container = null;
        
        console.log('[SimpleQualitySelector] Inicializado');
        this.createUI();
    }

    createUI() {
        // Remover container existente se houver
        const existing = document.getElementById('simple-quality-selector');
        if (existing) {
            existing.remove();
        }

        // Criar container
        this.container = document.createElement('div');
        this.container.id = 'simple-quality-selector';
        this.container.className = 'simple-quality-overlay hidden';
        
        this.container.innerHTML = `
            <div class="simple-quality-menu">
                <div class="simple-quality-header">
                    <h3>🎬 Selecionar Qualidade</h3>
                    <button class="simple-quality-close focusable" tabindex="60">✕</button>
                </div>
                <div class="simple-quality-list" id="simple-quality-list">
                    <div class="simple-quality-item loading">
                        <span>Carregando qualidades...</span>
                    </div>
                </div>
                <div class="simple-quality-footer">
                    <p>Setas: Navegar • OK: Selecionar • Voltar: Fechar</p>
                </div>
            </div>
        `;
        
        // Adicionar ao body
        document.body.appendChild(this.container);
        
        // Event listeners
        this.setupEventListeners();
        
        // Adicionar CSS inline para garantir funcionamento
        this.addStyles();
        
        console.log('[SimpleQualitySelector] UI criada');
    }

    addStyles() {
        if (document.getElementById('simple-quality-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'simple-quality-styles';
        style.textContent = `
            .simple-quality-overlay {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                background: rgba(0, 0, 0, 0.95) !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                z-index: 10000 !important; /* Maior que fullscreen (9999) */
                transition: opacity 0.3s ease;
            }

            .simple-quality-overlay.hidden {
                display: none !important;
            }

            /* Garantir visibilidade em fullscreen */
            #player-screen.fullscreen ~ .simple-quality-overlay {
                z-index: 10001 !important;
            }

            .simple-quality-menu {
                background: #1a1a1a;
                border-radius: 15px;
                padding: 2rem;
                max-width: 500px;
                width: 90%;
                max-height: 70vh;
                overflow-y: auto;
                border: 2px solid #333;
            }

            .simple-quality-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1.5rem;
                padding-bottom: 1rem;
                border-bottom: 1px solid #333;
            }

            .simple-quality-header h3 {
                margin: 0;
                color: #ffffff;
                font-size: 1.3rem;
            }

            .simple-quality-close {
                background: #ff3b30;
                border: none;
                border-radius: 50%;
                width: 35px;
                height: 35px;
                color: white;
                font-size: 1.2rem;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .simple-quality-close:hover,
            .simple-quality-close.focused {
                background: #ff6b60;
                transform: scale(1.1);
            }

            .simple-quality-list {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                margin-bottom: 1.5rem;
            }

            .simple-quality-item {
                padding: 1rem;
                background: #2a2a2a;
                border: 2px solid transparent;
                border-radius: 8px;
                color: white;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .simple-quality-item:hover,
            .simple-quality-item.focused {
                background: #3a3a3a;
                border-color: #007AFF;
                transform: translateY(-2px);
            }

            .simple-quality-item.current {
                background: #007AFF;
                border-color: #0056CC;
            }

            .simple-quality-item.disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .simple-quality-item.loading {
                text-align: center;
                opacity: 0.7;
            }

            .simple-quality-info {
                display: flex;
                flex-direction: column;
                gap: 0.2rem;
            }

            .simple-quality-name {
                font-weight: 600;
                font-size: 1rem;
            }

            .simple-quality-desc {
                font-size: 0.8rem;
                opacity: 0.8;
            }

            .simple-quality-status {
                font-size: 1.2rem;
                min-width: 30px;
                text-align: center;
            }

            .simple-quality-footer {
                text-align: center;
                padding-top: 1rem;
                border-top: 1px solid #333;
            }

            .simple-quality-footer p {
                margin: 0;
                color: #888;
                font-size: 0.9rem;
            }
        `;
        
        document.head.appendChild(style);
    }

    setupEventListeners() {
        // Botão fechar
        const closeBtn = this.container.querySelector('.simple-quality-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
        
        // Tecla ESC para fechar
        document.addEventListener('keydown', (e) => {
            if (this.isVisible && (e.keyCode === 27 || e.key === 'Escape')) {
                this.hide();
            }
        });
        
        // Eventos customizados de navegação
        window.addEventListener('tvBack', () => {
            if (this.isVisible) {
                this.hide();
            }
        });
    }

    updateQualities(qualities) {
        console.log('[SimpleQualitySelector] 🔄 Atualizando qualidades:', qualities);
        
        this.qualities = qualities || [];
        
        const list = document.getElementById('simple-quality-list');
        if (!list) {
            console.error('[SimpleQualitySelector] ❌ Lista não encontrada');
            return;
        }
        
        // Limpar lista
        list.innerHTML = '';
        
        if (this.qualities.length === 0) {
            list.innerHTML = `
                <div class="simple-quality-item disabled">
                    <div class="simple-quality-info">
                        <span class="simple-quality-name">Nenhuma qualidade disponível</span>
                        <span class="simple-quality-desc">Verifique se a stream está online</span>
                    </div>
                    <span class="simple-quality-status">❌</span>
                </div>
            `;
            return;
        }
        
        // Criar itens de qualidade
        this.qualities.forEach((quality, index) => {
            const item = document.createElement('div');
            item.className = `simple-quality-item focusable ${quality.current ? 'current' : ''} ${!quality.active ? 'disabled' : ''}`;
            item.setAttribute('tabindex', 61 + index);
            item.setAttribute('data-quality', quality.name);
            
            const statusIcon = quality.current ? '▶️' : (quality.active ? '✅' : '❌');
            
            item.innerHTML = `
                <div class="simple-quality-info">
                    <span class="simple-quality-name">${quality.displayName || quality.name}</span>
                    <span class="simple-quality-desc">${quality.description || ''}</span>
                    ${quality.lowLatency ? '<span style="color: #34C759; font-size: 0.7rem;">🚀 Baixa Latência</span>' : ''}
                </div>
                <span class="simple-quality-status">${statusIcon}</span>
                ${quality.current ? '<span style="color: #007AFF; font-size: 0.8rem; margin-left: 10px;">ATUAL</span>' : ''}
            `;
            
            // Event listener para seleção
            if (quality.active && !quality.current) {
                item.addEventListener('click', () => this.selectQuality(quality.name));
            }
            
            list.appendChild(item);
        });
        
        console.log('[SimpleQualitySelector] ✅ Lista atualizada com', this.qualities.length, 'qualidades');
    }

    show() {
        console.log('[SimpleQualitySelector] 👁️ Mostrando menu...');
        console.log('[SimpleQualitySelector] Qualidades disponíveis:', this.qualities.length);
        
        if (!this.container) {
            console.log('[SimpleQualitySelector] ❌ Container não existe, criando...');
            this.createUI();
        }
        
        // Verificar se container foi criado
        if (!this.container) {
            console.error('[SimpleQualitySelector] ❌ Falha ao criar container');
            return;
        }
        
        // Verificar se está no DOM
        if (!document.body.contains(this.container)) {
            console.log('[SimpleQualitySelector] 🔧 Re-adicionando ao DOM...');
            document.body.appendChild(this.container);
        }
        
        this.container.classList.remove('hidden');
        this.isVisible = true;
        
        console.log('[SimpleQualitySelector] 📊 Container classes:', this.container.className);
        console.log('[SimpleQualitySelector] 📊 Container style:', this.container.style.cssText);
        
        // Atualizar elementos focáveis
        setTimeout(() => {
            if (window.tvNavigation) {
                window.tvNavigation.updateFocusableElements();
                
                // Focar no primeiro item ativo
                const firstActive = document.querySelector('.simple-quality-item.focusable:not(.disabled)');
                if (firstActive) {
                    window.tvNavigation.focusElement('.simple-quality-item.focusable:not(.disabled)');
                }
            }
        }, 200);
        
        console.log('[SimpleQualitySelector] ✅ Menu visível');
    }

    hide() {
        if (this.container) {
            this.container.classList.add('hidden');
        }
        
        this.isVisible = false;
        console.log('[SimpleQualitySelector] 👁️ Menu escondido');
        
        // Voltar foco para botão de qualidade
        setTimeout(() => {
            if (window.tvNavigation) {
                window.tvNavigation.focusElement('#quality-btn');
            }
        }, 100);
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    async selectQuality(qualityName) {
        try {
            console.log('[SimpleQualitySelector] 🎯 Selecionando:', qualityName);
            
            // Esconder menu
            this.hide();
            
            // Chamar callback
            if (this.options.onQualityChange) {
                await this.options.onQualityChange(qualityName);
            }
            
        } catch (error) {
            console.error('[SimpleQualitySelector] ❌ Erro ao selecionar:', error);
        }
    }

    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        this.container = null;
        this.qualities = [];
        
        console.log('[SimpleQualitySelector] 🗑️ Destruído');
    }
}

// Export global
window.SimpleQualitySelector = SimpleQualitySelector;
