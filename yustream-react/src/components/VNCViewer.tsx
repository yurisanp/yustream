import { useEffect, useRef, useState, useCallback } from 'react'
import { Monitor, Upload, Download, Power, RefreshCw, FileText, AlertTriangle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import './VNCViewer.css'

// Importar noVNC de forma dinâmica para evitar problemas de SSR
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let RFB: any = null

interface VNCStatus {
  available: boolean
  host: string
  port: number
  name: string
  wsPort?: number
  lastChecked: string
  activeSessions?: number
  method?: string
  wsUrl?: string
  testMethod?: string
  reliability?: string
}

interface VNCViewerProps {
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

const VNCViewer = ({ showToast }: VNCViewerProps) => {
  const { token, user } = useAuth()
  const canvasRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rfbRef = useRef<any>(null)
  
  const [vncStatus, setVncStatus] = useState<VNCStatus | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [showFileTransfer, setShowFileTransfer] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [connectionLogs, setConnectionLogs] = useState<string[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [isVNCReady, setIsVNCReady] = useState(false)
  const [statusLoading, setStatusLoading] = useState(true)

  // Verificar se usuário é admin
  const isAdmin = user?.role === 'admin'

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setConnectionLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }, [])

  const loadVNCStatus = useCallback(async () => {
    try {
      setStatusLoading(true)
      
      // Primeiro tentar via NGINX integrado
      try {
        const nginxResponse = await fetch('/api/vnc/status', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (nginxResponse.ok) {
          const status = await nginxResponse.json()
          setVncStatus({
            ...status,
            method: 'nginx-integrated',
            wsUrl: window.location.protocol === 'https:' ? 'wss://' + window.location.host + '/vnc-ws' : 'ws://' + window.location.host + '/vnc-ws'
          })
          addLog(`Status VNC via NGINX: ${status.available ? 'Disponível' : 'Indisponível'} (${status.testMethod})`)
          return
        }
      } catch (nginxError) {
        console.warn('NGINX VNC não disponível, tentando fallback:', nginxError)
      }
      
      // Fallback: servidor auxiliar
      const response = await fetch('/api/admin/vnc/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Falha ao verificar status VNC')
      }

      const status = await response.json()
      
      // Se é redirecionamento para NGINX + websockify
      if (status.message && status.message.includes('websockify')) {
        setVncStatus({
          available: true, // Assumir disponível se websockify está configurado
          host: status.server.host,
          port: status.server.port,
          name: status.server.name,
          lastChecked: new Date().toISOString(),
          method: 'nginx-websockify',
          wsUrl: window.location.protocol === 'https:' ? 'wss://' + window.location.host + '/vnc-ws' : 'ws://' + window.location.host + '/vnc-ws'
        })
        addLog('VNC gerenciado pelo NGINX + websockify')
      } else {
        setVncStatus(status)
        addLog(`Status VNC: ${status.available ? 'Disponível' : 'Indisponível'} em ${status.host}:${status.port}`)
      }
    } catch (error) {
      console.error('Erro ao verificar status VNC:', error)
      addLog('Erro ao verificar status do servidor VNC')
      
      // Fallback final: configuração NGINX integrado
      setVncStatus({
        available: true, // Assumir disponível para teste
        host: '192.168.18.96',
        port: 5900,
        name: 'Servidor de Streaming',
        lastChecked: new Date().toISOString(),
        method: 'nginx-fallback',
        wsUrl: window.location.protocol === 'https:' ? 'wss://' + window.location.host + '/vnc-ws' : 'ws://' + window.location.host + '/vnc-ws'
      })
      addLog('Usando configuração NGINX integrado padrão')
    } finally {
      setStatusLoading(false)
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

  // Carregar status do servidor VNC
  useEffect(() => {
    if (!isAdmin) return

    loadVNCStatus()
    
    // Atualizar status a cada 30 segundos
    const interval = setInterval(loadVNCStatus, 30000)
    return () => clearInterval(interval)
  }, [isAdmin, token, loadVNCStatus])

  const connectToVNC = async () => {
    // Verificações básicas primeiro
    if (!isVNCReady) {
      showToast('Sistema VNC ainda está carregando. Aguarde...', 'info')
      return
    }

    if (!RFB) {
      showToast('Biblioteca VNC não está disponível', 'error')
      return
    }

    if (!vncStatus || !vncStatus.available) {
      showToast('Servidor VNC não está disponível. Verifique se o túnel está ativo.', 'error')
      return
    }

    setIsConnecting(true)
    addLog(`Conectando ao servidor VNC ${vncStatus.name}`)

    // Aguardar o React renderizar o canvas
    await new Promise(resolve => setTimeout(resolve, 200))

    // Verificar se canvas foi renderizado
    if (!canvasRef.current) {
      showToast('Erro: interface VNC não foi renderizada. Tente novamente.', 'error')
      addLog('Erro: elemento canvas não encontrado')
      setIsConnecting(false)
      return
    }

    if (rfbRef.current) {
      rfbRef.current.disconnect()
      rfbRef.current = null
    }

    try {
      // Usar WebSocket do NGINX integrado (nova arquitetura)
      const wsUrl = vncStatus.wsUrl || (window.location.protocol === 'https:' ? 'wss://' + window.location.host + '/vnc-ws' : 'ws://' + window.location.host + '/vnc-ws')
      const server = { name: vncStatus.name }
      
      addLog(`Conectando via NGINX integrado: ${wsUrl}`)

      // Verificação final antes de usar
      if (!canvasRef.current) {
        throw new Error('Canvas element foi removido durante o processo')
      }

      // Limpar canvas anterior
      canvasRef.current.innerHTML = ''

      // Criar conexão RFB via websockify (WebSocket → TCP direto)
      const rfb = new RFB(canvasRef.current, wsUrl, {
        shared: false,
        viewOnly: false // Habilitar controle total
        // websockify gerencia a conversão WebSocket → TCP automaticamente
      })

      // Event listeners
      rfb.addEventListener('connect', () => {
        setIsConnected(true)
        setIsConnecting(false)
        addLog(`Conectado com sucesso ao ${server.name}`)
        showToast(`Conectado ao VNC: ${server.name}`, 'success')
      })

      rfb.addEventListener('disconnect', () => {
        setIsConnected(false)
        setIsConnecting(false)
        addLog(`Desconectado do ${server.name}`)
        showToast(`Desconectado do VNC: ${server.name}`, 'info')
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
    addLog('Desconexão manual do servidor VNC')
  }


  const handleFileUpload = async () => {
    if (!uploadFile) return

    const formData = new FormData()
    formData.append('file', uploadFile)

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
          
          <div className={`vnc-server-status ${vncStatus?.available ? 'available' : 'unavailable'}`}>
            {statusLoading ? '🔄 Verificando...' : 
             vncStatus?.available ? `🟢 ${vncStatus.name}` : '🔴 Servidor Indisponível'}
          </div>

          {isConnected ? (
            <>
              <button
                className="btn-file-transfer"
                onClick={() => setShowFileTransfer(!showFileTransfer)}
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
              >
                <Power size={16} />
                Desconectar
              </button>
            </>
          ) : (
            <button
              className="btn-connect"
              onClick={connectToVNC}
              disabled={!isVNCReady || !vncStatus?.available || isConnecting}
            >
              {isConnecting ? (
                <>
                  <RefreshCw className="spinning" size={16} />
                  Conectando...
                </>
              ) : (
                <>
                  <Monitor size={16} />
                  Conectar VNC
                </>
              )}
            </button>
          )}

          <button
            className="btn-refresh"
            onClick={loadVNCStatus}
            disabled={statusLoading}
          >
            <RefreshCw size={16} />
            Verificar Status
          </button>
        </div>
      </div>

      <div className="vnc-content">
        {/* Área principal VNC */}
        <div className="vnc-main">
          {/* Status do servidor */}
          <div className="vnc-server-info">
            {statusLoading ? (
              <div className="server-status loading">
                <RefreshCw className="spinning" size={20} />
                <span>Verificando servidor VNC...</span>
              </div>
            ) : vncStatus ? (
              <div className={`server-status ${vncStatus.available ? 'available' : 'unavailable'}`}>
                <div className="server-details">
                  <h3>{vncStatus.name}</h3>
                  <p>{vncStatus.host}:{vncStatus.port}</p>
                  <small>
                    Status: {vncStatus.available ? 'Disponível' : 'Indisponível'} • 
                    Sessões ativas: {vncStatus.activeSessions} • 
                    Última verificação: {new Date(vncStatus.lastChecked).toLocaleTimeString()}
                  </small>
                </div>
                <div className="server-indicator">
                  {vncStatus.available ? '🟢' : '🔴'}
                </div>
              </div>
            ) : (
              <div className="server-status error">
                <span>❌ Erro ao verificar servidor VNC</span>
              </div>
            )}
          </div>

          {/* Canvas VNC */}
          {isConnected || isConnecting ? (
            <div className="vnc-container">
              <div className="vnc-status">
                {isConnecting && (
                  <div className="connecting-status">
                    <RefreshCw className="spinning" size={16} />
                    Conectando ao servidor de streaming...
                  </div>
                )}
                {isConnected && (
                  <div className="connected-status">
                    🟢 Conectado ao servidor de streaming
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
          ) : !vncStatus?.available ? (
            <div className="vnc-placeholder">
              <AlertTriangle size={64} />
              <p>Servidor VNC não disponível</p>
              <small>Verifique se o túnel SSH está ativo e o TightVNC está rodando na porta 5901</small>
            </div>
          ) : (
            <div className="vnc-placeholder">
              <Monitor size={64} />
              <p>Clique em "Conectar VNC" para iniciar</p>
              <small>Servidor VNC disponível e pronto para conexão</small>
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
