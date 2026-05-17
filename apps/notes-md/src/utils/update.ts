import { apiGet } from './api'

const APP_VERSION = '1.0.0'
const LAST_CHECK_KEY = 'notes-md-last-update-check'
const DISMISSED_VERSION_KEY = 'notes-md-dismissed-version'

export interface UpdateInfo {
  update_available: boolean
  latest_version: string
  download_url: string
  release_notes: string
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  try {
    const updateInfo = await apiGet<UpdateInfo>(`/update/check?current_version=${APP_VERSION}`)
    return updateInfo
  } catch (error) {
    console.error('Failed to check for updates:', error)
    return {
      update_available: false,
      latest_version: APP_VERSION,
      download_url: '',
      release_notes: ''
    }
  }
}

export function getLastCheckTime(): number {
  const stored = localStorage.getItem(LAST_CHECK_KEY)
  return stored ? parseInt(stored, 10) : 0
}

export function setLastCheckTime(time: number): void {
  localStorage.setItem(LAST_CHECK_KEY, time.toString())
}

export function shouldCheckForUpdate(): boolean {
  const lastCheck = getLastCheckTime()
  const oneDayMs = 24 * 60 * 60 * 1000
  return Date.now() - lastCheck > oneDayMs
}

export function getDismissedVersion(): string | null {
  return localStorage.getItem(DISMISSED_VERSION_KEY)
}

export function setDismissedVersion(version: string): void {
  localStorage.setItem(DISMISSED_VERSION_KEY, version)
}

export function getCurrentVersion(): string {
  return APP_VERSION
}