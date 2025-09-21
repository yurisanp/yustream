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

// Configuração do servidor VNC fixo
const VNC_CONFIG = {
  host: '127.0.0.1', // Servidor VNC local via túnel
  port: 5901,
  name: 'Servidor de Streaming',
  wsPort: 6080 // Porta WebSocket fixa
}

// Armazenamento em memória para sessões
const sessions = new Map() // Session Token -> Session Info
const connectionLogs = []  // Array de logs simplificado
let vncWebSocketServer = null // Servidor WebSocket único

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

// Função para testar se VNC está disponível
const testVNCConnection = () => {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    
    socket.setTimeout(5000) // 5 segundos timeout
    
    socket.connect(VNC_CONFIG.port, VNC_CONFIG.host, () => {
      socket.destroy()
      resolve(true)
    })
    
    socket.on('error', () => {
      socket.destroy()
      resolve(false)
    })
    
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
  })
}

// Função para criar servidor WebSocket único para VNC
const createVNCWebSocketServer = () => {
  return new Promise((resolve, reject) => {
    try {
      const httpServer = createServer()
      const wsServer = new WebSocketServer({ server: httpServer })
      
      wsServer.on('connection', async (ws) => {
        addLog('Nova conexão WebSocket VNC')
        
        try {
          // Conectar ao servidor VNC local (via túnel)
          const vncSocket = new net.Socket()
          
          vncSocket.connect(VNC_CONFIG.port, VNC_CONFIG.host, () => {
            addLog(`Conectado ao servidor VNC ${VNC_CONFIG.host}:${VNC_CONFIG.port}`)
          })
          
          // Relay dados do WebSocket para VNC
          ws.on('message', (data) => {
            try {
              // Se for JSON (comandos de controle), processar
              const jsonData = JSON.parse(data.toString())
              logger.debug('Comando VNC recebido:', jsonData.type)
              
              // Converter comandos para protocolo VNC binário
              if (jsonData.type === 'pointer') {
                const pointerMsg = Buffer.alloc(6)
                pointerMsg[0] = 5 // PointerEvent
                pointerMsg[1] = jsonData.buttonMask
                pointerMsg.writeUInt16BE(jsonData.x, 2)
                pointerMsg.writeUInt16BE(jsonData.y, 4)
                vncSocket.write(pointerMsg)
              } else if (jsonData.type === 'key') {
                const keyMsg = Buffer.alloc(8)
                keyMsg[0] = 4 // KeyEvent
                keyMsg[1] = jsonData.down ? 1 : 0
                keyMsg.writeUInt32BE(jsonData.keysym, 4)
                vncSocket.write(keyMsg)
              }
            } catch {
              // Se não for JSON, enviar dados binários diretamente
              vncSocket.write(data)
            }
          })
          
          // Relay dados do VNC para WebSocket
          vncSocket.on('data', (data) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(data)
            }
          })
          
          vncSocket.on('error', (error) => {
            addLog(`Erro na conexão VNC: ${error.message}`)
            ws.close()
          })
          
          vncSocket.on('close', () => {
            addLog('Conexão VNC fechada')
            ws.close()
          })
          
          ws.on('close', () => {
            addLog('WebSocket VNC fechado')
            vncSocket.destroy()
          })
          
          ws.on('error', (error) => {
            addLog(`Erro no WebSocket VNC: ${error.message}`)
            vncSocket.destroy()
          })
          
        } catch (error) {
          addLog(`Erro ao estabelecer conexão VNC: ${error.message}`)
          ws.close()
        }
      })
      
      httpServer.listen(VNC_CONFIG.wsPort, '0.0.0.0', () => {
        addLog(`Servidor WebSocket VNC iniciado na porta ${VNC_CONFIG.wsPort}`)
        vncWebSocketServer = { httpServer, wsServer }
        resolve({ httpServer, wsServer })
      })
      
      httpServer.on('error', (error) => {
        logger.error(`Erro ao iniciar servidor WebSocket na porta ${VNC_CONFIG.wsPort}:`, error.message)
        reject(error)
      })
      
    } catch (error) {
      reject(error)
    }
  })
}

// Rotas da API

// Verificar status do VNC
app.get('/api/admin/vnc/status', authenticateToken, async (req, res) => {
  try {
    addLog('Verificando status do servidor VNC...')
    
    const isVNCAvailable = await testVNCConnection()
    
    const status = {
      available: isVNCAvailable,
      host: VNC_CONFIG.host,
      port: VNC_CONFIG.port,
      name: VNC_CONFIG.name,
      wsPort: VNC_CONFIG.wsPort,
      lastChecked: new Date().toISOString(),
      activeSessions: sessions.size
    }
    
    addLog(`Status VNC: ${isVNCAvailable ? 'Disponível' : 'Indisponível'} em ${VNC_CONFIG.host}:${VNC_CONFIG.port}`)
    
    res.json(status)
  } catch (error) {
    logger.error('Erro ao verificar status VNC:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Criar sessão VNC
app.post('/api/admin/vnc/connect', authenticateToken, async (req, res) => {
  try {
    // Verificar se usuário está definido
    if (!req.user || !req.user.id) {
      logger.error('Usuário não definido no middleware de autenticação')
      return res.status(401).json({ error: 'Usuário não autenticado corretamente' })
    }
    
    // Verificar se VNC está disponível
    const isVNCAvailable = await testVNCConnection()
    if (!isVNCAvailable) {
      addLog('Tentativa de conexão VNC falhada - servidor VNC não disponível')
      return res.status(503).json({ error: 'Servidor VNC não está disponível na porta ' + VNC_CONFIG.port })
    }
    
    // Gerar token de sessão
    const sessionToken = jwt.sign(
      { 
        userId: req.user.id,
        username: req.user.username || 'admin',
        timestamp: Date.now()
      },
      config.jwtSecret,
      { expiresIn: '1h' }
    )
    
    // Verificar se servidor WebSocket VNC já está rodando
    if (!vncWebSocketServer) {
      try {
        // Criar servidor WebSocket único para VNC
        await createVNCWebSocketServer()
        addLog(`Servidor WebSocket VNC iniciado na porta ${VNC_CONFIG.wsPort}`)
      } catch (error) {
        logger.error(`Erro ao criar servidor WebSocket VNC:`, error.message)
        return res.status(500).json({ error: 'Falha ao inicializar servidor VNC' })
      }
    }
    
    // URL do WebSocket
    const wsUrl = `ws://localhost:${VNC_CONFIG.wsPort}`
    
    // Armazenar sessão
    sessions.set(sessionToken, {
      userId: req.user.id,
      username: req.user.username || 'admin',
      wsPort: VNC_CONFIG.wsPort,
      createdAt: Date.now(),
      lastActivity: Date.now()
    })
    
    addLog(`Sessão VNC criada para usuário ${req.user.username || 'admin'}`)
    
    res.json({
      sessionToken,
      wsUrl,
      server: {
        name: VNC_CONFIG.name,
        host: VNC_CONFIG.host,
        port: VNC_CONFIG.port,
        available: true
      }
    })
  } catch (error) {
    logger.error('Erro ao criar sessão VNC:', error)
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
    activeSessions: sessions.size
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
  logger.info(`Servidor VNC Proxy iniciado na porta ${config.port}`)
  logger.info(`Configuração VNC: ${VNC_CONFIG.host}:${VNC_CONFIG.port}`)
  logger.info(`WebSocket VNC será criado na porta: ${VNC_CONFIG.wsPort}`)
  
  addLog('Servidor VNC Proxy iniciado e pronto para conexões')
})

// Limpeza de sessões expiradas
setInterval(() => {
  const now = Date.now()
  const expiredSessions = []
  
  sessions.forEach((session, token) => {
    // Sessões expiram após 1 hora de inatividade
    if (now - session.lastActivity > 60 * 60 * 1000) {
      expiredSessions.push(token)
    }
  })
  
  expiredSessions.forEach(token => {
    sessions.delete(token)
    addLog('Sessão VNC expirada removida')
  })
}, 5 * 60 * 1000) // Verificar a cada 5 minutos

export default app
