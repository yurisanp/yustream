import { useState } from 'react'
import './App.css'
import OvenStreamPlayer from './components/OvenStreamPlayer'
import Toast from './components/Toast'

export interface ToastMessage {
  message: string
  type: 'success' | 'error' | 'info'
  id: number
}

function App() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

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

  return (
    
    <div className="app">
      {/* OvenPlayer - Tela cheia */}
      <OvenStreamPlayer showToast={showToast} />

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

export default App
