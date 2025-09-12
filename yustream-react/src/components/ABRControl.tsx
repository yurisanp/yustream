import React, { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  Grid,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Paper,
  IconButton,
  Tooltip
} from '@mui/material'
import {
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon
} from '@mui/icons-material'
import abrService, { type ABRConfig, type StreamQuality } from '../services/abrService'

interface ABRControlProps {
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

const ABRControl: React.FC<ABRControlProps> = ({ showToast }) => {
  const [config, setConfig] = useState<ABRConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Método para obter token de acesso do localStorage
  const getAuthToken = (): string | null => {
    return localStorage.getItem('yustream_token')
  }

  const loadConfig = async () => {
    try {
      setLoading(true)
      setError(null)
      const token = getAuthToken()
      const abrConfig = await abrService.getABRConfig(token || undefined)
      setConfig(abrConfig)
    } catch (err) {
      setError('Erro ao carregar configuração ABR')
      console.error('Erro ao carregar configuração:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfig()
  });

  const handleQualityToggle = async (qualityName: string, enabled: boolean) => {
    if (!config) return

    try {
      setSaving(true)
      
      // Atualizar estado local imediatamente para feedback visual
      const updatedQualities = config.qualities.map(q =>
        q.name === qualityName ? { ...q, enabled } : q
      )
      setConfig({ ...config, qualities: updatedQualities })

      // Fazer chamada para API
      const token = getAuthToken()
      await abrService.toggleQuality(qualityName, enabled, token || undefined)
      
      showToast(
        `Qualidade ${qualityName} ${enabled ? 'ativada' : 'desativada'} com sucesso`,
        'success'
      )
    } catch (err) {
      // Reverter mudança em caso de erro
      const revertedQualities = config.qualities.map(q =>
        q.name === qualityName ? { ...q, enabled: !enabled } : q
      )
      setConfig({ ...config, qualities: revertedQualities })
      
      showToast(
        `Erro ao ${enabled ? 'ativar' : 'desativar'} qualidade ${qualityName}`,
        'error'
      )
      console.error('Erro ao alterar qualidade:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadXML = () => {
    if (!config) return

    const xml = abrService.generateABRMuxXML(config)
    const blob = new Blob([xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'abr.mux'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    showToast('Arquivo abr.mux baixado com sucesso', 'success')
  }

  const getQualityColor = (quality: StreamQuality) => {
    if (quality.enabled) {
      return quality.name === 'Fonte' ? 'primary' : 'success'
    }
    return 'default'
  }

  const getQualityIcon = (quality: StreamQuality) => {
    return quality.enabled ? <PlayIcon /> : <PauseIcon />
  }

  const enabledCount = config?.qualities.filter(q => q.enabled).length || 0
  const totalCount = config?.qualities.length || 0

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} />
      </Box>
    )
  }

  if (error) {
    return (
      <Alert 
        severity="error" 
        action={
          <Button color="inherit" size="small" onClick={loadConfig}>
            Tentar Novamente
          </Button>
        }
      >
        {error}
      </Alert>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Controle ABR
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gerencie as qualidades de stream disponíveis para transmissão
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <Tooltip title="Recarregar configuração">
            <IconButton onClick={loadConfig} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Baixar arquivo abr.mux">
            <IconButton onClick={handleDownloadXML} disabled={!config}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Status */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: 'background.paper' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" gutterBottom>
              Status das Qualidades
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {enabledCount} de {totalCount} qualidades ativas
            </Typography>
          </Box>
          
          <Chip
            label={`${enabledCount}/${totalCount} Ativas`}
            color={enabledCount > 0 ? 'success' : 'default'}
            variant="outlined"
          />
        </Box>
      </Paper>

      {/* Qualidades */}
      <Grid container spacing={3}>
        {config?.qualities.map((quality) => (
          <Grid item xs={12} sm={6} md={4} key={quality.name}>
            <Card 
              sx={{ 
                height: '100%',
                opacity: quality.enabled ? 1 : 0.7,
                transition: 'opacity 0.3s ease'
              }}
            >
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" component="h3">
                    {quality.name}p
                  </Typography>
                  
                  <Chip
                    icon={getQualityIcon(quality)}
                    label={quality.enabled ? 'Ativa' : 'Inativa'}
                    color={getQualityColor(quality)}
                    size="small"
                  />
                </Box>

                <Box mb={2}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Track de Vídeo:
                  </Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {quality.videoTrack}
                  </Typography>
                </Box>

                <Box mb={2}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Track de Áudio:
                  </Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {quality.audioTrack}
                  </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                <FormControlLabel
                  control={
                    <Switch
                      checked={quality.enabled}
                      onChange={(e) => handleQualityToggle(quality.name, e.target.checked)}
                      disabled={saving}
                      color="primary"
                    />
                  }
                  label={
                    <Typography variant="body2">
                      {quality.enabled ? 'Desativar' : 'Ativar'} Qualidade
                    </Typography>
                  }
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Informações adicionais */}
      <Box mt={4}>
        <Alert severity="info">
          <Typography variant="body2">
            <strong>Dica:</strong> As mudanças são aplicadas imediatamente. 
            Certifique-se de que pelo menos uma qualidade esteja ativa para manter a transmissão funcionando.
          </Typography>
        </Alert>
      </Box>
    </Box>
  )
}

export default ABRControl
