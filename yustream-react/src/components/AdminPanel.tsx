import { useState, useEffect, useCallback } from 'react'
import { Users, Plus, Edit, Trash2, Search, UserCheck, UserX, Shield, Eye, EyeOff, Video, Monitor } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import ABRControl from './ABRControl'
import VNCViewer from './VNCViewer'
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

const AdminPanel = ({ showToast, onClose }: AdminPanelProps) => {
  const { token } = useAuth()
  const [activeTab, setActiveTab] = useState<'users' | 'abr' | 'vnc'>('users')
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

  useEffect(() => {
    loadUsers()
    loadStats()
  }, [currentPage, loadUsers, loadStats])

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

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

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

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div className="header-left">
          <h1>
            {activeTab === 'users' ? (
              <><Users size={24} /> Gerenciamento de Usuários</>
            ) : activeTab === 'abr' ? (
              <><Video size={24} /> Controle ABR</>
            ) : (
              <><Monitor size={24} /> Controle VNC Remoto</>
            )}
          </h1>
        </div>
        <div className="header-right">
          {activeTab === 'users' && (
            <button className="btn-create" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} />
              Novo Usuário
            </button>
          )}
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button 
          className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <Users size={16} />
          Usuários
        </button>
        <button 
          className={`tab-button ${activeTab === 'abr' ? 'active' : ''}`}
          onClick={() => setActiveTab('abr')}
        >
          <Video size={16} />
          Controle ABR
        </button>
        <button 
          className={`tab-button ${activeTab === 'vnc' ? 'active' : ''}`}
          onClick={() => setActiveTab('vnc')}
        >
          <Monitor size={16} />
          VNC Remoto
        </button>
      </div>

      {/* Conteúdo da aba ativa */}
      {activeTab === 'users' ? (
        <>
          {/* Estatísticas */}
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

      {/* Filtros */}
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

      {/* Tabela de Usuários */}
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

      {/* Paginação */}
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

      {/* Modal de Criar Usuário */}
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

      {/* Modal de Editar Usuário */}
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
        </>
      ) : activeTab === 'abr' ? (
        <ABRControl showToast={showToast} />
      ) : (
        <VNCViewer showToast={showToast} />
      )}
    </div>
  )
}

export default AdminPanel
