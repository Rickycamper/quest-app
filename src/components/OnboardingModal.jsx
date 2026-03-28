// ─────────────────────────────────────────────
// QUEST — OnboardingModal
// First-time user walkthrough
// ─────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react'

const SLIDES = [
  {
    emoji: '👋',
    title: 'Bienvenido a Quest',
    body: 'Tu hub de TCG local. Conectate con jugadores cerca tuyo para comprar, vender, tradear y competir.',
    cta: 'Empezar',
    accent: '#A78BFA',
    bg: 'rgba(167,139,250,0.08)',
    border: 'rgba(167,139,250,0.2)',
  },
  {
    emoji: '📸',
    title: 'Publicá en el feed',
    body: 'Mostrá tus cartas, anunciá lo que buscás, tenés, vendés o tradeas. Tocá el botón\u00a0\u002b del centro para crear un post.',
    hint: '💡 Podés subir hasta 10 fotos o un video por post',
    accent: '#60A5FA',
    bg: 'rgba(96,165,250,0.08)',
    border: 'rgba(96,165,250,0.2)',
  },
  {
    emoji: '⚔️',
    title: 'H2H — Registrá partidas',
    body: 'Cada vez que jugás contra alguien, registrá el resultado. Ganás puntos y subís en el ranking del juego.',
    hint: '💡 En cualquier perfil podés tocar ⚔️\u00a0VS para desafiar y registrar el match',
    accent: '#F87171',
    bg: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.2)',
  },
  {
    emoji: '🏆',
    title: 'Torneos locales',
    body: 'Inscribite en torneos que organizan las tiendas o creá el tuyo propio. Los top 3 acumulan puntos automáticamente.',
    hint: '💡 Encontrás los torneos en Rankings → Torneos',
    accent: '#FBBF24',
    bg: 'rgba(251,191,36,0.08)',
    border: 'rgba(251,191,36,0.2)',
  },
  {
    emoji: '🎯',
    title: 'Reclamá tus puntos',
    body: 'Terminaste top 3 en un torneo? Reportá tu resultado para que un admin lo valide y acredite los puntos.',
    hint: '💡 Andá a Rankings → usá el botón\u00a0\u002b para reportar',
    accent: '#4ADE80',
    bg: 'rgba(74,222,128,0.08)',
    border: 'rgba(74,222,128,0.2)',
  },
  {
    emoji: '📦',
    title: 'Tracking de envíos',
    body: 'Compraste o vendiste algo? Creá un envío para que el comprador pueda seguir el estado del paquete en tiempo real.',
    hint: '💡 Encontrás el tracking en la sección\u00a0📦 del menú',
    accent: '#FB923C',
    bg: 'rgba(251,146,60,0.08)',
    border: 'rgba(251,146,60,0.2)',
  },
]

export default function OnboardingModal({ onDone }) {
  const [slide, setSlide]     = useState(0)
  const [dragX, setDragX]     = useState(0)
  const [leaving, setLeaving] = useState(false) // fade-out on finish
  const startX  = useRef(null)
  const s       = SLIDES[slide]
  const isLast  = slide === SLIDES.length - 1

  // Swipe support
  const onTouchStart = (e) => { startX.current = e.touches[0].clientX }
  const onTouchMove  = (e) => {
    if (startX.current === null) return
    setDragX(e.touches[0].clientX - startX.current)
  }
  const onTouchEnd   = () => {
    if (dragX < -50 && slide < SLIDES.length - 1) setSlide(s => s + 1)
    if (dragX >  50 && slide > 0)                  setSlide(s => s - 1)
    startX.current = null
    setDragX(0)
  }

  const next = () => {
    if (isLast) {
      setLeaving(true)
      setTimeout(onDone, 320)
    } else {
      setSlide(s => s + 1)
    }
  }

  const skip = () => {
    setLeaving(true)
    setTimeout(onDone, 320)
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.92)',
      backdropFilter: 'blur(12px)',
      display: 'flex', flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      animation: leaving ? 'fadeOutFast 0.3s ease forwards' : 'fadeInFast 0.35s ease',
    }}>

      {/* Skip */}
      {!isLast && (
        <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={skip} style={{
            background: 'none', border: 'none', color: '#4B5563',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif', padding: '4px 8px',
          }}>Saltar</button>
        </div>
      )}

      {/* Slide content */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '20px 32px',
          transform: `translateX(${dragX * 0.12}px)`,
          transition: dragX === 0 ? 'transform 0.3s ease' : 'none',
        }}
      >
        {/* Emoji card */}
        <div style={{
          width: 96, height: 96, borderRadius: 28,
          background: s.bg,
          border: `1.5px solid ${s.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 44, marginBottom: 28,
          boxShadow: `0 0 32px ${s.bg}`,
          animation: 'onboardPop 0.4s cubic-bezier(0.175,0.885,0.32,1.275) both',
          animationDelay: '0.05s',
        }}>
          {s.emoji}
        </div>

        {/* Title */}
        <div style={{
          fontSize: 22, fontWeight: 800, color: '#FFFFFF',
          fontFamily: 'Inter, sans-serif', textAlign: 'center',
          marginBottom: 14, lineHeight: 1.25,
          animation: 'fadeUp 0.35s ease both', animationDelay: '0.1s',
        }}>
          {s.title}
        </div>

        {/* Body */}
        <div style={{
          fontSize: 15, color: '#9CA3AF', lineHeight: 1.65,
          textAlign: 'center', fontFamily: 'Inter, sans-serif',
          maxWidth: 300, marginBottom: s.hint ? 18 : 0,
          animation: 'fadeUp 0.35s ease both', animationDelay: '0.15s',
        }}>
          {s.body}
        </div>

        {/* Hint pill */}
        {s.hint && (
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 10, padding: '9px 14px',
            fontSize: 12, color: '#6B7280',
            fontFamily: 'Inter, sans-serif', textAlign: 'center',
            lineHeight: 1.5, maxWidth: 300,
            animation: 'fadeUp 0.35s ease both', animationDelay: '0.2s',
          }}>
            {s.hint}
          </div>
        )}
      </div>

      {/* Bottom: dots + button */}
      <div style={{
        padding: '0 32px calc(env(safe-area-inset-bottom, 0px) + 32px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
      }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6 }}>
          {SLIDES.map((_, i) => (
            <div
              key={i}
              onClick={() => setSlide(i)}
              style={{
                width: i === slide ? 20 : 6,
                height: 6, borderRadius: 3,
                background: i === slide ? s.accent : '#2A2A2A',
                transition: 'all 0.25s ease',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={next}
          style={{
            width: '100%', padding: '15px 0',
            background: s.accent, border: 'none', borderRadius: 14,
            color: '#0A0A0A', fontSize: 15, fontWeight: 800,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            transition: 'transform 0.12s, opacity 0.12s',
            boxShadow: `0 4px 20px ${s.bg}`,
          }}
          onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)' }}
          onMouseUp={e   => { e.currentTarget.style.transform = 'scale(1)' }}
          onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.97)' }}
          onTouchEnd={e   => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          {isLast ? '¡Empezar a jugar! 🎮' : (s.cta ?? 'Siguiente →')}
        </button>
      </div>
    </div>
  )
}
