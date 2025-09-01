import { useEffect, useState } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import './Toast.css'

interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info'
  onClose: () => void
}

const Toast = ({ message, type, onClose }: ToastProps) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Mostrar toast
    setTimeout(() => setIsVisible(true), 100)
    
    // Auto close após 4 segundos
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300)
    }, 4000)

    return () => clearTimeout(timer)
  }, [onClose])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 300)
  }

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={20} />
      case 'error':
        return <AlertCircle size={20} />
      case 'info':
        return <Info size={20} />
      default:
        return <Info size={20} />
    }
  }

  return (
    <div className={`toast toast-${type} ${isVisible ? 'show' : ''}`}>
      <div className="toast-content">
        {getIcon()}
        <span className="toast-message">{message}</span>
      </div>
      <button className="toast-close" onClick={handleClose}>
        <X size={16} />
      </button>
    </div>
  )
}

export default Toast
