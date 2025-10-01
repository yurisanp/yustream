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
  getStreamToken: () => Promise<string | null>
}
