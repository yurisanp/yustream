import { useState, useCallback, useRef } from 'react';

interface StreamStatusResult {
  isOnline: boolean;
  isLoading: boolean;
  error: string | null;
  lastChecked: Date | null;
}

interface UseStreamStatusOptions {
  checkInterval?: number; // Intervalo em ms para verificação automática
  onStatusChange?: (isOnline: boolean) => void;
}

export const useStreamStatus = (options: UseStreamStatusOptions = {}) => {
  const {
    checkInterval = 30000, // 30 segundos por padrão
    onStatusChange
  } = options;

  const [status, setStatus] = useState<StreamStatusResult>({
    isOnline: false,
    isLoading: false,
    error: null,
    lastChecked: null
  });

  const intervalRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const getStreamCheckUrl = useCallback((token?: string) => {
    const hostname = window.location.hostname;
    const isSecure = window.location.protocol === 'https:';
    const httpProtocol = isSecure ? 'https:' : 'http:';
    const httpPort = isSecure ? '8443' : '8080';
    const tokenParam = token ? `?token=${token}` : '';
    
    return `${httpProtocol}//${hostname}:${httpPort}/live/live/abr.m3u8${tokenParam}`;
  }, []);

  const checkStreamStatus = useCallback(async (token?: string): Promise<boolean> => {
    try {
      console.log('🔍 [useStreamStatus] Iniciando verificação de stream...');
      setStatus(prev => ({ ...prev, isLoading: true, error: null }));

      // Cancelar requisição anterior se existir
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Criar novo AbortController
      abortControllerRef.current = new AbortController();

      const streamCheckUrl = getStreamCheckUrl(token);
      console.log('🌐 [useStreamStatus] URL de verificação:', streamCheckUrl);

      const response = await fetch(streamCheckUrl, {
        method: 'GET',
        signal: abortControllerRef.current.signal,
        headers: {
          'Accept': 'application/vnd.apple.mpegurl, application/x-mpegURL, */*',
        },
      });

      // Verificar se a resposta é válida e contém dados de stream
      const isOnline = response.ok && response.status === 200;
      console.log('📡 [useStreamStatus] Resposta HTTP:', response.status, response.statusText);
      
      if (isOnline) {
        // Verificar se o conteúdo contém dados de stream válidos   
        setStatus(prev => ({
          ...prev,
          isOnline: isOnline,
          isLoading: false,
          error: null,
          lastChecked: new Date()
        }));

        onStatusChange?.(isOnline);
        return isOnline;
      } else {
        console.log('❌ [useStreamStatus] Resposta não OK:', response.status);
        setStatus(prev => ({
          ...prev,
          isOnline: false,
          isLoading: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          lastChecked: new Date()
        }));

        onStatusChange?.(false);
        return false;
      }
    } catch (error: any) {
      // Ignorar erros de abort
      if (error.name === 'AbortError') {
        return status.isOnline;
      }

      const errorMessage = error.message || 'Unknown error';
      console.log('Stream offline:', errorMessage);

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
  }, [getStreamCheckUrl, onStatusChange, status.isOnline]);

  const startPeriodicCheck = useCallback((token?: string) => {
    // Limpar intervalo anterior se existir
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Verificação inicial
    checkStreamStatus(token);

    // Configurar verificação periódica
    intervalRef.current = setInterval(() => {
      checkStreamStatus(token);
    }, checkInterval);
  }, [checkStreamStatus, checkInterval]);

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

  const resetStatus = useCallback(() => {
    setStatus({
      isOnline: false,
      isLoading: false,
      error: null,
      lastChecked: null
    });
  }, []);

  return {
    ...status,
    checkStreamStatus,
    startPeriodicCheck,
    stopPeriodicCheck,
    resetStatus
  };
};
