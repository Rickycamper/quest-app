// ─────────────────────────────────────────────
// QUEST — Spinner (unified loading indicator)
// ─────────────────────────────────────────────
// Single source of truth for loading spinners across the app.
// Use sizes: 'xs' (10), 'sm' (14), 'md' (20), 'lg' (28).

const SIZES = { xs: 10, sm: 14, md: 20, lg: 28 }

export default function Spinner({
  size = 'md',
  color = '#FFFFFF',
  trackColor = 'rgba(255,255,255,0.1)',
  thickness,
  inline = false,
  centered = false,
}) {
  const px = typeof size === 'number' ? size : (SIZES[size] ?? SIZES.md)
  const t = thickness ?? Math.max(1.5, Math.round(px / 10))

  const ring = (
    <span
      role="status"
      aria-label="Cargando"
      style={{
        display: 'inline-block',
        width: px, height: px, borderRadius: '50%',
        border: `${t}px solid ${trackColor}`,
        borderTopColor: color,
        animation: 'spin 0.7s linear infinite',
        flexShrink: 0,
      }}
    />
  )

  if (inline) return ring
  if (centered) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
        {ring}
      </div>
    )
  }
  return ring
}
