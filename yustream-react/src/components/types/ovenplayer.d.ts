declare module 'ovenplayer' {
  interface OvenPlayerConfig {
    autoStart?: boolean
    autoFallback?: boolean
    controls?: boolean
    loop?: boolean
    muted?: boolean
    volume?: number
    playbackRate?: number
    playsinline?: boolean
    sources?: Array<{
      label: string
      type: 'webrtc' | 'hls' | 'llhls' | 'dash'
      file: string
      lowLatency?: boolean
    }>
    webrtcConfig?: {
      iceServers: Array<{ urls: string }>
    }
    hlsConfig?: {
      lowLatencyMode?: boolean
      backBufferLength?: number
    }
  }

  interface OvenPlayerInstance {
    on(event: string, callback: (data?: unknown) => void): void
    play(): void
    pause(): void
    setVolume(volume: number): void
    setMute(mute: boolean): void
    destroy(): void
    getSources(): { file: string; type?: string; label?: string }[]
    setCurrentSource(index: number): void
  }

  interface OvenPlayerStatic {
    create(elementId: string, config: OvenPlayerConfig): OvenPlayerInstance
  }

  const OvenPlayer: OvenPlayerStatic
  export default OvenPlayer
}
