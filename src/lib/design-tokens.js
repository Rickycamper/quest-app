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
export const COLOR = {
  // Text
  text:           '#FFFFFF',  // primary text
  textSecondary:  '#9CA3AF',  // secondary text (was used 113× as-is — keep)
  textTertiary:   '#6B7280',  // disabled, metadata
  textQuaternary: '#4B5563',  // hint text only

  // Surfaces
  background:     '#0A0A0A',  // app background
  surface:        '#111111',  // cards, modals
  surfaceRaised:  '#1A1A1A',  // pressed states, raised cards
  surfaceHover:   '#1F1F1F',  // hover states

  // Borders
  border:         '#1F1F1F',  // default border (use for dividers)
  borderStrong:   '#2A2A2A',  // emphasized border (around inputs, buttons)

  // Brand accents (kept — these are intentional)
  purple:         '#A78BFA',
  green:          '#4ADE80',
  red:            '#F87171',
  amber:          '#F59E0B',
  gold:           '#FBBF24',
  blue:           '#60A5FA',
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

// ── Border radius (5-stop scale) ─────────────────────────────────────────────
export const RADIUS = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  full: 9999,  // pill / circle
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
