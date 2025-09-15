const fs = require('fs');
const path = require('path');

// Função para criar ícones PNG baseados nos SVGs do projeto React
function generateIcons() {
  console.log('🎨 Gerando ícones para o app mobile...');
  
  // Caminhos dos assets
  const reactAssetsPath = path.join(__dirname, '../../yustream-react/public/stremio-assets');
  const mobileAssetsPath = path.join(__dirname, '../assets');
  
  // Tamanhos necessários para diferentes contextos
  const iconSizes = {
    // App icon sizes
    'icon': [1024, 1024],
    'adaptive-icon': [1024, 1024],
    'splash-icon': [1284, 2778], // iPhone 14 Pro Max resolution
    'favicon': [32, 32],
    
    // Component icon sizes
    'logo-small': [64, 64],
    'logo-medium': [128, 128],
    'logo-large': [256, 256],
    'poster-live': [300, 450],
    'poster-offline': [300, 450],
    'background': [1920, 1080]
  };
  
  // Função para criar um ícone PNG simples baseado no design do logo
  function createSimpleIcon(size, name, isLive = false) {
    const [width, height] = size;
    const canvas = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="textGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#f0f0f0;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background circle -->
  <circle cx="${width/2}" cy="${height/2}" r="${Math.min(width, height)/2 - 10}" fill="url(#logoGradient)" stroke="#ffffff" stroke-width="2"/>
  
  <!-- Play button icon -->
  <polygon points="${width*0.4},${height*0.3} ${width*0.4},${height*0.7} ${width*0.7},${height*0.5}" fill="url(#textGradient)" stroke="#667eea" stroke-width="1"/>
  
  ${isLive ? `
  <!-- Live indicator -->
  <circle cx="${width*0.8}" cy="${height*0.2}" r="${Math.min(width, height)*0.08}" fill="#ff4757"/>
  <text x="${width*0.8}" y="${height*0.22}" font-family="Arial, sans-serif" font-size="${Math.min(width, height)*0.05}" font-weight="bold" text-anchor="middle" fill="#ffffff">LIVE</text>
  ` : ''}
</svg>`;
    
    return canvas;
  }
  
  // Criar diretório de assets se não existir
  if (!fs.existsSync(mobileAssetsPath)) {
    fs.mkdirSync(mobileAssetsPath, { recursive: true });
  }
  
  // Gerar ícones
  Object.entries(iconSizes).forEach(([name, size]) => {
    const isLive = name.includes('live') || name === 'icon' || name === 'adaptive-icon';
    const svgContent = createSimpleIcon(size, name, isLive);
    const filePath = path.join(mobileAssetsPath, `${name}.svg`);
    
    fs.writeFileSync(filePath, svgContent);
    console.log(`✅ Criado: ${name}.svg (${size[0]}x${size[1]})`);
  });
  
  console.log('🎉 Ícones gerados com sucesso!');
  console.log('📝 Nota: Os arquivos SVG foram criados. Para produção, converta para PNG usando ferramentas como:');
  console.log('   - Inkscape: inkscape --export-png=icon.png --export-width=1024 --export-height=1024 icon.svg');
  console.log('   - Online: https://convertio.co/svg-png/');
  console.log('   - Node.js: sharp, svg2png, etc.');
}

// Executar se chamado diretamente
if (require.main === module) {
  generateIcons();
}

module.exports = { generateIcons };

