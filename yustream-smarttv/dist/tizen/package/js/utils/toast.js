/**
 * YuStream Smart TV Toast Notifications
 * Sistema de notificações otimizado para Smart TVs
 */

class ToastManager {
    constructor() {
        this.toasts = [];
        this.container = null;
        this.maxToasts = 3;
        this.defaultDuration = 4000; // 4 segundos
        
        this.init();
    }

    init() {
        // Criar container se não existir
        this.container = document.getElementById('toast-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
        
        console.log('[Toast] Sistema inicializado');
    }

    show(message, type = 'info', duration = this.defaultDuration) {
        console.log(`[Toast] Mostrando: ${type} - ${message}`);
        
        // Criar elemento do toast
        const toast = this.createToastElement(message, type);
        
        // Adicionar à lista
        this.toasts.push({
            element: toast,
            type,
            message,
            timestamp: Date.now()
        });

        // Adicionar ao DOM
        this.container.appendChild(toast);

        // Limitar número de toasts
        this.limitToasts();

        // Auto-remover após duração especificada
        if (duration > 0) {
            setTimeout(() => {
                this.remove(toast);
            }, duration);
        }

        // Animar entrada
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        return toast;
    }

    createToastElement(message, type) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        // Ícone baseado no tipo
        const icon = this.getIconForType(type);
        
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${icon}</span>
                <span class="toast-message">${this.escapeHtml(message)}</span>
            </div>
        `;

        // Adicionar handler de clique para fechar
        toast.addEventListener('click', () => {
            this.remove(toast);
        });

        return toast;
    }

    getIconForType(type) {
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };
        
        return icons[type] || icons.info;
    }

    remove(toastElement) {
        if (!toastElement || !toastElement.parentNode) {
            return;
        }

        // Animar saída
        toastElement.classList.add('hide');
        
        setTimeout(() => {
            if (toastElement.parentNode) {
                toastElement.parentNode.removeChild(toastElement);
            }
            
            // Remover da lista
            this.toasts = this.toasts.filter(t => t.element !== toastElement);
        }, 300);
    }

    limitToasts() {
        while (this.toasts.length > this.maxToasts) {
            const oldestToast = this.toasts[0];
            this.remove(oldestToast.element);
        }
    }

    clear() {
        this.toasts.forEach(toast => {
            this.remove(toast.element);
        });
        this.toasts = [];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Métodos de conveniência
    success(message, duration) {
        return this.show(message, 'success', duration);
    }

    error(message, duration) {
        return this.show(message, 'error', duration);
    }

    info(message, duration) {
        return this.show(message, 'info', duration);
    }

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }
}

// Criar instância global
const toastManager = new ToastManager();

// Função global para facilitar uso
window.showToast = (message, type, duration) => {
    return toastManager.show(message, type, duration);
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ToastManager;
}
