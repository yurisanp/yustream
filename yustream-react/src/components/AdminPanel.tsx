import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Search,
  UserCheck,
  UserX,
  Shield,
  Eye,
  EyeOff,
  Video,
  Copy,
  Loader2,
  RefreshCcw
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import playerConfigService from '../services/playerConfigService'
import type { PlayerConfig, PlayerConfigInput } from '../types/playerConfig'
import './AdminPanel.css'

interface User {
  _id: string
  username: string
  email: string
  role: 'admin' | 'user' | 'moderator'
  isActive: boolean
  lastLogin: string | null
  createdAt: string
  updatedAt: string
}

interface UserStats {
  total: number
  active: number
  inactive: number
  byRole: {
    admin: number
    user: number
    moderator: number
  }
}

interface AdminPanelProps {
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
  onClose: () => void
}

interface PlayerFormState {
  videoInput: string
}

const defaultPlayerForm: PlayerFormState = {
  videoInput: ''
}

const AdminPanel = ({ showToast, onClose }: AdminPanelProps) => {
  const { token } = useAuth()
  const [activeTab, setActiveTab] = useState<'users' | 'player'>('users')
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'user' | 'moderator',
    isActive: true
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportEmails, setExportEmails] = useState('')
  const [exportLoading, setExportLoading] = useState(false)

  const [playerConfig, setPlayerConfig] = useState<PlayerConfig | null>(null)
  const [playerForm, setPlayerForm] = useState<PlayerFormState>(defaultPlayerForm)
  const [playerLoading, setPlayerLoading] = useState(true)
  const [playerSaving, setPlayerSaving] = useState(false)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [playerClearing, setPlayerClearing] = useState(false)

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/users?page=${currentPage}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Falha ao carregar usuários')
      }

      const data = await response.json()
      setUsers(data.users)
      setTotalPages(data.pagination.total)
    } catch (error) {
      console.error('Erro ao carregar usuários:', error)
      showToast('Erro ao carregar usuários', 'error')
    } finally {
      setLoading(false)
    }
  }, [currentPage, token, showToast])

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Falha ao carregar estatísticas')
      }

      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error)
    }
  }, [token])

  const loadPlayerConfig = useCallback(async () => {
    if (!token) {
      return
    }

    try {
      setPlayerLoading(true)
      setPlayerError(null)
      const config = await playerConfigService.getPlayerConfig({ token, admin: true })
      setPlayerConfig(config)
      setPlayerForm({
        videoInput: config?.videoId ? config.videoId : ''
      })
    } catch (error) {
      console.error('Erro ao carregar configuração do player:', error)
      setPlayerError('Não foi possível carregar a configuração do player.')
    } finally {
      setPlayerLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadUsers()
    loadStats()
  }, [currentPage, loadUsers, loadStats])

  useEffect(() => {
    if (activeTab === 'player' && !playerConfig) {
      loadPlayerConfig()
    }
  }, [activeTab, loadPlayerConfig, playerConfig])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao criar usuário')
      }

      showToast('Usuário criado com sucesso!', 'success')
      setShowCreateModal(false)
      resetForm()
      loadUsers()
      loadStats()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar usuário'
      showToast(errorMessage, 'error')
    }
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedUser) return

    try {
      const updateData: Partial<typeof formData> = { ...formData }
      if (!updateData.password) {
        delete updateData.password
      }

      const response = await fetch(`/api/admin/users/${selectedUser._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao atualizar usuário')
      }

      showToast('Usuário atualizado com sucesso!', 'success')
      setShowEditModal(false)
      setSelectedUser(null)
      resetForm()
      loadUsers()
      loadStats()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar usuário'
      showToast(errorMessage, 'error')
    }
  }

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Tem certeza que deseja deletar o usuário "${user.username}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${user._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao deletar usuário')
      }

      showToast('Usuário deletado com sucesso!', 'success')
      loadUsers()
      loadStats()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao deletar usuário'
      showToast(errorMessage, 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      role: 'user',
      isActive: true
    })
    setShowPassword(false)
  }

  const openEditModal = (user: User) => {
    setSelectedUser(user)
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
      isActive: user.isActive
    })
    setShowEditModal(true)
  }

  const filteredUsers = useMemo(() => (
    users.filter(user =>
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    )
  ), [users, searchTerm])

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin': return 'role-admin'
      case 'moderator': return 'role-moderator'
      default: return 'role-user'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const extractVideoId = (input: string): string | null => {
    const trimmed = input.trim()
    if (!trimmed) {
      return null
    }

    const directIdPattern = /^[a-zA-Z0-9_-]{11}$/
    if (directIdPattern.test(trimmed)) {
      return trimmed
    }

    const urlPatterns = [
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /v=([a-zA-Z0-9_-]{11})/,
      /embed\/([a-zA-Z0-9_-]{11})/,
      /shorts\/([a-zA-Z0-9_-]{11})/
    ]

    for (const pattern of urlPatterns) {
      const match = trimmed.match(pattern)
      if (match && match[1]) {
        return match[1]
      }
    }

    return null
  }

  const handleTabChange = (tab: 'users' | 'player') => {
    setActiveTab(tab)
    if (tab === 'player' && !playerConfig) {
      loadPlayerConfig()
    }
  }

  const handlePlayerFormChange = (value: string) => {
    setPlayerForm({
      videoInput: value
    })
  }

  const handlePlayerConfigSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!token) {
      showToast('Token de autenticação não encontrado', 'error')
      return
    }

    const videoId = extractVideoId(playerForm.videoInput)

    if (!videoId) {
      showToast('Informe um ID ou URL de vídeo do YouTube válido.', 'error')
      return
    }

    try {
      setPlayerSaving(true)
      const payload: PlayerConfigInput = {
        videoId
      }

      const updatedConfig = await playerConfigService.updatePlayerConfig({
        token,
        payload
      })

      setPlayerConfig(updatedConfig)
      setPlayerForm({
        videoInput: updatedConfig.videoId
      })

      showToast('Configuração do player atualizada com sucesso.', 'success')
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erro ao atualizar configuração do player'
      showToast(message, 'error')
    } finally {
      setPlayerSaving(false)
    }
  }

  const handleRefreshPlayerConfig = async () => {
    await loadPlayerConfig()
    showToast('Configuração recarregada', 'info')
  }

  const handleClearPlayerConfig = async () => {
    if (!token) {
      showToast('Token de autenticação não encontrado', 'error')
      return
    }

    try {
      setPlayerClearing(true)
      const clearedConfig = await playerConfigService.deletePlayerConfig({ token })
      setPlayerConfig(clearedConfig)
      setPlayerForm(defaultPlayerForm)
      showToast('Configuração do player removida.', 'success')
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erro ao remover configuração do player'
      showToast(message, 'error')
    } finally {
      setPlayerClearing(false)
    }
  }

  const handleExportEmails = async () => {
    if (!token) {
      showToast('Token de autenticação não encontrado', 'error')
      return
    }

    try {
      setExportLoading(true)
      const response = await fetch('/api/admin/users/emails', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        let message = 'Erro ao exportar emails'
        if (payload && typeof payload === 'object') {
          if ('message' in payload && typeof (payload as { message?: string }).message === 'string') {
            message = (payload as { message: string }).message
          } else if ('error' in payload && typeof (payload as { error?: string }).error === 'string') {
            message = (payload as { error: string }).error
          }
        }
        throw new Error(message)
      }

      const emailsData = (payload ?? {}) as { emails?: string[] | string }
      const emailsArray = Array.isArray(emailsData.emails)
        ? emailsData.emails
        : typeof emailsData.emails === 'string'
          ? emailsData.emails.split(',').map(email => email.trim()).filter(Boolean)
          : users.map(user => user.email)

      const uniqueEmails = Array.from(new Set(emailsArray)).sort()
      const formatted = uniqueEmails.join(', ')
      setExportEmails(formatted)
      setShowExportModal(true)
      showToast('Lista de emails gerada com sucesso.', 'success')
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erro ao exportar emails dos usuários'
      showToast(message, 'error')
    } finally {
      setExportLoading(false)
    }
  }

  const handleCopyEmails = async () => {
    try {
      await navigator.clipboard.writeText(exportEmails)
      showToast('Emails copiados para a área de transferência.', 'success')
    } catch (error) {
      console.error('Erro ao copiar emails:', error)
      showToast('Não foi possível copiar os emails. Copie manualmente.', 'error')
    }
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div className="header-left">
          <h1>
            {activeTab === 'users' ? (
              <><Users size={24} /> Gerenciamento de Usuários</>
            ) : (
              <><Video size={24} /> Configuração do Player</>
            )}
          </h1>
        </div>
        <div className="header-right">
          {activeTab === 'users' && (
            <>
              <button
                className="btn-secondary"
                onClick={handleExportEmails}
                disabled={exportLoading}
              >
                {exportLoading ? (
                  <Loader2 size={16} className="icon-spin" />
                ) : (
                  <Copy size={16} />
                )}
                Exportar Emails
              </button>
              <button className="btn-create" onClick={() => setShowCreateModal(true)}>
                <Plus size={16} />
                Novo Usuário
              </button>
            </>
          )}
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      <div className="admin-tabs">
        <button
          className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => handleTabChange('users')}
        >
          <Users size={16} />
          Usuários
        </button>
        <button
          className={`tab-button ${activeTab === 'player' ? 'active' : ''}`}
          onClick={() => handleTabChange('player')}
        >
          <Video size={16} />
          Player
        </button>
      </div>

      {activeTab === 'users' ? (
        <>
          {stats && (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon users">
                  <Users size={24} />
                </div>
                <div className="stat-content">
                  <h3>{stats.total}</h3>
                  <p>Total de Usuários</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon active">
                  <UserCheck size={24} />
                </div>
                <div className="stat-content">
                  <h3>{stats.active}</h3>
                  <p>Usuários Ativos</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon admins">
                  <Shield size={24} />
                </div>
                <div className="stat-content">
                  <h3>{stats.byRole.admin}</h3>
                  <p>Administradores</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon inactive">
                  <UserX size={24} />
                </div>
                <div className="stat-content">
                  <h3>{stats.inactive}</h3>
                  <p>Usuários Inativos</p>
                </div>
              </div>
            </div>
          )}

          <div className="filters">
            <div className="search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Buscar por usuário ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="users-table-container">
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner" />
                <p>Carregando usuários...</p>
              </div>
            ) : (
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Último Login</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => (
                    <tr key={user._id}>
                      <td>
                        <div className="user-info">
                          <strong>{user.username}</strong>
                          <small>Criado em {formatDate(user.createdAt)}</small>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`role-badge ${getRoleBadgeClass(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                          {user.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td>
                        {user.lastLogin ? formatDate(user.lastLogin) : 'Nunca'}
                      </td>
                      <td>
                        <div className="actions">
                          <button
                            className="btn-edit"
                            onClick={() => openEditModal(user)}
                            title="Editar usuário"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            className="btn-delete"
                            onClick={() => handleDeleteUser(user)}
                            title="Deletar usuário"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Anterior
              </button>
              <span>Página {currentPage} de {totalPages}</span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Próxima
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="player-config">
          <div className="player-config-header">
            <div>
              <h2>Configuração do Player</h2>
              <p>Defina qual vídeo do YouTube será exibido para os usuários.</p>
            </div>
            <button
              className="btn-secondary"
              onClick={handleRefreshPlayerConfig}
              disabled={playerLoading}
            >
              {playerLoading ? <Loader2 size={16} className="icon-spin" /> : <RefreshCcw size={16} />}
              Recarregar
            </button>
          </div>

          {playerLoading ? (
            <div className="player-loading">
              <div className="loading-spinner" />
              <p>Carregando configuração do player...</p>
            </div>
          ) : playerError ? (
            <div className="player-error">
              <p>{playerError}</p>
              <button onClick={handleRefreshPlayerConfig}>Tentar novamente</button>
            </div>
          ) : (
            <div className="player-config-grid">
              <form className="player-form" onSubmit={handlePlayerConfigSubmit}>
                <div className="form-group">
                  <label>URL ou ID do Vídeo</label>
                  <input
                    type="text"
                    value={playerForm.videoInput}
                    onChange={(e) => handlePlayerFormChange(e.target.value)}
                    placeholder="Ex: https://youtu.be/abcdefghijk"
                    required
                  />
                  <small>Informe a URL completa, um link curto ou apenas o ID do vídeo.</small>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    onClick={handleClearPlayerConfig}
                    disabled={playerSaving || playerClearing || playerLoading}
                  >
                    {playerClearing ? <Loader2 size={16} className="icon-spin" /> : 'Remover Vídeo'}
                  </button>
                  <button type="submit" disabled={playerSaving}>
                    {playerSaving ? <Loader2 size={16} className="icon-spin" /> : 'Salvar Configuração'}
                  </button>
                </div>
              </form>

              <div className="player-preview">
                <h3>Pré-visualização</h3>
                {playerConfig?.videoId ? (
                  <div className="preview-frame">
                    <iframe
                      title="Pré-visualização do player"
                      src={`https://www.youtube.com/embed/${playerConfig.videoId}`}
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className="preview-placeholder">
                    <p>Nenhum vídeo configurado.</p>
                    <p>Adicione um ID ou URL e salve para visualizar aqui.</p>
                  </div>
                )}
                {playerConfig?.updatedAt && (
                  <p className="player-updated">
                    Última atualização em {new Date(playerConfig.updatedAt).toLocaleString('pt-BR')}
                    {playerConfig.updatedBy ? ` por ${playerConfig.updatedBy}` : ''}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showExportModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Emails dos Usuários</h2>
              <button onClick={() => setShowExportModal(false)}>✕</button>
            </div>
            <div className="modal-content">
              <p>Copie os emails para configurar o acesso às transmissões privadas.</p>
              <textarea readOnly value={exportEmails} className="emails-textarea" />
              <div className="form-actions">
                <button type="button" onClick={() => setShowExportModal(false)}>
                  Fechar
                </button>
                <button type="button" onClick={handleCopyEmails}>
                  Copiar Emails
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Criar Novo Usuário</h2>
              <button onClick={() => { setShowCreateModal(false); resetForm(); }}>✕</button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Senha</label>
                <div className="password-input">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' | 'moderator' })}
                >
                  <option value="user">Usuário</option>
                  <option value="moderator">Moderador</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => { setShowCreateModal(false); resetForm(); }}>
                  Cancelar
                </button>
                <button type="submit">Criar Usuário</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Editar Usuário</h2>
              <button onClick={() => { setShowEditModal(false); setSelectedUser(null); resetForm(); }}>✕</button>
            </div>
            <form onSubmit={handleUpdateUser}>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Nova Senha (deixe vazio para não alterar)</label>
                <div className="password-input">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Nova senha (opcional)"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' | 'moderator' })}
                >
                  <option value="user">Usuário</option>
                  <option value="moderator">Moderador</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  Usuário ativo
                </label>
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => { setShowEditModal(false); setSelectedUser(null); resetForm(); }}>
                  Cancelar
                </button>
                <button type="submit">Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminPanel
