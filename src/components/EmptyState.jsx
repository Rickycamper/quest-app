// ─────────────────────────────────────────────
// QUEST — EmptyState (reusable polished empty)
// ─────────────────────────────────────────────
// Polished empty state with optional icon OR hero illustration, title,
// subtitle, and CTA.
//
// Use `icon`  for everyday cases (no results, filter empty).
// Use `heroImage` for first-time / brand moments — renders a bigger image
// with a subtle purple/gold glow halo behind it. Pulls from our brand
// illustration set (monsters, skull, etc.).

export default function EmptyState({
  icon,           // ReactNode — small icon mode
  heroImage,      // string  — img src — branded illustration mode
  title,
  subtitle,
  ctaLabel,
  onCta,
  compact = false,
}) {
  return (
    <div style={{
      padding: compact ? '40px 24px' : '56px 24px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center', gap: 6,
      animation: 'fadeUp 0.35s ease both',
    }}>
      {/* Branded hero illustration with aurora-like glow halo */}
      {heroImage && (
        <div style={{
          position: 'relative', marginBottom: 18,
          width: 180, height: 140,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            position: 'absolute', inset: -10, borderRadius: '50%',
            background: `
              radial-gradient(ellipse 120px 90px at 50% 50%, rgba(167,139,250,0.10) 0%, transparent 65%),
              radial-gradient(ellipse 90px 70px at 50% 60%, rgba(251,191,36,0.06) 0%, transparent 65%)
            `,
            filter: 'blur(6px)',
          }} />
          <img
            src={heroImage}
            alt=""
            width={180} height={140}
            loading="lazy" decoding="async"
            style={{
              position: 'relative', maxWidth: '100%', maxHeight: '100%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 6px 24px rgba(0,0,0,0.5))',
              opacity: 0.92,
            }}
          />
        </div>
      )}
      {/* Standard icon (no hero) */}
      {!heroImage && icon && (
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 70%)',
          border: '1px solid #1F1F1F',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 14,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 16px rgba(0,0,0,0.3)',
        }}>
          <div style={{ color: '#4B5563', opacity: 0.9 }}>{icon}</div>
        </div>
      )}
      <div style={{
        fontSize: 15, fontWeight: 700, color: '#E5E5E5',
        letterSpacing: '-0.01em',
      }}>
        {title}
      </div>
      {subtitle && (
        <div style={{
          fontSize: 12.5, color: '#6B7280',
          lineHeight: 1.5,
          maxWidth: 270, marginTop: 2,
        }}>
          {subtitle}
        </div>
      )}
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          style={{
            marginTop: 16, padding: '11px 22px', borderRadius: 12,
            background: '#FFFFFF', border: 'none', color: '#111',
            fontSize: 13, fontWeight: 800, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1) inset',
            transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
          onMouseUp  ={e => e.currentTarget.style.transform = 'scale(1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          onTouchStart={e => e.currentTarget.style.transform = 'scale(0.96)'}
          onTouchEnd  ={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  )
}
