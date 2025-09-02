import { useState } from 'react'
import { User, Lock, Eye, EyeOff } from 'lucide-react'
import './Login.css'

interface LoginProps {
  onLogin: (token: string, user: any) => void
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

const Login = ({ onLogin, showToast }: LoginProps) => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!credentials.username || !credentials.password) {
      showToast('Por favor, preencha todos os campos', 'error')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials)
      })

      const data = await response.json()

      if (response.ok) {
        localStorage.setItem('yustream_token', data.token)
        localStorage.setItem('yustream_user', JSON.stringify(data.user))
        onLogin(data.token, data.user)
        showToast('Login realizado com sucesso!', 'success')
      } else {
        showToast(data.message || 'Erro ao fazer login', 'error')
      }
    } catch (error) {
      console.error('Erro no login:', error)
      showToast('Erro de conexão. Tente novamente.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setCredentials(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>YuStream</h1>
          <p>Faça login para acessar a stream</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <div className="input-wrapper">
              <User className="input-icon" size={20} />
              <input
                type="text"
                placeholder="Usuário"
                value={credentials.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                disabled={isLoading}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="input-group">
            <div className="input-wrapper">
              <Lock className="input-icon" size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Senha"
                value={credentials.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                disabled={isLoading}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="loading-spinner" />
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <div className="login-footer">
          <button 
            type="button"
            className="stremio-link-btn"
            onClick={() => window.location.href = '/configure'}
          >
            🎬 Configurar Addon Stremio
          </button>
        </div>
      </div>
    </div>
  )
}

export default Login
