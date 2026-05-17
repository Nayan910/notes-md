import { useState, useEffect, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function PairPage() {
  const { token, user, logout } = useAuth()
  const navigate = useNavigate()
  const [qrData, setQrData] = useState('')
  const [pairingToken, setPairingToken] = useState('')
  const [claimed, setClaimed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const generateQR = useCallback(async () => {
    setLoading(true)
    setError('')
    setClaimed(false)
    try {
      const res = await fetch(`${window.location.protocol}//${window.location.hostname}:8000/pair/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to generate pairing code')
      const data = await res.json()
      setQrData(data.qr_data)
      setPairingToken(data.pairing_token)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    generateQR()
  }, [generateQR])

  // Poll for claim status
  useEffect(() => {
    if (!pairingToken || claimed) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `${window.location.protocol}//${window.location.hostname}:8000/pair/status/${pairingToken}`
        )
        const data = await res.json()
        if (data.claimed) setClaimed(true)
      } catch {
        // Server might be restarting
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [pairingToken, claimed])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-900 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Pair Android Device
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Signed in as <span className="font-semibold text-gray-700 dark:text-gray-300">{user?.username}</span>
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 mb-4">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Success / QR Code */}
        {claimed ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-green-600 dark:text-green-400 mb-2">
              Device Paired Successfully!
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Your Android device is now connected to your account.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={generateQR}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
              >
                Pair Another Device
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm transition-colors"
              >
                Back to Editor
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            {/* QR Code */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 inline-block mb-6">
              {loading ? (
                <div className="w-48 h-48 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              ) : qrData ? (
                <QRCodeSVG value={qrData} size={192} level="M" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-gray-400">
                  No QR code
                </div>
              )}
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 max-w-sm mx-auto">
              Open the <strong>notes.md</strong> app on your Android device and
              tap <strong>"Scan QR Code"</strong> to pair.
            </p>

            {/* Instructions */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-left mb-6">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Instructions
              </h3>
              <ol className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                <li className="flex gap-2">
                  <span className="text-blue-600 font-bold shrink-0">1.</span>
                  <span>Install notes.md on your Android device</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 font-bold shrink-0">2.</span>
                  <span>Open the app and tap "Scan QR Code"</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 font-bold shrink-0">3.</span>
                  <span>Point your camera at this QR code</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 font-bold shrink-0">4.</span>
                  <span>Your devices will be paired automatically</span>
                </li>
              </ol>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={generateQR}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50 transition-colors"
              >
                Regenerate QR
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm transition-colors"
              >
                Back to Editor
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
