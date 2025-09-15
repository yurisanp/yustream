import { useState, useCallback, useEffect, useRef } from 'react';
import { authService } from '../services/authService';

export interface StreamQuality {
  name: string;
  application: string;
  streamName: string;
  displayName: string;
  description: string;
  priority: number;
  url: string;
  active: boolean;
  state?: string;
  uptime?: number;
  totalConnections?: number;
  error?: string;
}

export interface ABRInfo {
  active: boolean;
  url: string | null;
  description: string;
}

export interface QualitiesData {
  qualities: StreamQuality[];
  abr: ABRInfo;
  totalQualities: number;
  activeQualities: number;
  timestamp: string;
}

export interface UseStreamQualitiesOptions {
  refreshInterval?: number;
  onQualitiesChange?: (qualities: QualitiesData | null) => void;
  onError?: (error: Error) => void;
  enablePeriodicRefresh?: boolean;
}

export const useStreamQualities = (options: UseStreamQualitiesOptions = {}) => {
  const {
    refreshInterval = 30000, // 30 segundos
    onQualitiesChange,
    onError,
    enablePeriodicRefresh = false,
  } = options;

  const [qualities, setQualities] = useState<QualitiesData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Busca as qualidades disponíveis
   */
  const fetchQualities = useCallback(async (): Promise<QualitiesData | null> => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('[useStreamQualities] Buscando qualidades...');
      
      const data = await authService.getAvailableQualities();
      
      if (data) {
        console.log('[useStreamQualities] Qualidades obtidas:', data);
        setQualities(data);
        setLastChecked(new Date());
        onQualitiesChange?.(data);
      } else {
        console.log('[useStreamQualities] Nenhuma qualidade encontrada');
        setQualities(null);
        setLastChecked(new Date());
        onQualitiesChange?.(null);
      }
      
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('[useStreamQualities] Erro ao buscar qualidades:', errorMessage);
      
      setError(errorMessage);
      setQualities(null);
      setLastChecked(new Date());
      
      const error = new Error(errorMessage);
      onError?.(error);
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [onQualitiesChange, onError]);

  /**
   * Agenda uma nova verificação
   */
  const scheduleRefresh = useCallback(() => {
    if (!enablePeriodicRefresh) return;
    
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    
    refreshTimeoutRef.current = setTimeout(() => {
      fetchQualities().then(() => {
        scheduleRefresh(); // Agendar próxima verificação
      });
    }, refreshInterval);
  }, [enablePeriodicRefresh, refreshInterval, fetchQualities]);

  /**
   * Para a verificação periódica
   */
  const stopPeriodicRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  }, []);

  /**
   * Força uma atualização manual
   */
  const refresh = useCallback(async () => {
    console.log('[useStreamQualities] Atualização manual solicitada');
    return await fetchQualities();
  }, [fetchQualities]);

  /**
   * Obtém apenas as qualidades ativas
   */
  const getActiveQualities = useCallback((): StreamQuality[] => {
    return qualities?.qualities.filter(q => q.active) || [];
  }, [qualities]);

  /**
   * Verifica se uma qualidade específica está ativa
   */
  const isQualityActive = useCallback((qualityName: string): boolean => {
    return qualities?.qualities.some(q => q.name === qualityName && q.active) || false;
  }, [qualities]);

  /**
   * Verifica se ABR está ativo (desabilitado no mobile)
   */
  const isABRActive = useCallback((): boolean => {
    // ABR desabilitado no mobile pois não funciona bem com Expo Player
    return false;
  }, []);

  /**
   * Obtém estatísticas das qualidades
   */
  const getQualitiesStats = useCallback(() => {
    if (!qualities) {
      return {
        total: 0,
        active: 0,
        inactive: 0,
        abrActive: false,
      };
    }

    const total = qualities.totalQualities;
    const active = qualities.activeQualities;
    const inactive = total - active;
    const abrActive = qualities.abr.active;

    return {
      total,
      active,
      inactive,
      abrActive,
    };
  }, [qualities]);

  // Efeito para inicialização
  useEffect(() => {
    console.log('[useStreamQualities] Hook inicializado');
    
    // Buscar qualidades imediatamente
    fetchQualities();
    
    // Iniciar verificação periódica se habilitada
    if (enablePeriodicRefresh) {
      scheduleRefresh();
    }
    
    return () => {
      console.log('[useStreamQualities] Hook desmontado');
      stopPeriodicRefresh();
    };
  }, [enablePeriodicRefresh]); // Dependências mínimas para executar apenas uma vez

  // Efeito para gerenciar verificação periódica
  useEffect(() => {
    if (enablePeriodicRefresh) {
      scheduleRefresh();
    } else {
      stopPeriodicRefresh();
    }
    
    return () => stopPeriodicRefresh();
  }, [enablePeriodicRefresh, refreshInterval, scheduleRefresh, stopPeriodicRefresh]);

  return {
    // Estados
    qualities,
    isLoading,
    error,
    lastChecked,
    
    // Dados processados
    activeQualities: getActiveQualities(),
    abrInfo: qualities?.abr || { active: false, url: null, description: '' },
    stats: getQualitiesStats(),
    
    // Funções
    refresh,
    fetchQualities,
    stopPeriodicRefresh,
    isQualityActive,
    isABRActive,
    
    // Configurações
    refreshInterval,
    enablePeriodicRefresh,
  };
};
