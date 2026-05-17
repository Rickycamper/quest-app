// ─────────────────────────────────────────────
// QUEST — Offline Banner
//
// Tiny non-blocking banner that appears at the top of the app when the
// browser reports navigator.onLine === false. Disappears as soon as
// connectivity returns. Zero render when online (no cost).
//
// Native iOS Safari does fire 'online'/'offline' events reliably; on Android
// Chrome it's also supported. We pair it with the response of fetch errors
// elsewhere so users get instant feedback instead of confusing crash cards.
// ─────────────────────────────────────────────
import { useEffect, useState } from 'react'

export default function OfflineBanner() {
  const [online, setOnline]   = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [reconnected, setRec] = useState(false)

  useEffect(() => {
    const goOnline  = () => {
      setOnline(true)
      // Brief "Conectado" toast so the user knows their request will now succeed.
      setRec(true)
      setTimeout(() => setRec(false), 2200)
    }
    const goOffline = () => setOnline(false)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (online && !reconnected) return null

  const offline = !online
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999,
        padding: '8px 14px',
        borderRadius: 999,
        fontSize: 12, fontWeight: 600,
        background: offline ? 'rgba(239,68,68,0.16)' : 'rgba(74,222,128,0.16)',
        border: `1px solid ${offline ? 'rgba(239,68,68,0.35)' : 'rgba(74,222,128,0.35)'}`,
        color: offline ? '#FCA5A5' : '#86EFAC',
        backdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', gap: 6,
        animation: 'slideDown 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: offline ? '#EF4444' : '#22C55E',
        animation: offline ? 'pulse 1.4s ease-in-out infinite' : 'none',
      }} />
      {offline ? 'Sin conexión' : 'Conectado'}
    </div>
  )
}
