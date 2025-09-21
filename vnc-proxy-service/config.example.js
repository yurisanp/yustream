// Configurações do Serviço VNC Proxy YuStream
// Copie este arquivo para config.js e ajuste as configurações

export const config = {
  // Porta do serviço
  port: process.env.VNC_PROXY_PORT || 3003,
  
  // Chave secreta JWT (MUDE EM PRODUÇÃO!)
  jwtSecret: process.env.JWT_SECRET || 'yustream-jwt-secret-change-in-production-2024',
  
  // URL do servidor de autenticação
  authServerUrl: process.env.AUTH_SERVER_URL || 'http://yustream-auth:3001',
  
  // Token para registro de clientes remotos (MUDE EM PRODUÇÃO!)
  registerToken: process.env.VNC_REGISTER_TOKEN || 'yustream-vnc-register-token-change-in-production',
  
  // Configurações de arquivo
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024, // 100MB
  uploadsDir: process.env.UPLOADS_DIR || './uploads',
  
  // Configurações de sessão
  sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 30 * 60 * 1000, // 30 minutos
  cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL) || 5 * 60 * 1000, // 5 minutos
  
  // Configurações de log
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Configurações de WebSocket VNC
  vncPortRange: {
    start: 6080,
    end: 6180
  },
  
  // Configurações de SSH
  ssh: {
    timeout: 30000,
    keepaliveInterval: 5000,
    keepaliveCountMax: 3
  },
  
  // Configurações de segurança
  security: {
    maxConnectionsPerUser: 3,
    maxSessionsPerConnection: 1,
    tokenExpirationTime: '1h',
    rateLimitWindow: 15 * 60 * 1000, // 15 minutos
    rateLimitMax: 100 // requests por janela
  }
}
