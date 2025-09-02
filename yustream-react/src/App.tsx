import { useState, useEffect } from 'react'
import './App.css'
import OvenStreamPlayer from './components/OvenStreamPlayer'
import Toast from './components/Toast'
import Login from './components/Login'
import StremioConfig from './components/StremioConfig'
import { AuthProvider, useAuth } from './contexts/AuthContext'

export interface ToastMessage {
  message: string
  type: 'success' | 'error' | 'info'
  id: number
}

const AppContent = () => {
  const { isAuthenticated, isLoading, login } = useAuth()
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [currentPage, setCurrentPage] = useState<'main' | 'stremio-config'>('main')

  // Detectar se é rota do Stremio
  useEffect(() => {
    const path = window.location.pathname
    if (path === '/configure') {
      setCurrentPage('stremio-config')
    } else {
      setCurrentPage('main')
    }
  }, [])

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    // Usar timestamp mais específico e um número aleatório para garantir unicidade
    const id = Date.now() + Math.random()
    const toast: ToastMessage = { message, type, id }
    
    setToasts(prev => [...prev, toast])
    
    // Remove toast após 4 segundos
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const handleBackToMain = () => {
    setCurrentPage('main')
    window.history.pushState({}, '', '/')
  }

  // Mostrar loading durante verificação de autenticação
  if (isLoading) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="loading-spinner" />
          <p>Carregando...</p>
        </div>
      </div>
    )
  }

  // Renderizar página do Stremio sem necessidade de autenticação
  if (currentPage === 'stremio-config') {
    return (
      <div className="app">
        <StremioConfig 
          showToast={showToast} 
          onBack={handleBackToMain}
          isAuthenticated={isAuthenticated}
          currentUser={isAuthenticated ? { email: 'user@yustream.com', username: 'user' } : null}
        />
        
        {/* Toast Container */}
        <div className="toast-container">
          {toasts.map(toast => (
            <Toast
              key={toast.id}
              message={toast.message}
              type={toast.type}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      {!isAuthenticated ? (
        <Login onLogin={login} showToast={showToast} />
      ) : (
        <OvenStreamPlayer showToast={showToast} />
      )}

      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
