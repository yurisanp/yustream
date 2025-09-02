import { createContext, useContext, useState, useEffect } from 'react'
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

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('yustream_token')
    localStorage.removeItem('yustream_user')
  }

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

    try {
      const response = await fetch('/api/stream/token', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Falha ao obter token de stream')
      }

      const data = await response.json()
      return data.streamToken
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
    getStreamToken
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
