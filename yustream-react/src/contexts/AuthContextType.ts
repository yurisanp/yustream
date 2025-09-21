export interface User {
  id: number
  username: string
  role: string
}

export interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (token: string, user: User) => void
  logout: () => void
  checkStreamStatus: () => Promise<{ online: boolean; status: string }>
  getStreamToken: () => Promise<string | null>
  refreshToken: () => Promise<boolean>
  clearStreamTokenCache: () => void
}
