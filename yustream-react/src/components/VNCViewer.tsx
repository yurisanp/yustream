import { useEffect, useRef, useState, useCallback } from 'react'
import { Monitor, Upload, Download, Power, RefreshCw, FileText, AlertTriangle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import './VNCViewer.css'

// Importar noVNC de forma dinâmica para evitar problemas de SSR
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let RFB: any = null

interface VNCConnection {
  id: string
  name: string
  host: string
  port: number
  status: 'connected' | 'connecting' | 'disconnected' | 'error'
  lastSeen: string
  monitors: number
}

interface VNCViewerProps {
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

const VNCViewer = ({ showToast }: VNCViewerProps) => {
  const { token, user } = useAuth()
  const canvasRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rfbRef = useRef<any>(null)
  
  const [connections, setConnections] = useState<VNCConnection[]>([])
  const [selectedConnection, setSelectedConnection] = useState<VNCConnection | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [currentMonitor, setCurrentMonitor] = useState(0)
  const [showFileTransfer, setShowFileTransfer] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [connectionLogs, setConnectionLogs] = useState<string[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [scaleMode, setScaleMode] = useState<'local' | 'remote'>('local')
  const [isVNCReady, setIsVNCReady] = useState(false)

  // Verificar se usuário é admin
  const isAdmin = user?.role === 'admin'

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setConnectionLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }, [])

  const loadConnections = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/vnc/connections', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Falha ao carregar conexões VNC')
      }

      const data = await response.json()
      setConnections(data.connections)
      addLog(`Carregadas ${data.connections.length} conexão(ões) do servidor`)
    } catch (error) {
      console.error('Erro ao carregar conexões VNC:', error)
      addLog('Erro ao carregar conexões do servidor, usando dados de demonstração')
      
      // Fallback: carregar dados de demonstração
      try {
        const demoResponse = await fetch('/demo-vnc-connections.json')
        if (demoResponse.ok) {
          const demoData = await demoResponse.json()
          setConnections(demoData.connections)
          addLog(`Carregadas ${demoData.connections.length} conexão(ões) de demonstração`)
        }
      } catch (demoError) {
        console.error('Erro ao carregar dados de demonstração:', demoError)
        addLog('Não foi possível carregar conexões')
      }
    }
  }, [token, addLog])

  // Verificar se biblioteca VNC está disponível
  useEffect(() => {
    let attempts = 0
    const maxAttempts = 20
    let checkInterval: number

    const checkVNC = () => {
      attempts++
      
      if (window.RFB) {
        RFB = window.RFB
        setIsVNCReady(true)
        addLog('Biblioteca VNC carregada e disponível')
        showToast('Sistema VNC pronto para uso', 'success')
        
        if (checkInterval) {
          clearInterval(checkInterval)
        }
        return
      }
      
      if (attempts < maxAttempts) {
        addLog(`Aguardando biblioteca VNC... (tentativa ${attempts}/${maxAttempts})`)
      } else {
        addLog('Biblioteca VNC não encontrada após múltiplas tentativas')
        showToast('Biblioteca VNC não carregada - verifique a conexão', 'error')
        
        if (checkInterval) {
          clearInterval(checkInterval)
        }
      }
    }

    // Verificar imediatamente
    checkVNC()
    
    // Se não encontrou, verificar a cada 500ms
    if (!window.RFB) {
      checkInterval = setInterval(checkVNC, 500)
    }

    // Escutar evento customizado de carregamento
    const handleVNCLoaded = () => {
      if (window.RFB && !RFB) {
        RFB = window.RFB
        setIsVNCReady(true)
        addLog('Biblioteca VNC carregada via evento customizado')
        showToast('Sistema VNC pronto para uso', 'success')
        
        if (checkInterval) {
          clearInterval(checkInterval)
        }
      }
    }

    window.addEventListener('vncLibraryLoaded', handleVNCLoaded)

    // Cleanup
    return () => {
      if (checkInterval) {
        clearInterval(checkInterval)
      }
      window.removeEventListener('vncLibraryLoaded', handleVNCLoaded)
    }
  }, [showToast, addLog])

  // Carregar lista de conexões disponíveis
  useEffect(() => {
    if (!isAdmin) return

    loadConnections()
    
    // Atualizar lista a cada 30 segundos
    const interval = setInterval(loadConnections, 30000)
    return () => clearInterval(interval)
  }, [isAdmin, token, loadConnections])

  const connectToVNC = async (connection: VNCConnection) => {
    // Verificações básicas primeiro
    if (!isVNCReady) {
      showToast('Sistema VNC ainda está carregando. Aguarde...', 'info')
      return
    }

    if (!RFB) {
      showToast('Biblioteca VNC não está disponível', 'error')
      return
    }

    // Primeiro, selecionar a conexão para renderizar o canvas
    setSelectedConnection(connection)
    setIsConnecting(true)
    addLog(`Preparando conexão com ${connection.name}`)

    // Aguardar o React renderizar o canvas
    await new Promise(resolve => setTimeout(resolve, 200))

    // Verificar se canvas foi renderizado
    if (!canvasRef.current) {
      showToast('Erro: interface VNC não foi renderizada. Tente novamente.', 'error')
      addLog('Erro: elemento canvas não encontrado após selecionar conexão')
      setIsConnecting(false)
      return
    }

    if (rfbRef.current) {
      rfbRef.current.disconnect()
      rfbRef.current = null
    }

    addLog(`Conectando a ${connection.name} (${connection.host}:${connection.port})`)

    try {
      // Obter token de sessão VNC
      const tokenResponse = await fetch('/api/admin/vnc/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          connectionId: connection.id,
          monitor: currentMonitor
        })
      })

      if (!tokenResponse.ok) {
        throw new Error('Falha ao obter token de sessão VNC')
      }

      const { sessionToken, wsUrl } = await tokenResponse.json()

      // Verificação final antes de usar
      if (!canvasRef.current) {
        throw new Error('Canvas element foi removido durante o processo')
      }

      // Limpar canvas anterior
      canvasRef.current.innerHTML = ''

      // Criar conexão RFB com controle real
      const rfb = new RFB(canvasRef.current, wsUrl, {
        credentials: { password: sessionToken },
        shared: false,
        viewOnly: false // Habilitar controle total
      })

      // Event listeners
      rfb.addEventListener('connect', () => {
        setIsConnected(true)
        setIsConnecting(false)
        addLog(`Conectado com sucesso a ${connection.name}`)
        showToast(`Conectado ao VNC: ${connection.name}`, 'success')
      })

      rfb.addEventListener('disconnect', () => {
        setIsConnected(false)
        setIsConnecting(false)
        addLog(`Desconectado de ${connection.name}`)
        showToast(`Desconectado do VNC: ${connection.name}`, 'info')
      })

      rfb.addEventListener('credentialsrequired', () => {
        addLog('Credenciais requeridas')
        showToast('Falha na autenticação VNC', 'error')
        setIsConnecting(false)
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rfb.addEventListener('securityfailure', (e: any) => {
        addLog(`Falha de segurança: ${e.detail.reason}`)
        showToast('Falha de segurança na conexão VNC', 'error')
        setIsConnecting(false)
      })

      rfbRef.current = rfb

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('Erro ao conectar VNC:', error)
      addLog(`Erro de conexão: ${error.message}`)
      showToast(`Erro ao conectar: ${error.message}`, 'error')
      setIsConnecting(false)
    }
  }

  const disconnectVNC = () => {
    if (rfbRef.current) {
      rfbRef.current.disconnect()
      rfbRef.current = null
    }
    setIsConnected(false)
    setSelectedConnection(null)
    addLog('Desconexão manual')
  }

  const switchMonitor = async (monitor: number) => {
    if (!selectedConnection) return

    setCurrentMonitor(monitor)
    addLog(`Alternando para monitor ${monitor + 1}`)
    
    // Reconectar com novo monitor
    await connectToVNC(selectedConnection)
  }

  const handleFileUpload = async () => {
    if (!uploadFile || !selectedConnection) return

    const formData = new FormData()
    formData.append('file', uploadFile)
    formData.append('connectionId', selectedConnection.id)

    try {
      const response = await fetch('/api/admin/vnc/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error('Falha no upload do arquivo')
      }

      addLog(`Arquivo enviado: ${uploadFile.name}`)
      showToast(`Arquivo ${uploadFile.name} enviado com sucesso`, 'success')
      setUploadFile(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      addLog(`Erro no upload: ${error.message}`)
      showToast(`Erro no upload: ${error.message}`, 'error')
    }
  }


  if (!isAdmin) {
    return (
      <div className="vnc-viewer">
        <div className="vnc-access-denied">
          <AlertTriangle size={48} />
          <h3>Acesso Negado</h3>
          <p>Apenas administradores podem acessar o controle VNC remoto.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="vnc-viewer">
      <div className="vnc-header">
        <div className="vnc-title">
          <Monitor size={24} />
          <h2>Controle VNC Remoto</h2>
        </div>
        
        <div className="vnc-controls">
          <div className={`vnc-status-indicator ${isVNCReady ? 'ready' : 'loading'}`}>
            {isVNCReady ? '🟢 VNC Pronto' : '🟡 Carregando VNC...'}
          </div>
          
          {selectedConnection && (
            <>
              <div className="monitor-selector">
                <label>Monitor:</label>
                <select 
                  value={currentMonitor} 
                  onChange={(e) => switchMonitor(Number(e.target.value))}
                  disabled={isConnecting}
                >
                  {Array.from({ length: selectedConnection.monitors }, (_, i) => (
                    <option key={i} value={i}>Monitor {i + 1}</option>
                  ))}
                </select>
              </div>

              <div className="scale-mode">
                <label>Escala:</label>
                <select 
                  value={scaleMode} 
                  onChange={(e) => setScaleMode(e.target.value as 'local' | 'remote')}
                  disabled={isConnecting}
                >
                  <option value="local">Local</option>
                  <option value="remote">Remota</option>
                </select>
              </div>

              <button
                className="btn-file-transfer"
                onClick={() => setShowFileTransfer(!showFileTransfer)}
                disabled={!isConnected}
              >
                <Upload size={16} />
                Arquivos
              </button>

              <button
                className="btn-logs"
                onClick={() => setShowLogs(!showLogs)}
              >
                <FileText size={16} />
                Logs
              </button>

              <button
                className="btn-disconnect"
                onClick={disconnectVNC}
                disabled={!isConnected && !isConnecting}
              >
                <Power size={16} />
                Desconectar
              </button>
            </>
          )}

          <button
            className="btn-refresh"
            onClick={loadConnections}
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="vnc-content">
        {/* Lista de conexões */}
        <div className="vnc-sidebar">
          <h3>Conexões Disponíveis</h3>
          <div className="connections-list">
            {connections.map(connection => (
              <div
                key={connection.id}
                className={`connection-item ${selectedConnection?.id === connection.id ? 'selected' : ''} ${connection.status} ${!isVNCReady ? 'disabled' : ''}`}
                onClick={() => isVNCReady ? connectToVNC(connection) : showToast('Aguarde o sistema VNC carregar completamente', 'info')}
                style={{ 
                  cursor: isVNCReady ? 'pointer' : 'not-allowed',
                  opacity: isVNCReady ? 1 : 0.6
                }}
              >
                <div className="connection-info">
                  <div className="connection-name">{connection.name}</div>
                  <div className="connection-details">
                    {connection.host}:{connection.port}
                  </div>
                  <div className="connection-monitors">
                    {connection.monitors} monitor(s)
                  </div>
                </div>
                <div className={`connection-status ${connection.status}`}>
                  {connection.status === 'connected' && '🟢'}
                  {connection.status === 'connecting' && '🟡'}
                  {connection.status === 'disconnected' && '🔴'}
                  {connection.status === 'error' && '❌'}
                </div>
              </div>
            ))}
          </div>

          {connections.length === 0 && (
            <div className="no-connections">
              <p>Nenhuma conexão VNC disponível</p>
            </div>
          )}
        </div>

        {/* Viewer VNC */}
        <div className="vnc-main">
          {selectedConnection ? (
            <div className="vnc-container">
              <div className="vnc-status">
                {isConnecting && (
                  <div className="connecting-status">
                    <RefreshCw className="spinning" size={16} />
                    Conectando a {selectedConnection.name}...
                  </div>
                )}
                {isConnected && (
                  <div className="connected-status">
                    🟢 Conectado a {selectedConnection.name} - Monitor {currentMonitor + 1}
                    <div className="control-instructions">
                      <small>
                        Mouse e teclado ativos • Clique no canvas para focar • 
                        Todas as teclas funcionam incluindo Ctrl+Alt+Del
                      </small>
                    </div>
                  </div>
                )}
              </div>
              
              <div 
                ref={canvasRef} 
                className="vnc-canvas"
                style={{ 
                  width: '100%', 
                  height: '100%',
                  border: '1px solid #333'
                }}
              />
            </div>
          ) : !isVNCReady ? (
            <div className="vnc-placeholder">
              <RefreshCw className="spinning" size={64} />
              <p>Carregando sistema VNC...</p>
              <small>Aguarde enquanto a biblioteca é inicializada</small>
            </div>
          ) : (
            <div className="vnc-placeholder">
              <Monitor size={64} />
              <p>Selecione uma conexão VNC para começar</p>
              <small>Sistema VNC pronto para uso</small>
            </div>
          )}
        </div>
      </div>

      {/* Modal de transferência de arquivos */}
      {showFileTransfer && (
        <div className="modal-overlay">
          <div className="modal file-transfer-modal">
            <div className="modal-header">
              <h3>Transferência de Arquivos</h3>
              <button onClick={() => setShowFileTransfer(false)}>✕</button>
            </div>
            
            <div className="file-transfer-content">
              <div className="upload-section">
                <h4>
                  <Upload size={20} />
                  Upload de Arquivo
                </h4>
                <div className="file-input-container">
                  <input
                    type="file"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="file-input"
                  />
                  <button
                    onClick={handleFileUpload}
                    disabled={!uploadFile}
                    className="btn-upload"
                  >
                    Enviar Arquivo
                  </button>
                </div>
              </div>

              <div className="download-section">
                <h4>
                  <Download size={20} />
                  Download de Arquivo
                </h4>
                <p>Use o gerenciador de arquivos na sessão VNC para navegar e baixar arquivos.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de logs */}
      {showLogs && (
        <div className="modal-overlay">
          <div className="modal logs-modal">
            <div className="modal-header">
              <h3>Logs de Conexão</h3>
              <button onClick={() => setShowLogs(false)}>✕</button>
            </div>
            
            <div className="logs-content">
              {connectionLogs.map((log, index) => (
                <div key={index} className="log-entry">
                  {log}
                </div>
              ))}
              
              {connectionLogs.length === 0 && (
                <div className="no-logs">
                  Nenhum log disponível
                </div>
              )}
            </div>

            <div className="logs-actions">
              <button
                onClick={() => setConnectionLogs([])}
                className="btn-clear-logs"
              >
                Limpar Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VNCViewer
