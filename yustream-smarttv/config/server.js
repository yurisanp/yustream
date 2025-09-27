/**
 * Configuração do servidor YuStream para Smart TV
 * Centralize todas as configurações de servidor aqui
 */

const SERVER_CONFIG = {
    // Servidor de produção YuStream
    production: {
        AUTH_SERVER_URL: 'https://yustream.yurisp.com.br/api',
        STREAM_SERVER_URL: 'https://yustream.yurisp.com.br:8443',
        ENVIRONMENT: 'production',
        USE_HTTPS: true
    },
    
    // Servidor de desenvolvimento local
    development: {
        AUTH_SERVER_URL: 'http://localhost/api',
        STREAM_SERVER_URL: 'http://localhost:8080',
        ENVIRONMENT: 'development',
        USE_HTTPS: false
    },
    
    // Configuração personalizada (edite aqui se necessário)
    custom: {
        AUTH_SERVER_URL: 'https://seu-servidor.com:3001/api',
        STREAM_SERVER_URL: 'https://seu-servidor.com:8443',
        ENVIRONMENT: 'production',
        USE_HTTPS: true
    }
};

/**
 * Obter configuração baseada no ambiente
 */
function getServerConfig(environment = 'development') {
    const config = SERVER_CONFIG[environment];
    
    if (!config) {
        console.warn(`Configuração '${environment}' não encontrada, usando 'production'`);
        return SERVER_CONFIG.production;
    }
    
    return config;
}

/**
 * Gerar script de configuração para inserir no HTML
 */
function generateConfigScript(environment = 'development', platform = 'universal') {
    const config = getServerConfig(environment);
    
    return `
    <script>
        // Configuração do servidor YuStream para ${platform}
        window.YUSTREAM_CONFIG = {
            SERVER_URL: '${config.AUTH_SERVER_URL}',
            STREAM_URL: '${config.STREAM_SERVER_URL}',
            ENVIRONMENT: '${config.ENVIRONMENT}',
            PLATFORM: '${platform}',
            USE_HTTPS: ${config.USE_HTTPS}
        };
        
        console.log('[Config] YuStream configurado para:', window.YUSTREAM_CONFIG);
    </script>`;
}

// Export para Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SERVER_CONFIG,
        getServerConfig,
        generateConfigScript
    };
}

// Export para browser
if (typeof window !== 'undefined') {
    window.YuStreamServerConfig = {
        SERVER_CONFIG,
        getServerConfig,
        generateConfigScript
    };
}
