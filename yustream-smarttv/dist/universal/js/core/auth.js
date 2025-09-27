/**
 * YuStream Smart TV Authentication
 * Sistema de autenticação simplificado para Smart TVs
 * Baseado no sistema do projeto React original
 */

class AuthService {
    constructor() {
        this.baseURL = this.getBaseURL();
        this.token = this.getStoredToken();
        this.user = this.getStoredUser();
        this.refreshTokenTimer = null;
        
        console.log('[Auth] Serviço inicializado, base URL:', this.baseURL);
    }

    getBaseURL() {
        // Usar configuração global se disponível
        if (window.YUSTREAM_CONFIG && window.YUSTREAM_CONFIG.SERVER_URL) {
            return window.YUSTREAM_CONFIG.SERVER_URL;
        }
        
        // Determinar URL base baseado no ambiente
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:3001';
        }
        
        // Para produção, usar servidor YuStream
        return 'https://yustream.yurisp.com.br';
    }

    // Armazenamento local (localStorage ou fallback)
    setStoredToken(token) {
        try {
            if (typeof localStorage !== 'undefined') {
                if (token) {
                    localStorage.setItem('yustream_token', token);
                } else {
                    localStorage.removeItem('yustream_token');
                }
            } else {
                // Fallback para dispositivos sem localStorage
                this._memoryToken = token;
            }
        } catch (error) {
            console.warn('[Auth] Erro ao salvar token:', error);
            this._memoryToken = token;
        }
    }

    getStoredToken() {
        try {
            if (typeof localStorage !== 'undefined') {
                return localStorage.getItem('yustream_token');
            } else {
                return this._memoryToken || null;
            }
        } catch (error) {
            console.warn('[Auth] Erro ao recuperar token:', error);
            return this._memoryToken || null;
        }
    }

    setStoredUser(user) {
        try {
            if (typeof localStorage !== 'undefined') {
                if (user) {
                    localStorage.setItem('yustream_user', JSON.stringify(user));
                } else {
                    localStorage.removeItem('yustream_user');
                }
            } else {
                this._memoryUser = user;
            }
        } catch (error) {
            console.warn('[Auth] Erro ao salvar usuário:', error);
            this._memoryUser = user;
        }
    }

    getStoredUser() {
        try {
            if (typeof localStorage !== 'undefined') {
                const userData = localStorage.getItem('yustream_user');
                return userData ? JSON.parse(userData) : null;
            } else {
                return this._memoryUser || null;
            }
        } catch (error) {
            console.warn('[Auth] Erro ao recuperar usuário:', error);
            return this._memoryUser || null;
        }
    }

    // Verificar se está autenticado
    isAuthenticated() {
        return !!(this.token && this.user);
    }

    // Login
    async login(username, password) {
        try {
            console.log('[Auth] Tentando login para:', username);

            const response = await fetch(`${this.baseURL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username.trim(),
                    password: password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}`);
            }

            // Salvar dados de autenticação
            this.token = data.token;
            this.user = data.user;
            
            this.setStoredToken(this.token);
            this.setStoredUser(this.user);

            console.log('[Auth] Login realizado com sucesso:', this.user.username);

            // Configurar renovação automática do token
            this.scheduleTokenRefresh();

            return {
                success: true,
                user: this.user,
                token: this.token
            };

        } catch (error) {
            console.error('[Auth] Erro no login:', error);
            
            // Limpar dados inválidos
            this.clearAuth();
            
            return {
                success: false,
                error: error.message || 'Erro de conexão'
            };
        }
    }

    // Logout
    async logout() {
        try {
            console.log('[Auth] Fazendo logout...');
            
            // Limpar timer de renovação
            if (this.refreshTokenTimer) {
                clearTimeout(this.refreshTokenTimer);
                this.refreshTokenTimer = null;
            }

            // Limpar dados locais
            this.clearAuth();

            console.log('[Auth] Logout realizado com sucesso');
            
            return { success: true };

        } catch (error) {
            console.error('[Auth] Erro no logout:', error);
            
            // Mesmo com erro, limpar dados locais
            this.clearAuth();
            
            return { success: false, error: error.message };
        }
    }

    // Limpar autenticação
    clearAuth() {
        this.token = null;
        this.user = null;
        this.setStoredToken(null);
        this.setStoredUser(null);
        
        if (this.refreshTokenTimer) {
            clearTimeout(this.refreshTokenTimer);
            this.refreshTokenTimer = null;
        }
    }

    // Verificar token no servidor
    async verifyToken() {
        if (!this.token) {
            return { valid: false, error: 'Token não encontrado' };
        }

        try {
            console.log('[Auth] Verificando token...');

            const response = await fetch(`${this.baseURL}/auth/verify`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('[Auth] Token válido');
                return { valid: true, user: data.user };
            } else {
                console.log('[Auth] Token inválido');
                this.clearAuth();
                return { valid: false, error: 'Token inválido' };
            }

        } catch (error) {
            console.error('[Auth] Erro na verificação do token:', error);
            return { valid: false, error: error.message };
        }
    }

    // Obter token para stream
    async getStreamToken() {
        if (!this.token) {
            throw new Error('Usuário não autenticado');
        }

        try {
            console.log('[Auth] Obtendo token de stream...');

            const response = await fetch(`${this.baseURL}/stream/token`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('[Auth] Token de stream obtido');
            
            return data.streamToken;

        } catch (error) {
            console.error('[Auth] Erro ao obter token de stream:', error);
            
            // Se o erro for de autenticação, limpar dados
            if (error.message.includes('401') || error.message.includes('403')) {
                this.clearAuth();
            }
            
            throw error;
        }
    }

    // Verificar status da stream
    async getStreamStatus() {
        if (!this.token) {
            throw new Error('Usuário não autenticado');
        }

        try {
            const response = await fetch(`${this.baseURL}/stream/status`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            return data;

        } catch (error) {
            console.error('[Auth] Erro ao verificar status da stream:', error);
            throw error;
        }
    }

    // Agendar renovação do token
    scheduleTokenRefresh() {
        // Limpar timer anterior se existir
        if (this.refreshTokenTimer) {
            clearTimeout(this.refreshTokenTimer);
        }

        // JWT tokens normalmente expiram em 24h, renovar a cada 6h
        const refreshInterval = 6 * 60 * 60 * 1000; // 6 horas

        this.refreshTokenTimer = setTimeout(async () => {
            try {
                console.log('[Auth] Verificando validade do token...');
                const result = await this.verifyToken();
                
                if (!result.valid) {
                    console.log('[Auth] Token expirado, necessário fazer login novamente');
                    this.clearAuth();
                    
                    // Disparar evento para interface saber que precisa fazer login
                    window.dispatchEvent(new CustomEvent('auth:tokenExpired'));
                } else {
                    // Agendar próxima verificação
                    this.scheduleTokenRefresh();
                }
            } catch (error) {
                console.error('[Auth] Erro na verificação periódica:', error);
            }
        }, refreshInterval);
    }

    // Fazer requisição autenticada
    async authenticatedFetch(url, options = {}) {
        if (!this.token) {
            throw new Error('Usuário não autenticado');
        }

        const authOptions = {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        };

        try {
            const response = await fetch(url, authOptions);
            
            // Se receber 401, token pode ter expirado
            if (response.status === 401) {
                console.log('[Auth] Token possivelmente expirado');
                this.clearAuth();
                throw new Error('Token expirado, faça login novamente');
            }

            return response;

        } catch (error) {
            console.error('[Auth] Erro na requisição autenticada:', error);
            throw error;
        }
    }

    // Getters
    getUser() {
        return this.user;
    }

    getToken() {
        return this.token;
    }
}

// Criar instância global
window.authService = new AuthService();

// Export para uso em módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthService;
}
