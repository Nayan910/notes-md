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
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'var(--color-surface)' }}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Pair Android Device
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Signed in as <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{user?.username}</span>
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="border rounded-lg px-4 py-2 mb-4" style={{ background: '#FEF2F2', borderColor: '#FCA5A5' }}>
            <p className="text-sm" style={{ color: '#DC2626' }}>{error}</p>
          </div>
        )}

        {/* Success / QR Code */}
        {claimed ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#DCFCE7' }}>
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#16A34A">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-2" style={{ color: '#16A34A' }}>
              Device Paired Successfully!
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
              Your Android device is now connected to your account.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={generateQR}
                className="px-4 py-2 text-white rounded-lg text-sm transition-colors"
                style={{ background: 'var(--color-accent)' }}
              >
                Pair Another Device
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 rounded-lg text-sm transition-colors"
                style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-primary)' }}
              >
                Back to Editor
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            {/* QR Code */}
            <div className="rounded-xl p-6 inline-block mb-6" style={{ background: 'var(--color-surface-alt)' }}>
              {loading ? (
                <div className="w-48 h-48 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-accent)' }} />
                </div>
              ) : qrData ? (
                <QRCodeSVG value={qrData} size={192} level="M" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center" style={{ color: 'var(--color-text-secondary)' }}>
                  No QR code
                </div>
              )}
            </div>

            <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: 'var(--color-text-primary)' }}>
              Open the <strong>notes.md</strong> app on your Android device and
              tap <strong>"Scan QR Code"</strong> to pair.
            </p>

            {/* Instructions */}
            <div className="rounded-lg p-4 text-left mb-6" style={{ background: 'var(--color-surface-alt)' }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Instructions
              </h3>
              <ol className="text-sm space-y-2" style={{ color: 'var(--color-text-primary)' }}>
                <li className="flex gap-2">
                  <span className="font-bold shrink-0" style={{ color: 'var(--color-accent)' }}>1.</span>
                  <span>Install notes.md on your Android device</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold shrink-0" style={{ color: 'var(--color-accent)' }}>2.</span>
                  <span>Open the app and tap "Scan QR Code"</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold shrink-0" style={{ color: 'var(--color-accent)' }}>3.</span>
                  <span>Point your camera at this QR code</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold shrink-0" style={{ color: 'var(--color-accent)' }}>4.</span>
                  <span>Your devices will be paired automatically</span>
                </li>
              </ol>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={generateQR}
                disabled={loading}
                className="px-4 py-2 text-white rounded-lg text-sm disabled:opacity-50 transition-colors"
                style={{ background: 'var(--color-accent)' }}
              >
                Regenerate QR
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 rounded-lg text-sm transition-colors"
                style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-primary)' }}
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
            className="text-sm transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
