// ─────────────────────────────────────────────
// QUEST — EmptyState (reusable polished empty)
// ─────────────────────────────────────────────
// Polished empty state with optional icon, title, subtitle, and CTA.
// Replaces the old "emoji + plain text" pattern across screens.

export default function EmptyState({
  icon,           // ReactNode (SVG component or emoji as fallback)
  title,
  subtitle,
  ctaLabel,
  onCta,
  compact = false,
}) {
  return (
    <div style={{
      padding: compact ? '40px 24px' : '64px 24px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center', gap: 6,
      animation: 'fadeUp 0.35s ease both',
    }}>
      {icon && (
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
        fontFamily: 'Inter, sans-serif', letterSpacing: '-0.01em',
      }}>
        {title}
      </div>
      {subtitle && (
        <div style={{
          fontSize: 12.5, color: '#6B7280',
          fontFamily: 'Inter, sans-serif', lineHeight: 1.5,
          maxWidth: 260, marginTop: 2,
        }}>
          {subtitle}
        </div>
      )}
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          style={{
            marginTop: 16, padding: '10px 20px', borderRadius: 10,
            background: '#FFFFFF', border: 'none', color: '#111',
            fontSize: 13, fontWeight: 800, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
          }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  )
}
