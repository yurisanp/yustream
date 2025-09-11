import { useState, useEffect, memo, useCallback } from 'react'
import { Box, CircularProgress, Typography, Backdrop } from '@mui/material'
import './App.css'
import OvenStreamPlayer from './components/OvenStreamPlayer'
import Toast from './components/Toast'
import Login from './components/Login'
import StremioConfig from './components/StremioConfig'
import AdminScreen from './components/AdminScreen'
import { AuthProvider, useAuth } from './contexts/AuthContext'

export interface ToastMessage {
  message: string
  type: 'success' | 'error' | 'info'
  id: number
}

const AppContent = memo(() => {
  const { isAuthenticated, isLoading, login, user } = useAuth()
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [currentPage, setCurrentPage] = useState<'main' | 'stremio-config' | 'admin'>('main')

  // Detectar rota atual
  useEffect(() => {
    const path = window.location.pathname
    if (path === '/configure') {
      setCurrentPage('stremio-config')
    } else if (path === '/admin') {
      setCurrentPage('admin')
    } else {
      setCurrentPage('main')
    }
  }, [])

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    // Usar timestamp mais específico e um número aleatório para garantir unicidade
    const id = Date.now() + Math.random()
    const toast: ToastMessage = { message, type, id }
    
    setToasts(prev => [...prev, toast])
    
    // Remove toast após 4 segundos
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const handleBackToMain = useCallback(() => {
    setCurrentPage('main')
    window.history.pushState({}, '', '/')
  }, [])

  const handleNavigateToStremio = useCallback(() => {
    setCurrentPage('stremio-config')
    window.history.pushState({}, '', '/configure')
  }, [])

  const handleNavigateToAdmin = useCallback(() => {
    setCurrentPage('admin')
    window.history.pushState({}, '', '/admin')
  }, [])

  // Mostrar loading durante verificação de autenticação
  if (isLoading) {
    return (
      <Backdrop
        sx={{ 
          color: '#fff', 
          zIndex: (theme) => theme.zIndex.drawer + 1,
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)'
        }}
        open={true}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress 
            size={60} 
            thickness={4}
            sx={{ 
              color: 'primary.main',
              mb: 2
            }} 
          />
          <Typography variant="h6" color="text.primary">
            Carregando...
          </Typography>
        </Box>
      </Backdrop>
    )
  }

  // Renderizar página do Stremio sem necessidade de autenticação
  if (currentPage === 'stremio-config') {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <StremioConfig 
          showToast={showToast} 
          onBack={handleBackToMain}
          isAuthenticated={isAuthenticated}
          currentUser={isAuthenticated ? { email: 'user@yustream.com', username: 'user' } : null}
        />
        
        {/* Toast Container */}
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </Box>
    )
  }

  // Renderizar página de Admin (requer autenticação)
  if (currentPage === 'admin') {
    if (!isAuthenticated) {
      return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
          <Login onLogin={login} showToast={showToast} />
          {toasts.map(toast => (
            <Toast
              key={toast.id}
              message={toast.message}
              type={toast.type}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </Box>
      )
    }

    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <AdminScreen 
          showToast={showToast} 
          onBack={handleBackToMain}
          user={user}
        />
        
        {/* Toast Container */}
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {!isAuthenticated ? (
        <Login onLogin={login} showToast={showToast} />
      ) : (
        <OvenStreamPlayer 
          showToast={showToast} 
          onNavigateToStremio={handleNavigateToStremio}
          onNavigateToAdmin={handleNavigateToAdmin}
        />
      )}

      {/* Toast Container */}
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </Box>
  )
})

AppContent.displayName = 'AppContent'

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
