import { useState, useCallback, useEffect, useRef } from 'react';
import { Dimensions, StatusBar, Platform } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useKeepAwake } from 'expo-keep-awake';
import { useWebFullscreen } from './useWebFullscreen';

interface FullscreenPlayerState {
  isFullscreen: boolean;
  orientation: ScreenOrientation.Orientation;
  dimensions: {
    width: number;
    height: number;
  };
}

export const useFullscreenPlayer = () => {
  const [state, setState] = useState<FullscreenPlayerState>(() => {
    const { width, height } = Dimensions.get('window');
    return {
      isFullscreen: false,
      orientation: ScreenOrientation.Orientation.PORTRAIT_UP,
      dimensions: { width, height },
    };
  });

  const [showControls, setShowControls] = useState(true);
  const orientationSubscription = useRef<ReturnType<typeof ScreenOrientation.addOrientationChangeListener> | null>(null);
  
  // Hook para fullscreen web
  const webFullscreen = useWebFullscreen();

  /**
   * Atualizar dimensões quando a tela rotacionar
   */
  const updateDimensions = useCallback(() => {
    const { width, height } = Dimensions.get('window');
    setState(prev => ({
      ...prev,
      dimensions: { width, height },
    }));
  }, []);

  /**
   * Configurar listeners de orientação
   */
  useEffect(() => {
    // No web, usar o hook específico para web
    if (Platform.OS === 'web') {
      return;
    }

    // Listener para mudanças de orientação (apenas mobile)
    orientationSubscription.current = ScreenOrientation.addOrientationChangeListener((event) => {
      console.log('[FullscreenPlayer] Orientação mudou:', event.orientationInfo.orientation);
      
      setState(prev => ({
        ...prev,
        orientation: event.orientationInfo.orientation,
      }));
      
      updateDimensions();
      
      // Determinar se está em landscape (fullscreen)
      const isLandscape = 
        event.orientationInfo.orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        event.orientationInfo.orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
      
      setState(prev => ({
        ...prev,
        isFullscreen: isLandscape,
      }));
      
      // Gerenciar status bar
      if (Platform.OS === 'android') {
        if (isLandscape) {
          StatusBar.setHidden(true, 'fade');
        } else {
          StatusBar.setHidden(false, 'fade');
        }
      }
    });

    // Listener para mudanças de dimensões
    const dimensionsSubscription = Dimensions.addEventListener('change', updateDimensions);

    return () => {
      orientationSubscription.current?.remove();
      dimensionsSubscription?.remove();
    };
  }, [updateDimensions]);

  /**
   * Sincronizar estado com web fullscreen
   */
  useEffect(() => {
    if (Platform.OS === 'web') {
      setState(prev => ({
        ...prev,
        isFullscreen: webFullscreen.isFullscreen,
      }));
    }
  }, [webFullscreen.isFullscreen]);

  /**
   * Entrar em modo fullscreen
   */
  const enterFullscreen = useCallback(async () => {
    try {
      console.log('[FullscreenPlayer] Entrando em fullscreen...');
      
      if (Platform.OS === 'web') {
        // Usar API do navegador para fullscreen
        await webFullscreen.enterFullscreen();
      } else {
        // Lógica mobile original
        await ScreenOrientation.unlockAsync();
        
        const currentOrientation = await ScreenOrientation.getOrientationAsync();
        if (currentOrientation === ScreenOrientation.Orientation.PORTRAIT_UP) {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        }
        
        setState(prev => ({ ...prev, isFullscreen: true }));
        
        if (Platform.OS === 'android') {
          StatusBar.setHidden(true, 'fade');
        }
      }
      
    } catch (error) {
      console.error('[FullscreenPlayer] Erro ao entrar em fullscreen:', error);
    }
  }, [webFullscreen]);

  /**
   * Sair do modo fullscreen
   */
  const exitFullscreen = useCallback(async () => {
    try {
      console.log('[FullscreenPlayer] Saindo do fullscreen...');
      
      if (Platform.OS === 'web') {
        // Usar API do navegador para sair do fullscreen
        await webFullscreen.exitFullscreen();
      } else {
        // Lógica mobile original
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        
        setState(prev => ({ ...prev, isFullscreen: false }));
        
        if (Platform.OS === 'android') {
          StatusBar.setHidden(false, 'fade');
        }
      }
      
    } catch (error) {
      console.error('[FullscreenPlayer] Erro ao sair do fullscreen:', error);
    }
  }, [webFullscreen]);

  /**
   * Toggle fullscreen
   */
  const toggleFullscreen = useCallback(async () => {
    const currentFullscreenState = Platform.OS === 'web' ? webFullscreen.isFullscreen : state.isFullscreen;
    
    if (currentFullscreenState) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  }, [state.isFullscreen, webFullscreen.isFullscreen, enterFullscreen, exitFullscreen]);

  /**
   * Toggle controles
   */
  const toggleControls = useCallback(() => {
    console.log('toggling');
    setShowControls(prev => !prev);
  }, []);

  /**
   * Mostrar controles
   */
  const showPlayerControls = useCallback(() => {
    setShowControls(true);
  }, []);

  /**
   * Esconder controles
   */
  const hidePlayerControls = useCallback(() => {
    setShowControls(false);
  }, []);

  /**
   * Cleanup ao desmontar
   */
  useEffect(() => {
    return () => {
      // Restaurar configurações ao desmontar
      if (state.isFullscreen) {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        if (Platform.OS === 'android') {
          StatusBar.setHidden(false, 'fade');
        }
      }
    };
  }, [state.isFullscreen]);

  return {
    // Estados
    isFullscreen: Platform.OS === 'web' ? webFullscreen.isFullscreen : state.isFullscreen,
    orientation: state.orientation,
    dimensions: state.dimensions,
    showControls,
    
    // Funções
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    toggleControls,
    showPlayerControls,
    hidePlayerControls,
    setShowControls,
    
    // Helpers
    isLandscape: state.orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT || 
                 state.orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT,
    isPortrait: state.orientation === ScreenOrientation.Orientation.PORTRAIT_UP || 
                state.orientation === ScreenOrientation.Orientation.PORTRAIT_DOWN,
    
    // Web específico
    containerRef: webFullscreen.containerRef,
    isWebPlatform: webFullscreen.isWebPlatform,
  };
};
