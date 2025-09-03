import { useEffect, useState } from 'react'
import { Snackbar, Alert } from '@mui/material'
import { CheckCircle, AlertCircle, Info } from 'lucide-react'

interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info'
  onClose: () => void
}

const Toast = ({ message, type, onClose }: ToastProps) => {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    // Auto close após 4 segundos
    const timer = setTimeout(() => {
      handleClose()
    }, 4000)

    return () => clearTimeout(timer)
  }, [])

  const handleClose = () => {
    setOpen(false)
    setTimeout(onClose, 300)
  }

  const getSeverity = () => {
    switch (type) {
      case 'success':
        return 'success'
      case 'error':
        return 'error'
      case 'info':
        return 'info'
      default:
        return 'info'
    }
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
    <Snackbar
      open={open}
      autoHideDuration={4000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      sx={{ mt: 8 }}
    >
      <Alert
        onClose={handleClose}
        severity={getSeverity() as any}
        icon={getIcon()}
        variant="filled"
        sx={{ 
          width: '100%',
          '& .MuiAlert-message': {
            width: '100%'
          }
        }}
      >
        {message}
      </Alert>
    </Snackbar>
  )
}

export default Toast
