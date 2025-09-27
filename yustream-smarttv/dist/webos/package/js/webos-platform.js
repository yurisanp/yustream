
/**
 * webOS Platform Specific Code
 */

class WebOSPlatform {
    constructor() {
        this.isAvailable = typeof window.webOS !== 'undefined';
        
        if (this.isAvailable) {
            console.log('[webOS] Platform available');
            this.init();
        }
    }

    init() {
        // Service management
        this.setupServices();
        
        // Input handling
        this.setupInputHandling();
        
        // Audio management
        this.setupAudioManagement();
        
        // Network management
        this.setupNetworkManagement();
    }

    setupServices() {
        try {
            if (window.webOS.service) {
                // Power management
                this.powerService = window.webOS.service.request('luna://com.webos.service.tvpower', {
                    method: 'turnOnScreen',
                    parameters: {},
                    onSuccess: (response) => {
                        console.log('[webOS] Power service initialized:', response);
                    },
                    onFailure: (error) => {
                        console.warn('[webOS] Power service error:', error);
                    }
                });
                
                console.log('[webOS] Services configured');
            }
        } catch (e) {
            console.warn('[webOS] Service setup error:', e);
        }
    }

    setupInputHandling() {
        // Magic Remote support
        document.addEventListener('mousemove', (e) => {
            // Handle Magic Remote pointer
            this.updatePointerPosition(e.clientX, e.clientY);
        });

        // Handle webOS specific keys
        document.addEventListener('keydown', (e) => {
            switch(e.keyCode) {
                case 461: // webOS back
                    e.preventDefault();
                    this.handleBack();
                    break;
                case 403: // Red
                case 404: // Green  
                case 405: // Yellow
                case 406: // Blue
                    e.preventDefault();
                    this.handleColorKey(e.keyCode);
                    break;
            }
        });
    }

    updatePointerPosition(x, y) {
        // Update cursor position for Magic Remote
        const cursor = document.querySelector('.magic-remote-cursor');
        if (cursor) {
            cursor.style.left = x + 'px';
            cursor.style.top = y + 'px';
        }
    }

    handleBack() {
        if (window.tvInterface) {
            window.tvInterface.handleBackButton();
        }
    }

    handleColorKey(keyCode) {
        const colorMap = {
            403: 'red',
            404: 'green', 
            405: 'yellow',
            406: 'blue'
        };
        
        const color = colorMap[keyCode];
        console.log(`[webOS] Color key pressed: ${color}`);
        
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('webos:colorkey', { 
            detail: { color, keyCode } 
        }));
    }

    setupAudioManagement() {
        try {
            if (window.webOS.service) {
                // Audio control service
                console.log('[webOS] Audio management configured');
            }
        } catch (e) {
            console.warn('[webOS] Audio management error:', e);
        }
    }

    setupNetworkManagement() {
        try {
            if (window.webOS.service) {
                // Network status monitoring
                window.webOS.service.request('luna://com.webos.service.connectionmanager', {
                    method: 'getStatus',
                    parameters: {},
                    onSuccess: (response) => {
                        console.log('[webOS] Network status:', response);
                    },
                    onFailure: (error) => {
                        console.warn('[webOS] Network status error:', error);
                    }
                });
            }
        } catch (e) {
            console.warn('[webOS] Network management error:', e);
        }
    }

    close() {
        try {
            if (window.webOS.platformBack) {
                window.webOS.platformBack();
            }
        } catch (e) {
            console.warn('[webOS] Close error:', e);
        }
    }

    minimize() {
        try {
            if (window.webOS.service) {
                window.webOS.service.request('luna://com.webos.service.applicationmanager', {
                    method: 'pause',
                    parameters: {},
                    onSuccess: (response) => {
                        console.log('[webOS] App minimized');
                    }
                });
            }
        } catch (e) {
            console.warn('[webOS] Minimize error:', e);
        }
    }
}

// Inicializar quando disponível
if (typeof window !== 'undefined') {
    window.webOSPlatform = new WebOSPlatform();
}
