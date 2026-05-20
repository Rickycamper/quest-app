// ─────────────────────────────────────────────
// QUEST — Follow success popup
// ─────────────────────────────────────────────
// Celebratory popup que aparece cuando seguís a alguien. Avatar grande,
// check con halo verde, "Siguiendo a @user", confetti de partículas, y
// haptic vibration en mobile/PWA. Auto-dismiss ~1.6 s. Tap para cerrar
// antes si se quiere.
//
// Uso:
//   const showFollow = useFollowSuccess()
//   showFollow({ username: 'pepito', avatarUrl: '...' })
//
import { useState, useCallback, useEffect, createContext, useContext } from 'react'
import Avatar from './Avatar'
import { HAPTIC } from '../lib/design-tokens'

const FollowSuccessContext = createContext(null)

export function FollowSuccessProvider({ children }) {
  const [popup, setPopup] = useState(null) // { username, avatarUrl, id }

  const show = useCallback((user) => {
    const id = Date.now() + Math.random()
    setPopup({ id, username: user?.username ?? '', avatarUrl: user?.avatar_url ?? null })
    // Patrón de vibración celebratorio — burst suave + segundo tap.
    // En PWA/Android se siente como un "tap-tap" cuando confirma la
    // acción. iOS Safari ignora navigator.vibrate por seguridad, pero
    // PWA instalado en iOS 17.4+ sí lo recibe.
    HAPTIC.success()
  }, [])

  // Auto-dismiss
  useEffect(() => {
    if (!popup) return
    const t = setTimeout(() => setPopup(null), 1800)
    return () => clearTimeout(t)
  }, [popup])

  return (
    <FollowSuccessContext.Provider value={show}>
      {children}
      {popup && <FollowSuccessOverlay popup={popup} onClose={() => setPopup(null)} />}
    </FollowSuccessContext.Provider>
  )
}

export function useFollowSuccess() {
  return useContext(FollowSuccessContext)
}

// ── Overlay ──────────────────────────────────────────────────────────
function FollowSuccessOverlay({ popup, onClose }) {
  // Partículas alrededor del avatar — 12 chispas en ángulos uniformes
  // que vuelan hacia afuera. CSS animation, no JS loop.
  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2
    const dx = Math.cos(angle) * 60
    const dy = Math.sin(angle) * 60
    const colors = ['#FB923C', '#F472B6', '#A78BFA', '#4ADE80', '#FACC15']
    return { dx, dy, color: colors[i % colors.length], delay: i * 18 }
  })

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99998,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(8px) saturate(140%)',
        WebkitBackdropFilter: 'blur(8px) saturate(140%)',
        animation: 'followBgIn 200ms ease',
        cursor: 'pointer',
        pointerEvents: 'auto',
      }}
    >
      <div style={{
        position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        padding: '28px 36px',
        background: 'linear-gradient(135deg, rgba(74,222,128,0.14) 0%, rgba(74,222,128,0.04) 60%, rgba(167,139,250,0.10) 100%)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid rgba(74,222,128,0.35)',
        borderRadius: 24,
        boxShadow: '0 0 40px rgba(74,222,128,0.25), 0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.10)',
        animation: 'followPopIn 420ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        maxWidth: 280,
      }}>
        {/* Particle burst */}
        {particles.map((p, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: 'calc(50% - 4px)', left: 'calc(50% - 4px)',
              width: 8, height: 8, borderRadius: '50%',
              background: p.color,
              boxShadow: `0 0 8px ${p.color}`,
              pointerEvents: 'none',
              opacity: 0,
              animation: `followBurst 900ms cubic-bezier(0.22, 1, 0.36, 1) ${p.delay}ms forwards`,
              '--burst-x': `${p.dx}px`,
              '--burst-y': `${p.dy}px`,
            }}
          />
        ))}

        {/* Avatar block with check overlay */}
        <div style={{ position: 'relative', width: 84, height: 84 }}>
          <div style={{
            width: 84, height: 84, borderRadius: '50%',
            overflow: 'hidden',
            border: '3px solid rgba(74,222,128,0.6)',
            boxShadow: '0 0 24px rgba(74,222,128,0.45), inset 0 1px 0 rgba(255,255,255,0.10)',
            background: '#111',
          }}>
            <Avatar url={popup.avatarUrl} size={84} />
          </div>
          {/* Check badge bottom-right */}
          <div style={{
            position: 'absolute', right: -4, bottom: -4,
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg, #4ADE80 0%, #22C55E 100%)',
            border: '3px solid rgba(10,10,18,0.95)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(74,222,128,0.45)',
            animation: 'followCheckPop 520ms cubic-bezier(0.34, 1.56, 0.64, 1) 180ms backwards',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#062013" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        {/* Text */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{
            fontSize: 11, fontWeight: 800, color: '#4ADE80',
            letterSpacing: '0.18em', textTransform: 'uppercase',
            fontFamily: 'Inter, sans-serif',
          }}>
            Siguiendo
          </div>
          <div style={{
            fontSize: 18, fontWeight: 800, color: '#FFFFFF',
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '-0.01em',
            maxWidth: 240,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            @{popup.username}
          </div>
        </div>
      </div>

      {/* Keyframes inline (one-shot) */}
      <style>{`
        @keyframes followBgIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes followPopIn {
          0%   { opacity: 0; transform: scale(0.6) translateY(20px); }
          60%  { opacity: 1; transform: scale(1.06) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes followCheckPop {
          0%   { transform: scale(0); opacity: 0; }
          70%  { transform: scale(1.18); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes followBurst {
          0%   { transform: translate(0, 0) scale(0); opacity: 0; }
          25%  { opacity: 1; }
          100% { transform: translate(var(--burst-x), var(--burst-y)) scale(0.4); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
