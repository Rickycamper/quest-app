// ─────────────────────────────────────────────────────────────────────────────
// QUEST — Design Code UI Preview (owner-only, experimental)
//
// Re-skins the live app with a "designcode.io" vibe (Meng To's UI kit):
// glassmorphism cards, aurora gradient background, vibrant gradient buttons,
// pill-style active tabs, gradient avatar rings, soft multi-layer shadows
// with color tints, big rounded radii, refined typography.
//
// Owner-only. Floating pill in the corner. Tap → CSS injects. Tap again →
// snaps back. No component or logic changes anywhere in the codebase.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'

const STORAGE_KEY = 'quest_dc_preview'

// ─── The DC stylesheet ──────────────────────────────────────────────────────
// Strategy notes:
//   • body.dc-preview is the guard — every selector is scoped to it so
//     nothing leaks when the toggle is off.
//   • For inline-style backgrounds we use attribute selectors targeting the
//     exact rgb()/hex strings React renders. !important is necessary to
//     beat inline style specificity.
//   • Tag selectors (input, textarea, button) catch generic surfaces.
//   • A fixed aurora overlay sits below #root for that "ambient depth".
//   • Pill-style active tab is faked with a glow ring on the icon container.
// ─────────────────────────────────────────────────────────────────────────────
const DC_CSS = `
/* ── 0. Base palette + ambient aurora ──────────────────────────────────── */
body.dc-preview {
  /* Deep navy/indigo base, not pure black — DC kit signature */
  background: #08090F !important;
  background-attachment: fixed !important;
  color: #F5F5F7 !important;
}

/* Fixed aurora overlay — sits behind everything, doesn't scroll */
body.dc-preview::before {
  content: '';
  position: fixed; inset: 0;
  pointer-events: none;
  z-index: 0;
  background:
    radial-gradient(ellipse 70% 50% at 110% -10%, rgba(167,139,250,0.30) 0%, transparent 55%),
    radial-gradient(ellipse 50% 40% at -10% 5%,   rgba(236,72,153,0.20)  0%, transparent 55%),
    radial-gradient(ellipse 60% 40% at 50% 120%,  rgba(56,189,248,0.18)  0%, transparent 60%),
    radial-gradient(ellipse 40% 30% at 30% 60%,   rgba(94,92,230,0.10)   0%, transparent 70%);
  animation: dcAurora 18s ease-in-out infinite alternate;
}

/* Subtle drift on the aurora — feels alive */
@keyframes dcAurora {
  0%   { transform: translate3d(0, 0, 0) scale(1); }
  100% { transform: translate3d(-2%, 1%, 0) scale(1.04); }
}

body.dc-preview #root {
  background: transparent !important;
  position: relative;
  z-index: 1;
}

body.dc-preview .screen-scroll {
  background: transparent !important;
}

/* ── 1. Cards — glassmorphism with gradient borders ─────────────────────── */
/* All the common card backgrounds get the same glass treatment.
   Using border-image to fake a gradient border (CSS doesn't allow
   gradient on border-color directly without box hacks). */
body.dc-preview [style*="background: rgb(17, 17, 17)"],
body.dc-preview [style*="background:#111"],
body.dc-preview [style*="background: #111"],
body.dc-preview [style*="background:#111111"],
body.dc-preview [style*="background: #111111"] {
  background:
    linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.015) 100%),
    rgba(20,20,28,0.55) !important;
  backdrop-filter: saturate(180%) blur(22px) !important;
  -webkit-backdrop-filter: saturate(180%) blur(22px) !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
  box-shadow:
    0 10px 32px rgba(0,0,0,0.45),
    0 2px 8px  rgba(0,0,0,0.25),
    0 0 0 0.5px rgba(167,139,250,0.10) inset,
    0 1px 0 rgba(255,255,255,0.06) inset !important;
}

/* Raised surfaces (#1A1A1A / #1F1F1F) — slightly brighter glass */
body.dc-preview [style*="background: rgb(26, 26, 26)"],
body.dc-preview [style*="background:#1A1A1A"],
body.dc-preview [style*="background: #1A1A1A"],
body.dc-preview [style*="background: rgb(31, 31, 31)"],
body.dc-preview [style*="background:#1F1F1F"],
body.dc-preview [style*="background: #1F1F1F"] {
  background:
    linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%),
    rgba(28,28,40,0.6) !important;
  border-color: rgba(255,255,255,0.10) !important;
}

/* App background (0A0A0A) → transparent so aurora shows through */
body.dc-preview [style*="background: rgb(10, 10, 10)"],
body.dc-preview [style*="background:#0A0A0A"],
body.dc-preview [style*="background: #0A0A0A"] {
  background: transparent !important;
}

/* ── 2. Primary buttons (white) → purple-pink gradient with glow ────────── */
body.dc-preview button[style*="background: rgb(255, 255, 255)"],
body.dc-preview button[style*="background:#FFFFFF"],
body.dc-preview button[style*="background: #FFFFFF"],
body.dc-preview button[style*="background:#FFF"],
body.dc-preview button[style*="background: #FFF"] {
  background: linear-gradient(135deg, #A78BFA 0%, #F472B6 60%, #FB923C 130%) !important;
  background-size: 200% 200% !important;
  color: #FFFFFF !important;
  border: 0 !important;
  box-shadow:
    0 10px 28px rgba(167,139,250,0.40),
    0 4px 10px rgba(236,72,153,0.25),
    0 1px 0 rgba(255,255,255,0.35) inset,
    0 -1px 0 rgba(0,0,0,0.25) inset !important;
  text-shadow: 0 1px 0 rgba(0,0,0,0.18) !important;
  transition: background-position 600ms ease, transform 200ms cubic-bezier(0.34,1.56,0.64,1) !important;
}
body.dc-preview button[style*="background: rgb(255, 255, 255)"]:hover,
body.dc-preview button[style*="background:#FFFFFF"]:hover,
body.dc-preview button[style*="background: #FFFFFF"]:hover,
body.dc-preview button[style*="background:#FFF"]:hover,
body.dc-preview button[style*="background: #FFF"]:hover {
  background-position: 100% 50% !important;
}

/* Secondary / outlined buttons get a glass tint */
body.dc-preview button[style*="border: 1.5px solid rgb(42, 42, 42)"],
body.dc-preview button[style*="border: 1px solid rgb(42, 42, 42)"] {
  border-color: rgba(255,255,255,0.12) !important;
  background: rgba(255,255,255,0.04) !important;
  backdrop-filter: blur(12px) !important;
  -webkit-backdrop-filter: blur(12px) !important;
}

/* ── 3. Bottom nav — heavier glass + purple top border ─────────────────── */
body.dc-preview [style*="rgba(10, 10, 10, 0.82)"],
body.dc-preview [style*="rgba(10,10,10,0.82)"] {
  background: linear-gradient(180deg, rgba(28,28,40,0.55) 0%, rgba(12,12,18,0.85) 100%) !important;
  backdrop-filter: saturate(200%) blur(32px) !important;
  -webkit-backdrop-filter: saturate(200%) blur(32px) !important;
  border-top: 1px solid rgba(167,139,250,0.22) !important;
  box-shadow:
    0 -12px 36px rgba(0,0,0,0.5),
    0 -1px 0 rgba(167,139,250,0.12) inset !important;
}

/* ── 4. Inputs — soft glass with vibrant focus ─────────────────────────── */
body.dc-preview input,
body.dc-preview textarea,
body.dc-preview select {
  background: rgba(255,255,255,0.05) !important;
  border: 1px solid rgba(255,255,255,0.10) !important;
  color: #F5F5F7 !important;
  transition: border-color 220ms ease, box-shadow 220ms ease, background 220ms ease !important;
}
body.dc-preview input:focus,
body.dc-preview textarea:focus,
body.dc-preview select:focus {
  border-color: rgba(167,139,250,0.65) !important;
  background: rgba(167,139,250,0.06) !important;
  box-shadow:
    0 0 0 4px rgba(167,139,250,0.22),
    0 0 24px rgba(167,139,250,0.18) !important;
  outline: none !important;
}
body.dc-preview input::placeholder,
body.dc-preview textarea::placeholder {
  color: rgba(245,245,247,0.40) !important;
}

/* ── 5. Generous radius bumps (DC kit signature) ────────────────────────── */
body.dc-preview [style*="border-radius: 6px"],
body.dc-preview [style*="border-radius:6px"]   { border-radius: 10px !important; }
body.dc-preview [style*="border-radius: 8px"],
body.dc-preview [style*="border-radius:8px"]   { border-radius: 14px !important; }
body.dc-preview [style*="border-radius: 10px"],
body.dc-preview [style*="border-radius:10px"]  { border-radius: 16px !important; }
body.dc-preview [style*="border-radius: 12px"],
body.dc-preview [style*="border-radius:12px"]  { border-radius: 20px !important; }
body.dc-preview [style*="border-radius: 14px"],
body.dc-preview [style*="border-radius:14px"]  { border-radius: 22px !important; }
body.dc-preview [style*="border-radius: 16px"],
body.dc-preview [style*="border-radius:16px"]  { border-radius: 24px !important; }
body.dc-preview [style*="border-radius: 20px"],
body.dc-preview [style*="border-radius:20px"]  { border-radius: 28px !important; }

/* Pills (full radius 9999) stay full — but make them clearly pill */
body.dc-preview [style*="border-radius: 9999"] {
  border-radius: 9999px !important;
}

/* ── 6. Avatars — gradient ring ─────────────────────────────────────────── */
/* Targets the avatar container divs across the app */
body.dc-preview [style*="border: 1.5px solid rgb(42, 42, 42)"][style*="border-radius: 50%"],
body.dc-preview [style*="border: 2px solid rgb(42, 42, 42)"][style*="border-radius: 50%"],
body.dc-preview [style*="border: 1px solid rgb(42, 42, 42)"][style*="border-radius: 50%"] {
  background:
    linear-gradient(rgba(20,20,28,1), rgba(20,20,28,1)) padding-box,
    linear-gradient(135deg, #A78BFA, #F472B6) border-box !important;
  border: 1.5px solid transparent !important;
}

/* ── 7. Game / branch chips — punchier ──────────────────────────────────── */
/* The faded brand pills (rgba(*,0.10)) get a brighter background */
body.dc-preview [style*="rgba(167,139,250,0.10)"],
body.dc-preview [style*="rgba(167, 139, 250, 0.10)"] {
  background: linear-gradient(135deg, rgba(167,139,250,0.20) 0%, rgba(167,139,250,0.08) 100%) !important;
}
body.dc-preview [style*="rgba(56,189,248,0.10)"],
body.dc-preview [style*="rgba(56, 189, 248, 0.10)"] {
  background: linear-gradient(135deg, rgba(56,189,248,0.22) 0%, rgba(56,189,248,0.08) 100%) !important;
}
body.dc-preview [style*="rgba(251,146,60,0.10)"],
body.dc-preview [style*="rgba(251, 146, 60, 0.10)"] {
  background: linear-gradient(135deg, rgba(251,146,60,0.22) 0%, rgba(251,146,60,0.08) 100%) !important;
}
body.dc-preview [style*="rgba(245,158,11,0.12)"],
body.dc-preview [style*="rgba(245, 158, 11, 0.12)"] {
  background: linear-gradient(135deg, rgba(245,158,11,0.22) 0%, rgba(251,191,36,0.10) 100%) !important;
}

/* ── 8. Typography refinements ─────────────────────────────────────────── */
body.dc-preview h1, body.dc-preview h2, body.dc-preview h3 {
  letter-spacing: -0.025em !important;
}

/* Big numbers (stats, points) — gradient text where we can target */
body.dc-preview [style*="font-variant-numeric: tabular-nums"][style*="font-weight: 700"] {
  /* Skip — gradient text in inline styles is impossible cleanly */
}

/* ── 9. Selection color ────────────────────────────────────────────────── */
body.dc-preview ::selection {
  background: rgba(167,139,250,0.35) !important;
  color: #FFFFFF !important;
}

/* ── 10. Scrollbars (where visible) ────────────────────────────────────── */
body.dc-preview *::-webkit-scrollbar {
  width: 8px; height: 8px;
}
body.dc-preview *::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(167,139,250,0.5), rgba(236,72,153,0.5));
  border-radius: 4px;
}
body.dc-preview *::-webkit-scrollbar-track {
  background: transparent;
}

/* ── 11. Tap feedback — universal scale on press ───────────────────────── */
body.dc-preview button:active,
body.dc-preview [role="button"]:active,
body.dc-preview .pressable:active {
  transform: scale(0.96) !important;
  transition: transform 80ms ease !important;
}

/* ── 12. Active nav icon — purple glow halo ────────────────────────────── */
/* The redesigned nav icons scale to 1.12 when active. We add a glow to it. */
body.dc-preview button[aria-label][style*="scale(1.12)"] {
  filter: drop-shadow(0 0 14px rgba(167,139,250,0.55));
}
`

export default function DCPreviewToggle({ isOwner }) {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'on' } catch { return false }
  })
  const [collapsed, setCollapsed] = useState(true)

  useEffect(() => {
    if (!isOwner) return
    try { localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off') } catch {}

    if (!enabled) {
      document.body.classList.remove('dc-preview')
      const existing = document.getElementById('quest-dc-preview-style')
      if (existing) existing.remove()
      return
    }

    document.body.classList.add('dc-preview')
    let styleEl = document.getElementById('quest-dc-preview-style')
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = 'quest-dc-preview-style'
      styleEl.textContent = DC_CSS
      document.head.appendChild(styleEl)
    } else {
      styleEl.textContent = DC_CSS  // refresh CSS if we shipped an update
    }

    return () => {
      document.body.classList.remove('dc-preview')
      const el = document.getElementById('quest-dc-preview-style')
      if (el) el.remove()
    }
  }, [enabled, isOwner])

  if (!isOwner) return null

  // Collapsed bubble
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        title={enabled ? 'Modo DC activado' : 'Activar modo DC'}
        style={{
          position: 'fixed',
          bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
          right: 12,
          zIndex: 9999,
          width: 40, height: 40, borderRadius: '50%',
          background: enabled
            ? 'linear-gradient(135deg, #A78BFA 0%, #F472B6 60%, #FB923C 130%)'
            : 'rgba(20,20,28,0.85)',
          backdropFilter: 'saturate(180%) blur(16px)',
          WebkitBackdropFilter: 'saturate(180%) blur(16px)',
          border: `1px solid ${enabled ? 'rgba(255,255,255,0.35)' : 'rgba(167,139,250,0.4)'}`,
          color: '#FFFFFF',
          fontSize: 17,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: enabled
            ? '0 10px 28px rgba(167,139,250,0.55), 0 0 24px rgba(236,72,153,0.35), inset 0 1px 0 rgba(255,255,255,0.35)'
            : '0 4px 16px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
          fontFamily: 'inherit',
          opacity: 0.95,
          transition: 'all 300ms cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        🎨
      </button>
    )
  }

  // Expanded pill
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
        right: 12,
        zIndex: 9999,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 8px 8px 14px',
        background: 'rgba(15,15,22,0.92)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        border: '1px solid rgba(167,139,250,0.35)',
        borderRadius: 24,
        boxShadow: '0 10px 32px rgba(0,0,0,0.55), 0 0 28px rgba(167,139,250,0.22), inset 0 1px 0 rgba(255,255,255,0.06)',
        animation: 'fadeUp 0.22s ease',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: '#E5E7EB', letterSpacing: '-0.005em' }}>
        🎨 DC Mode
      </span>
      <button
        onClick={() => setEnabled(v => !v)}
        aria-label="Toggle Design Code preview"
        style={{
          width: 40, height: 22, borderRadius: 11,
          background: enabled
            ? 'linear-gradient(135deg, #A78BFA 0%, #F472B6 100%)'
            : 'rgba(255,255,255,0.10)',
          border: '1px solid rgba(255,255,255,0.14)',
          position: 'relative',
          cursor: 'pointer',
          padding: 0,
          transition: 'background 220ms ease',
          boxShadow: enabled
            ? '0 0 12px rgba(167,139,250,0.5) inset, 0 0 16px rgba(236,72,153,0.3)'
            : 'none',
        }}
      >
        <span style={{
          position: 'absolute',
          top: 2, left: enabled ? 20 : 2,
          width: 16, height: 16, borderRadius: '50%',
          background: '#FFFFFF',
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          transition: 'left 260ms cubic-bezier(0.34,1.56,0.64,1)',
        }} />
      </button>
      <button
        onClick={() => setCollapsed(true)}
        aria-label="Minimizar"
        style={{
          width: 22, height: 22, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.10)',
          color: '#9CA3AF', cursor: 'pointer', padding: 0,
          fontSize: 11, fontWeight: 700, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ✕
      </button>
    </div>
  )
}
