import { useState, useEffect, memo, useCallback, startTransition } from 'react'
import { Box, CircularProgress, Typography, Backdrop } from '@mui/material'
import './App.css'
import YouTubePlayer from './components/YouTubePlayer'
import Toast from './components/Toast'
import Login from './components/Login'
import AdminScreen from './components/AdminScreen'
import { AuthProvider } from './contexts/AuthContextProvider'
import { useAuth } from './hooks/useAuth'
import { useOptimizedToast } from './hooks/useOptimizedToast'

const AppContent = memo(() => {
  const { isAuthenticated, isLoading, login, user } = useAuth()
  const { toasts, showToast, removeToast } = useOptimizedToast()
  const [currentPage, setCurrentPage] = useState<'player' | 'admin'>('player')

  useEffect(() => {
    const syncWithLocation = () => {
      const path = window.location.pathname
      startTransition(() => {
        setCurrentPage(path === '/admin' ? 'admin' : 'player')
      })
    }

    syncWithLocation()
    window.addEventListener('popstate', syncWithLocation)

    return () => {
      window.removeEventListener('popstate', syncWithLocation)
    }
  }, [])

  // Toast functions are now provided by useOptimizedToast hook

  const handleBackToMain = useCallback(() => {
      setCurrentPage('player')
      window.history.pushState({}, '', '/')
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
        <YouTubePlayer 
          showToast={showToast} 
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
