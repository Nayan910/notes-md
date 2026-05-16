import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { useAuth } from '../context/AuthContext'
import TabBar from './TabBar'
import Sidebar from './Sidebar'
import Editor from './Editor'
import Preview from './Preview'
import Toolbar from './Toolbar'
import StatusBar from './StatusBar'
import WelcomeScreen from './WelcomeScreen'
import SettingsModal from './SettingsModal'

function UserBadge({ user, logout }: { user: { username: string } | null; logout: () => void }) {
  const navigate = useNavigate()
  if (!user) return null
  return (
    <div className="flex items-center justify-end gap-3 px-3 py-1.5 bg-surface-alt border-t border-border text-xs">
      <span className="text-gray-500 dark:text-gray-400">
        <span className="font-medium text-gray-700 dark:text-gray-300">{user.username}</span>
      </span>
      <Link to="/pair" className="text-blue-600 hover:text-blue-700 hover:underline">
        Pair Device
      </Link>
      <button
        onClick={() => { logout(); navigate('/login') }}
        className="text-gray-400 hover:text-red-500 transition-colors"
      >
        Sign out
      </button>
    </div>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const docs = useStore((s) => s.docs)
  const activeDocId = useStore((s) => s.activeDocId)
  const viewMode = useStore((s) => s.viewMode)
  const showSidebar = useStore((s) => s.settings.showSidebar)
  const sideBySide = useStore((s) => s.settings.sideBySide)

  if (docs.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <Toolbar />
        <div className="flex-1 flex items-center justify-center">
          <WelcomeScreen />
        </div>
        <StatusBar />
        <UserBadge user={user} logout={logout} />
        <SettingsModal />
      </div>
    )
  }

  const showEdit = viewMode === 'edit' || viewMode === 'both'
  const showPreview = viewMode === 'preview' || viewMode === 'both'

  return (
    <div className="h-full flex flex-col">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        {showSidebar && <Sidebar />}
        <div className="flex-1 flex flex-col overflow-hidden">
          <TabBar />
          <div className="flex-1 flex overflow-hidden">
            {showEdit && (
              <div className={`flex-1 overflow-hidden ${showPreview && sideBySide ? 'border-r border-border' : ''}`}
                style={{ minWidth: showPreview && sideBySide ? '40%' : '100%' }}>
                <Editor />
              </div>
            )}
            {showPreview && (
              <div className="flex-1 overflow-hidden" style={{ minWidth: showEdit && sideBySide ? '40%' : '100%' }}>
                <Preview />
              </div>
            )}
          </div>
        </div>
      </div>
      <StatusBar />
      <UserBadge user={user} logout={logout} />
      <SettingsModal />
    </div>
  )
}
