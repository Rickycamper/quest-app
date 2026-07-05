// ─────────────────────────────────────────────
// QUEST — UpdateBanner (con auto-update)
// ─────────────────────────────────────────────
// Detecta cuando hay un bundle más nuevo en el CDN que el que está corriendo.
//
// Estrategia: cada 60s (y al volver a la app) fetchea /index.html con
// cache: no-store, parsea el script src del bundle (asset hashed) y lo
// compara con el que cargó el document. Si difieren → hay versión nueva.
//
// AUTO-UPDATE: cuando la persona VUELVE a la app (foreground / focus de
// pestaña) y hay versión nueva, recarga SOLA — así nadie se queda pegado en
// una versión vieja por el caché/Service Worker. No recarga si estás
// escribiendo (input/textarea enfocado) ni si acaba de recargar (anti-loop);
// en esos casos muestra el banner para tocar manualmente.
//
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'

const POLL_MS = 60_000
const AUTO_FLAG = 'quest_auto_reload_at'

// Evita loops: si auto-recargó hace <20s y sigue detectando mismatch, no
// vuelve a recargar solo (muestra el banner).
function recentlyAutoReloaded() {
  try { return Date.now() - parseInt(sessionStorage.getItem(AUTO_FLAG) || '0', 10) < 20_000 } catch { return false }
}

// No interrumpir si la persona está tipeando algo.
function safeToReload() {
  const el = document.activeElement
  const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
  return !typing
}

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

  // Nuke SW + caches + hard reload (bypass del HTTP cache con query param).
  const doReload = useCallback(async (isAuto) => {
    if (isAuto) { try { sessionStorage.setItem(AUTO_FLAG, String(Date.now())) } catch {} }
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
    window.location.replace(location.pathname + '?_v=' + Date.now())
  }, [])

  // autoReload=true cuando la persona vuelve a la app (foreground/focus).
  const check = useCallback(async (autoReload = false) => {
    if (!currentBundle) return
    // Ya sabíamos que hay update: si vuelve a la app, recargamos solo.
    if (hasUpdate) {
      if (autoReload && safeToReload() && !recentlyAutoReloaded()) doReload(true)
      return
    }
    try {
      const r = await fetch('/?t=' + Date.now(), { cache: 'no-store', credentials: 'omit' })
      if (!r.ok) return
      const html = await r.text()
      const m = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)
      const latest = m?.[0] ?? null
      if (latest && !currentBundle.includes(latest)) {
        // Hay versión nueva. Si la persona volvió a la app y no está tipeando,
        // recargamos solo; si no, mostramos el banner para tocar.
        if (autoReload && safeToReload() && !recentlyAutoReloaded()) { doReload(true); return }
        setHasUpdate(true)
      }
    } catch { /* offline / network blip — silent */ }
  }, [currentBundle, hasUpdate, doReload])

  useEffect(() => {
    check(false)                                   // al cargar: solo banner (no auto)
    const interval = setInterval(() => check(false), POLL_MS)  // en foreground: banner
    const onReturn = () => { if (document.visibilityState === 'visible') check(true) } // volver a la app: auto
    window.addEventListener('focus', onReturn)
    document.addEventListener('visibilitychange', onReturn)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onReturn)
      document.removeEventListener('visibilitychange', onReturn)
    }
  }, [check])

  const handleReload = async () => {
    if (busy) return
    setBusy(true)
    await doReload(false)
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
