import { useState } from 'react'
import { Play, Download, Eye, EyeOff, ArrowLeft, Zap } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import './StremioConfig.css'

interface StremioConfigProps {
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
  onBack: () => void
  isAuthenticated?: boolean
  currentUser?: { email: string; username: string } | null
}

const StremioConfig = ({ showToast, onBack }: StremioConfigProps) => {
  const { user, isAuthenticated } = useAuth()
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Instalação rápida para usuário logado
  const handleQuickInstall = async () => {
    if (!user) return
    
    setIsLoading(true)
    
    try {
      // Usar dados do usuário logado
      const credentialsObj = {
        email: `${user.username}@yustream.com`, // Gerar email baseado no username
        password: 'logged-in-user' // Placeholder - será validado pelo token JWT no backend
      }
      
      // Converter para JSON e depois para URL encoding
      const jsonCredentials = JSON.stringify(credentialsObj)
      const encodedCredentials = encodeURIComponent(jsonCredentials)
      
      // URL do addon com credenciais encoded corretamente
      const addonUrl = `${window.location.origin}/${encodedCredentials}/manifest.json`
      
      // URL para instalar no Stremio
      const stremioUrl = `stremio://${addonUrl.replace('http://', '').replace('https://', '')}`
      
      console.log('Quick Install - Stremio URL:', stremioUrl)
      
      showToast('Instalando addon automaticamente...', 'info')
      
      // Tentar abrir no Stremio
      window.location.href = stremioUrl
      
      // Fallback para web após 2 segundos
      setTimeout(() => {
        const webUrl = 'https://web.stremio.com/#/addons?addon=' + encodeURIComponent(addonUrl)
        
        setIsLoading(false)
        showToast('Addon instalado! Verifique o Stremio.', 'success')
        
        if (confirm('✅ Addon instalado!\n\nSe o Stremio não abriu, clique OK para abrir no navegador:')) {
          window.open(webUrl, '_blank')
        }
      }, 2000)

    } catch (error) {
      console.error('Erro na instalação rápida:', error)
      showToast('Erro na instalação rápida. Use o formulário manual.', 'error')
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!credentials.email || !credentials.password) {
      showToast('Por favor, preencha todos os campos', 'error')
      return
    }

    setIsLoading(true)

    try {
      // Criar objeto de credenciais
      const credentialsObj = {
        email: credentials.email,
        password: credentials.password
      }
      
      // Converter para JSON e depois para URL encoding
      const jsonCredentials = JSON.stringify(credentialsObj)
      const encodedCredentials = encodeURIComponent(jsonCredentials)
      
      // URL do addon com credenciais encoded corretamente
      const addonUrl = `${window.location.origin}/${encodedCredentials}/manifest.json`
      
      console.log('Credentials Object:', credentialsObj)
      console.log('JSON Credentials:', jsonCredentials)
      console.log('Encoded Credentials:', encodedCredentials)
      console.log('Addon URL:', addonUrl)
      
      // URL para instalar no Stremio
      const stremioUrl = `stremio://${addonUrl.replace('http://', '').replace('https://', '')}`
      
      console.log('Stremio URL:', stremioUrl)
      
      showToast('Redirecionando para o Stremio...', 'info')
      
      // Tentar abrir no Stremio
      window.location.href = stremioUrl
      
      // Fallback para web após 3 segundos
      setTimeout(() => {
        const webUrl = 'https://web.stremio.com/#/addons?addon=' + encodeURIComponent(addonUrl)
        
        setIsLoading(false)
        
        if (confirm('✅ Addon configurado!\n\nSe o Stremio não abriu automaticamente, clique OK para abrir no navegador:')) {
          window.open(webUrl, '_blank')
        }
      }, 3000)

    } catch (error) {
      console.error('Erro ao configurar addon:', error)
      showToast('Erro ao configurar addon. Tente novamente.', 'error')
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
    <div className="stremio-config-container">
      <div className="stremio-config-card">
        <div className="stremio-header">
          <button className="back-btn" onClick={onBack}>
            <ArrowLeft size={20} />
            Voltar
          </button>
          <div className="header-content">
            <Play className="stremio-icon" size={32} />
            <h1>Stremio Addon</h1>
            <p>
              {isAuthenticated 
                ? `Olá, ${user?.username}! Configure o addon para o Stremio`
                : 'Configure suas credenciais para assistir no Stremio'
              }
            </p>
          </div>
        </div>

        {/* Instalação rápida para usuários logados */}
        {isAuthenticated && (
          <div className="quick-install">
            <h3>⚡ Instalação Rápida</h3>
            <p>Você já está logado! Instale o addon automaticamente:</p>
            <button 
              className="quick-install-btn"
              onClick={handleQuickInstall}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="loading-spinner" />
                  Instalando...
                </>
              ) : (
                <>
                  <Zap size={20} />
                  Instalar Agora ({user?.username})
                </>
              )}
            </button>
            
            <div className="divider">
              <span>ou configure manualmente</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="stremio-form">
          <div className="input-group">
            <div className="input-wrapper">
              <input
                type="email"
                placeholder="📧 Email"
                value={credentials.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                disabled={isLoading}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="input-group">
            <div className="input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="🔒 Senha"
                value={credentials.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                disabled={isLoading}
                autoComplete="current-password"
                required
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
            className="install-button"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="loading-spinner" />
                Configurando...
              </>
            ) : (
              <>
                <Download size={20} />
                Instalar no Stremio
              </>
            )}
          </button>
        </form>

        <div className="instructions">
          <h3>📋 Como usar:</h3>
          <ol>
            <li>Digite suas credenciais do YuStream</li>
            <li>Clique em "Instalar no Stremio"</li>
            <li>O Stremio abrirá automaticamente</li>
            <li>Vá para "YuStream Live" para assistir</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

export default StremioConfig
