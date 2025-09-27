#!/usr/bin/env node

/**
 * Build script para webOS (LG Smart TV)
 * Cria um pacote .ipk pronto para instalação
 */

const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const { generateConfigScript } = require('../config/server');

class WebOSBuilder {
    constructor() {
        this.srcDir = path.join(__dirname, '..', 'src');
        this.platformDir = path.join(__dirname, '..', 'platforms', 'webos');
        this.distDir = path.join(__dirname, '..', 'dist', 'webos');
        this.packageDir = path.join(this.distDir, 'package');
        
        console.log('📺 YuStream TV - Build webOS');
        console.log('Origem:', this.srcDir);
        console.log('Plataforma:', this.platformDir);
        console.log('Destino:', this.distDir);
    }

    async build() {
        try {
            console.log('\n📦 Iniciando build para webOS...');
            
            // Limpar diretório de destino
            await this.clean();
            
            // Copiar arquivos base
            await this.copyBaseFiles();
            
            // Copiar configuração do webOS
            await this.copyWebOSConfig();
            
            // Processar HTML para webOS
            await this.processHTML();
            
            // Processar CSS para webOS
            await this.processCSS();
            
            // Processar JavaScript para webOS
            await this.processJavaScript();
            
            // Copiar assets
            await this.copyAssets();
            
            // Gerar ícones para webOS
            await this.generateWebOSIcons();
            
            // Criar estrutura de pacote webOS
            await this.createPackageStructure();
            
            // Gerar informações de build
            await this.generateBuildInfo();
            
            console.log('✅ Build webOS concluído!');
            console.log(`📁 Pacote em: ${this.packageDir}`);
            console.log('💡 Use "ares-package" para criar o .ipk');
            
        } catch (error) {
            console.error('❌ Erro no build:', error);
            process.exit(1);
        }
    }

    async clean() {
        console.log('🧹 Limpando diretório...');
        await fs.remove(this.distDir);
        await fs.ensureDir(this.distDir);
        await fs.ensureDir(this.packageDir);
    }

    async copyBaseFiles() {
        console.log('📄 Copiando arquivos base...');
        
        // Copiar estrutura completa
        await fs.copy(this.srcDir, this.packageDir);
        
        // Remover manifest.json (webOS usa appinfo.json)
        const manifestPath = path.join(this.packageDir, 'manifest.json');
        if (await fs.pathExists(manifestPath)) {
            await fs.remove(manifestPath);
        }
        
        console.log('  ✓ Arquivos base copiados');
    }

    async copyWebOSConfig() {
        console.log('⚙️ Copiando configuração webOS...');
        
        const appinfoPath = path.join(this.platformDir, 'appinfo.json');
        const destAppinfoPath = path.join(this.packageDir, 'appinfo.json');
        
        await fs.copy(appinfoPath, destAppinfoPath);
        console.log('  ✓ appinfo.json copiado');
    }

    async processHTML() {
        console.log('🔧 Processando HTML para webOS...');
        
        const htmlPath = path.join(this.packageDir, 'index.html');
        let html = await fs.readFile(htmlPath, 'utf8');
        
        // Remover referência ao manifest.json
        html = html.replace(/<link rel="manifest"[^>]*>/g, '');
        
        // Adicionar meta tags específicas para webOS
        html = html.replace(
            '<meta name="theme-color" content="#000000">',
            `<meta name="theme-color" content="#000000">
    <meta name="webos-version" content="4.0">
    <meta name="application-name" content="YuStream TV">
    <meta name="viewport" content="width=1920, height=1080, user-scalable=no">`
        );
        
        // Adicionar configuração do servidor usando arquivo centralizado
        const serverConfig = generateConfigScript('production', 'webos');

        // Adicionar script de inicialização webOS
        const webosInitScript = `
    <script>
        // webOS initialization
        window.addEventListener('load', function() {
            if (window.webOS) {
                console.log('webOS platform detected');
                document.body.classList.add('webos-platform');
                
                // Initialize webOS services
                try {
                    // Keep screen on during playback
                    if (webOS.service) {
                        webOS.service.request('luna://com.webos.service.tvpower', {
                            method: 'turnOnScreen',
                            parameters: {},
                            onSuccess: function() {
                                console.log('webOS screen management initialized');
                            },
                            onFailure: function(error) {
                                console.warn('webOS screen management error:', error);
                            }
                        });
                    }
                } catch (e) {
                    console.warn('Error initializing webOS services:', e);
                }
            }
        });
        
        // Handle webOS back key
        document.addEventListener('keydown', function(e) {
            if (e.keyCode === 461) { // webOS back key
                e.preventDefault();
                if (window.tvInterface) {
                    window.tvInterface.handleBackButton();
                }
            }
        });
    </script>`;
        
        html = html.replace('</body>', `${serverConfig}${webosInitScript}\n</body>`);
        
        // Adicionar informações de build
        const buildInfo = `<!-- Build: webOS LG TV - ${new Date().toISOString()} -->`;
        html = html.replace('</head>', `    ${buildInfo}\n</head>`);
        
        await fs.writeFile(htmlPath, html);
        console.log('  ✓ index.html processado para webOS');
    }

    async processCSS() {
        console.log('🎨 Processando CSS para webOS...');
        
        const cssPath = path.join(this.packageDir, 'css', 'styles.css');
        let css = await fs.readFile(cssPath, 'utf8');
        
        // Adicionar CSS específico para webOS
        const webosCSS = `
/* webOS LG TV Optimizations */
.webos-platform {
    /* Otimizações específicas para webOS */
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
}

/* Otimizações para Magic Remote */
.webos-platform .focusable {
    position: relative;
}

.webos-platform .focusable::after {
    content: '';
    position: absolute;
    top: -4px;
    left: -4px;
    right: -4px;
    bottom: -4px;
    border: 3px solid transparent;
    border-radius: inherit;
    transition: border-color 0.2s ease;
    pointer-events: none;
}

.webos-platform .focusable:focus::after,
.webos-platform .focusable.focused::after {
    border-color: #00D4FF;
    box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
}

/* Otimizações para resolução 1920x1080 */
@media (width: 1920px) and (height: 1080px) {
    .webos-platform {
        font-size: 1.1em;
    }
    
    .login-header h1 {
        font-size: 3.5rem;
    }
    
    .control-btn {
        padding: 1.2rem 1.8rem;
        font-size: 1.6rem;
    }
}

/* Otimizações para resolução 4K */
@media (width: 3840px) and (height: 2160px) {
    .webos-platform {
        font-size: 1.5em;
    }
    
    .login-header h1 {
        font-size: 5rem;
    }
    
    .control-btn {
        padding: 1.5rem 2.2rem;
        font-size: 2rem;
    }
}

/* Suporte para cores do controle remoto LG */
.lg-color-buttons {
    position: absolute;
    bottom: 2rem;
    right: 2rem;
    display: flex;
    gap: 1rem;
}

.color-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.3);
    cursor: pointer;
    transition: all 0.3s ease;
}

.color-btn.red { background: #FF3B30; }
.color-btn.green { background: #34C759; }
.color-btn.yellow { background: #FFCC00; }
.color-btn.blue { background: #007AFF; }

.color-btn:focus,
.color-btn.focused {
    transform: scale(1.2);
    border-color: #FFFFFF;
}

/* Otimizações de performance para webOS */
.webos-optimized * {
    -webkit-transform: translateZ(0);
    transform: translateZ(0);
}

.video-player {
    /* Usar aceleração de hardware nativa do webOS */
    -webkit-transform: translateZ(0);
    transform: translateZ(0);
    will-change: transform;
}

/* Suporte para Magic Remote pointer */
.webos-platform .magic-remote-pointer {
    cursor: pointer;
}

/* Animações suaves para webOS */
.webos-platform .screen {
    transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
`;
        
        css += webosCSS;
        await fs.writeFile(cssPath, css);
        console.log('  ✓ CSS processado com otimizações webOS');
    }

    async processJavaScript() {
        console.log('📜 Processando JavaScript para webOS...');
        
        // Adicionar arquivo específico para webOS
        const webosJSContent = `
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
        console.log(\`[webOS] Color key pressed: \${color}\`);
        
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
`;
        
        const webosJSPath = path.join(this.packageDir, 'js', 'webos-platform.js');
        await fs.writeFile(webosJSPath, webosJSContent);
        
        // Adicionar script ao HTML
        const htmlPath = path.join(this.packageDir, 'index.html');
        let html = await fs.readFile(htmlPath, 'utf8');
        html = html.replace(
            '<script src="js/app.js"></script>',
            '<script src="js/webos-platform.js"></script>\n    <script src="js/app.js"></script>'
        );
        await fs.writeFile(htmlPath, html);
        
        console.log('  ✓ JavaScript processado para webOS');
    }

    async copyAssets() {
        console.log('🖼️ Processando assets...');
        
        const assetsDir = path.join(this.packageDir, 'assets');
        await fs.ensureDir(assetsDir);
        
        // Assets já foram copiados com copyBaseFiles
        console.log('  ✓ Assets processados');
    }

    async generateWebOSIcons() {
        console.log('🎨 Gerando ícones webOS...');
        
        // Gerar ícone principal (80x80 para webOS)
        const iconSVG = `
<svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="80" rx="15" fill="#000000"/>
    <circle cx="40" cy="40" r="18" fill="#007AFF"/>
    <polygon points="34,30 34,50 52,40" fill="#FFFFFF"/>
    <text x="40" y="68" text-anchor="middle" fill="#FFFFFF" font-family="Arial" font-size="6" font-weight="bold">YuStream</text>
</svg>`;
        
        await fs.writeFile(path.join(this.packageDir, 'icon.svg'), iconSVG);
        
        // Gerar ícone grande (130x130)
        const largeIconSVG = `
<svg width="130" height="130" viewBox="0 0 130 130" xmlns="http://www.w3.org/2000/svg">
    <rect width="130" height="130" rx="25" fill="#000000"/>
    <circle cx="65" cy="65" r="30" fill="#007AFF"/>
    <polygon points="55,48 55,82 85,65" fill="#FFFFFF"/>
    <text x="65" y="110" text-anchor="middle" fill="#FFFFFF" font-family="Arial" font-size="10" font-weight="bold">YuStream</text>
</svg>`;
        
        await fs.writeFile(path.join(this.packageDir, 'icon-large.svg'), largeIconSVG);
        
        console.log('  ✓ Ícones webOS gerados');
    }

    async createPackageStructure() {
        console.log('📁 Criando estrutura de pacote webOS...');
        
        // webOS não precisa de compactação especial como Tizen
        // O pacote .ipk é criado com ares-package
        
        console.log('  ✓ Estrutura criada (use ares-package para gerar .ipk)');
    }

    async generateBuildInfo() {
        console.log('📋 Gerando informações de build...');
        
        const buildInfo = {
            version: '1.0.0',
            build: 'webos',
            timestamp: new Date().toISOString(),
            platform: 'LG webOS TV',
            targetDevices: [
                'LG Smart TV 2014+',
                'webOS 3.0+',
                'Full HD (1920x1080)',
                '4K UHD (3840x2160)'
            ],
            features: [
                'Native webOS Integration',
                'Magic Remote Support',
                'Luna Service API',
                'Power Management',
                'Color Key Support',
                'HLS Native Playback'
            ],
            package: {
                id: 'com.yustream.tv',
                name: 'YuStream TV',
                directory: 'package'
            },
            deployment: {
                command: 'ares-package package',
                install: 'ares-install com.yustream.tv_1.0.0_all.ipk',
                launch: 'ares-launch com.yustream.tv'
            }
        };
        
        await fs.writeFile(
            path.join(this.distDir, 'build-info.json'), 
            JSON.stringify(buildInfo, null, 2)
        );
        
        // Criar script de deploy
        const deployScript = `#!/bin/bash
# webOS Deploy Script

echo "📦 Criando pacote webOS..."
ares-package package

echo "📱 Instalando no dispositivo..."
# ares-install com.yustream.tv_1.0.0_all.ipk -d [DEVICE_NAME]

echo "🚀 Iniciando aplicação..."
# ares-launch com.yustream.tv -d [DEVICE_NAME]

echo "✅ Deploy concluído!"
`;
        
        await fs.writeFile(path.join(this.distDir, 'deploy.sh'), deployScript);
        
        console.log('  ✓ build-info.json e deploy.sh gerados');
    }
}

// Executar build se chamado diretamente
if (require.main === module) {
    const builder = new WebOSBuilder();
    builder.build();
}

module.exports = WebOSBuilder;
