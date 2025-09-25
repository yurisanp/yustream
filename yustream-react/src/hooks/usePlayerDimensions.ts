import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTheme } from '@mui/material';

interface PlayerDimensions {
  width: number;
  height: number;
  maxWidth: number;
}

export const usePlayerDimensions = () => {
  const theme = useTheme();
  const [dimensions, setDimensions] = useState<PlayerDimensions>({
    width: 0,
    height: 0,
    maxWidth: 0
  });

  const resizeTimeoutRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // Detectar tipo de dispositivo para otimizações
  const deviceType = useMemo(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isTV = /smart-tv|smarttv|tv/i.test(userAgent) || window.innerWidth > 1920;
    return { isMobile, isTV };
  }, []);

  const calculateDimensions = useCallback(() => {
    // Cancelar animação anterior se existir
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      const isMobile = window.innerWidth <= theme.breakpoints.values.md;
      const headerHeight = isMobile ? 56 : 64; // Altura do header
      const availableHeight = window.innerHeight - headerHeight;
      
      // Aspect ratio 16:9
      const aspectRatio = 16 / 9;
      
      // Calcular width baseado na altura disponível
      const calculatedWidth = availableHeight * aspectRatio;
      const viewportWidth = window.innerWidth;
      
      // Usar o menor valor entre o calculado e a largura da viewport
      let finalWidth = Math.min(calculatedWidth, viewportWidth);
      let finalHeight = finalWidth / aspectRatio;

      // Otimizações específicas por dispositivo
      if (deviceType.isMobile) {
        // Em mobile, priorizar largura total para melhor experiência
        finalWidth = viewportWidth;
        finalHeight = finalWidth / aspectRatio;
      } else if (deviceType.isTV) {
        // Em TVs, garantir que o player não seja muito pequeno
        const minWidth = Math.min(1280, viewportWidth * 0.8);
        finalWidth = Math.max(finalWidth, minWidth);
        finalHeight = finalWidth / aspectRatio;
      }

      // Evitar cálculos desnecessários se as dimensões não mudaram significativamente
      const threshold = 5; // pixels
      const currentDimensions = {
        width: finalWidth,
        height: finalHeight,
        maxWidth: viewportWidth
      };

      setDimensions(prev => {
        if (
          Math.abs(prev.width - currentDimensions.width) > threshold ||
          Math.abs(prev.height - currentDimensions.height) > threshold ||
          Math.abs(prev.maxWidth - currentDimensions.maxWidth) > threshold
        ) {
          return currentDimensions;
        }
        return prev;
      });
    });
  }, [theme.breakpoints.values.md, deviceType]);

  // Função de resize com debounce otimizado
  const debouncedResize = useCallback(() => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }

    // Debounce mais agressivo em mobile para economizar bateria
    const debounceTime = deviceType.isMobile ? 250 : 150;

    resizeTimeoutRef.current = setTimeout(() => {
      calculateDimensions();
    }, debounceTime);
  }, [calculateDimensions, deviceType.isMobile]);

  useEffect(() => {
    // Calcular dimensões iniciais
    calculateDimensions();

    // Usar passive listeners para melhor performance
    const options = { passive: true };
    window.addEventListener('resize', debouncedResize, options);
    
    // Também escutar mudanças de orientação em mobile
    if (deviceType.isMobile) {
      window.addEventListener('orientationchange', debouncedResize, options);
    }
    
    return () => {
      window.removeEventListener('resize', debouncedResize);
      if (deviceType.isMobile) {
        window.removeEventListener('orientationchange', debouncedResize);
      }
      
      // Limpar timeouts e RAF
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [calculateDimensions, debouncedResize, deviceType.isMobile]);

  return dimensions;
};
