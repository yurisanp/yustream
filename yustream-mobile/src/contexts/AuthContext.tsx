import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthContextType, AuthUser, LoginCredentials } from '../types';
import { authService } from '../services/authService';

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Verifica autenticação na inicialização
   */
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('[AuthContext] Verificando autenticação inicial...');
        
        const authenticated = await authService.isAuthenticated();
        if (authenticated) {
          const userData = await authService.getUserData();
          if (userData) {
            setUser(userData);
            setIsAuthenticated(true);
            console.log('[AuthContext] Usuário autenticado:', userData.username);
          }
        }
      } catch (error) {
        console.error('[AuthContext] Erro na verificação inicial:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  /**
   * Função de login
   */
  const login = useCallback(async (credentials: LoginCredentials): Promise<boolean> => {
    try {
      setIsLoading(true);
      console.log('[AuthContext] Tentando login para:', credentials.username);
      
      const result = await authService.login(credentials);
      
      if (result.success && result.user) {
        setUser(result.user);
        setIsAuthenticated(true);
        console.log('[AuthContext] Login bem-sucedido:', result.user.username);
        return true;
      } else {
        console.log('[AuthContext] Login falhou:', result.error);
        return false;
      }
    } catch (error) {
      console.error('[AuthContext] Erro no login:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Função de logout
   */
  const logout = useCallback(async () => {
    try {
      console.log('[AuthContext] Fazendo logout...');
      await authService.logout();
      setUser(null);
      setIsAuthenticated(false);
      console.log('[AuthContext] Logout realizado com sucesso');
    } catch (error) {
      console.error('[AuthContext] Erro no logout:', error);
    }
  }, []);

  /**
   * Obter token de stream
   */
  const getStreamToken = useCallback(async (): Promise<string | null> => {
    try {
      if (!isAuthenticated) {
        console.log('[AuthContext] Usuário não autenticado, não é possível obter token');
        return null;
      }

      const token = await authService.getStreamToken();
      if (token) {
        console.log('[AuthContext] Token de stream obtido com sucesso');
      } else {
        console.log('[AuthContext] Falha ao obter token de stream');
      }
      
      return token;
    } catch (error) {
      console.error('[AuthContext] Erro ao obter token de stream:', error);
      return null;
    }
  }, [isAuthenticated]);

  const contextValue: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    getStreamToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook para usar o contexto de autenticação
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

export default AuthContext;
