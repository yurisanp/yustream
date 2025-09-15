import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthUser, LoginCredentials } from '../types';

const AUTH_TOKEN_KEY = '@yustream_auth_token';
const USER_DATA_KEY = '@yustream_user_data';

class AuthService {
  private baseUrl: string;

  constructor() {
    // Detectar se está rodando no desenvolvimento ou produção
    this.baseUrl = 'https://yustream.yurisp.com.br'; // Servidor de produção
  }

  /**
   * Realiza login do usuário
   */
  async login(credentials: LoginCredentials): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `Erro HTTP: ${response.status}`,
        };
      }

      const data = await response.json();
      console.log(data);
      if (data.token && data.user) {
        // Salvar token e dados do usuário
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token);
        await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(data.user));

        return {
          success: true,
          user: data.user,
        };
      }

      return {
        success: false,
        error: data.message || 'Credenciais inválidas',
      };
    } catch (error) {
      console.error('Erro no login:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro de conexão',
      };
    }
  }

  /**
   * Faz logout do usuário
   */
  async logout(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[AuthService] Fazendo logout...');
      await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, USER_DATA_KEY]);
      console.log('[AuthService] Logout realizado com sucesso');
      return { success: true };
    } catch (error) {
      console.error('[AuthService] Erro ao fazer logout:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  /**
   * Verifica se o usuário está autenticado
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      return !!token;
    } catch {
      return false;
    }
  }

  /**
   * Obtém o token de autenticação
   */
  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Obtém dados do usuário armazenados
   */
  async getUserData(): Promise<AuthUser | null> {
    try {
      const userData = await AsyncStorage.getItem(USER_DATA_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch {
      return null;
    }
  }

  /**
   * Obtém token para streaming
   */
  async getStreamToken(): Promise<string | null> {
    try {
      const token = await this.getToken();
      if (!token) return null;

      const response = await fetch(`${this.baseUrl}/api/stream/token`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Erro ao obter token de stream:', response.status);
        return null;
      }

      const data = await response.json();
      return data.streamToken || null;
    } catch (error) {
      console.error('Erro ao obter token de stream:', error);
      return null;
    }
  }

  /**
   * Verifica status da stream usando a API do auth-server
   */
  async checkStreamStatus(token?: string): Promise<{
    isOnline: boolean;
    error?: string;
    hasWebRTC?: boolean;
    hasLLHLS?: boolean;
    totalActiveStreams?: number;
    streamDetails?: any;
    status?: string;
    streamName?: string;
    timestamp?: string;
  }> {
    try {
      const authToken = token || await this.getToken();
      if (!authToken) {
        return { isOnline: false, error: 'Token não encontrado' };
      }

      console.log('[AuthService] Verificando status da stream via API...');

      const response = await fetch(`${this.baseUrl}/api/stream/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          isOnline: false,
          error: errorData.message || errorData.error || `HTTP ${response.status}`,
        };
      }

      const data = await response.json();
      console.log('[AuthService] Resposta da API de status:', data);

      return {
        isOnline: data.online === true,
        error: data.error,
        hasWebRTC: data.hasWebRTC || false,
        hasLLHLS: data.hasLLHLS || false,
        totalActiveStreams: data.totalActiveStreams || 0,
        streamDetails: data.streamDetails,
        status: data.status,
        streamName: data.streamName,
        timestamp: data.timestamp,
      };
    } catch (error) {
      console.error('[AuthService] Erro ao verificar status da stream:', error);
      return {
        isOnline: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  /**
   * Obtém qualidades disponíveis via API
   */
  async getAvailableQualities(token?: string): Promise<{
    qualities: Array<{
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
    }>;
    abr: {
      active: boolean;
      url: string | null;
      description: string;
    };
    totalQualities: number;
    activeQualities: number;
    timestamp: string;
  } | null> {
    try {
      const authToken = token || await this.getToken();
      if (!authToken) return null;

      console.log('[AuthService] Obtendo qualidades disponíveis...');

      const response = await fetch(`${this.baseUrl}/api/stream/qualities`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[AuthService] Erro ao obter qualidades:', errorData.message || `HTTP ${response.status}`);
        return null;
      }

      const data = await response.json();
      console.log('[AuthService] Qualidades obtidas:', data);

      return data;
    } catch (error) {
      console.error('[AuthService] Erro ao obter qualidades:', error);
      return null;
    }
  }

  /**
   * Gera configuração de streams para o player baseada nas qualidades disponíveis
   */
  async getStreamSources(token?: string): Promise<Array<{ label: string; uri: string; type: 'hls'; quality?: string }>> {
    try {
      const streamToken = token || await this.getStreamToken();
      if (!streamToken) return [];

      // Obter qualidades disponíveis
      const qualitiesData = await this.getAvailableQualities(streamToken);
      if (!qualitiesData) {
        console.log('[AuthService] Fallback para configuração padrão');
        return this.getDefaultStreamSources(streamToken);
      }

      const hostname = this.baseUrl.replace(/^https?:\/\//, '');
      const protocol = this.baseUrl.startsWith('https') ? 'https' : 'http';
      const port = this.baseUrl.startsWith('https') ? '8443' : '8080';
      
      const tokenParam = `?token=${streamToken}`;
      const sources: Array<{ label: string; uri: string; type: 'hls'; quality?: string }> = [];

      // Nota: ABR removido do mobile pois não funciona bem com Expo Player

      // Adicionar qualidades individuais ativas
      const activeQualities = qualitiesData.qualities.filter(q => q.active);
      for (const quality of activeQualities) {
        const qualityUrl = `${protocol}://${hostname}:${port}/${quality.application}/${quality.streamName}/${quality.streamName}.m3u8${tokenParam}`;
        
        sources.push({
          label: quality.displayName,
          uri: qualityUrl,
          type: 'hls' as const,
          quality: quality.name.toLowerCase(),
        });
      }

      // Se não há qualidades ativas, usar configuração padrão
      if (sources.length === 0) {
        console.log('[AuthService] Nenhuma qualidade ativa, usando fallback');
        return this.getDefaultStreamSources(streamToken);
      }

      console.log('[AuthService] Fontes geradas:', sources.length);
      return sources;
    } catch (error) {
      console.error('[AuthService] Erro ao gerar fontes de stream:', error);
      const streamToken = token || await this.getStreamToken();
      if (!streamToken) return [];
      return this.getDefaultStreamSources(streamToken);
    }
  }

  /**
   * Configuração padrão de fallback
   */
  private getDefaultStreamSources(streamToken: string): Array<{ label: string; uri: string; type: 'hls' }> {
    const hostname = this.baseUrl.replace(/^https?:\/\//, '');
    const protocol = this.baseUrl.startsWith('https') ? 'https' : 'http';
    const port = this.baseUrl.startsWith('https') ? '8443' : '8080';
    
    const tokenParam = `?token=${streamToken}`;

    return [
      {
        label: 'Baixa Latência',
        uri: `${protocol}://${hostname}:${port}/live/live/abr.m3u8${tokenParam}`,
        type: 'hls' as const,
      },
      {
        label: 'Padrão',
        uri: `${protocol}://${hostname}:${port}/live/live/ts:abr.m3u8${tokenParam}`,
        type: 'hls' as const,
      },
    ];
  }
}

export const authService = new AuthService();
export default authService;
