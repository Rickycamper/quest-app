// ─────────────────────────────────────────────────────────────────────────────
// QUEST — UI Presets
//
// Reusable style fragments built on top of design-tokens.js. Use these
// instead of repeating the same inline objects across screens. They compose
// — spread the preset, then override anything specific:
//
//   <div style={{ ...UI.card, padding: 20 }}>
//
// Goals:
//   1. Consistency — same elevation, same radius, same border across the app.
//   2. Less inline noise — screens describe content, not visuals.
//   3. Single place to retune the look. Change a token → app-wide upgrade.
// ─────────────────────────────────────────────────────────────────────────────
import { COLOR, RADIUS, SPACING, TYPE, WEIGHT, MOTION, FONT_STACK } from './design-tokens'

// ── Elevation (5-stop shadow scale, neutral) ─────────────────────────────────
// On dark UI, shadows alone are subtle — we pair them with a 1 px border to
// make the elevation legible. Use *box* for surfaces, *hover* for lift.
export const ELEVATION = {
  flat:  'none',
  sm:    '0 1px 2px rgba(0,0,0,0.4)',
  md:    '0 4px 12px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.4)',
  lg:    '0 12px 32px rgba(0,0,0,0.55), 0 4px 8px rgba(0,0,0,0.4)',
  xl:    '0 24px 64px rgba(0,0,0,0.6), 0 8px 16px rgba(0,0,0,0.45)',
  // Inner highlight — gives cards that subtle "top-lit" feel like iOS widgets
  innerLit: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

// ── Surface presets ──────────────────────────────────────────────────────────
export const UI = {
  // Base card — what 90% of grouped content should sit in
  card: {
    background: COLOR.surface,
    border: `1px solid ${COLOR.border}`,
    borderRadius: RADIUS.lg,
    boxShadow: `${ELEVATION.sm}, ${ELEVATION.innerLit}`,
    overflow: 'hidden',
  },

  // Raised card — primary content, hero areas
  cardRaised: {
    background: COLOR.surface,
    border: `1px solid ${COLOR.borderStrong}`,
    borderRadius: RADIUS.lg,
    boxShadow: `${ELEVATION.md}, ${ELEVATION.innerLit}`,
    overflow: 'hidden',
  },

  // Interactive card — adds hover lift + cursor
  cardInteractive: {
    background: COLOR.surface,
    border: `1px solid ${COLOR.border}`,
    borderRadius: RADIUS.lg,
    boxShadow: `${ELEVATION.sm}, ${ELEVATION.innerLit}`,
    overflow: 'hidden',
    cursor: 'pointer',
    transition: MOTION.springTransition,
  },

  // Glass / translucent surface — sticky headers, floating chips
  glass: {
    background: 'rgba(17,17,17,0.72)',
    backdropFilter: 'saturate(180%) blur(20px)',
    WebkitBackdropFilter: 'saturate(180%) blur(20px)',
    border: `1px solid rgba(255,255,255,0.06)`,
  },

  // ── Buttons (4 variants) ───────────────────────────────────────────────────
  btnPrimary: {
    width: '100%',
    padding: '14px 18px',
    background: '#FFFFFF',
    border: 'none',
    borderRadius: RADIUS.md,
    color: '#111111',
    fontSize: TYPE.body,
    fontWeight: WEIGHT.semibold,
    fontFamily: FONT_STACK,
    cursor: 'pointer',
    transition: MOTION.springTransition,
    boxShadow: ELEVATION.sm,
    letterSpacing: '-0.01em',
  },

  btnSecondary: {
    width: '100%',
    padding: '13px 18px',
    background: COLOR.surfaceRaised,
    border: `1px solid ${COLOR.borderStrong}`,
    borderRadius: RADIUS.md,
    color: COLOR.text,
    fontSize: TYPE.body,
    fontWeight: WEIGHT.semibold,
    fontFamily: FONT_STACK,
    cursor: 'pointer',
    transition: MOTION.springTransition,
    letterSpacing: '-0.01em',
  },

  btnGhost: {
    background: 'transparent',
    border: 'none',
    color: COLOR.textSecondary,
    fontSize: TYPE.footnote,
    fontWeight: WEIGHT.medium,
    fontFamily: FONT_STACK,
    cursor: 'pointer',
    padding: `${SPACING.sm}px ${SPACING.md}px`,
    borderRadius: RADIUS.sm,
    transition: MOTION.quickTransition,
  },

  // Pill / chip — used for tags, filters, segmented controls
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: SPACING.xs + 2,
    padding: '6px 12px',
    background: COLOR.surfaceRaised,
    border: `1px solid ${COLOR.borderStrong}`,
    borderRadius: RADIUS.full,
    color: COLOR.textSecondary,
    fontSize: TYPE.caption + 1,  // 12
    fontWeight: WEIGHT.semibold,
    fontFamily: FONT_STACK,
    cursor: 'pointer',
    transition: MOTION.quickTransition,
    letterSpacing: '0.01em',
  },

  pillActive: {
    background: '#FFFFFF',
    border: '1px solid #FFFFFF',
    color: '#111111',
  },

  // ── Inputs ─────────────────────────────────────────────────────────────────
  input: {
    width: '100%',
    padding: '13px 14px',
    background: COLOR.surface,
    border: `1px solid ${COLOR.borderStrong}`,
    borderRadius: RADIUS.md,
    color: COLOR.text,
    fontSize: TYPE.body,
    fontFamily: FONT_STACK,
    fontWeight: WEIGHT.regular,
    outline: 'none',
    boxSizing: 'border-box',
    transition: MOTION.quickTransition,
  },

  // ── Typography presets — semantic, no magic numbers ────────────────────────
  display: {
    fontSize: TYPE.display,
    fontWeight: WEIGHT.bold,
    color: COLOR.text,
    fontFamily: FONT_STACK,
    letterSpacing: '-0.025em',
    lineHeight: 1.15,
  },
  title2: {
    fontSize: TYPE.title2,
    fontWeight: WEIGHT.bold,
    color: COLOR.text,
    fontFamily: FONT_STACK,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
  },
  title3: {
    fontSize: TYPE.title3,
    fontWeight: WEIGHT.semibold,
    color: COLOR.text,
    fontFamily: FONT_STACK,
    letterSpacing: '-0.01em',
    lineHeight: 1.3,
  },
  body: {
    fontSize: TYPE.body,
    fontWeight: WEIGHT.regular,
    color: COLOR.text,
    fontFamily: FONT_STACK,
    lineHeight: 1.5,
  },
  footnote: {
    fontSize: TYPE.footnote,
    fontWeight: WEIGHT.regular,
    color: COLOR.textSecondary,
    fontFamily: FONT_STACK,
    lineHeight: 1.45,
  },
  caption: {
    fontSize: TYPE.caption,
    fontWeight: WEIGHT.medium,
    color: COLOR.textTertiary,
    fontFamily: FONT_STACK,
    letterSpacing: '0.02em',
    lineHeight: 1.4,
  },
  // Uppercase label — for SECTION HEADERS like "JUGADORES", "TORNEOS"
  eyebrow: {
    fontSize: 10,
    fontWeight: WEIGHT.bold,
    color: COLOR.textTertiary,
    fontFamily: FONT_STACK,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },

  // ── Badge / dot ────────────────────────────────────────────────────────────
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    background: '#EF4444',
    border: '2px solid #0A0A0A',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    fontWeight: WEIGHT.bold,
    color: '#FFFFFF',
    padding: '0 5px',
    fontFamily: FONT_STACK,
  },

  // ── Divider ────────────────────────────────────────────────────────────────
  divider: {
    height: 1,
    background: COLOR.border,
    border: 'none',
    margin: 0,
  },

  // ── Skeleton (loading placeholder) ─────────────────────────────────────────
  skeleton: {
    background: `linear-gradient(90deg, ${COLOR.surface} 0%, ${COLOR.surfaceRaised} 50%, ${COLOR.surface} 100%)`,
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s ease-in-out infinite',
    borderRadius: RADIUS.sm,
  },
}

// ── Helpers ──────────────────────────────────────────────────────────────────
//   pressable(base) → adds a tactile press animation, used for tap surfaces
//                     spread the result on a button or div.
export function pressable(base = {}) {
  return {
    ...base,
    transition: MOTION.springTransition,
    transform: 'scale(1)',
    cursor: 'pointer',
    // Combine with className 'pressable' to get the active state via CSS.
  }
}

// Focus ring for inputs — accessible, blue-ish so it reads on dark UI.
export const focusRing = `0 0 0 3px rgba(96,165,250,0.35)`

// One-stop hover lift for cards. Apply on mouseover via state, or via
// className 'lift'.
export const HOVER_LIFT = {
  transform: 'translateY(-1px)',
  boxShadow: `${ELEVATION.md}, ${ELEVATION.innerLit}`,
}

// ── Keyframes (one-time CSS injection helper) ────────────────────────────────
// Call once at app boot to register `shimmer`, `fadeUp`, `slideUp`, etc.
let injected = false
export function injectGlobalKeyframes() {
  if (injected || typeof document === 'undefined') return
  injected = true
  const style = document.createElement('style')
  style.textContent = `
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
    @keyframes pop     { 0%{transform:scale(.85)} 60%{transform:scale(1.04)} 100%{transform:scale(1)} }
    @keyframes bounce  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
    @keyframes tabBounce { 0%{transform:scale(1)} 40%{transform:scale(1.15)} 100%{transform:scale(1)} }
    @keyframes seasonShine {
      0%   { background-position: -100% 0; }
      55%  { background-position:  120% 0; }
      100% { background-position:  120% 0; }
    }
    @keyframes trophyGlow {
      0%, 100% { box-shadow: 0 0 14px rgba(245,158,11,0.22), inset 0 1px 0 rgba(255,255,255,0.06); }
      50%      { box-shadow: 0 0 22px rgba(251,191,36,0.45), inset 0 1px 0 rgba(255,255,255,0.08); }
    }
    @keyframes pulseDot {
      0%, 100% { opacity: 1;   transform: scale(1); }
      50%      { opacity: 0.55; transform: scale(0.85); }
    }
    .pressable:active { transform: scale(0.97); }
    .lift:hover { transform: translateY(-1px); }
  `
  document.head.appendChild(style)
}

// Re-export the tokens for convenience so screens import from one place.
export { COLOR, RADIUS, SPACING, TYPE, WEIGHT, MOTION, FONT_STACK, HAPTIC } from './design-tokens'
