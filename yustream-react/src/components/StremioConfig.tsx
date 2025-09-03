import { useState, useEffect } from 'react'
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
  Container,
  useMediaQuery,
  useTheme,
  Stack,
  Paper,
  Divider
} from '@mui/material'
import { 
  PlayArrow, 
  Download, 
  Visibility, 
  VisibilityOff, 
  ArrowBack,
  Person,
  Lock
} from '@mui/icons-material'
import { useAuth } from '../contexts/AuthContext'

interface StremioConfigProps {
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
  onBack: () => void
  isAuthenticated?: boolean
  currentUser?: { email: string; username: string } | null
}

const StremioConfig = ({ showToast, onBack }: StremioConfigProps) => {
  const { user, isAuthenticated } = useAuth()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Preencher username quando usuário estiver logado
  useEffect(() => {
    if (isAuthenticated && user?.username) {
      setCredentials(prev => ({
        ...prev,
        username: user.username
      }))
    }
  }, [isAuthenticated, user])



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!credentials.username || !credentials.password) {
      showToast('Por favor, preencha todos os campos', 'error')
      return
    }

    setIsLoading(true)

    try {
      // Criar objeto de credenciais
      const credentialsObj = {
        username: credentials.username,
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
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        background: 'linear-gradient(135deg, #0c0c0c 0%, #1a1a1a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2, sm: 3 }
      }}
    >
      <Container 
        maxWidth="sm"
        sx={{
          width: '100%',
          maxWidth: { xs: '100%', sm: 600, md: 700 }
        }}
      >
        <Card
          elevation={8}
          sx={{
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 3,
            overflow: 'visible'
          }}
        >
          <CardContent sx={{ p: { xs: 3, sm: 4, md: 5 } }}>
            {/* Header */}
            <Box sx={{ mb: 4, position: 'relative' }}>
              <Button
                startIcon={<ArrowBack />}
                onClick={onBack}
                sx={{
                  position: { xs: 'relative', sm: 'absolute' },
                  top: { sm: 0 },
                  left: { sm: 0 },
                  mb: { xs: 2, sm: 0 },
                  color: 'text.primary',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.1)'
                  }
                }}
              >
                Voltar
              </Button>
              
              <Box sx={{ textAlign: 'center', mt: { xs: 0, sm: 2 } }}>
                <PlayArrow 
                  sx={{ 
                    fontSize: { xs: 40, sm: 48 },
                    color: 'primary.main',
                    mb: 2,
                    filter: 'drop-shadow(0 4px 12px rgba(102, 126, 234, 0.3))'
                  }} 
                />
                <Typography 
                  variant={isMobile ? "h4" : "h3"} 
                  component="h1"
                  sx={{
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 2
                  }}
                >
                  Stremio Addon
                </Typography>
                <Typography 
                  variant="body1" 
                  color="text.secondary"
                  sx={{ 
                    fontSize: { xs: '1rem', sm: '1.1rem' },
                    maxWidth: 400,
                    mx: 'auto'
                  }}
                >
                  {isAuthenticated 
                    ? `Olá, ${user?.username}! Configure o addon para o Stremio`
                    : 'Configure suas credenciais para assistir no Stremio'
                  }
                </Typography>
              </Box>
            </Box>

            {/* Form */}
            <Box component="form" onSubmit={handleSubmit} sx={{ mb: 4 }}>
              <Stack spacing={3}>
                <TextField
                  fullWidth
                  label="Username"
                  value={credentials.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  disabled={isLoading || isAuthenticated}
                  autoComplete="username"
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Person color="action" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'rgba(255, 255, 255, 0.05)',
                      '& fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'primary.main',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'text.secondary',
                    },
                    '& .MuiInputBase-input': {
                      color: 'text.primary',
                    }
                  }}
                />

                <TextField
                  fullWidth
                  label="Senha"
                  type={showPassword ? 'text' : 'password'}
                  value={credentials.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={isLoading}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'rgba(255, 255, 255, 0.05)',
                      '& fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'primary.main',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'text.secondary',
                    },
                    '& .MuiInputBase-input': {
                      color: 'text.primary',
                    }
                  }}
                />

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={isLoading}
                  startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <Download />}
                  sx={{
                    py: { xs: 1.5, sm: 2 },
                    fontSize: { xs: '1rem', sm: '1.1rem' },
                    fontWeight: 600,
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #5a6fd8, #6a4190)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 25px rgba(102, 126, 234, 0.3)',
                    },
                    '&:disabled': {
                      background: 'rgba(255, 255, 255, 0.1)',
                      transform: 'none',
                      boxShadow: 'none'
                    }
                  }}
                >
                  {isLoading ? 'Configurando...' : 'Instalar no Stremio'}
                </Button>
              </Stack>
            </Box>

            {/* Instructions */}
            <Paper
              elevation={0}
              sx={{
                bgcolor: 'rgba(102, 126, 234, 0.1)',
                border: '1px solid rgba(102, 126, 234, 0.2)',
                borderRadius: 2,
                p: 3
              }}
            >
              <Typography 
                variant="h6" 
                color="primary.main"
                sx={{ 
                  mb: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  fontSize: { xs: '1.1rem', sm: '1.2rem' }
                }}
              >
                📋 Como usar:
              </Typography>
              
              <Stack spacing={1} sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  1. Digite seu username e senha do YuStream
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  2. Clique em "Instalar no Stremio"
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  3. O Stremio abrirá automaticamente
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  4. Vá para "YuStream Live" para assistir
                </Typography>
              </Stack>

              {isAuthenticated && (
                <>
                  <Divider sx={{ my: 2, borderColor: 'rgba(102, 126, 234, 0.2)' }} />
                  <Box
                    sx={{
                      bgcolor: 'rgba(46, 213, 115, 0.1)',
                      border: '1px solid rgba(46, 213, 115, 0.2)',
                      borderRadius: 1,
                      p: 2,
                      textAlign: 'center'
                    }}
                  >
                    <Typography variant="body2" color="success.main" sx={{ fontWeight: 500 }}>
                      ✅ Seu username já foi preenchido automaticamente!
                    </Typography>
                  </Box>
                </>
              )}
            </Paper>
          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}

export default StremioConfig
