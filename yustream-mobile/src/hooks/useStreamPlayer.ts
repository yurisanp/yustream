import { useState, useRef, useCallback, useEffect, act } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { StreamStatus, StreamPlayerOptions, StreamStatusInfo, PlayerMetrics } from '../types';
import { authService } from '../services/authService';
import { useStreamStatus } from './useStreamStatus';
import { useStreamQualities } from './useStreamQualities';

export const useStreamPlayer = (options: StreamPlayerOptions = {}) => {
  const {
    onStatusChange,
    onError,
    onStreamOnlineChange,
    getStreamToken = () => authService.getStreamToken(),
  } = options;

  // Estados do player
  const [status, setStatus] = useState<StreamStatus>('connecting');
  const [retryCount, setRetryCount] = useState(0);
  const [streamSources, setStreamSources] = useState<Array<{ label: string; uri: string; type: 'hls' }>>([]);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playerMetrics, setPlayerMetrics] = useState<PlayerMetrics>({
    bufferHealth: 0,
    currentBitrate: 0,
    droppedFrames: 0,
    loadStartTime: 0,
    playbackStartTime: 0,
    totalStalls: 0,
    averageStallDuration: 0,
  });

  // Refs para controle interno
  const lastInitTime = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const isActiveRef = useRef(true);

  // Constantes
  const MAX_RETRY_ATTEMPTS = 3;
  const MIN_RETRY_INTERVAL = 10000; // 10 segundos
  const STREAM_CHECK_INTERVAL = 30000; // 30 segundos

  // Estado da stream
  // Hook para verificar status da stream usando a API do auth-server
  const streamStatusHook = useStreamStatus({
    checkInterval: 30000, // Intervalo para caso seja habilitado
    onStatusChange: onStreamOnlineChange,
    enablePeriodicCheck: true, // Habilitar verificação periódica para monitorar status
    authToken: currentToken || undefined // Passar o token atual para autenticação
  });

  // Hook para gerenciar qualidades disponíveis
  const streamQualitiesHook = useStreamQualities({
    refreshInterval: 30000, // 30 segundos
    enablePeriodicRefresh: false, // Desabilitar por padrão
    onQualitiesChange: (qualities) => {
      console.log('[StreamPlayer] Qualidades atualizadas:', qualities?.activeQualities || 0);
    },
    onError: (error) => {
      console.error('[StreamPlayer] Erro nas qualidades:', error);
    },
  });

  /**
   * Atualiza o status do player
   */
  const updateStatus = useCallback((newStatus: StreamStatus) => {
    console.log(`[StreamPlayer] Status mudou: ${status} → ${newStatus}`);
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [status, onStatusChange]);

  /**
   * Verifica se a stream está online usando o hook
   */
  const checkStreamStatus = useCallback(async (token?: string): Promise<boolean> => {
    try {
      console.log('[StreamPlayer] Verificando status da stream...');
      return await streamStatusHook.checkOnce(token);
    } catch (error) {
      console.error('[StreamPlayer] Erro ao verificar status da stream:', error);
      return false;
    }
  }, [streamStatusHook]);

  /**
   * Valida se o token de stream é válido
   */
  const validateStreamToken = useCallback(async (token: string): Promise<boolean> => {
    try {
      console.log('[StreamPlayer] Validando token de stream...');
      
      // Verificar status da stream usando o token
      const streamStatus = await streamStatusHook.checkOnce(token);
      
      if (streamStatus) {
        console.log('[StreamPlayer] Token válido - stream online');
        return true;
      } else {
        console.log('[StreamPlayer] Token inválido ou stream offline');
        return false;
      }
    } catch (error) {
      console.error('[StreamPlayer] Erro ao validar token:', error);
      return false;
    }
  }, [streamStatusHook]);

  /**
   * Obtém as fontes de stream
   */
  const loadStreamSources = useCallback(async () => {
    try {
      console.log('[StreamPlayer] Carregando fontes de stream...');
      
      const token = await getStreamToken();
      if (!token) {
        throw new Error('Token de stream não disponível');
      }

      // Validar token antes de prosseguir
      const isTokenValid = await validateStreamToken(token);
      if (!isTokenValid) {
        throw new Error('Token de stream inválido ou expirado');
      }

      setCurrentToken(token);
      
      // Atualizar qualidades disponíveis
      await streamQualitiesHook.refresh();

      const sources = await authService.getStreamSources(token);
      if (sources.length === 0) {
        throw new Error('Nenhuma fonte de stream disponível');
      }

      console.log('[StreamPlayer] Fontes carregadas:', sources.length);
      setStreamSources(sources);
      
      return sources;
    } catch (error) {
      console.error('[StreamPlayer] Erro ao carregar fontes:', error);
      onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }, [getStreamToken, validateStreamToken, streamQualitiesHook, onError]);

  /**
   * Agenda uma nova tentativa de conexão
   */
  const scheduleRetry = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    const now = Date.now();
    if (now - lastInitTime.current < MIN_RETRY_INTERVAL) {
      console.log('[StreamPlayer] Retry muito rápido, ignorando...');
      return;
    }

    if (retryCount >= MAX_RETRY_ATTEMPTS) {
      console.log('[StreamPlayer] Máximo de tentativas atingido');
      updateStatus('offline');
      return;
    }

    console.log(`[StreamPlayer] Agendando retry ${retryCount + 1}/${MAX_RETRY_ATTEMPTS}`);
    setRetryCount(prev => prev + 1);
    lastInitTime.current = now;

    retryTimeoutRef.current = setTimeout(() => {
      if (isActiveRef.current) {
        initializePlayer();
      }
    }, 5000);
  }, [retryCount, updateStatus]);

  /**
   * Inicializa o player
   */
  const initializePlayer = useCallback(async () => {
    try {
      console.log('[StreamPlayer] Inicializando player...');
      updateStatus('connecting');

      // Carregar fontes de stream
      await loadStreamSources();
      
      console.log('[StreamPlayer] Player inicializado com sucesso');
      updateStatus('playing');
      
      // Resetar contador de retry em caso de sucesso
      setRetryCount(0);
      
    } catch (error) {
      console.error('[StreamPlayer] Erro na inicialização:', error);
      updateStatus('error');
      scheduleRetry();
    }
  }, [loadStreamSources, updateStatus, scheduleRetry]);

  /**
   * Retry manual pelo usuário
   */
  const handleManualRetry = useCallback(async () => {
    console.log('[StreamPlayer] Retry manual solicitado');
    
    // Limpar timeout de retry automático
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    // Resetar contadores
    setRetryCount(0);
    lastInitTime.current = 0;
    
    // Reinicializar
    await initializePlayer();
  }, [initializePlayer]);

  /**
   * Verifica se o token expirou e tenta renovar
   */
  const checkAndRenewToken = useCallback(async (): Promise<string | null> => {
    try {
      console.log('[StreamPlayer] Verificando e renovando token...');
      
      // Tentar obter um novo token
      const newToken = await getStreamToken();
      if (!newToken) {
        console.log('[StreamPlayer] Não foi possível obter novo token');
        return null;
      }

      // Validar o novo token
      const isValid = await validateStreamToken(newToken);
      if (isValid) {
        console.log('[StreamPlayer] Token renovado com sucesso');
        setCurrentToken(newToken);
        return newToken;
      } else {
        console.log('[StreamPlayer] Novo token também é inválido');
        return null;
      }
    } catch (error) {
      console.error('[StreamPlayer] Erro ao renovar token:', error);
      return null;
    }
  }, [getStreamToken, validateStreamToken]);

  /**
   * Gerencia mudanças no estado do app (background/foreground)
   */
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    console.log('[StreamPlayer] App state mudou:', appStateRef.current, '→', nextAppState);
    
    if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
      // App voltou para foreground
      console.log('[StreamPlayer] App voltou para foreground, verificando stream...');
      isActiveRef.current = true;
      
      // Verificar e renovar token se necessário
      checkAndRenewToken().then((newToken) => {
        if (newToken) {
          checkStreamStatus(newToken);
        } else {
          // Se não conseguiu renovar, tentar reconectar
          console.log('[StreamPlayer] Token inválido, tentando reconectar...');
          initializePlayer();
        }
      });
    } else if (nextAppState.match(/inactive|background/)) {
      // App foi para background
      console.log('[StreamPlayer] App foi para background');
      isActiveRef.current = false;
      
      // Limpar timeouts
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (streamCheckTimeoutRef.current) {
        clearTimeout(streamCheckTimeoutRef.current);
        streamCheckTimeoutRef.current = null;
      }
    }
    
    appStateRef.current = nextAppState;
  }, [checkAndRenewToken, checkStreamStatus, initializePlayer]);

  /**
   * Handlers para eventos do player de vídeo
   */
  const playerHandlers = {
    onLoad: useCallback(() => {
      console.log('[StreamPlayer] Vídeo carregado');
      setPlayerMetrics(prev => ({ ...prev, loadStartTime: Date.now() }));
      updateStatus('playing');
    }, [updateStatus]),

    onLoadStart: useCallback(() => {
      console.log('[StreamPlayer] Iniciando carregamento do vídeo');
      setPlayerMetrics(prev => ({ ...prev, loadStartTime: Date.now() }));
      setIsBuffering(true);
    }, []),

    onBuffer: useCallback((isBuffering: boolean) => {
      console.log('[StreamPlayer] Buffer status:', isBuffering);
      setIsBuffering(isBuffering);
    }, []),

    onError: useCallback((error: any) => {
      console.error('[StreamPlayer] Erro no vídeo:', error);
      updateStatus('error');
      onError?.(error);
      scheduleRetry();
    }, [updateStatus, onError, scheduleRetry]),

    onProgress: useCallback((progress: any) => {
      // Atualizar métricas de progresso se necessário
      setPlayerMetrics(prev => ({
        ...prev,
        bufferHealth: progress.playableDuration || 0,
      }));
    }, []),
  };

  /**
   * Cleanup de recursos
   */
  const cleanup = useCallback(() => {
    console.log('[StreamPlayer] Fazendo cleanup...');
    
    isActiveRef.current = false;
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    if (streamCheckTimeoutRef.current) {
      clearTimeout(streamCheckTimeoutRef.current);
      streamCheckTimeoutRef.current = null;
    }
    
    // Parar verificação periódica da stream
    streamStatusHook.stopPeriodicCheck();
  }, [streamStatusHook]);

  // Efeito para verificação periódica de token
  useEffect(() => {
    if (!currentToken) return;

    // Verificar token a cada 5 minutos
    const tokenCheckInterval = setInterval(async () => {
      if (isActiveRef.current) {
        console.log('[StreamPlayer] Verificação periódica de token...');
        const isValid = await validateStreamToken(currentToken);
        if (!isValid) {
          console.log('[StreamPlayer] Token expirado, tentando renovar...');
          await checkAndRenewToken();
        }
      }
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(tokenCheckInterval);
  }, [currentToken, validateStreamToken, checkAndRenewToken]);

  // Efeitos
  useEffect(() => {
    console.log('[StreamPlayer] Hook montado, inicializando...');
    
    // Adicionar listener para mudanças de estado do app
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Inicializar player
    const timer = setTimeout(() => {
      if (isActiveRef.current) {
        initializePlayer();
      }
    }, 100);
    
    return () => {
      console.log('[StreamPlayer] Hook desmontado');
      clearTimeout(timer);
      subscription?.remove();
      cleanup();
    };
  }, []); // Dependências vazias para executar apenas uma vez

  return {
    // Estados
    status,
    retryCount,
    streamSources,
    isBuffering,
    playerMetrics,
    currentToken,
    
    // Status da stream via API
    streamStatus: {
      isOnline: streamStatusHook.isOnline,
      isLoading: streamStatusHook.isLoading,
      error: streamStatusHook.error,
      lastChecked: streamStatusHook.lastChecked,
      hasWebRTC: streamStatusHook.hasWebRTC,
      hasLLHLS: streamStatusHook.hasLLHLS,
      totalActiveStreams: streamStatusHook.totalActiveStreams,
      streamDetails: streamStatusHook.streamDetails,
      method: streamStatusHook.method || 'api'
    },
    
    // Informações sobre qualidades disponíveis
    streamQualities: {
      qualities: streamQualitiesHook.qualities,
      activeQualities: streamQualitiesHook.activeQualities,
      abrInfo: streamQualitiesHook.abrInfo,
      stats: streamQualitiesHook.stats,
      isLoading: streamQualitiesHook.isLoading,
      error: streamQualitiesHook.error,
      lastChecked: streamQualitiesHook.lastChecked,
      isABRActive: streamQualitiesHook.isABRActive(),
      refresh: streamQualitiesHook.refresh,
    },
    
    // Constantes
    MAX_RETRY_ATTEMPTS,
    
    // Funções
    handleManualRetry,
    checkStreamStatus,
    validateStreamToken,
    checkAndRenewToken,
    
    // Handlers para o player de vídeo
    playerHandlers,
  };
};
