// Types para o YuStream Mobile

export type StreamStatus = 'connecting' | 'playing' | 'paused' | 'error' | 'offline' | 'idle';

export interface StreamConfig {
  streamId: string;
  baseUrl: string;
  token?: string;
  lowLatency: boolean;
}

export interface StreamSource {
  label: string;
  uri: string;
  type: 'hls' | 'dash' | 'mp4';
  lowLatency?: boolean;
}

export interface PlayerDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

export interface StreamPlayerOptions {
  onStatusChange?: (status: StreamStatus) => void;
  onError?: (error: string | Error) => void;
  onStreamOnlineChange?: (isOnline: boolean) => void;
  getStreamToken?: () => Promise<string | null>;
}

export interface StreamStatusInfo {
  isOnline: boolean;
  isLoading: boolean;
  error?: string;
  lastChecked?: Date;
  hasWebRTC?: boolean;
  hasLLHLS?: boolean;
  totalActiveStreams?: number;
  streamDetails?: any;
  method?: string;
}

export interface ToastMessage {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  id: string;
  duration?: number;
}

export interface AuthUser {
  username: string;
  email?: string;
  role?: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => void;
  getStreamToken: () => Promise<string | null>;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

// Configurações do player otimizadas para mobile
export interface MobilePlayerConfig {
  autoStart: boolean;
  controls: boolean;
  fullscreen: boolean;
  muted: boolean;
  volume: number;
  resizeMode: 'contain' | 'cover' | 'stretch';
  shouldPlay: boolean;
  isLooping: boolean;
  useNativeControls: boolean;
  usePoster: boolean;
  posterSource?: { uri: string };
}

// Métricas de performance
export interface PlayerMetrics {
  bufferHealth: number;
  currentBitrate: number;
  droppedFrames: number;
  loadStartTime: number;
  playbackStartTime: number;
  totalStalls: number;
  averageStallDuration: number;
}
