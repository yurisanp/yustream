import { useState, useRef, useCallback, useEffect } from 'react';
import OvenPlayer from 'ovenplayer';
import Hls from 'hls.js';
import { useStreamStatus } from './useStreamStatus';

type StreamStatus = 'connecting' | 'playing' | 'paused' | 'error' | 'offline' | 'idle';

interface UseStreamPlayerOptions {
  onStatusChange?: (status: StreamStatus) => void;
  onError?: (error: any) => void;
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
  
  const ovenPlayerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  
  const MAX_RETRY_ATTEMPTS = 3;
  const MIN_RETRY_INTERVAL = 10000;
  const STREAM_ID = 'live';

  // Hook para verificar status da stream
  const streamStatus = useStreamStatus({
    checkInterval: 30000, // Verificar a cada 30 segundos
    onStatusChange: onStreamOnlineChange
  });

  const getPlayerConfig = useCallback((streamToken: string | null) => {
    const hostname = window.location.hostname;
    const isSecure = window.location.protocol === 'https:';
    const httpProtocol = isSecure ? 'https:' : 'http:';
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
          label: 'LLHLS',
          type: 'llhls' as const,
          file: `${httpProtocol}//${hostname}:${httpPort}/live/${STREAM_ID}/abr.m3u8${tokenParam}`,
          lowLatency: true,
        },
      ],
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
      initializePlayer();
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

      // Verificar se a stream está online antes de inicializar o player
      console.log('🔍 Verificando status da stream...');
      const isStreamOnline = await streamStatus.checkStreamStatus(token);
      console.log('📊 Status da stream:', isStreamOnline ? 'ONLINE' : 'OFFLINE');
      
      if (!isStreamOnline) {
        console.log('❌ Stream offline, não inicializando player');
        updateStatus('offline');
        onError?.('Stream está offline');
        return;
      }

      // Iniciar verificação periódica do status da stream
      console.log('⏰ Iniciando verificação periódica...');
      streamStatus.startPeriodicCheck(token);

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

      player.on?.('error', (error: unknown) => {
        const errorData = error as { message?: string; code?: number };
        console.error('Erro do OvenPlayer:', errorData);
        updateStatus('error');
        onError?.(errorData);
        scheduleRetry();
      });

      player.on?.('destroy', () => {
        console.log('OvenPlayer destruído');
        updateStatus('offline');
      });

      console.log('OvenPlayer inicializado com sucesso');
    } catch (error) {
      console.error('Erro ao inicializar OvenPlayer:', error);
      onError?.(error);
      scheduleRetry();
    }
  }, [getStreamToken, getPlayerConfig, updateStatus, onError, scheduleRetry]);

  const handleManualRetry = useCallback(() => {
    setRetryCount(0);
    setLastInitTime(0);
    updateStatus('connecting');
    initializePlayer();
  }, [initializePlayer, updateStatus]);

  const cleanupPlayer = useCallback(() => {
    // Parar verificação periódica da stream
    streamStatus.stopPeriodicCheck();
    
    if (ovenPlayerRef.current) {
      try {
        if (typeof ovenPlayerRef.current.destroy === 'function') {
          ovenPlayerRef.current.destroy();
        } else if (typeof ovenPlayerRef.current.remove === 'function') {
          ovenPlayerRef.current.remove();
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
  }, []); // Remover dependências para evitar loop infinito

  // Efeito para monitorar mudanças no status da stream
  useEffect(() => {
    if (currentToken && streamStatus.isOnline === false && status === 'playing') {
      console.log('Stream went offline, updating player status');
      updateStatus('offline');
    }
  }, [streamStatus.isOnline, currentToken, status, updateStatus]);

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
