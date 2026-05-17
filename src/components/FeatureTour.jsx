// ─────────────────────────────────────────────
// QUEST — Feature Tour
//
// Actionable onboarding for returning users. Walks through 5 key flows
// (username setup, match logging, tracking, rankings, tournaments) with a
// "Probar ahora" button on each step so they can actually USE the feature.
//
// Shown ONCE per user. If they skip or close at any point, we mark them
// done permanently. Tracked in localStorage as `quest_feature_tour_done_v1_<userId>`.
//
// Different from /components/OnboardingModal.jsx which is a pure swipe-through
// info walkthrough for first-time signups.
// ─────────────────────────────────────────────
import { useState } from 'react'

const TOUR_KEY_PREFIX = 'quest_feature_tour_done_v1_'

export function isFeatureTourDone(userId) {
  if (!userId) return true
  try { return !!localStorage.getItem(TOUR_KEY_PREFIX + userId) } catch { return true }
}

export function markFeatureTourDone(userId) {
  if (!userId) return
  try { localStorage.setItem(TOUR_KEY_PREFIX + userId, String(Date.now())) } catch {}
}

// ── Step content. Order matters — username comes first because we want them
// to set a real handle before they start interacting with others. ────────────
const STEPS = [
  {
    emoji: '⚙️',
    title: 'Configurá tu usuario',
    body: 'Subí tu foto, ajustá tu nombre, agregá tu teléfono y tu juego favorito. Esto hace que otros jugadores te reconozcan.',
    cta: 'Editar mi perfil',
    accent: '#A78BFA',
    bg: 'rgba(167,139,250,0.08)',
    border: 'rgba(167,139,250,0.22)',
    action: 'profile',
  },
  {
    emoji: '⚔️',
    title: 'Jugá un match contra alguien',
    body: 'Cada vez que jugás contra otro jugador, registrá el resultado. Subís en el ranking del juego y se acumula tu historial cabeza a cabeza.',
    hint: '💡 También podés tocar el ⚔️ VS en cualquier perfil.',
    cta: 'Registrar match',
    accent: '#F87171',
    bg: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.22)',
    action: 'match',
  },
  {
    emoji: '📦',
    title: 'Trackeá un envío',
    body: 'Si comprás, vendés o tradeas con alguien de otra ciudad, creá un tracking para que el otro vea el estado del paquete en tiempo real.',
    hint: '💡 La prueba te llega al admin (RickyQuest) — luego la podemos borrar.',
    cta: 'Crear tracking de prueba',
    accent: '#FB923C',
    bg: 'rgba(251,146,60,0.08)',
    border: 'rgba(251,146,60,0.22)',
    action: 'tracking',
  },
  {
    emoji: '🏆',
    title: 'Mirá los rankings',
    body: 'Cada juego tiene su propio ranking — Magic, Pokémon, One Piece, Digimon. Si vas a torneos, vas subiendo posiciones.',
    cta: 'Ver rankings',
    accent: '#FBBF24',
    bg: 'rgba(251,191,36,0.08)',
    border: 'rgba(251,191,36,0.22)',
    action: 'rankings',
  },
  {
    emoji: '🎯',
    title: 'Inscribite en torneos',
    body: 'En la pestaña de Ranking también encontrás torneos abiertos. Te inscribís, vas a jugar y reportás tu resultado para que el staff lo valide.',
    cta: 'Ver torneos',
    accent: '#4ADE80',
    bg: 'rgba(74,222,128,0.08)',
    border: 'rgba(74,222,128,0.22)',
    action: 'tournaments',
  },
]

export default function FeatureTour({ userId, onSkip, onAction }) {
  const [step,    setStep]    = useState(0)
  const [leaving, setLeaving] = useState(false)

  const s      = STEPS[step]
  const isLast = step === STEPS.length - 1

  // Close = "skip" = mark done forever
  const close = () => {
    setLeaving(true)
    setTimeout(() => {
      markFeatureTourDone(userId)
      onSkip?.()
    }, 280)
  }

  // "Probar ahora" → mark done, fire the action callback so the parent
  // opens the relevant modal / screen
  const tryNow = () => {
    setLeaving(true)
    setTimeout(() => {
      markFeatureTourDone(userId)
      onAction?.(s.action)
    }, 280)
  }

  const next = () => {
    if (isLast) close()
    else setStep(n => n + 1)
  }

  return (
    <div
      role="dialog"
      aria-label="Tour de funciones"
      style={{
        position: 'absolute', inset: 0, zIndex: 600,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
        display: 'flex', flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        animation: leaving ? 'fadeOutFast 0.28s ease forwards' : 'fadeInFast 0.32s ease',
      }}
    >
      {/* Skip / close pinned top-right */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 18px 0' }}>
        <button onClick={close} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#6B7280', fontSize: 13, fontWeight: 600, padding: '6px 10px',
        }}>
          Saltar tour
        </button>
      </div>

      {/* Content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 32px',
      }}>
        {/* Emoji card */}
        <div style={{
          width: 92, height: 92, borderRadius: 26,
          background: s.bg,
          border: `1.5px solid ${s.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 42, marginBottom: 24,
          boxShadow: `0 0 28px ${s.bg}`,
          animation: 'fadeUp 0.3s ease both',
        }}>
          {s.emoji}
        </div>

        <div style={{
          fontSize: 22, fontWeight: 800, color: '#FFFFFF',
          textAlign: 'center', marginBottom: 12, lineHeight: 1.25,
          animation: 'fadeUp 0.3s ease both', animationDelay: '50ms',
        }}>
          {s.title}
        </div>

        <div style={{
          fontSize: 14, color: '#9CA3AF', lineHeight: 1.55,
          textAlign: 'center', maxWidth: 300,
          marginBottom: s.hint ? 16 : 0,
          animation: 'fadeUp 0.3s ease both', animationDelay: '100ms',
        }}>
          {s.body}
        </div>

        {s.hint && (
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: '9px 14px',
            fontSize: 12, color: '#6B7280',
            textAlign: 'center', lineHeight: 1.5,
            maxWidth: 300,
            animation: 'fadeUp 0.3s ease both', animationDelay: '150ms',
          }}>
            {s.hint}
          </div>
        )}
      </div>

      {/* Bottom: dots + buttons */}
      <div style={{
        padding: '0 24px calc(env(safe-area-inset-bottom, 0px) + 28px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
      }}>
        {/* progress dots */}
        <div style={{ display: 'flex', gap: 6 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              onClick={() => setStep(i)}
              style={{
                width: i === step ? 22 : 6, height: 6, borderRadius: 3,
                background: i === step ? s.accent : '#2A2A2A',
                transition: 'all 0.25s ease', cursor: 'pointer',
              }}
            />
          ))}
        </div>

        {/* Primary: try now (color-accented per step) */}
        <button
          onClick={tryNow}
          style={{
            width: '100%', padding: '14px 0',
            background: s.accent, border: 'none', borderRadius: 12,
            color: '#0A0A0A', fontSize: 15, fontWeight: 800,
            cursor: 'pointer',
            boxShadow: `0 6px 20px ${s.bg}`,
            transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
          onMouseUp  ={e => e.currentTarget.style.transform = 'scale(1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          onTouchStart={e => e.currentTarget.style.transform = 'scale(0.97)'}
          onTouchEnd  ={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {s.cta}
        </button>

        {/* Secondary: skip to next step or finish */}
        <button
          onClick={next}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#6B7280', fontSize: 13, fontWeight: 600,
            padding: 4,
          }}
        >
          {isLast ? 'Terminar' : 'Lo veo después →'}
        </button>
      </div>
    </div>
  )
}
