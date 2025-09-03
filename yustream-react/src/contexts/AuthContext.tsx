import { createContext, useContext, useState, useEffect, useCallback, memo } from 'react'
import type { ReactNode } from 'react'

interface User {
  id: number
  username: string
  role: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (token: string, user: User) => void
  logout: () => void
  checkStreamStatus: () => Promise<{ online: boolean; status: string }>
  getStreamToken: () => Promise<string | null>
  refreshToken: () => Promise<boolean>
  clearStreamTokenCache: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = memo(({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null)
  
  // Cache para token de stream
  const [streamToken, setStreamToken] = useState<string | null>(null)
  const [streamTokenExpiry, setStreamTokenExpiry] = useState<number | null>(null)

  const isAuthenticated = !!user && !!token

  // Verificar se há token salvo no localStorage na inicialização
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const savedToken = localStorage.getItem('yustream_token')
        const savedUser = localStorage.getItem('yustream_user')

        if (savedToken && savedUser) {
          // Verificar se o token ainda é válido
          const response = await fetch('/api/auth/verify', {
            headers: {
              'Authorization': `Bearer ${savedToken}`
            }
          })

          if (response.ok) {
            setToken(savedToken)
            setUser(JSON.parse(savedUser))
          } else {
            // Token inválido, limpar storage
            localStorage.removeItem('yustream_token')
            localStorage.removeItem('yustream_user')
          }
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error)
        localStorage.removeItem('yustream_token')
        localStorage.removeItem('yustream_user')
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = (newToken: string, newUser: User) => {
    setToken(newToken)
    setUser(newUser)
    localStorage.setItem('yustream_token', newToken)
    localStorage.setItem('yustream_user', JSON.stringify(newUser))
    
    // Iniciar monitoramento do novo token
    startTokenMonitoring()
  }

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    setStreamToken(null)
    setStreamTokenExpiry(null)
    localStorage.removeItem('yustream_token')
    localStorage.removeItem('yustream_user')
    
    // Limpar intervalo de renovação
    if (refreshInterval) {
      clearInterval(refreshInterval)
      setRefreshInterval(null)
    }
  }, [refreshInterval])

  // Função para verificar se o token está próximo do vencimento
  const isTokenExpiringSoon = (token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const expirationTime = payload.exp * 1000 // Converter para milliseconds
      const currentTime = Date.now()
      const timeUntilExpiry = expirationTime - currentTime
      
      // Renovar se restam menos de 30 minutos (1800000 ms)
      return timeUntilExpiry < 1800000
    } catch (error) {
      console.error('Erro ao verificar expiração do token:', error)
      return true // Se não conseguir decodificar, considerar como expirado
    }
  }

  // Função para renovar o token
  const refreshToken = useCallback(async (): Promise<boolean> => {
    if (!token || !user) {
      return false
    }

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        const newToken = data.token
        
        setToken(newToken)
        localStorage.setItem('yustream_token', newToken)
        
        console.log('Token renovado com sucesso')
        return true
      } else {
        console.log('Falha ao renovar token, fazendo logout')
        logout()
        return false
      }
    } catch (error) {
      console.error('Erro ao renovar token:', error)
      logout()
      return false
    }
  }, [token, user, logout])

  // Função para iniciar o monitoramento automático do token
  const startTokenMonitoring = useCallback(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval)
    }

    // Verificar a cada 5 minutos se o token precisa ser renovado
    const interval = setInterval(async () => {
      if (token && isTokenExpiringSoon(token)) {
        console.log('Token próximo do vencimento, renovando...')
        await refreshToken()
      }
    }, 5 * 60 * 1000) // 5 minutos

    setRefreshInterval(interval)
  }, [refreshInterval, token, refreshToken])

  // Função para parar o monitoramento
  const stopTokenMonitoring = useCallback(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      setRefreshInterval(null)
    }
  }, [refreshInterval])

  // Função para verificar se o token de stream ainda é válido
  const isStreamTokenValid = (): boolean => {
    if (!streamToken || !streamTokenExpiry) {
      return false
    }
    
    const currentTime = Date.now()
    // Considerar válido se restam mais de 5 minutos (300000 ms)
    return streamTokenExpiry - currentTime > 300000
  }

  // Função para limpar o cache do token de stream
  const clearStreamTokenCache = () => {
    console.log('Limpando cache do token de stream')
    setStreamToken(null)
    setStreamTokenExpiry(null)
  }

  // Iniciar monitoramento de token quando usuário estiver autenticado
  useEffect(() => {
    if (isAuthenticated && token) {
      // Verificar se o token precisa ser renovado imediatamente
      if (isTokenExpiringSoon(token)) {
        console.log('Token próximo do vencimento na inicialização, renovando...')
        refreshToken()
      }
      
      // Iniciar monitoramento automático
      startTokenMonitoring()
    } else {
      // Parar monitoramento se não estiver autenticado
      stopTokenMonitoring()
    }

    // Cleanup ao desmontar
    return () => {
      stopTokenMonitoring()
    }
  }, [isAuthenticated, token, refreshToken, startTokenMonitoring, stopTokenMonitoring])

  const checkStreamStatus = async (): Promise<{ online: boolean; status: string }> => {
    if (!token) {
      throw new Error('Usuário não autenticado')
    }

    try {
      const response = await fetch('/api/stream/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Falha ao verificar status da stream')
      }

      const data = await response.json()
      return { online: data.online, status: data.status }
    } catch (error) {
      console.error('Erro ao verificar status da stream:', error)
      return { online: false, status: 'error' }
    }
  }

  const getStreamToken = async (): Promise<string | null> => {
    if (!token) {
      throw new Error('Usuário não autenticado')
    }

    // Verificar se já temos um token de stream válido em cache
    if (isStreamTokenValid()) {
      console.log('Usando token de stream do cache')
      return streamToken
    }

    try {
      console.log('Obtendo novo token de stream do servidor')
      const response = await fetch('/api/stream/token', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Falha ao obter token de stream')
      }

      const data = await response.json()
      const newStreamToken = data.streamToken
      
      // Calcular tempo de expiração (assumindo 6 horas como no backend)
      const expiryTime = Date.now() + (6 * 60 * 60 * 1000) // 6 horas
      
      // Atualizar cache
      setStreamToken(newStreamToken)
      setStreamTokenExpiry(expiryTime)
      
      console.log('Token de stream obtido e armazenado em cache')
      return newStreamToken
    } catch (error) {
      console.error('Erro ao obter token de stream:', error)
      return null
    }
  }

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkStreamStatus,
    getStreamToken,
    refreshToken,
    clearStreamTokenCache
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
})

AuthProvider.displayName = 'AuthProvider'
