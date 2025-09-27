/**
 * YuStream Smart TV Device Detection
 * Utilitários para detecção e otimização por dispositivo
 */

class DeviceUtils {
    constructor() {
        this.info = this.detectDevice();
        this.applyOptimizations();
        
        console.log('[Device] Dispositivo detectado:', this.info);
    }

    detectDevice() {
        const userAgent = navigator.userAgent.toLowerCase();
        const platform = navigator.platform.toLowerCase();
        const screen = {
            width: window.screen.width,
            height: window.screen.height,
            availWidth: window.screen.availWidth,
            availHeight: window.screen.availHeight
        };

        let deviceInfo = {
            userAgent,
            platform,
            screen,
            type: 'unknown',
            brand: 'unknown',
            model: 'unknown',
            os: 'unknown',
            capabilities: {
                nativeHLS: false,
                hardwareAcceleration: false,
                touch: false,
                voice: false,
                remoteControl: true,
                maxResolution: '1080p',
                audioCodecs: ['aac'],
                videoCodecs: ['h264'],
                drm: false
            },
            optimizations: {
                bufferSize: 10,
                maxBitrate: 8000000, // 8Mbps
                preferredFormat: 'hls',
                lowLatencyMode: false
            }
        };

        // Detecção Tizen (Samsung)
        if (userAgent.includes('tizen') || userAgent.includes('samsung')) {
            deviceInfo = {
                ...deviceInfo,
                type: 'smarttv',
                brand: 'samsung',
                os: 'tizen',
                capabilities: {
                    ...deviceInfo.capabilities,
                    nativeHLS: true,
                    hardwareAcceleration: true,
                    voice: userAgent.includes('voice'),
                    maxResolution: this.detectMaxResolution(screen),
                    audioCodecs: ['aac', 'mp3', 'ac3'],
                    videoCodecs: ['h264', 'h265', 'vp9'],
                    drm: true
                },
                optimizations: {
                    bufferSize: 30,
                    maxBitrate: 20000000, // 20Mbps para 4K
                    preferredFormat: 'hls',
                    lowLatencyMode: true
                }
            };

            // Modelo específico do Tizen
            const tizenVersion = this.extractVersion(userAgent, 'tizen');
            if (tizenVersion) {
                deviceInfo.model = `Tizen ${tizenVersion}`;
            }
        }

        // Detecção WebOS (LG)
        else if (userAgent.includes('webos') || userAgent.includes('lg')) {
            deviceInfo = {
                ...deviceInfo,
                type: 'smarttv',
                brand: 'lg',
                os: 'webos',
                capabilities: {
                    ...deviceInfo.capabilities,
                    nativeHLS: true,
                    hardwareAcceleration: true,
                    voice: userAgent.includes('voice'),
                    maxResolution: this.detectMaxResolution(screen),
                    audioCodecs: ['aac', 'mp3', 'ac3'],
                    videoCodecs: ['h264', 'h265', 'vp9'],
                    drm: true
                },
                optimizations: {
                    bufferSize: 25,
                    maxBitrate: 15000000, // 15Mbps
                    preferredFormat: 'hls',
                    lowLatencyMode: true
                }
            };

            const webosVersion = this.extractVersion(userAgent, 'webos');
            if (webosVersion) {
                deviceInfo.model = `webOS ${webosVersion}`;
            }
        }

        // Detecção Android TV
        else if (userAgent.includes('android') && (userAgent.includes('tv') || screen.width >= 1920)) {
            deviceInfo = {
                ...deviceInfo,
                type: 'smarttv',
                brand: 'android',
                os: 'androidtv',
                capabilities: {
                    ...deviceInfo.capabilities,
                    nativeHLS: false, // Usar hls.js
                    hardwareAcceleration: true,
                    touch: userAgent.includes('touch'),
                    maxResolution: this.detectMaxResolution(screen),
                    audioCodecs: ['aac', 'mp3', 'opus'],
                    videoCodecs: ['h264', 'h265', 'vp8', 'vp9'],
                    drm: true
                },
                optimizations: {
                    bufferSize: 20,
                    maxBitrate: 12000000, // 12Mbps
                    preferredFormat: 'hls',
                    lowLatencyMode: false // hls.js pode ter problemas com LLHLS
                }
            };

            const androidVersion = this.extractVersion(userAgent, 'android');
            if (androidVersion) {
                deviceInfo.model = `Android TV ${androidVersion}`;
            }
        }

        // Detecção Apple TV (via browser)
        else if (userAgent.includes('apple tv') || userAgent.includes('tvos')) {
            deviceInfo = {
                ...deviceInfo,
                type: 'smarttv',
                brand: 'apple',
                os: 'tvos',
                capabilities: {
                    ...deviceInfo.capabilities,
                    nativeHLS: true,
                    hardwareAcceleration: true,
                    touch: true, // Siri Remote
                    voice: true,
                    maxResolution: '4K',
                    audioCodecs: ['aac', 'mp3', 'alac'],
                    videoCodecs: ['h264', 'h265'],
                    drm: true
                },
                optimizations: {
                    bufferSize: 35,
                    maxBitrate: 25000000, // 25Mbps
                    preferredFormat: 'hls',
                    lowLatencyMode: true
                }
            };
        }

        // Detecção Fire TV
        else if (userAgent.includes('aft') || userAgent.includes('fire tv')) {
            deviceInfo = {
                ...deviceInfo,
                type: 'smarttv',
                brand: 'amazon',
                os: 'fireos',
                capabilities: {
                    ...deviceInfo.capabilities,
                    nativeHLS: false,
                    hardwareAcceleration: true,
                    voice: true, // Alexa
                    maxResolution: this.detectMaxResolution(screen),
                    audioCodecs: ['aac', 'mp3'],
                    videoCodecs: ['h264', 'h265'],
                    drm: true
                },
                optimizations: {
                    bufferSize: 15,
                    maxBitrate: 10000000, // 10Mbps
                    preferredFormat: 'hls',
                    lowLatencyMode: false
                }
            };
        }

        // Detecção de desktop/browser comum
        else if (screen.width >= 1920 || userAgent.includes('smart-tv') || userAgent.includes('smarttv')) {
            deviceInfo = {
                ...deviceInfo,
                type: 'smarttv',
                brand: 'generic',
                os: 'browser',
                capabilities: {
                    ...deviceInfo.capabilities,
                    nativeHLS: this.supportsNativeHLS(),
                    hardwareAcceleration: false,
                    maxResolution: this.detectMaxResolution(screen),
                    audioCodecs: ['aac', 'mp3'],
                    videoCodecs: ['h264'],
                    drm: false
                },
                optimizations: {
                    bufferSize: 10,
                    maxBitrate: 8000000,
                    preferredFormat: 'hls',
                    lowLatencyMode: false
                }
            };
        }

        return deviceInfo;
    }

    extractVersion(userAgent, keyword) {
        const regex = new RegExp(`${keyword}[\\s\\/]([\\d\\.]+)`, 'i');
        const match = userAgent.match(regex);
        return match ? match[1] : null;
    }

    detectMaxResolution(screen) {
        if (screen.width >= 3840 && screen.height >= 2160) {
            return '4K';
        } else if (screen.width >= 2560 && screen.height >= 1440) {
            return '1440p';
        } else if (screen.width >= 1920 && screen.height >= 1080) {
            return '1080p';
        } else if (screen.width >= 1280 && screen.height >= 720) {
            return '720p';
        } else {
            return '480p';
        }
    }

    supportsNativeHLS() {
        const video = document.createElement('video');
        return video.canPlayType('application/vnd.apple.mpegurl') !== '';
    }

    applyOptimizations() {
        const body = document.body;
        
        // Aplicar classe CSS baseada na plataforma
        body.classList.add(`platform-${this.info.brand}`);
        body.classList.add(`type-${this.info.type}`);
        
        // Otimizações específicas por plataforma
        switch (this.info.brand) {
            case 'samsung':
                body.classList.add('tizen-optimized');
                this.applySamsungOptimizations();
                break;
            case 'lg':
                body.classList.add('webos-optimized');
                this.applyLGOptimizations();
                break;
            case 'android':
                body.classList.add('androidtv-optimized');
                this.applyAndroidTVOptimizations();
                break;
            case 'apple':
                body.classList.add('appletv-optimized');
                this.applyAppleTVOptimizations();
                break;
        }

        // Configurar viewport para Smart TVs
        if (this.info.type === 'smarttv') {
            this.configureSmartTVViewport();
        }
    }

    applySamsungOptimizations() {
        // Configurações específicas para Tizen
        if (window.tizen) {
            try {
                // Configurar power management
                if (window.tizen.power) {
                    window.tizen.power.request('SCREEN', 'SCREEN_NORMAL');
                }
            } catch (e) {
                console.warn('[Device] Erro ao configurar Tizen:', e);
            }
        }

        // CSS específico para Samsung
        const style = document.createElement('style');
        style.textContent = `
            .tizen-optimized {
                /* Otimizações específicas para Tizen */
                text-rendering: optimizeSpeed;
                -webkit-font-smoothing: antialiased;
            }
        `;
        document.head.appendChild(style);
    }

    applyLGOptimizations() {
        // Configurações específicas para webOS
        if (window.webOS) {
            try {
                // Manter tela ligada
                window.webOS.service.request('luna://com.webos.service.tvpower', {
                    method: 'turnOnScreen',
                    parameters: {},
                    onSuccess: () => console.log('[Device] webOS screen on'),
                    onFailure: (error) => console.warn('[Device] webOS error:', error)
                });
            } catch (e) {
                console.warn('[Device] Erro ao configurar webOS:', e);
            }
        }
    }

    applyAndroidTVOptimizations() {
        // Configurações específicas para Android TV
        const style = document.createElement('style');
        style.textContent = `
            .androidtv-optimized {
                /* Otimizações específicas para Android TV */
                -webkit-transform: translateZ(0);
                transform: translateZ(0);
            }
        `;
        document.head.appendChild(style);
    }

    applyAppleTVOptimizations() {
        // Configurações específicas para Apple TV
        const style = document.createElement('style');
        style.textContent = `
            .appletv-optimized {
                /* Otimizações específicas para Apple TV */
                -webkit-overflow-scrolling: touch;
            }
        `;
        document.head.appendChild(style);
    }

    configureSmartTVViewport() {
        // Configurar viewport para Smart TVs
        let viewport = document.querySelector('meta[name="viewport"]');
        if (!viewport) {
            viewport = document.createElement('meta');
            viewport.name = 'viewport';
            document.head.appendChild(viewport);
        }

        // Configuração otimizada para TVs
        viewport.content = 'width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover';

        // Configurar overscan safe area
        const safeAreaStyle = document.createElement('style');
        safeAreaStyle.textContent = `
            body {
                /* Safe area para TVs com overscan */
                padding: env(safe-area-inset-top, 5vh) env(safe-area-inset-right, 5vw) env(safe-area-inset-bottom, 5vh) env(safe-area-inset-left, 5vw);
            }
        `;
        document.head.appendChild(safeAreaStyle);
    }

    // Métodos públicos
    getInfo() {
        return this.info;
    }

    isSmartTV() {
        return this.info.type === 'smarttv';
    }

    isTizen() {
        return this.info.brand === 'samsung';
    }

    isWebOS() {
        return this.info.brand === 'lg';
    }

    isAndroidTV() {
        return this.info.brand === 'android';
    }

    supportsHardwareAcceleration() {
        return this.info.capabilities.hardwareAcceleration;
    }

    getOptimalBufferSize() {
        return this.info.optimizations.bufferSize;
    }

    getMaxBitrate() {
        return this.info.optimizations.maxBitrate;
    }

    shouldUseLowLatency() {
        return this.info.optimizations.lowLatencyMode;
    }

    getPreferredFormat() {
        return this.info.optimizations.preferredFormat;
    }
}

// Criar instância global
window.deviceUtils = new DeviceUtils();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeviceUtils;
}
