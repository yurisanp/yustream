import { useState, useEffect, useCallback } from 'react';
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

  const calculateDimensions = useCallback(() => {
    const isMobile = window.innerWidth <= theme.breakpoints.values.md;
    const headerHeight = isMobile ? 56 : 64; // Altura do header
    const availableHeight = window.innerHeight - headerHeight;
    
    // Aspect ratio 16:9
    const aspectRatio = 16 / 9;
    
    // Calcular width baseado na altura disponível
    const calculatedWidth = availableHeight * aspectRatio;
    const viewportWidth = window.innerWidth;
    
    // Usar o menor valor entre o calculado e a largura da viewport
    const finalWidth = Math.min(calculatedWidth, viewportWidth);
    const finalHeight = finalWidth / aspectRatio;
    
    setDimensions({
      width: finalWidth,
      height: finalHeight,
      maxWidth: viewportWidth
    });
  }, [theme.breakpoints.values.md]);

  useEffect(() => {
    // Calcular dimensões iniciais
    calculateDimensions();

    // Recalcular quando a janela redimensionar
    const handleResize = () => {
      calculateDimensions();
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [calculateDimensions]);

  return dimensions;
};
