/**
 * YuStream Smart TV Quality Selector
 * Componente para seleção de qualidades baseado na API /stream/qualities
 */

class QualitySelector {
    constructor(options = {}) {
        this.options = options;
        this.isVisible = false;
        this.currentFocusIndex = 0;
        this.qualities = [];
        
        this.container = null;
        this.menu = null;
        
        console.log('[QualitySelector] Inicializado');
    }

    createUI() {
        // Criar container se não existir
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'quality-selector';
            this.container.className = 'quality-selector hidden';
            
            this.container.innerHTML = `
                <div class="quality-menu">
                    <div class="quality-header">
                        <h3>Selecionar Qualidade</h3>
                        <button class="quality-close focusable" tabindex="50">×</button>
                    </div>
                    <div class="quality-list" id="quality-list">
                        <!-- Qualidades serão inseridas aqui -->
                    </div>
                    <div class="quality-footer">
                        <p class="quality-help">Use as setas para navegar • OK para selecionar • Voltar para fechar</p>
                    </div>
                </div>
            `;
            
            // Adicionar ao DOM
            document.body.appendChild(this.container);
            
            // Event listeners
            this.setupEventListeners();
        }
        
        this.menu = this.container.querySelector('.quality-list');
    }

    setupEventListeners() {
        // Botão fechar
        const closeBtn = this.container.querySelector('.quality-close');
        closeBtn.addEventListener('click', () => this.hide());
        
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
        this.qualities = qualities || [];
        
        if (!this.menu) {
            this.createUI();
        }
        
        // Limpar lista atual
        this.menu.innerHTML = '';
        
        if (this.qualities.length === 0) {
            this.menu.innerHTML = `
                <div class="quality-item disabled">
                    <span class="quality-name">Nenhuma qualidade disponível</span>
                </div>
            `;
            return;
        }
        
        // Criar itens de qualidade
        this.qualities.forEach((quality, index) => {
            const item = document.createElement('div');
            item.className = `quality-item focusable ${quality.current ? 'current' : ''} ${!quality.active ? 'disabled' : ''}`;
            item.setAttribute('tabindex', 51 + index);
            item.setAttribute('data-quality', quality.name);
            
            const statusIcon = quality.current ? '▶️' : (quality.active ? '⚪' : '⚫');
            const latencyBadge = quality.lowLatency ? '<span class="latency-badge">Baixa Latência</span>' : '';
            
            item.innerHTML = `
                <div class="quality-content">
                    <span class="quality-status">${statusIcon}</span>
                    <div class="quality-info">
                        <span class="quality-name">${quality.displayName}</span>
                        <span class="quality-description">${quality.description}</span>
                        ${latencyBadge}
                    </div>
                    ${quality.current ? '<span class="current-indicator">ATUAL</span>' : ''}
                </div>
            `;
            
            // Event listener para seleção
            if (quality.active) {
                item.addEventListener('click', () => this.selectQuality(quality.name));
                item.addEventListener('tvSelect', () => this.selectQuality(quality.name));
            }
            
            this.menu.appendChild(item);
        });
        
        console.log('[QualitySelector] ✅ Lista atualizada com', this.qualities.length, 'qualidades');
    }

    show() {
        console.log('[QualitySelector] 👁️ Tentando mostrar menu...');
        console.log('[QualitySelector] Qualidades disponíveis:', this.qualities.length);
        
        if (!this.container) {
            console.log('[QualitySelector] Criando UI...');
            this.createUI();
        }
        
        // Garantir que as qualidades estão atualizadas
        if (this.qualities.length === 0) {
            console.log('[QualitySelector] ⚠️ Nenhuma qualidade disponível, criando placeholder...');
            this.menu.innerHTML = `
                <div class="quality-item disabled">
                    <div class="quality-content">
                        <span class="quality-status">⚠️</span>
                        <div class="quality-info">
                            <span class="quality-name">Nenhuma qualidade disponível</span>
                            <span class="quality-description">Verifique se a stream está online</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        this.container.classList.remove('hidden');
        this.isVisible = true;
        
        // Focar no primeiro item ativo
        setTimeout(() => {
            const firstActive = this.menu.querySelector('.quality-item.focusable:not(.disabled)');
            if (firstActive && window.tvNavigation) {
                window.tvNavigation.focusElement('.quality-item.focusable:not(.disabled)');
            }
        }, 100);
        
        console.log('[QualitySelector] ✅ Menu exibido');
    }

    hide() {
        if (this.container) {
            this.container.classList.add('hidden');
        }
        
        this.isVisible = false;
        console.log('[QualitySelector] 👁️ Menu escondido');
        
        // Voltar foco para controles do player
        if (window.tvNavigation) {
            window.tvNavigation.focusElement('#quality-btn');
        }
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
            console.log('[QualitySelector] 🎯 Selecionando qualidade:', qualityName);
            
            // Esconder menu
            this.hide();
            
            // Chamar callback de mudança de qualidade
            if (this.options.onQualityChange) {
                await this.options.onQualityChange(qualityName);
            }
            
            // Atualizar lista para refletir nova seleção
            setTimeout(() => {
                if (this.options.onQualitiesUpdate) {
                    this.options.onQualitiesUpdate();
                }
            }, 1000);
            
        } catch (error) {
            console.error('[QualitySelector] ❌ Erro ao selecionar qualidade:', error);
        }
    }

    getCurrentQualityName() {
        const current = this.qualities.find(q => q.current);
        return current ? current.displayName : 'Desconhecida';
    }

    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        this.container = null;
        this.menu = null;
        this.qualities = [];
        
        console.log('[QualitySelector] 🗑️ Destruído');
    }
}

// CSS para o seletor de qualidades
const qualitySelectorCSS = `
.quality-selector {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    transition: opacity 0.3s ease;
}

.quality-selector.hidden {
    display: none;
}

.quality-menu {
    background: rgba(20, 20, 20, 0.95);
    border-radius: 20px;
    padding: 2rem;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.quality-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.quality-header h3 {
    margin: 0;
    color: #ffffff;
    font-size: 1.5rem;
}

.quality-close {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    color: #ffffff;
    font-size: 1.5rem;
    cursor: pointer;
    transition: all 0.3s ease;
}

.quality-close:hover,
.quality-close.focused {
    background: rgba(255, 59, 48, 0.8);
    transform: scale(1.1);
}

.quality-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.quality-item {
    padding: 1rem;
    background: rgba(255, 255, 255, 0.05);
    border: 2px solid transparent;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.quality-item:hover,
.quality-item.focused {
    background: rgba(255, 255, 255, 0.1);
    border-color: #007AFF;
    transform: translateY(-2px);
}

.quality-item.current {
    background: rgba(0, 122, 255, 0.2);
    border-color: #007AFF;
}

.quality-item.disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.quality-item.disabled:hover {
    transform: none;
    border-color: transparent;
}

.quality-content {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.quality-status {
    font-size: 1.2rem;
    min-width: 30px;
}

.quality-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.quality-name {
    color: #ffffff;
    font-size: 1.1rem;
    font-weight: 600;
}

.quality-description {
    color: #cccccc;
    font-size: 0.9rem;
}

.latency-badge {
    display: inline-block;
    background: linear-gradient(45deg, #34C759, #30D158);
    color: #ffffff;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    font-size: 0.7rem;
    font-weight: 600;
    margin-top: 0.25rem;
}

.current-indicator {
    background: linear-gradient(45deg, #007AFF, #00D4FF);
    color: #ffffff;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.8rem;
    font-weight: 600;
}

.quality-footer {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    text-align: center;
}

.quality-help {
    color: #888888;
    font-size: 0.9rem;
    margin: 0;
}

/* Responsivo para diferentes tamanhos de TV */
@media (min-width: 1920px) {
    .quality-menu {
        max-width: 800px;
        padding: 3rem;
    }
    
    .quality-header h3 {
        font-size: 2rem;
    }
    
    .quality-item {
        padding: 1.5rem;
    }
    
    .quality-name {
        font-size: 1.3rem;
    }
}
`;

// Adicionar CSS ao documento
if (!document.getElementById('quality-selector-styles')) {
    const style = document.createElement('style');
    style.id = 'quality-selector-styles';
    style.textContent = qualitySelectorCSS;
    document.head.appendChild(style);
}

// Export global
window.QualitySelector = QualitySelector;
