
import { ArrowLeft } from 'lucide-react'
import AdminPanel from './AdminPanel'
import './AdminScreen.css'

interface AdminScreenProps {
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
  onBack: () => void
  user: any
}

const AdminScreen = ({ showToast, onBack, user }: AdminScreenProps) => {
  return (
    <div className="admin-screen">
      <div className="admin-screen-header">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={20} />
          Voltar ao Player
        </button>
        <div className="user-info">
          <span>Administrador: {user?.username}</span>
          <span className="user-role">({user?.role})</span>
        </div>
      </div>
      
      <div className="admin-screen-content">
        <AdminPanel 
          showToast={showToast}
          onClose={onBack}
        />
      </div>
    </div>
  )
}

export default AdminScreen
