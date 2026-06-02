import { useStore } from '../store/useStore'
import FileList from './FileList'

/**
 * The sidebar's only job is to be a positioned container. The actual
 * file browser lives in `<FileList />` so it can be reused outside
 * the sidebar (e.g. inside a modal, the VS Code–style panel, etc.).
 */
export default function Sidebar() {
  const showSidebar = useStore((s) => s.settings.showSidebar)

  if (!showSidebar) return null

  return (
    <div className="w-56 bg-surface-alt border-r border-border flex flex-col overflow-hidden flex-shrink-0">
      <FileList />
    </div>
  )
}
