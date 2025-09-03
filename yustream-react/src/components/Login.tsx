import { useState, memo } from 'react'
import { 
  Box, 
  Card, 
  CardContent, 
  TextField, 
  Button, 
  Typography, 
  InputAdornment, 
  IconButton,
  CircularProgress,
  Container
} from '@mui/material'
import { 
  Person, 
  Lock, 
  Visibility, 
  VisibilityOff,
  Movie
} from '@mui/icons-material'

interface LoginProps {
  onLogin: (token: string, user: any) => void
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

const Login = memo(({ onLogin, showToast }: LoginProps) => {
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
    <Container 
      component="main" 
      maxWidth="sm"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4
      }}
    >
      <Card 
        elevation={8}
        sx={{ 
          width: '100%',
          maxWidth: 400,
          background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.1) 0%, rgba(220, 0, 78, 0.1) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography 
              variant="h3" 
              component="h1" 
              gutterBottom
              sx={{ 
                fontWeight: 700,
                background: 'linear-gradient(45deg, #1976d2, #dc004e)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 2
              }}
            >
              YuStream
            </Typography>
            <Typography 
              variant="body1" 
              color="text.secondary"
              sx={{ fontSize: '1.1rem' }}
            >
              Faça login para acessar a stream
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="username"
              label="Usuário"
              name="username"
              autoComplete="username"
              autoFocus
              value={credentials.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              disabled={isLoading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Person color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />

            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Senha"
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="current-password"
              value={credentials.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              disabled={isLoading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      onMouseDown={(e) => e.preventDefault()}
                      edge="end"
                      disabled={isLoading}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 3 }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={isLoading}
              sx={{ 
                mt: 2, 
                mb: 2, 
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 600,
                background: 'linear-gradient(45deg, #1976d2, #dc004e)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #1565c0, #9a0036)',
                }
              }}
            >
              {isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Entrar'
              )}
            </Button>

            <Button
              fullWidth
              variant="outlined"
              startIcon={<Movie />}
              onClick={() => window.location.href = '/configure'}
              sx={{ 
                mt: 1,
                py: 1.5,
                fontSize: '1rem',
                borderColor: 'rgba(255, 255, 255, 0.3)',
                color: 'text.primary',
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: 'rgba(25, 118, 210, 0.1)',
                }
              }}
            >
              Configurar Addon Stremio
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  )
})

Login.displayName = 'Login'

export default Login
