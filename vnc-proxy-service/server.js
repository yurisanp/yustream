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
import cron from 'node-cron'
import winston from 'winston'
import { Client } from 'ssh2'
import net from 'net'
import { spawn } from 'child_process'
import { createServer } from 'http'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuração de logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'vnc-proxy' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
})

// Configurações
const config = {
  port: process.env.VNC_PROXY_PORT || 3003,
  jwtSecret: process.env.JWT_SECRET || 'yustream-vnc-secret-key-change-in-production',
  authServerUrl: process.env.AUTH_SERVER_URL || 'http://localhost:3001',
  uploadsDir: path.join(__dirname, 'uploads'),
  maxFileSize: 100 * 1024 * 1024, // 100MB
  sessionTimeout: 30 * 60 * 1000, // 30 minutos
  cleanupInterval: 5 * 60 * 1000 // 5 minutos
}

const app = express()
const server = http.createServer(app)
const wss = new WebSocketServer({ server })

// Armazenamento em memória para conexões e sessões
const connections = new Map() // ID -> Connection Info
const sessions = new Map() // Session Token -> Session Info
const activeTunnels = new Map() // Connection ID -> Tunnel Info
const connectionLogs = new Map() // Connection ID -> Array of logs
const activeWebSocketServers = new Map() // Port -> WebSocket Server

// Middleware
app.use(helmet({
  contentSecurityPolicy: false
}))
app.use(cors({
  origin: true,
  credentials: true
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Configurar multer para uploads
const upload = multer({
  dest: config.uploadsDir,
  limits: {
    fileSize: config.maxFileSize
  }
})

// Middleware de autenticação
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso requerido' })
  }

  try {
    // Verificar token com o servidor de autenticação
    const response = await fetch(`${config.authServerUrl}/auth/verify`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      return res.status(401).json({ error: 'Token inválido' })
    }

    const userData = await response.json()
    
    logger.info('Dados do usuário recebidos:', JSON.stringify(userData))
    
    // Verificar estrutura dos dados
    if (!userData || !userData.user) {
      logger.error('Estrutura de dados inválida:', userData)
      return res.status(401).json({ error: 'Dados de usuário inválidos' })
    }
    
    // Verificar se é admin
    if (userData.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado - apenas administradores' })
    }

    req.user = userData.user
    logger.info('Usuário autenticado:', { id: req.user.id, username: req.user.username, role: req.user.role })
    next()
  } catch (error) {
    logger.error('Erro na autenticação:', error)
    return res.status(401).json({ error: 'Falha na autenticação' })
  }
}

// Função para adicionar log de conexão
const addConnectionLog = (connectionId, message) => {
  if (!connectionLogs.has(connectionId)) {
    connectionLogs.set(connectionId, [])
  }
  
  const logs = connectionLogs.get(connectionId)
  const timestamp = new Date().toISOString()
  logs.push(`[${timestamp}] ${message}`)
  
  // Manter apenas os últimos 1000 logs
  if (logs.length > 1000) {
    logs.splice(0, logs.length - 1000)
  }
  
  logger.info(`[${connectionId}] ${message}`)
}

  // Função para criar túnel SSH reverso
const createSSHTunnel = async (connectionInfo) => {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    
    conn.on('ready', () => {
      addConnectionLog(connectionInfo.id, `Túnel SSH estabelecido para ${connectionInfo.host}`)
      
      // Criar forward local (servidor conecta ao cliente via SSH)
      conn.forwardOut('127.0.0.1', 0, '127.0.0.1', connectionInfo.vncPort || 5900, (err, stream) => {
        if (err) {
          reject(err)
          return
        }
        
        const tunnelInfo = {
          connection: conn,
          stream: stream,
          remoteHost: connectionInfo.host,
          remotePort: connectionInfo.vncPort || 5900
        }
        
        activeTunnels.set(connectionInfo.id, tunnelInfo)
        resolve(tunnelInfo)
      })
    })
    
    conn.on('error', (err) => {
      addConnectionLog(connectionInfo.id, `Erro no túnel SSH: ${err.message}`)
      reject(err)
    })
    
    conn.connect({
      host: connectionInfo.host,
      port: connectionInfo.sshPort || 22,
      username: connectionInfo.sshUsername,
      password: connectionInfo.sshPassword,
      privateKey: connectionInfo.sshPrivateKey
    })
  })
}

// Função para criar proxy WebSocket para VNC
const createVNCWebSocketProxy = (wsPort, connectionInfo) => {
  return new Promise((resolve, reject) => {
    try {
      const httpServer = createServer()
      const wsServer = new WebSocketServer({ server: httpServer })
      
      wsServer.on('connection', async (ws) => {
        logger.info(`Nova conexão WebSocket VNC na porta ${wsPort}`)
        let vncSocket = null
        let sshTunnel = null
        
        try {
          // Se SSH está habilitado, usar túnel SSH
          if (connectionInfo.sshEnabled && connectionInfo.sshUsername) {
            logger.info(`Criando túnel SSH para ${connectionInfo.host}`)
            sshTunnel = await createSSHTunnel(connectionInfo)
            vncSocket = sshTunnel.stream
            
            logger.info(`Conectado via túnel SSH ao VNC ${connectionInfo.host}:${connectionInfo.vncPort || 5900}`)
          } else {
            // Conexão direta (apenas para testes locais)
            vncSocket = new net.Socket()
            
            vncSocket.connect(connectionInfo.vncPort || 5900, connectionInfo.host, () => {
              logger.info(`Conectado diretamente ao servidor VNC ${connectionInfo.host}:${connectionInfo.vncPort || 5900}`)
            })
          }
          
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
            logger.error(`Erro na conexão VNC ${connectionInfo.host}:${connectionInfo.vncPort || 5900}:`, error.message)
            ws.close()
          })
          
          vncSocket.on('close', () => {
            logger.info(`Conexão VNC ${connectionInfo.host}:${connectionInfo.vncPort || 5900} fechada`)
            ws.close()
          })
          
        } catch (error) {
          logger.error('Erro ao estabelecer conexão VNC:', error.message)
          ws.close()
        }
        
        ws.on('close', () => {
          logger.info('WebSocket VNC fechado')
          if (vncSocket && vncSocket.destroy) {
            vncSocket.destroy()
          }
          if (sshTunnel && sshTunnel.connection) {
            sshTunnel.connection.end()
          }
        })
        
        ws.on('error', (error) => {
          logger.error('Erro no WebSocket VNC:', error.message)
          if (vncSocket && vncSocket.destroy) {
            vncSocket.destroy()
          }
        })
      })
      
      httpServer.listen(wsPort, '0.0.0.0', () => {
        logger.info(`Servidor WebSocket VNC iniciado na porta ${wsPort}`)
        activeWebSocketServers.set(wsPort, { httpServer, wsServer })
        resolve({ httpServer, wsServer })
      })
      
      httpServer.on('error', (error) => {
        logger.error(`Erro ao iniciar servidor WebSocket na porta ${wsPort}:`, error.message)
        reject(error)
      })
      
    } catch (error) {
      reject(error)
    }
  })
}

// Rotas da API

// Listar conexões disponíveis
app.get('/api/admin/vnc/connections', authenticateToken, async (req, res) => {
  try {
    const connectionsArray = Array.from(connections.values()).map(conn => ({
      id: conn.id,
      name: conn.name,
      host: conn.host,
      port: conn.port,
      status: conn.status,
      lastSeen: conn.lastSeen,
      monitors: conn.monitors || 1
    }))
    
    res.json({ connections: connectionsArray })
  } catch (error) {
    logger.error('Erro ao listar conexões:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Criar sessão VNC
app.post('/api/admin/vnc/session', authenticateToken, async (req, res) => {
  try {
    const { connectionId, monitor = 0 } = req.body
    
    // Verificar se usuário está definido
    if (!req.user || !req.user.id) {
      logger.error('Usuário não definido no middleware de autenticação')
      return res.status(401).json({ error: 'Usuário não autenticado corretamente' })
    }
    
    const connection = connections.get(connectionId)
    if (!connection) {
      return res.status(404).json({ error: 'Conexão não encontrada' })
    }
    
    // Gerar token de sessão
    const sessionToken = jwt.sign(
      { 
        connectionId, 
        userId: req.user.id,
        username: req.user.username || 'admin',
        monitor,
        timestamp: Date.now()
      },
      config.jwtSecret,
      { expiresIn: '1h' }
    )
    
    // Determinar porta WebSocket baseada no monitor
    let wsPort = 6080 + monitor
    
    // Tentar usar hash do connectionId se possível
    try {
      const idHash = connectionId.slice(-2)
      const hashValue = parseInt(idHash, 16)
      if (!isNaN(hashValue)) {
        wsPort = 6080 + (hashValue % 100) + monitor
      }
    } catch (error) {
      logger.warn('Erro ao calcular porta do WebSocket, usando porta padrão:', error.message)
    }
    
    logger.info(`Porta WebSocket calculada: ${wsPort} para conexão ${connectionId} monitor ${monitor}`)
    
    // Verificar se já existe um servidor WebSocket nesta porta
    if (!activeWebSocketServers.has(wsPort)) {
      try {
        // Criar proxy WebSocket para VNC
        await createVNCWebSocketProxy(wsPort, connection)
        logger.info(`Proxy WebSocket VNC criado na porta ${wsPort}`)
      } catch (error) {
        logger.error(`Erro ao criar proxy WebSocket na porta ${wsPort}:`, error.message)
        return res.status(500).json({ error: 'Falha ao criar proxy VNC' })
      }
    }
    
    // URL do WebSocket
    const wsUrl = `ws://localhost:${wsPort}`
    
    // Armazenar sessão
    sessions.set(sessionToken, {
      connectionId,
      userId: req.user.id,
      username: req.user.username || 'admin',
      monitor,
      wsPort,
      vncHost: connection.host,
      vncPort: connection.vncPort || 5900,
      createdAt: Date.now(),
      lastActivity: Date.now()
    })
    
    addConnectionLog(connectionId, `Sessão VNC criada para usuário ${req.user.username || 'admin'} (monitor ${monitor + 1})`)
    addConnectionLog(connectionId, `Proxy WebSocket ativo na porta ${wsPort} -> ${connection.host}:${connection.vncPort || 5900}`)
    
    res.json({
      sessionToken,
      wsUrl,
      connection: {
        id: connection.id,
        name: connection.name,
        monitors: connection.monitors || 1
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
    const { connectionId } = req.body
    const file = req.file
    
    if (!file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' })
    }
    
    const connection = connections.get(connectionId)
    if (!connection) {
      return res.status(404).json({ error: 'Conexão não encontrada' })
    }
    
    // Mover arquivo para diretório específico da conexão
    const connectionDir = path.join(config.uploadsDir, connectionId)
    await fs.mkdir(connectionDir, { recursive: true })
    
    const finalPath = path.join(connectionDir, file.originalname)
    await fs.rename(file.path, finalPath)
    
    addConnectionLog(connectionId, `Arquivo enviado: ${file.originalname} (${file.size} bytes)`)
    
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
app.get('/api/admin/vnc/download/:connectionId/:filename', authenticateToken, async (req, res) => {
  try {
    const { connectionId, filename } = req.params
    
    const connection = connections.get(connectionId)
    if (!connection) {
      return res.status(404).json({ error: 'Conexão não encontrada' })
    }
    
    const filePath = path.join(config.uploadsDir, connectionId, filename)
    
    try {
      await fs.access(filePath)
    } catch {
      return res.status(404).json({ error: 'Arquivo não encontrado' })
    }
    
    addConnectionLog(connectionId, `Arquivo baixado: ${filename}`)
    
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
    connections: connections.size,
    activeSessions: sessions.size
  })
})

// Registrar nova conexão (endpoint para clientes remotos)
app.post('/api/vnc/register', async (req, res) => {
  try {
    const { 
      name, 
      host, 
      vncPort = 5900, 
      monitors = 1,
      sshEnabled = false,
      sshUsername,
      sshPassword,
      sshPrivateKey,
      sshPort = 22,
      reverseTunnelEnabled = false,
      tunnelType,
      localVNCPort,
      tunnelPort,
      authToken 
    } = req.body
    
    // // Validar token de registro (pode ser configurado via variável de ambiente)
    // const expectedToken = process.env.VNC_REGISTER_TOKEN || 'yustream-vnc-register-token'
    // if (authToken !== expectedToken) {
    //   return res.status(401).json({ error: 'Token de registro inválido' })
    // }
    
    const connectionId = `vnc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const connectionInfo = {
      id: connectionId,
      name,
      host,
      vncPort,
      monitors,
      sshEnabled,
      sshUsername,
      sshPassword,
      sshPrivateKey,
      sshPort,
      reverseTunnelEnabled,
      tunnelType,
      localVNCPort,
      tunnelPort,
      status: 'connected',
      lastSeen: new Date().toISOString(),
      registeredAt: new Date().toISOString()
    }
    
    connections.set(connectionId, connectionInfo)
    
    addConnectionLog(connectionId, `Conexão registrada: ${name} (${host}:${vncPort})`)
    
    if (reverseTunnelEnabled) {
      addConnectionLog(connectionId, `Túnel SSH reverso habilitado: ${tunnelType}`)
    }
    
    res.json({
      success: true,
      connectionId,
      message: 'Conexão registrada com sucesso',
      tunnelInfo: reverseTunnelEnabled ? {
        type: tunnelType,
        localPort: localVNCPort,
        remotePort: tunnelPort
      } : null
    })
  } catch (error) {
    logger.error('Erro ao registrar conexão:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Atualizar status da conexão
app.put('/api/vnc/heartbeat/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params
    const { status = 'connected' } = req.body
    
    const connection = connections.get(connectionId)
    if (!connection) {
      return res.status(404).json({ error: 'Conexão não encontrada' })
    }
    
    connection.status = status
    connection.lastSeen = new Date().toISOString()
    
    res.json({ success: true })
  } catch (error) {
    logger.error('Erro ao atualizar heartbeat:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// WebSocket para proxy VNC
wss.on('connection', (ws, req) => {
  logger.info('Nova conexão WebSocket VNC')
  let vncSocket = null
  let sessionInfo = null
  
  ws.on('message', async (message) => {
    try {
      // Tentar parse como JSON para comandos de controle
      let data
      try {
        data = JSON.parse(message.toString())
      } catch {
        // Se não for JSON, pode ser dados binários VNC
        if (vncSocket && vncSocket.readyState === WebSocket.OPEN) {
          vncSocket.send(message)
        }
        return
      }
      
      if (data.type === 'auth') {
        // Autenticar sessão
        const session = sessions.get(data.token)
        if (!session) {
          ws.send(JSON.stringify({ type: 'error', message: 'Sessão inválida' }))
          ws.close()
          return
        }
        
        sessionInfo = session
        session.lastActivity = Date.now()
        
        const connection = connections.get(session.connectionId)
        if (!connection) {
          ws.send(JSON.stringify({ type: 'error', message: 'Conexão não encontrada' }))
          ws.close()
          return
        }
        
        ws.send(JSON.stringify({ 
          type: 'authenticated', 
          connection: {
            id: connection.id,
            name: connection.name
          }
        }))
        
        addConnectionLog(session.connectionId, `WebSocket autenticado para usuário ${session.username}`)
        
      } else if (data.type === 'pointer' && sessionInfo) {
        // Reenviar evento de mouse para servidor VNC real
        addConnectionLog(sessionInfo.connectionId, `Mouse: (${data.x}, ${data.y}) botões: ${data.buttonMask}`)
        
      } else if (data.type === 'key' && sessionInfo) {
        // Reenviar evento de teclado para servidor VNC real
        addConnectionLog(sessionInfo.connectionId, `Teclado: keysym ${data.keysym} ${data.down ? 'down' : 'up'}`)
        
      } else if (data.type === 'connect_vnc' && sessionInfo) {
        // Conectar ao servidor VNC real
        const connection = connections.get(sessionInfo.connectionId)
        if (connection) {
          try {
            // Em implementação real, conectaria ao servidor VNC
            // Por enquanto, simular conexão bem-sucedida
            ws.send(JSON.stringify({ 
              type: 'vnc_connected',
              resolution: { width: 1024, height: 768 }
            }))
            
            addConnectionLog(sessionInfo.connectionId, `Conectado ao servidor VNC ${connection.host}:${connection.vncPort || 5900}`)
          } catch (error) {
            ws.send(JSON.stringify({ type: 'error', message: 'Falha ao conectar servidor VNC' }))
          }
        }
      }
    } catch (error) {
      logger.error('Erro no WebSocket:', error)
      ws.send(JSON.stringify({ type: 'error', message: 'Erro interno' }))
    }
  })
  
  ws.on('close', () => {
    logger.info('Conexão WebSocket VNC fechada')
    if (vncSocket) {
      vncSocket.close()
    }
  })
  
  ws.on('error', (error) => {
    logger.error('Erro no WebSocket VNC:', error)
  })
})

// Limpeza automática de sessões expiradas
const cleanupExpiredSessions = () => {
  const now = Date.now()
  
  for (const [token, session] of sessions.entries()) {
    if (now - session.lastActivity > config.sessionTimeout) {
      sessions.delete(token)
      addConnectionLog(session.connectionId, `Sessão expirada para usuário ${session.userId}`)
    }
  }
  
  // Limpar conexões inativas (mais de 5 minutos sem heartbeat)
  for (const [id, connection] of connections.entries()) {
    const lastSeen = new Date(connection.lastSeen).getTime()
    if (now - lastSeen > 5 * 60 * 1000) {
      connection.status = 'disconnected'
      addConnectionLog(id, 'Conexão marcada como desconectada (sem heartbeat)')
    }
  }
}

// Executar limpeza a cada 5 minutos
setInterval(cleanupExpiredSessions, config.cleanupInterval)

// Cron job para limpeza diária de logs antigos
cron.schedule('0 2 * * *', async () => {
  logger.info('Iniciando limpeza de logs antigos')
  
  for (const [connectionId, logs] of connectionLogs.entries()) {
    // Manter apenas os últimos 500 logs por conexão
    if (logs.length > 500) {
      logs.splice(0, logs.length - 500)
    }
  }
  
  logger.info('Limpeza de logs concluída')
})

// Criar diretório de uploads se não existir
try {
  await fs.mkdir(config.uploadsDir, { recursive: true })
  await fs.mkdir('logs', { recursive: true })
} catch (error) {
  logger.error('Erro ao criar diretórios:', error)
}

// Iniciar servidor
server.listen(config.port, () => {
  logger.info(`Servidor VNC Proxy rodando na porta ${config.port}`)
  logger.info(`Diretório de uploads: ${config.uploadsDir}`)
  logger.info(`Timeout de sessão: ${config.sessionTimeout / 1000}s`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Recebido SIGTERM, encerrando servidor...')
  
  // Fechar todas as conexões SSH
  for (const tunnel of activeTunnels.values()) {
    tunnel.connection.end()
  }
  
  server.close(() => {
    logger.info('Servidor encerrado')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.info('Recebido SIGINT, encerrando servidor...')
  
  // Fechar todas as conexões SSH
  for (const tunnel of activeTunnels.values()) {
    tunnel.connection.end()
  }
  
  server.close(() => {
    logger.info('Servidor encerrado')
    process.exit(0)
  })
})
