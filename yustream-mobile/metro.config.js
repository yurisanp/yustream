// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Otimizações para performance
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Configurações do transformer otimizadas
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    // Configurações do minificador para melhor performance
    keep_fnames: false,
    mangle: {
      keep_fnames: false,
    },
    output: {
      comments: false,
    },
  },
};

// Configurações do serializer para otimizar o bundle
config.serializer = {
  ...config.serializer,
  // Otimizar imports e exports
  getModulesRunBeforeMainModule: () => [
    require.resolve('react-native/Libraries/Core/InitializeCore'),
  ],
};

// Configurações do resolver para melhor resolução de módulos
config.resolver = {
  ...config.resolver,
  // Extensões suportadas em ordem de prioridade
  sourceExts: [...config.resolver.sourceExts, 'ts', 'tsx', 'js', 'jsx'],
  // Assets suportados
  assetExts: [...config.resolver.assetExts, 'bin', 'txt', 'jpg', 'png', 'json'],
};

module.exports = config;
