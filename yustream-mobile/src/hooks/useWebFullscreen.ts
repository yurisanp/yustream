import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

interface WebFullscreenState {
  isFullscreen: boolean;
}

export const useWebFullscreen = () => {
  const [state, setState] = useState<WebFullscreenState>({
    isFullscreen: false,
  });

  const containerRef = useRef<HTMLElement | null>(null);

  // Verificar se está em fullscreen (apenas web)
  const checkFullscreenStatus = useCallback(() => {
    if (Platform.OS !== 'web') return;
    
    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );

    setState(prev => ({
      ...prev,
      isFullscreen: isCurrentlyFullscreen,
    }));
  }, []);

  // Listener para mudanças de fullscreen
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleFullscreenChange = () => {
      checkFullscreenStatus();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // Permitir sair do fullscreen com ESC
      if (event.key === 'Escape') {
        // Verificar se está em fullscreen no momento da tecla
        const isCurrentlyFullscreen = !!(
          document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement ||
          (document as any).msFullscreenElement
        );
        
        if (isCurrentlyFullscreen) {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          } else if ((document as any).webkitExitFullscreen) {
            (document as any).webkitExitFullscreen();
          } else if ((document as any).mozCancelFullScreen) {
            (document as any).mozCancelFullScreen();
          } else if ((document as any).msExitFullscreen) {
            (document as any).msExitFullscreen();
          }
        }
      }
    };

    // Adicionar listeners para diferentes navegadores
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [checkFullscreenStatus]);

  // Entrar em fullscreen
  const enterFullscreen = useCallback(async (element?: HTMLElement) => {
    if (Platform.OS !== 'web') return;

    try {
      const targetElement = element || containerRef.current || document.documentElement;
      
      if (targetElement.requestFullscreen) {
        await targetElement.requestFullscreen();
      } else if ((targetElement as any).webkitRequestFullscreen) {
        await (targetElement as any).webkitRequestFullscreen();
      } else if ((targetElement as any).mozRequestFullScreen) {
        await (targetElement as any).mozRequestFullScreen();
      } else if ((targetElement as any).msRequestFullscreen) {
        await (targetElement as any).msRequestFullscreen();
      }
    } catch (error) {
      console.error('[WebFullscreen] Erro ao entrar em fullscreen:', error);
    }
  }, []);

  // Sair do fullscreen
  const exitFullscreen = useCallback(async () => {
    if (Platform.OS !== 'web') return;

    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
    } catch (error) {
      console.error('[WebFullscreen] Erro ao sair do fullscreen:', error);
    }
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async (element?: HTMLElement) => {
    if (state.isFullscreen) {
      await exitFullscreen();
    } else {
      await enterFullscreen(element);
    }
  }, [state.isFullscreen, enterFullscreen, exitFullscreen]);

  return {
    isFullscreen: state.isFullscreen,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    containerRef,
    isWebPlatform: Platform.OS === 'web',
  };
};
