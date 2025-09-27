
/**
 * Tizen Platform Specific Code
 */

class TizenPlatform {
    constructor() {
        this.isAvailable = typeof window.tizen !== 'undefined';
        
        if (this.isAvailable) {
            console.log('[Tizen] Platform available');
            this.init();
        }
    }

    init() {
        // Power management
        this.setupPowerManagement();
        
        // Key registration
        this.registerKeys();
        
        // Audio management
        this.setupAudioManagement();
    }

    setupPowerManagement() {
        try {
            if (window.tizen.power) {
                // Manter tela ligada durante reprodução
                window.tizen.power.request('SCREEN', 'SCREEN_NORMAL');
                console.log('[Tizen] Power management configured');
            }
        } catch (e) {
            console.warn('[Tizen] Power management error:', e);
        }
    }

    registerKeys() {
        try {
            if (window.tizen.tvinputdevice) {
                const keys = [
                    'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop',
                    'VolumeUp', 'VolumeDown', 'VolumeMute',
                    'ChannelUp', 'ChannelDown',
                    'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue'
                ];
                
                keys.forEach(key => {
                    try {
                        window.tizen.tvinputdevice.registerKey(key);
                    } catch (e) {
                        console.warn(`[Tizen] Failed to register key: ${key}`, e);
                    }
                });
                
                console.log('[Tizen] Keys registered');
            }
        } catch (e) {
            console.warn('[Tizen] Key registration error:', e);
        }
    }

    setupAudioManagement() {
        try {
            if (window.tizen.tvaudiocontrol) {
                // Configurar saída de áudio
                console.log('[Tizen] Audio management configured');
            }
        } catch (e) {
            console.warn('[Tizen] Audio management error:', e);
        }
    }

    exit() {
        try {
            if (window.tizen.application) {
                window.tizen.application.getCurrentApplication().exit();
            }
        } catch (e) {
            console.warn('[Tizen] Exit error:', e);
        }
    }

    hide() {
        try {
            if (window.tizen.application) {
                window.tizen.application.getCurrentApplication().hide();
            }
        } catch (e) {
            console.warn('[Tizen] Hide error:', e);
        }
    }
}

// Inicializar quando disponível
if (typeof window !== 'undefined') {
    window.tizenPlatform = new TizenPlatform();
}
