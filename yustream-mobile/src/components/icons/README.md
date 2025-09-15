# YuStream Icons

Este diretório contém os componentes de ícones do app YuStream Mobile, baseados no design system do projeto React.

## Componentes Disponíveis

### Icon
Componente genérico para ícones simples.

```tsx
import { Icon } from '../components/icons';

// Uso básico
<Icon name="play" size={24} color="#2ed573" />

// Ícones disponíveis
<Icon name="play" />
<Icon name="pause" />
<Icon name="stop" />
<Icon name="live" />
<Icon name="offline" />
<Icon name="settings" />
<Icon name="refresh" />
```

### YuStreamLogo
Componente específico para o logo do YuStream com diferentes variantes.

```tsx
import { YuStreamLogo } from '../components/icons';

// Uso básico
<YuStreamLogo size={64} />

// Com texto
<YuStreamLogo size={80} showText={true} />

// Variantes
<YuStreamLogo size={64} variant="default" />
<YuStreamLogo size={64} variant="live" />
<YuStreamLogo size={64} variant="offline" />
```

## Assets SVG

Os ícones SVG foram gerados automaticamente baseados no design do projeto React:

- `icon.svg` - Ícone principal do app (1024x1024)
- `adaptive-icon.svg` - Ícone adaptativo para Android (1024x1024)
- `splash-icon.svg` - Ícone da splash screen (1284x2778)
- `favicon.svg` - Favicon para web (32x32)
- `logo-small.svg` - Logo pequeno (64x64)
- `logo-medium.svg` - Logo médio (128x128)
- `logo-large.svg` - Logo grande (256x256)
- `poster-live.svg` - Poster para stream ao vivo (300x450)
- `poster-offline.svg` - Poster para stream offline (300x450)
- `background.svg` - Background padrão (1920x1080)

## Cores do Design System

### Gradientes Principais
- **Default**: `#667eea` → `#764ba2`
- **Live**: `#2ed573` → `#1e90ff`
- **Offline**: `#ff6b6b` → `#ee5a52`

### Cores de Status
- **Live Indicator**: `#ff4757`
- **Offline Indicator**: `#ffffff` com texto `#ff6b6b`
- **Texto**: `#ffffff` / `#f0f0f0`

## Configuração do App

O `app.json` foi atualizado para usar os novos ícones SVG:

```json
{
  "expo": {
    "icon": "./assets/icon.svg",
    "splash": {
      "image": "./assets/splash-icon.svg"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.svg"
      }
    },
    "web": {
      "favicon": "./assets/favicon.svg"
    }
  }
}
```

## Demonstração

Para ver todos os ícones em ação, use o componente `IconShowcase`:

```tsx
import IconShowcase from '../components/IconShowcase';

// Em qualquer tela
<IconShowcase />
```

## Geração de Ícones

Os ícones SVG são gerados automaticamente pelo script `scripts/generate-icons.js`. Para regenerar:

```bash
node scripts/generate-icons.js
```

## Notas Técnicas

- Todos os ícones são componentes React Native nativos (sem dependências externas)
- Os ícones SVG são otimizados para diferentes tamanhos de tela
- O design mantém consistência visual com o projeto React
- Suporte completo a temas claro/escuro
- Ícones responsivos que se adaptam ao tamanho especificado

