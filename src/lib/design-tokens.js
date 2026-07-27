// ─────────────────────────────────────────────────────────────────────────────
// QUEST — Design Tokens
//
// Single source of truth for the visual system. Inspired by Apple HIG.
// Use these instead of magic numbers / hex codes everywhere from now on.
//
// Migration: existing screens keep their inline styles for now. New code
// should reach into TOKENS. We'll backfill the old code over time.
// ─────────────────────────────────────────────────────────────────────────────

// ── Typography scale (6 sizes — Apple iOS HIG) ───────────────────────────────
export const TYPE = {
  caption:   11,   // labels, timestamps, secondary metadata
  footnote:  13,   // small body, hints, captions for posts
  body:      15,   // default body text
  title3:    17,   // section titles, list-row primaries
  title2:    22,   // screen titles, modal headers
  display:   28,   // hero, big numbers, big metrics
}

// Font weights — Apple uses fewer, with semantic meaning.
export const WEIGHT = {
  regular:   400,  // body text — let it breathe
  medium:    500,  // labels, secondary text
  semibold:  600,  // titles, emphasis
  bold:      700,  // hero, primary CTAs (use sparingly)
}

// ── Color tokens (4 text levels + surfaces) ──────────────────────────────────
// Replaces the 7+ near-identical grays scattered across the codebase.
// Rebuild One UI (jul 2026): superficies planas y calmas, un solo acento
// interactivo, color únicamente donde significa algo (estado/identidad).
export const COLOR = {
  // Text
  text:           '#F4F5F7',  // primary text (blanco suave, One UI)
  textSecondary:  '#9AA0A8',  // secondary text
  textTertiary:   '#6E747D',  // disabled, metadata
  textQuaternary: '#4B5563',  // hint text only

  // Surfaces (One UI dark: fondo casi negro plano + cards apenas elevadas)
  background:     '#050506',  // app background — PLANO, sin gradientes
  surface:        '#161619',  // cards, listas agrupadas
  surfaceRaised:  '#1C1C21',  // modals, sheets, cards elevadas
  surfaceHover:   '#222228',  // hover / pressed states
  surfaceInput:   '#101013',  // inputs

  // Borders (hairlines translúcidas — se funden con cualquier surface)
  border:         'rgba(255,255,255,0.055)',
  borderStrong:   'rgba(255,255,255,0.10)',

  // EL acento interactivo (links, tabs activos, toggles ON, foco)
  accent:         '#4C9EFF',
  accentDim:      'rgba(76,158,255,0.12)',

  // Estados / marca (usar SOLO en iconos, chips, dots — nunca de fondo de card)
  purple:         '#A78BFA',
  green:          '#3DDC84',
  red:            '#F65959',
  amber:          '#F5C34B',
  gold:           '#F5C34B',  // reservado: Q coins, pre order, listo p/ retirar
  blue:           '#4C9EFF',
  orange:         '#FB923C',
}

// ── Spacing (4pt grid — Apple HIG) ───────────────────────────────────────────
export const SPACING = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  xxxl: 32,
}

// ── Border radius (escala One UI — más redondo, más suave) ──────────────────
export const RADIUS = {
  xs:   6,
  sm:   10,
  md:   14,   // inputs, rows internas
  lg:   20,   // cards estándar, tiles
  xl:   26,   // clusters / cards grandes
  sheet: 28,  // top de bottom-sheets y modales
  full: 9999, // pill / circle
}

// ── Motion (spring physics, 3 durations) ─────────────────────────────────────
// Spring easing approximates iOS spring physics in pure CSS.
// Use the durations in MS or as strings.
export const MOTION = {
  quick:   { ms: 200, ease: 'cubic-bezier(0.2, 0, 0.38, 0.9)'  },
  default: { ms: 300, ease: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }, // spring overshoot
  slow:    { ms: 500, ease: 'cubic-bezier(0.16, 1, 0.3, 1)'    },  // long ease-out

  // Pre-built strings for common cases:
  springTransition:  'all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  quickTransition:   'all 200ms cubic-bezier(0.2, 0, 0.38, 0.9)',
}

// ── System font stack (uses SF Pro on Apple devices, Inter on others) ────────
// On iOS/macOS this resolves to the native system font (San Francisco). On
// Android/Windows we fall back to Inter. This is the same trick GitHub,
// Stripe, Vercel use.
export const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", system-ui, sans-serif'

// Subtle haptic feedback for primary actions (iOS Safari supports vibrate).
// No-op on unsupported browsers — safe to call anywhere.
export function haptic(ms = 8) {
  try { if (navigator?.vibrate) navigator.vibrate(ms) } catch {}
}

// Tiny success/error haptic patterns
export const HAPTIC = {
  tap:     () => haptic(8),
  success: () => haptic([0, 12, 40, 12]),
  error:   () => haptic([0, 60, 30, 60]),
}
