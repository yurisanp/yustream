import { useState, useEffect, useRef, useCallback } from 'react'
import { Wifi, WifiOff } from 'lucide-react'
import OvenPlayer from 'ovenplayer'
import Hls from 'hls.js'
import './OvenStreamPlayer.css'

interface OvenStreamPlayerProps {
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

// Interface básica para o OvenPlayer
interface OvenPlayerInstance {
  destroy?: () => void
  remove?: () => void
  on?: (event: string, callback: (data?: unknown) => void) => void
  play?: () => void
  pause?: () => void
  setMute?: (muted: boolean) => void
  setVolume?: (volume: number) => void
  getSources?: () => Array<{ type?: string; label?: string; index: number }>
  setCurrentSource?: (index: number) => void
}

type StreamStatus = 'connecting' | 'playing' | 'paused' | 'error' | 'offline' | 'idle'

const STREAM_ID = 'live'

const OvenStreamPlayer = ({ showToast }: OvenStreamPlayerProps) => {
  // Estados principais
  const [status, setStatus] = useState<StreamStatus>('connecting')

  // Refs
  const playerContainerRef = useRef<HTMLDivElement>(null)
  const ovenPlayerRef = useRef<OvenPlayerInstance | null>(null)
  const showToastRef = useRef(showToast)
  
  // Atualizar ref sempre que showToast mudar
  useEffect(() => {
    showToastRef.current = showToast
  }, [showToast])

  // Configurações do OvenPlayer para OvenMediaEngine
  const getPlayerConfig = () => {
    const hostname = window.location.hostname
    
    return {
      autoStart: true,
      autoFallback: true,
      controls: true, // Usar controles nativos do OvenPlayer
      loop: false,
      muted: false,
      volume: 100,
      playbackRate: 1,
      playsinline: true,
      sources: [
        {
          label: 'WebRTC',
          type: 'webrtc' as const,
          file: `ws://${hostname}:3333/live/${STREAM_ID}/abr_webrtc`,
          lowLatency: true
        },
        {
          label: 'LLHLS',
          type: 'llhls' as const, 
          file: `http://${hostname}:8080/live/${STREAM_ID}/abr.m3u8`,
          lowLatency: true
        },
        {
          label: 'HLS',
          type: 'hls' as const,
          file: `http://${hostname}:8080/live/${STREAM_ID}/ts:abr.m3u8`,
          lowLatency: false
        }
      ],
      webrtcConfig: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      },
      hlsConfig: {
        lowLatencyMode: true,
        backBufferLength: 90
      }
    }
  }

  const initializePlayer = useCallback(async () => {
    if (!playerContainerRef.current) return

    try {
      setStatus('connecting')
      
      // Destruir player anterior se existir
      if (ovenPlayerRef.current) {
        try {
          if (typeof ovenPlayerRef.current.destroy === 'function') {
            ovenPlayerRef.current.destroy()
          } else if (typeof ovenPlayerRef.current.remove === 'function') {
            ovenPlayerRef.current.remove()
          }
        } catch (error) {
          console.log('Erro ao destruir player anterior:', error)
        }
        ovenPlayerRef.current = null
      }

      // Aguardar um pouco para garantir que o DOM esteja limpo
      await new Promise(resolve => setTimeout(resolve, 100))

      // Verificar se o elemento ainda existe
      const playerElement = document.getElementById('ovenPlayer')
      if (!playerElement) {
        console.error('Elemento do player não encontrado')
        setStatus('error')
        showToastRef.current('Erro: Elemento do player não encontrado', 'error')
        return
      }

      // Criar novo OvenPlayer
      ovenPlayerRef.current = OvenPlayer.create('ovenPlayer', getPlayerConfig())

      if (!ovenPlayerRef.current) {
        throw new Error('Falha ao criar instância do OvenPlayer')
      }

      // Event listeners do OvenPlayer
      const player = ovenPlayerRef.current

      player.on?.('ready', () => {
        console.log('OvenPlayer pronto')
        setStatus('playing')
        showToastRef.current('Stream conectada com sucesso!', 'success')
      })

      player.on?.('stateChanged', (data: unknown) => {
        const stateData = data as { prevstate: string; newstate: string }
        console.log('Estado mudou:', stateData)
        
        switch (stateData.newstate) {
          case 'playing':
            setStatus('playing')
            break
          case 'paused':
            setStatus('paused')
            break
          case 'loading':
            setStatus('connecting')
            break
          case 'error':
            setStatus('error')
            showToastRef.current('Erro na reprodução', 'error')
            break
        }
      })

      player.on?.('sourceChanged', (data: unknown) => {
        const sourceData = data as { currentSource?: { label?: string } }
        console.log('Fonte alterada:', sourceData)
        const protocol = sourceData.currentSource?.label || 'Unknown'
        showToastRef.current(`Protocolo: ${protocol}`, 'info')
      })

      player.on?.('error', (error: unknown) => {
        const errorData = error as { message?: string; code?: number }
        console.error('Erro do OvenPlayer:', errorData)
        setStatus('error')
        showToastRef.current(`Erro: ${errorData.message || 'Falha na reprodução'}`, 'error')
      })

      player.on?.('destroy', () => {
        console.log('OvenPlayer destruído')
        setStatus('offline')
      })

      console.log('OvenPlayer inicializado com sucesso')

    } catch (error) {
      console.error('Erro ao inicializar OvenPlayer:', error)
      setStatus('error')
      showToastRef.current('Erro ao inicializar player', 'error')
    }
  }, [])

  useEffect(() => {
    // Configurar HLS.js globalmente para o OvenPlayer
    if (typeof window !== 'undefined') {
      (window as typeof window & { Hls: typeof Hls }).Hls = Hls
    }

    const cleanupPlayer = () => {
      if (ovenPlayerRef.current) {
        try {
          if (typeof ovenPlayerRef.current.destroy === 'function') {
            ovenPlayerRef.current.destroy()
          } else if (typeof ovenPlayerRef.current.remove === 'function') {
            ovenPlayerRef.current.remove()
          }
          ovenPlayerRef.current = null
        } catch (error) {
          console.error('Erro ao destruir player:', error)
        }
      }
    }
    
    // Aguardar o próximo ciclo de renderização para garantir que o DOM esteja pronto
    const timer = setTimeout(() => {
      initializePlayer()
    }, 50)
    
    return () => {
      clearTimeout(timer)
      cleanupPlayer()
    }
  }, [initializePlayer]) // Dependência: initializePlayer







  const getStatusIcon = () => {
    switch (status) {
      case 'connecting':
        return <div className="loading-spinner" />
      case 'playing':
        return <Wifi className="status-icon live" />
      case 'error':
        return <WifiOff className="status-icon error" />
      default:
        return <Wifi className="status-icon" />
    }
  }



  return (
    <div 
      ref={playerContainerRef}
      className="stream-player"
    >
      {/* Container do OvenPlayer */}
      <div id="ovenPlayer" className="oven-player-container" />

      {/* Loading/Status Overlay */}
      {(status === 'connecting' || status === 'error') && (
        <div className="stream-overlay">
          <div className="overlay-content">
            {getStatusIcon()}
            <p className="status-text">
              {status === 'connecting' && 'Conectando à stream...'}
              {status === 'error' && 'Erro na conexão'}
            </p>
            {status === 'error' && (
              <button className="retry-btn" onClick={initializePlayer}>
                Tentar Novamente
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default OvenStreamPlayer
