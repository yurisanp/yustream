/**
 * YuStream Smart TV Navigation
 * Sistema de navegação otimizado para controle remoto
 * Suporta Tizen, WebOS, Android TV e controles universais
 */

class TVNavigation {
    constructor() {
        this.focusableElements = [];
        this.currentFocusIndex = 0;
        this.isNavigating = false;
        this.lastFocusTime = 0;
        this.navigationDelay = 150; // ms para evitar navegação muito rápida
        
        // Mapeamento de teclas por plataforma
        this.keyMaps = {
            universal: {
                LEFT: [37, 'ArrowLeft'],
                UP: [38, 'ArrowUp'],
                RIGHT: [39, 'ArrowRight'],
                DOWN: [40, 'ArrowDown'],
                ENTER: [13, 'Enter'],
                BACK: [8, 27, 'Backspace', 'Escape'],
                PLAY_PAUSE: [32, ' ', 'Space'],
                HOME: [36, 'Home'],
                MENU: [93, 'ContextMenu']
            },
            tizen: {
                LEFT: [37, 'ArrowLeft'],
                UP: [38, 'ArrowUp'], 
                RIGHT: [39, 'ArrowRight'],
                DOWN: [40, 'ArrowDown'],
                ENTER: [13, 'Enter'],
                BACK: [10009, 'TizenBack'],
                PLAY_PAUSE: [415, 19, 'MediaPlayPause'],
                HOME: [10072, 'TizenHome'],
                MENU: [10146, 'TizenMenu'],
                RED: [403, 'ColorF0Red'],
                GREEN: [404, 'ColorF1Green'],
                YELLOW: [405, 'ColorF2Yellow'],
                BLUE: [406, 'ColorF3Blue']
            },
            webos: {
                LEFT: [37, 'ArrowLeft'],
                UP: [38, 'ArrowUp'],
                RIGHT: [39, 'ArrowRight'], 
                DOWN: [40, 'ArrowDown'],
                ENTER: [13, 'Enter'],
                BACK: [461, 'webOSBack'],
                PLAY_PAUSE: [415, 19, 'MediaPlayPause'],
                HOME: [18, 'webOSHome'],
                MENU: [462, 'webOSMenu'],
                RED: [403, 'ColorF0Red'],
                GREEN: [404, 'ColorF1Green'],
                YELLOW: [405, 'ColorF2Yellow'],
                BLUE: [406, 'ColorF3Blue']
            },
            androidtv: {
                LEFT: [21, 'KEYCODE_DPAD_LEFT'],
                UP: [19, 'KEYCODE_DPAD_UP'],
                RIGHT: [22, 'KEYCODE_DPAD_RIGHT'],
                DOWN: [20, 'KEYCODE_DPAD_DOWN'],
                ENTER: [23, 66, 'KEYCODE_DPAD_CENTER', 'KEYCODE_ENTER'],
                BACK: [4, 'KEYCODE_BACK'],
                PLAY_PAUSE: [85, 'KEYCODE_MEDIA_PLAY_PAUSE'],
                HOME: [3, 'KEYCODE_HOME'],
                MENU: [82, 'KEYCODE_MENU']
            }
        };
        
        this.currentKeyMap = this.detectPlatformKeyMap();
        this.init();
        
        console.log('[Navigation] Sistema inicializado para plataforma:', this.currentKeyMap.platform);
    }

    detectPlatformKeyMap() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        if (userAgent.includes('tizen')) {
            return { platform: 'tizen', keys: this.keyMaps.tizen };
        } else if (userAgent.includes('webos')) {
            return { platform: 'webos', keys: this.keyMaps.webos };
        } else if (userAgent.includes('android') && userAgent.includes('tv')) {
            return { platform: 'androidtv', keys: this.keyMaps.androidtv };
        } else {
            return { platform: 'universal', keys: this.keyMaps.universal };
        }
    }

    init() {
        // Event listeners para navegação
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Prevenir comportamentos padrão do browser
        document.addEventListener('keydown', (e) => {
            if (this.isNavigationKey(e.keyCode) || this.isNavigationKey(e.key)) {
                e.preventDefault();
                e.stopPropagation();
            }
        });

        // Observar mudanças no DOM para atualizar elementos focáveis
        this.setupMutationObserver();
        
        // Atualizar elementos focáveis inicialmente
        this.updateFocusableElements();
    }

    isNavigationKey(key) {
        const allKeys = Object.values(this.currentKeyMap.keys).flat();
        return allKeys.includes(key);
    }

    handleKeyDown(e) {
        const now = Date.now();
        
        // Throttle navegação para evitar movimentos muito rápidos
        if (now - this.lastFocusTime < this.navigationDelay) {
            return;
        }

        const keyCode = e.keyCode || e.which;
        const keyName = e.key;
        
        console.log('[Navigation] Tecla pressionada:', keyCode, keyName);

        // Verificar se é uma tecla de navegação
        if (this.matchKey('LEFT', keyCode, keyName)) {
            this.navigateLeft();
        } else if (this.matchKey('UP', keyCode, keyName)) {
            this.navigateUp();
        } else if (this.matchKey('RIGHT', keyCode, keyName)) {
            this.navigateRight();
        } else if (this.matchKey('DOWN', keyCode, keyName)) {
            this.navigateDown();
        } else if (this.matchKey('ENTER', keyCode, keyName)) {
            this.selectCurrent();
        } else if (this.matchKey('BACK', keyCode, keyName)) {
            this.goBack();
        } else if (this.matchKey('PLAY_PAUSE', keyCode, keyName)) {
            this.handlePlayPause();
        } else if (this.matchKey('HOME', keyCode, keyName)) {
            this.goHome();
        } else if (this.matchKey('MENU', keyCode, keyName)) {
            this.showMenu();
        }
        
        this.lastFocusTime = now;
    }

    handleKeyUp(e) {
        // Implementar se necessário para teclas que precisam de release
    }

    matchKey(action, keyCode, keyName) {
        const keys = this.currentKeyMap.keys[action] || [];
        return keys.includes(keyCode) || keys.includes(keyName);
    }

    updateFocusableElements() {
        // Encontrar todos os elementos focáveis visíveis
        const selector = '.focusable:not(.hidden):not([disabled]):not([style*="display: none"])';
        this.focusableElements = Array.from(document.querySelectorAll(selector));
        
        // Ordenar por tabindex e posição
        this.focusableElements.sort((a, b) => {
            const tabIndexA = parseInt(a.getAttribute('tabindex')) || 0;
            const tabIndexB = parseInt(b.getAttribute('tabindex')) || 0;
            
            if (tabIndexA !== tabIndexB) {
                return tabIndexA - tabIndexB;
            }
            
            // Se tabindex igual, ordenar por posição na tela
            const rectA = a.getBoundingClientRect();
            const rectB = b.getBoundingClientRect();
            
            if (Math.abs(rectA.top - rectB.top) > 10) {
                return rectA.top - rectB.top;
            }
            
            return rectA.left - rectB.left;
        });
        
        console.log('[Navigation] Elementos focáveis atualizados:', this.focusableElements.length);
        
        // Se não há foco atual, focar no primeiro elemento
        if (this.focusableElements.length > 0 && !this.getCurrentFocusedElement()) {
            this.setFocus(0);
        }
    }

    getCurrentFocusedElement() {
        return this.focusableElements.find(el => el.classList.contains('focused') || el === document.activeElement);
    }

    setFocus(index) {
        if (index < 0 || index >= this.focusableElements.length) {
            return;
        }

        // Remover foco anterior
        this.focusableElements.forEach(el => {
            el.classList.remove('focused');
            el.blur();
        });

        // Definir novo foco
        const element = this.focusableElements[index];
        if (element) {
            element.classList.add('focused');
            element.focus();
            this.currentFocusIndex = index;
            
            // Scroll para elemento se necessário
            this.scrollToElement(element);
            
            console.log('[Navigation] Foco definido para:', element.id || element.className, 'índice:', index);
        }
    }

    scrollToElement(element) {
        const rect = element.getBoundingClientRect();
        const isVisible = (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.right <= window.innerWidth
        );

        if (!isVisible) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center'
            });
        }
    }

    // Navegação direcional
    navigateLeft() {
        const current = this.getCurrentFocusedElement();
        if (!current) return;

        const currentRect = current.getBoundingClientRect();
        let bestCandidate = null;
        let bestDistance = Infinity;

        this.focusableElements.forEach(el => {
            if (el === current) return;
            
            const rect = el.getBoundingClientRect();
            
            // Elemento deve estar à esquerda
            if (rect.right <= currentRect.left) {
                // Calcular distância considerando alinhamento vertical
                const verticalOverlap = Math.max(0, 
                    Math.min(currentRect.bottom, rect.bottom) - 
                    Math.max(currentRect.top, rect.top)
                );
                
                const horizontalDistance = currentRect.left - rect.right;
                const verticalDistance = verticalOverlap > 0 ? 0 : 
                    Math.min(
                        Math.abs(currentRect.top - rect.bottom),
                        Math.abs(currentRect.bottom - rect.top)
                    );
                
                const distance = horizontalDistance + verticalDistance * 2;
                
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestCandidate = el;
                }
            }
        });

        if (bestCandidate) {
            const newIndex = this.focusableElements.indexOf(bestCandidate);
            this.setFocus(newIndex);
        }
    }

    navigateRight() {
        const current = this.getCurrentFocusedElement();
        if (!current) return;

        const currentRect = current.getBoundingClientRect();
        let bestCandidate = null;
        let bestDistance = Infinity;

        this.focusableElements.forEach(el => {
            if (el === current) return;
            
            const rect = el.getBoundingClientRect();
            
            // Elemento deve estar à direita
            if (rect.left >= currentRect.right) {
                const verticalOverlap = Math.max(0, 
                    Math.min(currentRect.bottom, rect.bottom) - 
                    Math.max(currentRect.top, rect.top)
                );
                
                const horizontalDistance = rect.left - currentRect.right;
                const verticalDistance = verticalOverlap > 0 ? 0 : 
                    Math.min(
                        Math.abs(currentRect.top - rect.bottom),
                        Math.abs(currentRect.bottom - rect.top)
                    );
                
                const distance = horizontalDistance + verticalDistance * 2;
                
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestCandidate = el;
                }
            }
        });

        if (bestCandidate) {
            const newIndex = this.focusableElements.indexOf(bestCandidate);
            this.setFocus(newIndex);
        }
    }

    navigateUp() {
        const current = this.getCurrentFocusedElement();
        if (!current) return;

        const currentRect = current.getBoundingClientRect();
        let bestCandidate = null;
        let bestDistance = Infinity;

        this.focusableElements.forEach(el => {
            if (el === current) return;
            
            const rect = el.getBoundingClientRect();
            
            // Elemento deve estar acima
            if (rect.bottom <= currentRect.top) {
                const horizontalOverlap = Math.max(0, 
                    Math.min(currentRect.right, rect.right) - 
                    Math.max(currentRect.left, rect.left)
                );
                
                const verticalDistance = currentRect.top - rect.bottom;
                const horizontalDistance = horizontalOverlap > 0 ? 0 : 
                    Math.min(
                        Math.abs(currentRect.left - rect.right),
                        Math.abs(currentRect.right - rect.left)
                    );
                
                const distance = verticalDistance + horizontalDistance * 2;
                
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestCandidate = el;
                }
            }
        });

        if (bestCandidate) {
            const newIndex = this.focusableElements.indexOf(bestCandidate);
            this.setFocus(newIndex);
        }
    }

    navigateDown() {
        const current = this.getCurrentFocusedElement();
        if (!current) return;

        const currentRect = current.getBoundingClientRect();
        let bestCandidate = null;
        let bestDistance = Infinity;

        this.focusableElements.forEach(el => {
            if (el === current) return;
            
            const rect = el.getBoundingClientRect();
            
            // Elemento deve estar abaixo
            if (rect.top >= currentRect.bottom) {
                const horizontalOverlap = Math.max(0, 
                    Math.min(currentRect.right, rect.right) - 
                    Math.max(currentRect.left, rect.left)
                );
                
                const verticalDistance = rect.top - currentRect.bottom;
                const horizontalDistance = horizontalOverlap > 0 ? 0 : 
                    Math.min(
                        Math.abs(currentRect.left - rect.right),
                        Math.abs(currentRect.right - rect.left)
                    );
                
                const distance = verticalDistance + horizontalDistance * 2;
                
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestCandidate = el;
                }
            }
        });

        if (bestCandidate) {
            const newIndex = this.focusableElements.indexOf(bestCandidate);
            this.setFocus(newIndex);
        }
    }

    // Ações
    selectCurrent() {
        const current = this.getCurrentFocusedElement();
        if (current) {
            console.log('[Navigation] Selecionando elemento:', current.id || current.className);
            
            // Simular clique
            current.click();
            
            // Disparar evento customizado
            current.dispatchEvent(new CustomEvent('tvSelect', { bubbles: true }));
        }
    }

    goBack() {
        console.log('[Navigation] Botão voltar pressionado');
        window.dispatchEvent(new CustomEvent('tvBack'));
    }

    handlePlayPause() {
        console.log('[Navigation] Botão play/pause pressionado');
        window.dispatchEvent(new CustomEvent('tvPlayPause'));
    }

    goHome() {
        console.log('[Navigation] Botão home pressionado');
        window.dispatchEvent(new CustomEvent('tvHome'));
    }

    showMenu() {
        console.log('[Navigation] Botão menu pressionado');
        window.dispatchEvent(new CustomEvent('tvMenu'));
    }

    // Mutation Observer para detectar mudanças no DOM
    setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            let shouldUpdate = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || 
                    mutation.type === 'attributes' && 
                    (mutation.attributeName === 'class' || 
                     mutation.attributeName === 'style' || 
                     mutation.attributeName === 'disabled')) {
                    shouldUpdate = true;
                }
            });
            
            if (shouldUpdate) {
                // Debounce para evitar múltiplas atualizações
                clearTimeout(this.updateTimeout);
                this.updateTimeout = setTimeout(() => {
                    this.updateFocusableElements();
                }, 100);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'disabled', 'tabindex']
        });
    }

    // Métodos públicos
    focusElement(selector) {
        const element = document.querySelector(selector);
        if (element) {
            const index = this.focusableElements.indexOf(element);
            if (index >= 0) {
                this.setFocus(index);
                return true;
            }
        }
        return false;
    }

    focusFirst() {
        if (this.focusableElements.length > 0) {
            this.setFocus(0);
            return true;
        }
        return false;
    }

    focusLast() {
        if (this.focusableElements.length > 0) {
            this.setFocus(this.focusableElements.length - 1);
            return true;
        }
        return false;
    }

    destroy() {
        // Limpar event listeners se necessário
        console.log('[Navigation] Sistema de navegação destruído');
    }
}

// Criar instância global
window.tvNavigation = new TVNavigation();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TVNavigation;
}
