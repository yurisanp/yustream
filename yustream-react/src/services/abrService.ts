export interface StreamQuality {
  name: string
  enabled: boolean
  videoTrack: string
  audioTrack: string
  url: string
}

export interface ABRConfig {
  qualities: StreamQuality[]
  playlistName: string
  fileName: string
}

const QUALITY_CONFIGS = {
  'Fonte': {
    name: 'Fonte',
    videoTrack: 'fonte_video',
    audioTrack: 'fonte_audio',
    url: 'stream://default/fonte/fonte'
  },
  '1440': {
    name: '1440',
    videoTrack: '1440_video',
    audioTrack: '1440_audio',
    url: 'stream://default/1440/1440'
  },
  '1080': {
    name: '1080',
    videoTrack: '1080_video',
    audioTrack: '1080_audio',
    url: 'stream://default/1080/1080'
  },
  '720': {
    name: '720',
    videoTrack: '720_video',
    audioTrack: '720_audio',
    url: 'stream://default/720/720'
  },
  '360': {
    name: '360',
    videoTrack: '360_video',
    audioTrack: '360_audio',
    url: 'stream://default/360/360'
  }
}

const hostname = window.location.hostname;
const isSecure = window.location.protocol === 'https:';
const httpProtocol = isSecure ? 'https:' : 'http:';

class ABRService {
  private baseUrl = `${httpProtocol}//${hostname}/api`;

  // Método para criar headers com autenticação
  private getAuthHeaders(token?: string): HeadersInit {
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  }

  async getABRConfig(token?: string): Promise<ABRConfig> {
    try {
      const response = await fetch(`${this.baseUrl}/abr/config`, {
        headers: this.getAuthHeaders(token)
      })
      if (!response.ok) {
        throw new Error('Erro ao carregar configuração ABR')
      }
      return await response.json()
    } catch (error) {
      console.error('Erro ao carregar configuração ABR:', error)
      // Retornar configuração padrão se houver erro
      return this.getDefaultConfig()
    }
  }

  async updateABRConfig(config: ABRConfig, token?: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/abr/config`, {
        method: 'PUT',
        headers: this.getAuthHeaders(token),
        body: JSON.stringify(config)
      })
      
      if (!response.ok) {
        throw new Error('Erro ao atualizar configuração ABR')
      }
    } catch (error) {
      console.error('Erro ao atualizar configuração ABR:', error)
      throw error
    }
  }

  async toggleQuality(qualityName: string, enabled: boolean, token?: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/abr/quality/${qualityName}`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(token),
        body: JSON.stringify({ enabled })
      })
      
      if (!response.ok) {
        throw new Error(`Erro ao ${enabled ? 'ativar' : 'desativar'} qualidade ${qualityName}`)
      }
    } catch (error) {
      console.error(`Erro ao ${enabled ? 'ativar' : 'desativar'} qualidade:`, error)
      throw error
    }
  }

  // Método para obter lista de canais multiplex do OME
  async getMultiplexChannels(token?: string): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/ome/multiplex-channels`, {
        headers: this.getAuthHeaders(token)
      })
      if (!response.ok) {
        throw new Error('Erro ao carregar canais multiplex')
      }
      const data = await response.json()
      return data.channels || []
    } catch (error) {
      console.error('Erro ao carregar canais multiplex:', error)
      return []
    }
  }

  // Método para obter informações detalhadas de um canal multiplex
  async getMultiplexChannelInfo(channelName: string, token?: string): Promise<unknown> {
    try {
      const response = await fetch(`${this.baseUrl}/ome/multiplex-channels/${channelName}`, {
        headers: this.getAuthHeaders(token)
      })
      if (!response.ok) {
        throw new Error('Erro ao carregar informações do canal')
      }
      return await response.json()
    } catch (error) {
      console.error('Erro ao carregar informações do canal:', error)
      throw error
    }
  }

  // Método para deletar canal multiplex
  async deleteMultiplexChannel(channelName: string, token?: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/ome/multiplex-channels/${channelName}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(token)
      })
      
      if (!response.ok) {
        throw new Error('Erro ao deletar canal multiplex')
      }
    } catch (error) {
      console.error('Erro ao deletar canal multiplex:', error)
      throw error
    }
  }

  getDefaultConfig(): ABRConfig {
    return {
      qualities: Object.values(QUALITY_CONFIGS).map(quality => ({
        ...quality,
        enabled: quality.name === 'Fonte' || quality.name === '720' // Ativar Fonte e 720 por padrão
      })),
      playlistName: 'LLHLS ABR',
      fileName: 'abr'
    }
  }

  // Converter configuração ABR para formato da API do OvenMediaEngine
  convertToOMEFormat(config: ABRConfig): Record<string, unknown> {
    const enabledQualities = config.qualities.filter(q => q.enabled)
    
    return {
      outputStream: {
        name: "live"
      },
      sourceStreams: enabledQualities.map(quality => ({
        name: quality.name.toLowerCase(),
        url: quality.url,
        trackMap: [
          {
            sourceTrackName: "bypass_video",
            newTrackName: quality.videoTrack,
            bitrateConf: this.getBitrateForQuality(quality.name),
            framerateConf: 30
          },
          {
            sourceTrackName: "bypass_audio", 
            newTrackName: quality.audioTrack,
            bitrateConf: 128000
          }
        ]
      })),
      playlists: [
        {
          name: config.playlistName,
          fileName: config.fileName,
          options: {
            webrtcAutoAbr: true,
            hlsChunklistPathDepth: 0,
            enableTsPackaging: true
          },
          renditions: enabledQualities.map(quality => ({
            name: quality.name,
            video: quality.videoTrack,
            audio: quality.audioTrack
          }))
        }
      ]
    }
  }

  // Obter bitrate baseado na qualidade
  private getBitrateForQuality(qualityName: string): number {
    const bitrates: { [key: string]: number } = {
      'Fonte': 10000000,  // 10 Mbps
      '1440': 8000000,    // 8 Mbps
      '1080': 5000000,    // 5 Mbps
      '720': 2500000,     // 2.5 Mbps
      '360': 1000000      // 1 Mbps
    }
    return bitrates[qualityName] || 1000000
  }

  generateABRMuxXML(config: ABRConfig): string {
    const enabledQualities = config.qualities.filter(q => q.enabled)
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Multiplex>
    <OutputStream>
        <Name>live</Name>
    </OutputStream>

    <SourceStreams>`

    // Adicionar SourceStreams para cada qualidade ativada
    enabledQualities.forEach(quality => {
      xml += `
        <SourceStream>
            <Name>${quality.name}</Name>
            <Url>${quality.url}</Url>
            <TrackMap>
                <Track>
                    <SourceTrackName>bypass_video</SourceTrackName>
                    <NewTrackName>${quality.videoTrack}</NewTrackName>
                </Track>
                <Track>
                    <SourceTrackName>bypass_audio</SourceTrackName>
                    <NewTrackName>${quality.audioTrack}</NewTrackName>
                </Track>
            </TrackMap>
        </SourceStream>`
    })

    xml += `
    </SourceStreams>
    
    <Playlists>
        <Playlist>
            <Name>${config.playlistName}</Name>
            <FileName>${config.fileName}</FileName>
            <Options>
                <HLSChunklistPathDepth>0</HLSChunklistPathDepth>
                <EnableTsPackaging>true</EnableTsPackaging>
            </Options>`

    // Adicionar Renditions para cada qualidade ativada
    enabledQualities.forEach(quality => {
      xml += `
            <Rendition>
                <Name>${quality.name}</Name>
                <Video>${quality.videoTrack}</Video>
                <Audio>${quality.audioTrack}</Audio>
            </Rendition>`
    })

    xml += `
        </Playlist>
    </Playlists>
    
</Multiplex>`

    return xml
  }
}

export default new ABRService()
