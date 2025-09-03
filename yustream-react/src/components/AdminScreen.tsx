
import { 
  Box, 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  useMediaQuery,
  useTheme,
  Container
} from '@mui/material'
import { ArrowBack } from '@mui/icons-material'
import AdminPanel from './AdminPanel'

interface AdminScreenProps {
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
  onBack: () => void
  user: { username: string; role: string } | null
}

const AdminScreen = ({ showToast, onBack, user }: AdminScreenProps) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Header responsivo */}
      <AppBar
        position="static"
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <Toolbar sx={{ 
          px: { xs: 1, sm: 2, md: 3 },
          minHeight: { xs: 56, sm: 64 },
          justifyContent: 'space-between'
        }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={onBack}
            sx={{
              color: 'text.primary',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.1)'
              }
            }}
          >
            {isMobile ? 'Voltar' : 'Voltar ao Player'}
          </Button>
          
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            flexDirection: { xs: 'column', sm: 'row' }
          }}>
            <Typography 
              variant={isMobile ? "body2" : "body1"} 
              color="text.primary"
              sx={{ fontWeight: 600 }}
            >
              Administrador: {user?.username}
            </Typography>
            <Typography 
              variant="caption" 
              color="primary.main"
              sx={{ 
                bgcolor: 'rgba(25, 118, 210, 0.1)',
                px: 1,
                py: 0.5,
                borderRadius: 1,
                fontSize: '0.75rem',
                fontWeight: 600
              }}
            >
              {user?.role}
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>
      
      {/* Conteúdo responsivo */}
      <Box sx={{ flex: 1, p: { xs: 1, sm: 2, md: 3 } }}>
        <Container maxWidth="xl" sx={{ height: '100%' }}>
          <AdminPanel 
            showToast={showToast}
            onClose={onBack}
          />
        </Container>
      </Box>
    </Box>
  )
}

export default AdminScreen
