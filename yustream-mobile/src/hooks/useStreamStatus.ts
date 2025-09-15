import { useState, useCallback, useRef } from 'react';

interface StreamStatusResult {
  isOnline: boolean;
  isLoading: boolean;
  error: string | null;
  lastChecked: Date | null;
  hasWebRTC?: boolean;
  hasLLHLS?: boolean;
  totalActiveStreams?: number;
  streamDetails?: Record<string, unknown>;
  method?: string;
  status?: string;
  streamName?: string;
  timestamp?: string;
}

interface UseStreamStatusOptions {
  checkInterval?: number; // Intervalo em ms para verificação automática
  onStatusChange?: (isOnline: boolean) => void;
  enablePeriodicCheck?: boolean; // Se deve fazer verificação periódica
  authToken?: string; // Token de autenticação para acessar o auth-server
}

export const useStreamStatus = (options: UseStreamStatusOptions = {}) => {
  const {
    checkInterval = 30000, // 30 segundos por padrão
    onStatusChange,
    enablePeriodicCheck = false, // Por padrão, não fazer verificação periódica
    authToken
  } = options;

  const [status, setStatus] = useState<StreamStatusResult>({
    isOnline: false,
    isLoading: false,
    error: null,
    lastChecked: null
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Obter URL da API do auth-server baseado no ambiente
   */
  const getAuthServerUrl = useCallback(() => { 
    const baseUrl = 'https://yustream.yurisp.com.br'; // Servidor de produção
    
    return `${baseUrl}/api/stream/status`;
  }, []);

  /**
   * Verificar status da stream via API do auth-server
   */
  const checkStreamStatus = useCallback(async (token?: string): Promise<boolean> => {
    try {
      console.log('checking');
      console.log('🔍 [useStreamStatus] Iniciando verificação de stream via auth-server...');
      setStatus(prev => ({ ...prev, isLoading: true, error: null }));

      // Cancelar requisição anterior se existir
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Criar novo AbortController
      abortControllerRef.current = new AbortController();

      const authServerUrl = getAuthServerUrl();
      const authTokenToUse = token || authToken;
      
      if (!authTokenToUse) {
        throw new Error('Token de autenticação necessário para verificar status da stream');
      }

      console.log('🌐 [useStreamStatus] URL do auth-server:', authServerUrl);

      const response = await fetch(authServerUrl, {
        method: 'GET',
        signal: abortControllerRef.current.signal,
        headers: {
          'Authorization': `Bearer ${authTokenToUse}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 [useStreamStatus] Resposta HTTP:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('📊 [useStreamStatus] Dados recebidos:', data);

        const isOnline = data.online === true;
        
        setStatus(prev => ({
          ...prev,
          isOnline: isOnline,
          isLoading: false,
          error: null,
          lastChecked: new Date(),
          hasWebRTC: data.hasWebRTC || false,
          hasLLHLS: data.hasLLHLS || false,
          totalActiveStreams: data.totalActiveStreams || 0,
          streamDetails: data.streamDetails,
          method: 'api',
          status: data.status,
          streamName: data.streamName,
          timestamp: data.timestamp
        }));

        onStatusChange?.(isOnline);
        return isOnline;
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
        console.log('❌ [useStreamStatus] Erro na resposta:', response.status, errorData);
        
        setStatus(prev => ({
          ...prev,
          isOnline: false,
          isLoading: false,
          error: errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`,
          lastChecked: new Date()
        }));

        onStatusChange?.(false);
        return false;
      }
    } catch (error: unknown) {
      // Ignorar erros de abort
      if (error instanceof Error && error.name === 'AbortError') {
        return status.isOnline;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log('❌ [useStreamStatus] Erro na verificação:', errorMessage);

      setStatus(prev => ({
        ...prev,
        isOnline: false,
        isLoading: false,
        error: errorMessage,
        lastChecked: new Date()
      }));

      onStatusChange?.(false);
      return false;
    }
  }, [getAuthServerUrl, onStatusChange, status.isOnline, authToken]);

  /**
   * Iniciar verificação periódica
   */
  const startPeriodicCheck = useCallback((token?: string) => {
    // Limpar intervalo anterior se existir
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Verificação inicial
    checkStreamStatus(token);

    // Só configurar verificação periódica se habilitada
    if (enablePeriodicCheck) {
      console.log('🔄 [useStreamStatus] Iniciando verificação periódica...');
      intervalRef.current = setInterval(() => {
        checkStreamStatus(token);
      }, checkInterval);
    } else {
      console.log('⏸️ [useStreamStatus] Verificação periódica desabilitada');
    }
  }, [checkStreamStatus, checkInterval, enablePeriodicCheck]);

  /**
   * Parar verificação periódica
   */
  const stopPeriodicCheck = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Cancelar requisição em andamento
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * Resetar status
   */
  const resetStatus = useCallback(() => {
    setStatus({
      isOnline: false,
      isLoading: false,
      error: null,
      lastChecked: null
    });
  }, []);

  /**
   * Função para verificação única (sem período)
   */
  const checkOnce = useCallback(async (token?: string): Promise<boolean> => {
    console.log('🔍 [useStreamStatus] Verificação única solicitada...');
    return await checkStreamStatus(token);
  }, [checkStreamStatus]);

  /**
   * Função para verificação apenas em caso de erro
   */
  const checkOnError = useCallback(async (token?: string): Promise<boolean> => {
    console.log('🚨 [useStreamStatus] Verificação por erro solicitada...');
    return await checkStreamStatus(token);
  }, [checkStreamStatus]);

  return {
    ...status,
    checkStreamStatus,
    checkOnce,
    checkOnError,
    startPeriodicCheck,
    stopPeriodicCheck,
    resetStatus
  };
};
