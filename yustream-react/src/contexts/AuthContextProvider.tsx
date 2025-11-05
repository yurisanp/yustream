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

  const isAuthenticated = useMemo(() => !!user && !!token, [user, token])

  const logout = useCallback(() => {
    startTransition(() => {
      setToken(null)
      setUser(null)
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

  const value: AuthContextType = useMemo(() => ({
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout,
  }), [user, token, isAuthenticated, isLoading, login, logout])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
})

AuthProvider.displayName = 'AuthProvider'
