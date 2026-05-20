// ─────────────────────────────────────────────
// QUEST — UpdateBanner
// ─────────────────────────────────────────────
// Detecta cuando el usuario tiene un bundle viejo y muestra una
// barra fija arriba con un botón "Recargar". Particularmente útil
// para PWAs en iOS — Apple cachea con uñas y dientes.
//
// Estrategia: cada 60s (y al volver al foreground) fetchea
// /index.html?t=<now> con cache: no-store, parsea el script src
// del bundle (asset hashed) y compara con el src que cargó el
// document actual. Si difieren → hay una versión más nueva en el
// CDN que la que está corriendo.
//
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'

const POLL_MS = 60_000

export default function UpdateBanner() {
  const [hasUpdate, setHasUpdate] = useState(false)
  const [busy, setBusy] = useState(false)

  // El bundle src que cargó este document — sirve de "versión actual".
  const currentBundle = (() => {
    try {
      const script = [...document.querySelectorAll('script[src]')].find(s => /\/assets\/index-/.test(s.src))
      return script?.src?.match(/\/assets\/index-[^/]+/)?.[0] ?? null
    } catch { return null }
  })()

  const check = useCallback(async () => {
    if (!currentBundle || hasUpdate) return
    try {
      const r = await fetch('/?t=' + Date.now(), { cache: 'no-store', credentials: 'omit' })
      if (!r.ok) return
      const html = await r.text()
      const m = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)
      const latest = m?.[0] ?? null
      if (latest && !currentBundle.includes(latest)) setHasUpdate(true)
    } catch { /* offline / network blip — silent */ }
  }, [currentBundle, hasUpdate])

  useEffect(() => {
    check()
    const interval = setInterval(check, POLL_MS)
    const onFocus = () => check()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [check])

  const handleReload = async () => {
    if (busy) return
    setBusy(true)
    // Nuke todo: SW, caches, storage relacionado al SW, luego hard reload.
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map(r => r.unregister()))
      }
    } catch {}
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
    } catch {}
    // Reload con cache bypass — query param fuerza al browser a
    // ignorar incluso su HTTP cache local.
    window.location.replace(location.pathname + '?_v=' + Date.now())
  }

  if (!hasUpdate) return null

  return (
    <div style={{
      position: 'fixed',
      top: 'calc(env(safe-area-inset-top, 0px) + 10px)',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px 10px 12px', borderRadius: 999,
      background: 'linear-gradient(135deg, #FB923C 0%, #F472B6 60%, #A78BFA 130%)',
      color: '#FFFFFF',
      fontSize: 13, fontWeight: 800,
      fontFamily: 'Inter, sans-serif',
      letterSpacing: '0.005em',
      boxShadow: '0 10px 28px rgba(244,114,182,0.30), 0 4px 10px rgba(167,139,250,0.20), inset 0 1px 0 rgba(255,255,255,0.30)',
      textShadow: '0 1px 0 rgba(0,0,0,0.18)',
      maxWidth: 'calc(100% - 24px)',
      cursor: 'pointer',
      animation: 'updateBannerIn 360ms cubic-bezier(0.34,1.56,0.64,1)',
    }} onClick={handleReload}>
      <RefreshCw size={16} strokeWidth={2.4} color="#FFFFFF" style={{
        animation: busy ? 'updateSpin 0.9s linear infinite' : 'none',
      }} />
      <span>{busy ? 'Actualizando…' : 'Nueva versión disponible · Recargar'}</span>
      <style>{`
        @keyframes updateBannerIn {
          0%   { opacity: 0; transform: translate(-50%, -16px); }
          100% { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes updateSpin {
          from { transform: rotate(0); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
