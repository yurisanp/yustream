const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function(env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  config.devServer = config.devServer || {};
  config.devServer.proxy = {
    '/api': {
      target: 'https://yustream.yurisp.com.br', // seu backend local
      secure: false,
      changeOrigin: true,
      pathRewrite: {'^/api' : '/api'},
    },
  };

  return config;
};
