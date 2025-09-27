#!/usr/bin/env node

/**
 * Build script para versão universal (PWA)
 * Cria uma versão otimizada para qualquer Smart TV via browser
 */

const fs = require('fs-extra');
const path = require('path');
const { generateConfigScript } = require('../config/server');

class UniversalBuilder {
    constructor() {
        this.srcDir = path.join(__dirname, '..', 'src');
        this.distDir = path.join(__dirname, '..', 'dist', 'universal');
        
        console.log('🌐 YuStream TV - Build Universal');
        console.log('Origem:', this.srcDir);
        console.log('Destino:', this.distDir);
    }

    async build() {
        try {
            console.log('\n📦 Iniciando build universal...');
            
            // Limpar diretório de destino
            await this.clean();
            
            // Copiar arquivos base
            await this.copyBaseFiles();
            
            // Processar HTML
            await this.processHTML();
            
            // Processar CSS
            await this.processCSS();
            
            // Copiar JavaScript
            await this.copyJavaScript();
            
            
            // Copiar assets
            await this.copyAssets();
            
            // Gerar informações de build
            await this.generateBuildInfo();
            
            console.log('✅ Build universal concluído!');
            console.log(`📁 Arquivos em: ${this.distDir}`);
            
        } catch (error) {
            console.error('❌ Erro no build:', error);
            process.exit(1);
        }
    }

    async clean() {
        console.log('🧹 Limpando diretório...');
        await fs.remove(this.distDir);
        await fs.ensureDir(this.distDir);
    }

    async copyBaseFiles() {
        console.log('📄 Copiando arquivos base...');
        
        const files = [
            'manifest.json'
        ];
        
        for (const file of files) {
            const srcFile = path.join(this.srcDir, file);
            const destFile = path.join(this.distDir, file);
            
            if (await fs.pathExists(srcFile)) {
                await fs.copy(srcFile, destFile);
                console.log(`  ✓ ${file}`);
            }
        }
    }

    async processHTML() {
        console.log('🔧 Processando HTML...');
        
        const htmlPath = path.join(this.srcDir, 'index.html');
        let html = await fs.readFile(htmlPath, 'utf8');
        
        // Adicionar meta tags específicas para PWA
        html = html.replace(
            '<meta name="theme-color" content="#000000">',
            `<meta name="theme-color" content="#000000">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="msapplication-TileColor" content="#000000">
    <meta name="application-name" content="YuStream TV">
    <meta name="msapplication-tooltip" content="YuStream - Streaming para Smart TVs">`
        );
        
        // Adicionar configuração do servidor usando arquivo centralizado
        const serverConfig = generateConfigScript('production', 'universal');
        
        html = html.replace('</head>', `    ${serverConfig}\n    <!-- Build: Universal PWA - ${new Date().toISOString()} -->\n</head>`);
        
        await fs.writeFile(path.join(this.distDir, 'index.html'), html);
        console.log('  ✓ index.html processado com configuração do servidor');
    }

    async processCSS() {
        console.log('🎨 Processando CSS...');
        
        const cssDir = path.join(this.srcDir, 'css');
        const destCssDir = path.join(this.distDir, 'css');
        
        await fs.copy(cssDir, destCssDir);
        
        // Adicionar CSS específico para PWA
        const pwaCSS = `
/* PWA Universal Optimizations */
@media (display-mode: fullscreen) {
    body {
        padding-top: 0;
    }
}

@media (display-mode: standalone) {
    .status-bar {
        padding-top: env(safe-area-inset-top);
    }
}

/* Otimizações para diferentes resoluções de TV */
@media (min-width: 3840px) {
    html {
        font-size: 125%;
    }
}

@media (min-width: 2560px) and (max-width: 3839px) {
    html {
        font-size: 112%;
    }
}

/* Melhorias para TVs com overscan */
.universal-optimized {
    box-sizing: border-box;
}

/* Suporte para diferentes aspect ratios */
@media (aspect-ratio: 16/9) {
    .player-container {
        max-height: 100vh;
    }
}

@media (aspect-ratio: 4/3) {
    .player-container {
        max-height: 75vh;
    }
}
`;
        
        await fs.appendFile(path.join(destCssDir, 'styles.css'), pwaCSS);
        console.log('  ✓ CSS processado com otimizações PWA');
    }

    async copyJavaScript() {
        console.log('📜 Copiando JavaScript...');
        
        const jsDir = path.join(this.srcDir, 'js');
        const destJsDir = path.join(this.distDir, 'js');
        
        await fs.copy(jsDir, destJsDir);
        console.log('  ✓ JavaScript copiado');
    }

    async copyAssets() {
        console.log('🖼️ Copiando assets...');
        
        const assetsDir = path.join(this.srcDir, 'assets');
        const destAssetsDir = path.join(this.distDir, 'assets');
        
        if (await fs.pathExists(assetsDir)) {
            await fs.copy(assetsDir, destAssetsDir);
            console.log('  ✓ Assets copiados');
        } else {
            // Criar assets básicos se não existirem
            await fs.ensureDir(destAssetsDir);
            
            // Gerar ícones básicos (placeholder)
            const iconSVG = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="512" fill="#000000"/>
    <circle cx="256" cy="256" r="100" fill="#007AFF"/>
    <polygon points="230,210 230,302 320,256" fill="#FFFFFF"/>
    <text x="256" y="380" text-anchor="middle" fill="#FFFFFF" font-family="Arial" font-size="36" font-weight="bold">YuStream</text>
</svg>`;
            
            await fs.writeFile(path.join(destAssetsDir, 'icon.svg'), iconSVG);
            console.log('  ✓ Ícones básicos gerados');
        }
    }

    async generateBuildInfo() {
        console.log('📋 Gerando informações de build...');
        
        const buildInfo = {
            version: '1.0.0',
            build: 'universal',
            timestamp: new Date().toISOString(),
            platform: 'PWA Universal',
            features: [
                'Smart TV Navigation',
                'HLS/LLHLS Streaming',
                'Authentication',
                'Responsive Design',
                'Service Worker',
                'Offline Support'
            ],
            compatibility: [
                'Tizen (via browser)',
                'WebOS (via browser)',
                'Android TV (via browser)',
                'Generic Smart TVs',
                'Desktop browsers'
            ]
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
    const builder = new UniversalBuilder();
    builder.build();
}

module.exports = UniversalBuilder;
