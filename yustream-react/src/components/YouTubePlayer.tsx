import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Toolbar,
  Typography
} from '@mui/material'
import { Logout, Refresh, Settings, OpenInNew } from '@mui/icons-material'
import { useAuth } from '../hooks/useAuth'
import {
  getPlayerConfig as fetchPlayerConfig
} from '../services/playerConfigService'
import type { PlayerConfig } from '../types/playerConfig'

interface PlayerProps {
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
  onNavigateToAdmin: () => void
}

const AUTO_REFRESH_INTERVAL = 30000

const VimeoPlayer = ({ showToast, onNavigateToAdmin }: PlayerProps) => {
  const { user, token, logout } = useAuth()
  const [config, setConfig] = useState<PlayerConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasLoadedRef = useRef(false)
  const lastConfigRef = useRef<PlayerConfig | null>(null)

  const loadConfig = useCallback(
    async (mode: 'initial' | 'silent' = 'initial') => {
      if (mode === 'initial') {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      try {
        setError(null)
        const data = await fetchPlayerConfig({ token: token ?? undefined })
        setConfig(data)
        if (
          mode === 'silent' &&
          data?.videoId &&
          data.videoId !== lastConfigRef.current?.videoId
        ) {
          showToast('Configuração do player atualizada', 'info')
        }
        lastConfigRef.current = data
      } catch (err) {
        console.error('Erro ao carregar configuração do player:', err)
        setError('Não foi possível carregar a configuração do player.')
        if (mode === 'initial' || !hasLoadedRef.current) {
          showToast('Erro ao carregar configuração do player', 'error')
        }
      } finally {
        if (mode === 'initial') {
          setLoading(false)
        } else {
          setRefreshing(false)
        }
        hasLoadedRef.current = true
      }
    },
    [showToast, token]
  )

  useEffect(() => {
    loadConfig('initial')

    const intervalId = window.setInterval(() => {
      loadConfig('silent')
    }, AUTO_REFRESH_INTERVAL)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [loadConfig])

  const embedUrl = useMemo(() => {
    if (!config?.videoId) {
      return null
    }

    return `https://vimeo.com/event/${config.videoId}/embed`
  }, [config])

  const externalVideoUrl = useMemo(() => {
    if (!config?.videoId) {
      return null
    }

    return `https://vimeo.com/event/${config.videoId}`
  }, [config])

  const handleManualRefresh = useCallback(() => {
    loadConfig('initial')
  }, [loadConfig])

  const handleLogout = useCallback(() => {
    logout()
    showToast('Logout realizado com sucesso', 'info')
  }, [logout, showToast])

  const handleOpenExternal = useCallback(() => {
    if (!externalVideoUrl) {
      showToast('Nenhum evento configurado para abrir.', 'info')
      return
    }

    window.open(externalVideoUrl, '_blank', 'noopener,noreferrer')
  }, [externalVideoUrl, showToast])

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <AppBar position="static" elevation={0}>
        <Toolbar
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 2
          }}
        >
          <Box>
            <Typography variant="h6" component="div">
              Yustream Player
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {config?.videoId ? 'Transmissão atual configurada' : 'Nenhuma transmissão configurada'}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {refreshing && <CircularProgress size={20} color="inherit" />}
            <IconButton
              onClick={handleManualRefresh}
              color="inherit"
              disabled={loading}
            >
              <Refresh />
            </IconButton>
            <Button
              variant="outlined"
              onClick={handleOpenExternal}
              startIcon={<OpenInNew />}
              sx={{
                color: 'white',
                borderColor: 'rgba(255,255,255,0.3)',
                display: { xs: 'none', sm: 'flex' }
              }}
              disabled={!externalVideoUrl}
            >
              Abrir no Vimeo
            </Button>
            <IconButton
              onClick={handleOpenExternal}
              color="inherit"
              sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
              disabled={!externalVideoUrl}
            >
              <OpenInNew />
            </IconButton>
            {user?.role === 'admin' && (
              <Button
                variant="outlined"
                onClick={onNavigateToAdmin}
                startIcon={<Settings />}
                sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
              >
                Admin
              </Button>
            )}
            <IconButton color="inherit" onClick={handleLogout}>
              <Logout />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2
        }}
      >
        {loading ? (
          <Paper
            elevation={0}
            sx={{
              p: 4,
              textAlign: 'center',
              bgcolor: 'background.paper',
              borderRadius: 2,
              minWidth: { xs: 'auto', sm: 360 }
            }}
          >
            <CircularProgress size={48} sx={{ mb: 2 }} />
            <Typography variant="h6">Carregando player...</Typography>
          </Paper>
        ) : error ? (
          <Paper
            elevation={0}
            sx={{
              p: 4,
              textAlign: 'center',
              bgcolor: 'background.paper',
              borderRadius: 2,
              minWidth: { xs: 'auto', sm: 360 }
            }}
          >
            <Typography variant="h6" gutterBottom>
              Erro ao carregar player
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {error}
            </Typography>
            <Button variant="contained" onClick={handleManualRefresh}>
              Tentar novamente
            </Button>
          </Paper>
        ) : !embedUrl ? (
          <Paper
            elevation={0}
            sx={{
              p: 4,
              textAlign: 'center',
              bgcolor: 'background.paper',
              borderRadius: 2,
              minWidth: { xs: 'auto', sm: 360 }
            }}
          >
            <Typography variant="h6" gutterBottom>
              Nenhum evento configurado
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Solicite ao administrador que defina um evento no painel.
            </Typography>
          </Paper>
        ) : (
          <Box
            sx={{
              width: '100%',
              maxWidth: 1280,
              aspectRatio: '16 / 9',
              bgcolor: 'black',
              borderRadius: 2,
              overflow: 'hidden',
              boxShadow: ({ shadows }) => shadows[8]
            }}
          >
            <iframe
              title={config?.videoId ? 'Yustream Live' : 'Yustream Player'}
              src={embedUrl}
              width="100%"
              height="100%"
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              style={{ border: 0, display: 'block', width: '100%', height: '100%' }}
            />
          </Box>
        )}
      </Box>

      {config?.updatedAt && (
        <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'background.paper' }}>
          <Typography variant="caption" color="text.secondary">
            Atualizado em {new Date(config.updatedAt).toLocaleString('pt-BR')}
            {config.updatedBy ? ` por ${config.updatedBy}` : ''}
          </Typography>
        </Box>
      )}
    </Box>
  )
}

export default VimeoPlayer

