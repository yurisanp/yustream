import { useState, useEffect, useCallback, memo, useMemo, startTransition } from 'react'
import type { ReactNode } from 'react'
import type { AuthContextType, User } from './AuthContextType'
import { AuthContext } from './AuthContext'

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = memo(({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Cache para token de stream
  const [streamToken, setStreamToken] = useState<string | null>(null)
  const [streamTokenExpiry, setStreamTokenExpiry] = useState<number | null>(null)

  const isAuthenticated = useMemo(() => !!user && !!token, [user, token])

  const logout = useCallback(() => {
    startTransition(() => {
      setToken(null)
      setUser(null)
      setStreamToken(null)
      setStreamTokenExpiry(null)
      localStorage.removeItem('yustream_token')
      localStorage.removeItem('yustream_user')
      
    })
  }, [])

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

  const login = useCallback((newToken: string, newUser: User) => {
    startTransition(() => {
      setToken(newToken)
      setUser(newUser)
      localStorage.setItem('yustream_token', newToken)
      localStorage.setItem('yustream_user', JSON.stringify(newUser))
      
    })
  }, [])

  // Função para verificar se o token de stream ainda é válido
  const isStreamTokenValid = useCallback((): boolean => {
    if (!streamToken || !streamTokenExpiry) {
      return false
    }
    
    const currentTime = Date.now()
    // Considerar válido se restam mais de 5 minutos (300000 ms)
    return streamTokenExpiry - currentTime > 300000
  }, [streamToken, streamTokenExpiry]);

  const getStreamToken = useCallback(async (): Promise<string | null> => {
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
  }, [token, streamToken, isStreamTokenValid])

  const value: AuthContextType = useMemo(() => ({
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout,
    getStreamToken,
  }), [user, token, isAuthenticated, isLoading, login, logout, getStreamToken])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
})

AuthProvider.displayName = 'AuthProvider'
