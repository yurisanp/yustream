import type { PlayerConfig, PlayerConfigInput } from '../types/playerConfig'

interface GetPlayerConfigOptions {
  token?: string
  admin?: boolean
}

interface UpdatePlayerConfigOptions {
  token: string
  payload: PlayerConfigInput
}

interface DeletePlayerConfigOptions {
  token: string
}

const normalizeConfig = (data: unknown): PlayerConfig => {
  if (data && typeof data === 'object' && 'config' in data) {
    return (data as { config: PlayerConfig }).config
  }

  return (data as PlayerConfig) ?? { videoId: '' }
}

const buildHeaders = (token?: string, hasBody = false): HeadersInit => {
  const headers: Record<string, string> = {
    Accept: 'application/json'
  }

  if (hasBody) {
    headers['Content-Type'] = 'application/json'
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return headers
}

export const getPlayerConfig = async (
  options: GetPlayerConfigOptions = {}
): Promise<PlayerConfig> => {
  const { token, admin = false } = options
  const endpoint = admin ? '/api/admin/player-config' : '/api/player-config'

  const response = await fetch(endpoint, {
    headers: buildHeaders(token)
  })

  if (!response.ok) {
    const message = await extractErrorMessage(response)
    throw new Error(message || 'Não foi possível obter a configuração do player')
  }

  const data = await response.json()
  return normalizeConfig(data)
}

export const updatePlayerConfig = async ({
  token,
  payload
}: UpdatePlayerConfigOptions): Promise<PlayerConfig> => {
  const response = await fetch('/api/admin/player-config', {
    method: 'PUT',
    headers: buildHeaders(token, true),
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const message = await extractErrorMessage(response)
    throw new Error(message || 'Não foi possível atualizar a configuração do player')
  }

  const data = await response.json()
  return normalizeConfig(data)
}

export const deletePlayerConfig = async ({
  token
}: DeletePlayerConfigOptions): Promise<PlayerConfig> => {
  const response = await fetch('/api/admin/player-config', {
    method: 'DELETE',
    headers: buildHeaders(token)
  })

  if (!response.ok) {
    const message = await extractErrorMessage(response)
    throw new Error(message || 'Não foi possível remover a configuração do player')
  }

  const data = await response.json()
  return normalizeConfig(data)
}

const extractErrorMessage = async (response: Response): Promise<string | null> => {
  try {
    const data = await response.json()
    if (data && typeof data === 'object') {
      if ('message' in data && typeof data.message === 'string') {
        return data.message
      }
      if ('error' in data && typeof data.error === 'string') {
        return data.error
      }
    }
    return null
  } catch (error) {
    console.error('Erro ao extrair mensagem da resposta:', error)
    return null
  }
}

export default {
  getPlayerConfig,
  updatePlayerConfig,
  deletePlayerConfig
}

