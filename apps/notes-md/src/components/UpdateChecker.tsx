import { useState, useEffect } from 'react'
import { checkForUpdate, shouldCheckForUpdate, setLastCheckTime, getDismissedVersion, setDismissedVersion, getCurrentVersion } from '../utils/update'

interface UpdateInfo {
  update_available: boolean
  latest_version: string
  download_url: string
  release_notes: string
}

export default function UpdateChecker() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [showToast, setShowToast] = useState(false)

  useEffect(() => {
    async function checkUpdate() {
      // Only check once per day
      if (!shouldCheckForUpdate()) {
        return
      }

      // Record that we're checking now
      setLastCheckTime(Date.now())

      const info = await checkForUpdate()
      setUpdateInfo(info)

      // Show toast if update available and not dismissed
      if (info.update_available) {
        const dismissed = getDismissedVersion()
        if (dismissed !== info.latest_version) {
          setShowToast(true)
        }
      }
    }

    checkUpdate()
  }, [])

  const handleDismiss = () => {
    if (updateInfo?.latest_version) {
      setDismissedVersion(updateInfo.latest_version)
    }
    setShowToast(false)
  }

  const handleDownload = () => {
    // Use the same download pattern as SettingsModal
    const downloadUrl = updateInfo?.download_url || `${window.location.protocol}//${window.location.hostname}:8000/download/apk`
    window.open(downloadUrl, '_blank')
    setShowToast(false)
  }

  if (!showToast || !updateInfo?.update_available) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
      <div className="bg-surface border border-border rounded-lg shadow-lg p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary">
              Version {updateInfo.latest_version} available!
            </p>
            {updateInfo.release_notes && (
              <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                {updateInfo.release_notes}
              </p>
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleDownload}
                className="px-3 py-1.5 text-xs font-medium rounded bg-accent text-white hover:bg-accent-hover transition-colors"
              >
                Download
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 text-xs font-medium rounded bg-surface-alt text-text-secondary hover:bg-surface-hover transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}