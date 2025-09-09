import { useState, useRef, useCallback, useEffect } from 'react';
import OvenPlayer from 'ovenplayer';
import Hls from 'hls.js';
import { useStreamStatus } from './useStreamStatus';

type StreamStatus = 'connecting' | 'playing' | 'paused' | 'error' | 'offline' | 'idle';

interface OvenPlayerInstance {
  on?: (event: string, callback: (data?: unknown) => void) => void;
  destroy?: () => void;
  remove?: () => void;
}

interface UseStreamPlayerOptions {
  onStatusChange?: (status: StreamStatus) => void;
  onError?: (error: string | Error | { message?: string; code?: number }) => void;
  onStreamOnlineChange?: (isOnline: boolean) => void;
  getStreamToken: () => Promise<string | null>;
}

export const useStreamPlayer = ({ 
  onStatusChange, 
  onError, 
  onStreamOnlineChange,
  getStreamToken 
}: UseStreamPlayerOptions) => {
  const [status, setStatus] = useState<StreamStatus>('connecting');
  const [retryCount, setRetryCount] = useState(0);
  const [lastInitTime, setLastInitTime] = useState(0);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  
  const ovenPlayerRef = useRef<OvenPlayerInstance | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  
  const MAX_RETRY_ATTEMPTS = 3;
  const MIN_RETRY_INTERVAL = 10000;
  const STREAM_ID = 'live';

  // Hook para verificar status da stream - SEM verificação periódica
  const streamStatus = useStreamStatus({
    checkInterval: 30000, // Intervalo para caso seja habilitado
    onStatusChange: onStreamOnlineChange,
    enablePeriodicCheck: false // Desabilitar verificação periódica por padrão
  });

  const getPlayerConfig = useCallback((streamToken: string | null) => {
    const hostname = window.location.hostname;
    const isSecure = window.location.protocol === 'https:';
		const wsProtocol = isSecure ? 'wss:' : 'ws:';
		const httpProtocol = isSecure ? 'https:' : 'http:';
		const wsPort = isSecure ? '3334' : '3333';
		const httpPort = isSecure ? '8443' : '8080';
    const tokenParam = streamToken ? `?token=${streamToken}` : '';
    
    return {
      autoStart: true,
      autoFallback: true,
      controls: true,
      loop: false,
      muted: false,
      volume: 100,
      playbackRate: 1,
      playsinline: true,
      sources: [
        {
					label: "WebRTC",
					type: "webrtc" as const,
					file: `${wsProtocol}//${hostname}:${wsPort}/live/${STREAM_ID}/abr_webrtc${tokenParam}&transport=tcp`,
					lowLatency: true,
				},
        {
          label: 'LLHLS',
          type: 'llhls' as const,
          file: `${httpProtocol}//${hostname}:${httpPort}/live/${STREAM_ID}/abr.m3u8${tokenParam}`,
          lowLatency: true,
        },
      ],
      webrtcConfig: {
				iceServers: [
					{ urls: "stun:stun.l.google.com:19302" },
					{ urls: "stun:stun1.l.google.com:19302" },
				],
			},
      hlsConfig: {
        lowLatencyMode: true,
        backBufferLength: 90,
      },
    };
  }, []);

  const updateStatus = useCallback((newStatus: StreamStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  const scheduleRetry = useCallback(() => {
    const now = Date.now();

    if (now - lastInitTime < MIN_RETRY_INTERVAL) {
      console.log('Retry muito rápido, ignorando...');
      return;
    }

    if (retryCount >= MAX_RETRY_ATTEMPTS) {
      updateStatus('offline');
      return;
    }

    setRetryCount(prev => prev + 1);
    setLastInitTime(now);

    setTimeout(() => {
      // Usar uma referência para evitar dependência circular
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }, 5000);
  }, [retryCount, lastInitTime, updateStatus]);

  const initializePlayer = useCallback(async () => {
    console.log('🚀 Iniciando initializePlayer...');
    
    if (!playerContainerRef.current) {
      console.log('❌ playerContainerRef não encontrado');
      return;
    }

    try {
      console.log('📡 Atualizando status para connecting...');
      updateStatus('connecting');

      console.log('🔑 Obtendo token de stream...');
      const token = await getStreamToken();
      if (!token) {
        console.log('❌ Token não obtido');
        updateStatus('error');
        onError?.('Erro ao obter token de acesso à stream');
        return;
      }

      console.log('✅ Token obtido:', token.substring(0, 20) + '...');
      setCurrentToken(token);

      // Verificar se a stream está online antes de inicializar o player (verificação única)
      console.log('🔍 Verificando status da stream na inicialização...');
      const isStreamOnline = await streamStatus.checkOnce(token);
      console.log('📊 Status da stream:', isStreamOnline ? 'ONLINE' : 'OFFLINE');
      
      if (!isStreamOnline) {
        console.log('❌ Stream offline, não inicializando player');
        updateStatus('offline');
        onError?.('Stream está offline');
        return;
      }

      // NÃO iniciar verificação periódica - apenas verificação única na inicialização
      console.log('✅ Stream online, inicializando player sem verificação periódica');

      ovenPlayerRef.current = OvenPlayer.create(
        'ovenPlayer',
        getPlayerConfig(token)
      );

      if (!ovenPlayerRef.current) {
        throw new Error('Falha ao criar instância do OvenPlayer');
      }

      const player = ovenPlayerRef.current;

      player.on?.('ready', () => {
        console.log('OvenPlayer pronto');
        updateStatus('playing');
      });

      player.on?.('stateChanged', (data: unknown) => {
        const stateData = data as { prevstate: string; newstate: string };
        console.log('Estado mudou:', stateData);

        switch (stateData.newstate) {
          case 'playing':
            updateStatus('playing');
            break;
          case 'paused':
            updateStatus('paused');
            break;
          case 'loading':
            updateStatus('connecting');
            break;
          case 'error':
            updateStatus('error');
            break;
        }
      });

      player.on?.('error', async (error: unknown) => {
        const errorData = error as { message?: string; code?: number };
        console.error('Erro do OvenPlayer:', errorData);
        
        // Verificar se a stream ainda está online quando há erro
        console.log('🚨 Verificando status da stream devido ao erro...');
        const isStreamStillOnline = await streamStatus.checkOnError(currentToken || undefined);
        console.log('📊 Status da stream após erro:', isStreamStillOnline ? 'ONLINE' : 'OFFLINE');
        
        if (!isStreamStillOnline) {
          console.log('❌ Stream offline, mudando status para offline');
          updateStatus('offline');
          onError?.('Stream está offline');
        } else {
          console.log('⚠️ Stream online, mas player com erro - tentando reconectar');
          updateStatus('error');
          onError?.(errorData);
          scheduleRetry();
        }
      });

      player.on?.('destroy', () => {
        console.log('OvenPlayer destruído');
        updateStatus('offline');
      });

      console.log('OvenPlayer inicializado com sucesso');
    } catch (error) {
      console.error('Erro ao inicializar OvenPlayer:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      onError?.(errorMessage);
      scheduleRetry();
    }
  }, [getStreamToken, getPlayerConfig, updateStatus, onError, scheduleRetry, streamStatus, currentToken]);

  const handleManualRetry = useCallback(async () => {
    console.log('🔄 Retry manual solicitado...');
    
    // Verificar se a stream está online antes de tentar reconectar
    if (currentToken) {
      console.log('🔍 Verificando status da stream antes do retry manual...');
      const isStreamOnline = await streamStatus.checkOnce(currentToken);
      console.log('📊 Status da stream no retry:', isStreamOnline ? 'ONLINE' : 'OFFLINE');
      
      if (!isStreamOnline) {
        console.log('❌ Stream offline, não fazendo retry');
        updateStatus('offline');
        onError?.('Stream está offline');
        return;
      }
    }
    
    setRetryCount(0);
    setLastInitTime(0);
    updateStatus('connecting');
    initializePlayer();
  }, [initializePlayer, updateStatus, currentToken, streamStatus, onError]);

  const cleanupPlayer = useCallback(() => {
    // Parar verificação periódica da stream
    streamStatus.stopPeriodicCheck();
    
    if (ovenPlayerRef.current) {
      try {
        const player = ovenPlayerRef.current;
        if (typeof player.destroy === 'function') {
          player.destroy();
        } else if (typeof player.remove === 'function') {
          player.remove();
        }
        ovenPlayerRef.current = null;
      } catch (error) {
        console.error('Erro ao destruir player:', error);
      }
    }
  }, [streamStatus]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as typeof window & { Hls: typeof Hls }).Hls = Hls;
    }

    const timer = setTimeout(() => {
      initializePlayer();
    }, 50);
    
    return () => {
      clearTimeout(timer);
      cleanupPlayer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Dependências removidas para evitar loop infinito

  // Removido: Efeito para monitorar mudanças no status da stream
  // Agora só verificamos o status na inicialização e quando há erros

  return {
    status,
    retryCount,
    playerContainerRef,
    handleManualRetry,
    MAX_RETRY_ATTEMPTS,
    streamStatus: {
      isOnline: streamStatus.isOnline,
      isLoading: streamStatus.isLoading,
      error: streamStatus.error,
      lastChecked: streamStatus.lastChecked
    }
  };
};
