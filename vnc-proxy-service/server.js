import express from 'express'
import { WebSocketServer } from 'ws'
import http from 'http'
import jwt from 'jsonwebtoken'
import cors from 'cors'
import helmet from 'helmet'
import multer from 'multer'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import winston from 'winston'
import net from 'net'
import { createServer } from 'http'

// Para ES modules, precisamos definir __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuração
const config = {
  port: process.env.VNC_PROXY_PORT || 3001,
  jwtSecret: process.env.JWT_SECRET || 'yustream-jwt-secret-key',
  uploadsDir: path.join(__dirname, 'uploads'),
  authServerUrl: process.env.AUTH_SERVER_URL || 'http://localhost:3000'
}

// Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'vnc-proxy.log' })
  ]
})

// Express app
const app = express()
const server = http.createServer(app)
const wss = new WebSocketServer({ server })

// Configuração simplificada (VNC agora é gerenciado pelo NGINX)
const VNC_CONFIG = {
  host: 'host.docker.internal',
  port: 5901,
  name: 'Servidor de Streaming',
  nginxProxyUrl: 'https://vnc.yustream.yurisp.com.br'
}

// Armazenamento para logs e sessões auxiliares
const connectionLogs = []  // Array de logs simplificado
const fileSessions = new Map() // Para upload/download de arquivos

// Middleware
app.use(helmet({
  contentSecurityPolicy: false
}))
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Configuração do multer para upload
const upload = multer({
  dest: path.join(config.uploadsDir, 'temp'),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
})

// Criar diretórios necessários se não existirem
const initDirectories = async () => {
  try {
    await fs.mkdir(config.uploadsDir, { recursive: true })
    await fs.mkdir(path.join(config.uploadsDir, 'temp'), { recursive: true })
    await fs.mkdir(path.join(config.uploadsDir, 'vnc-files'), { recursive: true })
    logger.info('Diretórios criados com sucesso')
  } catch (error) {
    logger.error('Erro ao criar diretórios:', error)
  }
}

initDirectories()

// Middleware de autenticação
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) {
      return res.status(401).json({ error: 'Token de acesso requerido' })
    }

    // Verificar token localmente
    const decoded = jwt.verify(token, config.jwtSecret)
    
    // Verificar com servidor de autenticação
    const response = await fetch(`${config.authServerUrl}/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (!response.ok) {
      throw new Error('Token inválido no servidor de autenticação')
    }

    const userData = await response.json()
    req.user = {
      id: userData.user.id,
      username: userData.user.username,
      role: userData.user.role
    }
    
    logger.debug(`Usuário autenticado: ${req.user.username} (${req.user.role})`)
    next()
  } catch (error) {
    logger.error('Erro na autenticação:', error)
    return res.status(401).json({ error: 'Falha na autenticação' })
  }
}

// Função para adicionar log simplificado
const addLog = (message) => {
  const timestamp = new Date().toISOString()
  const logEntry = `[${timestamp}] ${message}`
  
  connectionLogs.push(logEntry)
  
  // Manter apenas os últimos 1000 logs
  if (connectionLogs.length > 1000) {
    connectionLogs.splice(0, connectionLogs.length - 1000)
  }
  
  logger.info(message)
}

// Função para gerar sessão de arquivo (para upload/download)
const generateFileSession = (userId, filename) => {
  const sessionId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  fileSessions.set(sessionId, {
    userId,
    filename,
    createdAt: Date.now(),
    expiresAt: Date.now() + (30 * 60 * 1000) // 30 minutos
  })
  
  return sessionId
}

// Rotas da API

// Endpoint de status VNC com teste real
app.get('/api/vnc/status', async (req, res) => {
  try {
    addLog('Verificando status do servidor VNC...')
    
    // Testar conectividade TCP com o servidor VNC
    const isVNCAvailable = await new Promise((resolve) => {
      const socket = new net.Socket()
      socket.setTimeout(5000)
      
      socket.connect(VNC_CONFIG.port, VNC_CONFIG.host, () => {
        socket.destroy()
        resolve(true)
      })
      
      socket.on('error', (error) => {
        addLog(`Erro na conexão VNC: ${error.code} - ${error.message}`)
        socket.destroy()
        resolve(false)
      })
      
      socket.on('timeout', () => {
        addLog('Timeout na conexão VNC')
        socket.destroy()
        resolve(false)
      })
    })
    
    const status = {
      available: isVNCAvailable,
      host: VNC_CONFIG.host,
      port: VNC_CONFIG.port,
      name: VNC_CONFIG.name,
      lastChecked: new Date().toISOString(),
      testMethod: 'tcp-direct',
      reliability: 'high',
      wsUrl: '/vnc-ws' // WebSocket relativo
    }
    
    addLog(`Status VNC: ${isVNCAvailable ? 'Disponível' : 'Indisponível'} em ${VNC_CONFIG.host}:${VNC_CONFIG.port}`)
    
    // Headers CORS
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Origin, Authorization, Content-Type')
    
    res.json(status)
  } catch (error) {
    logger.error('Erro ao verificar status VNC:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Endpoint simplificado de informações VNC
app.get('/api/admin/vnc/info', authenticateToken, async (req, res) => {
  try {
    addLog(`Informações VNC solicitadas por ${req.user.username}`)
    
    res.json({
      message: 'VNC gerenciado via NGINX + websockify',
      websocketUrl: '/vnc-ws',
      statusUrl: '/api/vnc/status',
      server: {
        name: VNC_CONFIG.name,
        host: VNC_CONFIG.host,
        port: VNC_CONFIG.port,
        proxy: 'nginx-websockify'
      },
      instructions: 'Use os endpoints NGINX para conectar diretamente'
    })
  } catch (error) {
    logger.error('Erro ao processar informações VNC:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Upload de arquivo
app.post('/api/admin/vnc/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const file = req.file
    
    if (!file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' })
    }
    
    // Mover arquivo para diretório VNC
    const uploadDir = path.join(config.uploadsDir, 'vnc-files')
    await fs.mkdir(uploadDir, { recursive: true })
    
    const finalPath = path.join(uploadDir, file.originalname)
    await fs.rename(file.path, finalPath)
    
    addLog(`Arquivo enviado: ${file.originalname} (${file.size} bytes)`)
    
    res.json({
      success: true,
      filename: file.originalname,
      size: file.size
    })
  } catch (error) {
    logger.error('Erro no upload de arquivo:', error)
    res.status(500).json({ error: 'Erro no upload do arquivo' })
  }
})

// Download de arquivo
app.get('/api/admin/vnc/download/:filename', authenticateToken, async (req, res) => {
  try {
    const { filename } = req.params
    
    const filePath = path.join(config.uploadsDir, 'vnc-files', filename)
    
    try {
      await fs.access(filePath)
    } catch {
      return res.status(404).json({ error: 'Arquivo não encontrado' })
    }
    
    addLog(`Arquivo baixado: ${filename}`)
    
    res.download(filePath, filename)
  } catch (error) {
    logger.error('Erro no download de arquivo:', error)
    res.status(500).json({ error: 'Erro no download do arquivo' })
  }
})

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'vnc-auxiliary-service',
    fileSessions: fileSessions.size,
    vncProxy: 'nginx'
  })
})

// Logs (para debug)
app.get('/api/admin/vnc/logs', authenticateToken, (req, res) => {
  res.json({
    logs: connectionLogs.slice(-100) // Últimos 100 logs
  })
})

// Iniciar servidor
server.listen(config.port, () => {
  logger.info(`Servidor VNC Auxiliar iniciado na porta ${config.port}`)
  logger.info(`VNC Proxy via NGINX: ${VNC_CONFIG.nginxProxyUrl}`)
  logger.info(`Servidor VNC: ${VNC_CONFIG.host}:${VNC_CONFIG.port}`)
  
  addLog('Servidor VNC Auxiliar iniciado - VNC gerenciado pelo NGINX')
})

// Limpeza de sessões de arquivo expiradas
setInterval(() => {
  const now = Date.now()
  const expiredSessions = []
  
  fileSessions.forEach((session, sessionId) => {
    if (now > session.expiresAt) {
      expiredSessions.push(sessionId)
    }
  })
  
  expiredSessions.forEach(sessionId => {
    fileSessions.delete(sessionId)
    addLog('Sessão de arquivo expirada removida')
  })
}, 5 * 60 * 1000) // Verificar a cada 5 minutos

export default app
