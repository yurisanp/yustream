#!/usr/bin/env node

/**
 * Build script para Tizen OS (Samsung Smart TV)
 * Cria um pacote .wgt pronto para instalação
 */

const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const { generateConfigScript } = require('../config/server');

class TizenBuilder {
    constructor() {
        this.srcDir = path.join(__dirname, '..', 'src');
        this.platformDir = path.join(__dirname, '..', 'platforms', 'tizen');
        this.distDir = path.join(__dirname, '..', 'dist', 'tizen');
        this.packageDir = path.join(this.distDir, 'package');
        
        console.log('📱 YuStream TV - Build Tizen');
        console.log('Origem:', this.srcDir);
        console.log('Plataforma:', this.platformDir);
        console.log('Destino:', this.distDir);
    }

    async build() {
        try {
            console.log('\n📦 Iniciando build para Tizen...');
            
            // Limpar diretório de destino
            await this.clean();
            
            // Copiar arquivos base
            await this.copyBaseFiles();
            
            // Copiar configuração do Tizen
            await this.copyTizenConfig();
            
            // Processar HTML para Tizen
            await this.processHTML();
            
            // Processar CSS para Tizen
            await this.processCSS();
            
            // Processar JavaScript para Tizen
            await this.processJavaScript();
            
            // Copiar assets
            await this.copyAssets();
            
            // Gerar ícones para Tizen
            await this.generateTizenIcons();
            
            // Criar pacote .wgt
            await this.createWgtPackage();
            
            // Gerar informações de build
            await this.generateBuildInfo();
            
            console.log('✅ Build Tizen concluído!');
            console.log(`📁 Pacote em: ${this.distDir}/yustream-tv-tizen.wgt`);
            
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
        
        // Remover manifest.json (Tizen usa config.xml)
        const manifestPath = path.join(this.packageDir, 'manifest.json');
        if (await fs.pathExists(manifestPath)) {
            await fs.remove(manifestPath);
        }
        
        console.log('  ✓ Arquivos base copiados');
    }

    async copyTizenConfig() {
        console.log('⚙️ Copiando configuração Tizen...');
        
        const configPath = path.join(this.platformDir, 'config.xml');
        const destConfigPath = path.join(this.packageDir, 'config.xml');
        
        await fs.copy(configPath, destConfigPath);
        console.log('  ✓ config.xml copiado');
    }

    async processHTML() {
        console.log('🔧 Processando HTML para Tizen...');
        
        const htmlPath = path.join(this.packageDir, 'index.html');
        let html = await fs.readFile(htmlPath, 'utf8');
        
        // Remover referência ao manifest.json
        html = html.replace(/<link rel="manifest"[^>]*>/g, '');
        
        // Adicionar meta tags específicas para Tizen
        html = html.replace(
            '<meta name="theme-color" content="#000000">',
            `<meta name="theme-color" content="#000000">
    <meta name="tizen-version" content="2.3">
    <meta name="application-name" content="YuStream TV">
    <meta name="viewport" content="width=1920, height=1080, user-scalable=no">`
        );
        
        // Adicionar configuração do servidor usando arquivo centralizado
        const serverConfig = generateConfigScript('production', 'tizen');

        // Adicionar script de inicialização Tizen
        const tizenInitScript = `
    <script>
        // Tizen initialization
        window.addEventListener('load', function() {
            if (window.tizen) {
                console.log('Tizen platform detected');
                document.body.classList.add('tizen-platform');
                
                // Register key events
                try {
                    tizen.tvinputdevice.registerKey('MediaPlayPause');
                    tizen.tvinputdevice.registerKey('MediaPlay');
                    tizen.tvinputdevice.registerKey('MediaPause');
                    tizen.tvinputdevice.registerKey('MediaStop');
                    tizen.tvinputdevice.registerKey('ColorF0Red');
                    tizen.tvinputdevice.registerKey('ColorF1Green');
                    tizen.tvinputdevice.registerKey('ColorF2Yellow');
                    tizen.tvinputdevice.registerKey('ColorF3Blue');
                } catch (e) {
                    console.warn('Error registering Tizen keys:', e);
                }
            }
        });
    </script>`;
        
        html = html.replace('</body>', `${serverConfig}${tizenInitScript}\n</body>`);
        
        // Adicionar informações de build
        const buildInfo = `<!-- Build: Tizen Samsung TV - ${new Date().toISOString()} -->`;
        html = html.replace('</head>', `    ${buildInfo}\n</head>`);
        
        await fs.writeFile(htmlPath, html);
        console.log('  ✓ index.html processado para Tizen');
    }

    async processCSS() {
        console.log('🎨 Processando CSS para Tizen...');
        
        const cssPath = path.join(this.packageDir, 'css', 'styles.css');
        let css = await fs.readFile(cssPath, 'utf8');
        
        // Adicionar CSS específico para Tizen
        const tizenCSS = `
/* Tizen Samsung TV Optimizations */
.tizen-platform {
    /* Otimizações específicas para Tizen */
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
}

/* Otimizações para resolução 1920x1080 */
@media (width: 1920px) and (height: 1080px) {
    body {
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
    body {
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

/* Suporte para cores do controle remoto Samsung */
.samsung-color-buttons {
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

/* Otimizações de performance para Tizen */
.tizen-optimized * {
    -webkit-transform: translateZ(0);
    transform: translateZ(0);
}

.video-player {
    /* Usar aceleração de hardware nativa do Tizen */
    -webkit-transform: translateZ(0);
    transform: translateZ(0);
    will-change: transform;
}
`;
        
        css += tizenCSS;
        await fs.writeFile(cssPath, css);
        console.log('  ✓ CSS processado com otimizações Tizen');
    }

    async processJavaScript() {
        console.log('📜 Processando JavaScript para Tizen...');
        
        // Adicionar arquivo específico para Tizen
        const tizenJSContent = `
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
                        console.warn(\`[Tizen] Failed to register key: \${key}\`, e);
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
`;
        
        const tizenJSPath = path.join(this.packageDir, 'js', 'tizen-platform.js');
        await fs.writeFile(tizenJSPath, tizenJSContent);
        
        // Adicionar script ao HTML
        const htmlPath = path.join(this.packageDir, 'index.html');
        let html = await fs.readFile(htmlPath, 'utf8');
        html = html.replace(
            '<script src="js/app.js"></script>',
            '<script src="js/tizen-platform.js"></script>\n    <script src="js/app.js"></script>'
        );
        await fs.writeFile(htmlPath, html);
        
        console.log('  ✓ JavaScript processado para Tizen');
    }

    async copyAssets() {
        console.log('🖼️ Processando assets...');
        
        const assetsDir = path.join(this.packageDir, 'assets');
        await fs.ensureDir(assetsDir);
        
        // Assets já foram copiados com copyBaseFiles
        console.log('  ✓ Assets processados');
    }

    async generateTizenIcons() {
        console.log('🎨 Gerando ícones Tizen...');
        
        // Gerar ícone principal (117x117 para Tizen)
        const iconSVG = `
<svg width="117" height="117" viewBox="0 0 117 117" xmlns="http://www.w3.org/2000/svg">
    <rect width="117" height="117" rx="20" fill="#000000"/>
    <circle cx="58.5" cy="58.5" r="25" fill="#007AFF"/>
    <polygon points="50,45 50,72 72,58.5" fill="#FFFFFF"/>
    <text x="58.5" y="95" text-anchor="middle" fill="#FFFFFF" font-family="Arial" font-size="8" font-weight="bold">YuStream</text>
</svg>`;
        
        await fs.writeFile(path.join(this.packageDir, 'icon.svg'), iconSVG);
        
        console.log('  ✓ Ícones Tizen gerados');
    }

    async createWgtPackage() {
        console.log('📦 Criando pacote .wgt...');
        
        const wgtPath = path.join(this.distDir, 'yustream-tv-tizen.wgt');
        
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(wgtPath);
            const archive = archiver('zip', {
                zlib: { level: 9 } // Máxima compressão
            });

            output.on('close', () => {
                console.log(`  ✓ Pacote criado: ${archive.pointer()} bytes`);
                resolve();
            });

            archive.on('error', (err) => {
                reject(err);
            });

            archive.pipe(output);

            // Adicionar todos os arquivos do package
            archive.directory(this.packageDir, false);

            archive.finalize();
        });
    }

    async generateBuildInfo() {
        console.log('📋 Gerando informações de build...');
        
        const buildInfo = {
            version: '1.0.0',
            build: 'tizen',
            timestamp: new Date().toISOString(),
            platform: 'Samsung Tizen TV',
            targetDevices: [
                'Samsung Smart TV 2015+',
                'Tizen 2.3+',
                'Full HD (1920x1080)',
                '4K UHD (3840x2160)'
            ],
            features: [
                'Native Tizen Integration',
                'Hardware Key Support',
                'Power Management',
                'Audio Control',
                'HLS Native Playback'
            ],
            package: {
                id: 'yustream.tv',
                name: 'YuStream TV',
                file: 'yustream-tv-tizen.wgt'
            }
        };
        
        await fs.writeFile(
            path.join(this.distDir, 'build-info.json'), 
            JSON.stringify(buildInfo, null, 2)
        );
        
        console.log('  ✓ build-info.json gerado');
    }
}

// Executar build se chamado diretamente
if (require.main === module) {
    const builder = new TizenBuilder();
    builder.build();
}

module.exports = TizenBuilder;
