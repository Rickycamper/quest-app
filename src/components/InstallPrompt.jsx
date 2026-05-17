// ─────────────────────────────────────────────
// QUEST — Install App Prompt
//
// Shows a small "Install Quest" banner once the browser fires the
// `beforeinstallprompt` event (Chrome / Edge / Samsung Internet on Android).
//
// iOS Safari does NOT fire this event — instead we detect iOS + non-standalone
// and show a tip telling the user to use Share → Add to Home Screen, since
// that's the only way to install a PWA on iOS.
//
// Dismissals are remembered for 14 days via localStorage so we don't nag.
// ─────────────────────────────────────────────
import { useState, useEffect } from 'react'

const DISMISS_KEY  = 'quest_install_dismissed_at'
const DISMISS_DAYS = 14

function isDismissed() {
  try {
    const ts = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10)
    if (!ts) return false
    return (Date.now() - ts) < DISMISS_DAYS * 24 * 60 * 60 * 1000
  } catch { return false }
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator?.standalone === true
}

function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showIOSHint, setShowIOSHint] = useState(false)
  const [dismissed, setDismissed] = useState(() => isDismissed())

  useEffect(() => {
    if (dismissed || isStandalone()) return

    // Android / Chrome / Edge: capture the install event and surface our banner
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS Safari can't fire the event — show a hint after 8 s of engagement
    // so we don't annoy users who just opened the link to look around.
    let iosTimer
    if (isIOS()) {
      iosTimer = setTimeout(() => setShowIOSHint(true), 8000)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      if (iosTimer) clearTimeout(iosTimer)
    }
  }, [dismissed])

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
    setDismissed(true)
    setDeferredPrompt(null)
    setShowIOSHint(false)
  }

  const install = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    try {
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') dismiss()
    } catch {}
    setDeferredPrompt(null)
  }

  if (dismissed || isStandalone()) return null
  if (!deferredPrompt && !showIOSHint) return null

  return (
    <div style={{
      position: 'fixed', left: 12, right: 12,
      bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)', // sits above BottomNav
      zIndex: 90,
      background: 'rgba(17,17,17,0.96)',
      border: '1px solid #2A2A2A',
      borderRadius: 14,
      padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(20px)',
      animation: 'fadeUp 0.4s ease both',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: 'rgba(167,139,250,0.12)',
        border: '1px solid rgba(167,139,250,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, flexShrink: 0,
      }}>⚡</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#FFF', marginBottom: 2 }}>
          {deferredPrompt ? 'Instalá Quest' : 'Instalá Quest en iPhone'}
        </div>
        <div style={{ fontSize: 11.5, color: '#9CA3AF', lineHeight: 1.4 }}>
          {deferredPrompt
            ? 'Acceso rápido desde tu home, sin abrir el browser.'
            : 'Tocá Compartir → "Añadir a inicio".'}
        </div>
      </div>
      {deferredPrompt && (
        <button onClick={install} style={{
          padding: '8px 14px', borderRadius: 9, border: 'none',
          background: '#A78BFA', color: '#111',
          fontSize: 12, fontWeight: 800, cursor: 'pointer', flexShrink: 0,
        }}>Instalar</button>
      )}
      <button onClick={dismiss} aria-label="Cerrar" style={{
        background: 'none', border: 'none', color: '#6B7280',
        fontSize: 18, cursor: 'pointer', padding: 4, flexShrink: 0, lineHeight: 1,
      }}>✕</button>
    </div>
  )
}
