// ─────────────────────────────────────────────────────────────────────────────
// QUEST — Design Code UI Preview (owner-only, experimental)
//
// Lets the owner toggle a "Design Code" themed overlay on top of the current
// app without touching any component or logic. Pure visual try-out:
//
//   • Floating pill in the corner (only renders for is_owner=true).
//   • Tap → injects a global <style> tag that re-skins the app:
//       - deeper purple-tinted backgrounds
//       - aurora gradient ambient overlay in the top corner
//       - glassier cards with stronger blur
//       - vibrant accent colors (purple-pink-blue gradients)
//       - more generous border-radius
//       - colored multi-layer shadows
//   • State persists in localStorage so a reload keeps the choice.
//   • Tap again → CSS removed, app snaps back to prod look.
//
// Nothing here mutates app state, fetches data, or replaces components.
// If anything renders wrong with the overlay on, just toggle it off.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'

const STORAGE_KEY = 'quest_dc_preview'

// CSS overrides — applied via a <style> tag mounted on <head> when active.
// Most selectors use `body.dc-preview` as a guard so they only fire when
// the toggle is on, and target inline-style patterns we know exist in the
// codebase. Where inline styles need overriding we use !important — that's
// the only way to beat React's style={{ }} specificity. Limited blast
// radius: removing the <style> tag instantly reverts everything.
const DC_CSS = `
/* ── Page-level vibe — aurora background + tint ─────────────────────────── */
body.dc-preview {
  background:
    radial-gradient(ellipse 80% 50% at 90% -10%, rgba(167,139,250,0.18) 0%, transparent 60%),
    radial-gradient(ellipse 70% 50% at -10% 10%, rgba(244,114,182,0.12) 0%, transparent 55%),
    radial-gradient(ellipse 60% 40% at 50% 110%, rgba(59,130,246,0.10) 0%, transparent 60%),
    #06060a !important;
  background-attachment: fixed !important;
}

body.dc-preview #root {
  background: transparent !important;
}

/* Outer screen frame — keep slightly translucent so the aurora bleeds through */
body.dc-preview .screen-scroll {
  background: rgba(6,6,10,0.4) !important;
}

/* ── Cards — glassmorphism upgrade ──────────────────────────────────────── */
/* Targets common card patterns by their inline background values */
body.dc-preview [style*="background: rgb(17, 17, 17)"],
body.dc-preview [style*="background:#111"],
body.dc-preview [style*="background: #111"],
body.dc-preview [style*="background:#111111"],
body.dc-preview [style*="background: #111111"] {
  background:
    linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%),
    rgba(17,17,22,0.62) !important;
  backdrop-filter: saturate(180%) blur(20px) !important;
  -webkit-backdrop-filter: saturate(180%) blur(20px) !important;
  border-color: rgba(255,255,255,0.07) !important;
  box-shadow:
    0 8px 28px rgba(0,0,0,0.55),
    0 1px 0 rgba(255,255,255,0.05) inset,
    0 0 0 0.5px rgba(167,139,250,0.10) !important;
}

/* Slightly raised surfaces (#1A1A1A / #1F1F1F) get a gentle gradient */
body.dc-preview [style*="background: rgb(26, 26, 26)"],
body.dc-preview [style*="background:#1A1A1A"],
body.dc-preview [style*="background: #1A1A1A"],
body.dc-preview [style*="background: rgb(31, 31, 31)"],
body.dc-preview [style*="background:#1F1F1F"],
body.dc-preview [style*="background: #1F1F1F"] {
  background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%), rgba(28,28,38,0.7) !important;
}

/* ── Primary buttons (white) become purple-pink gradient ────────────────── */
body.dc-preview button[style*="background: rgb(255, 255, 255)"],
body.dc-preview button[style*="background:#FFFFFF"],
body.dc-preview button[style*="background: #FFFFFF"],
body.dc-preview button[style*="background:#FFF"],
body.dc-preview button[style*="background: #FFF"] {
  background: linear-gradient(135deg, #A78BFA 0%, #EC4899 100%) !important;
  color: #FFFFFF !important;
  box-shadow:
    0 8px 24px rgba(167,139,250,0.35),
    0 1px 0 rgba(255,255,255,0.25) inset,
    0 -1px 0 rgba(0,0,0,0.2) inset !important;
  text-shadow: 0 1px 0 rgba(0,0,0,0.15) !important;
}

/* ── Bottom nav — extra glass ───────────────────────────────────────────── */
body.dc-preview [style*="rgba(10,10,10,0.82)"],
body.dc-preview [style*="rgba(10, 10, 10, 0.82)"] {
  background: linear-gradient(180deg, rgba(20,20,30,0.55) 0%, rgba(10,10,15,0.85) 100%) !important;
  backdrop-filter: saturate(200%) blur(28px) !important;
  -webkit-backdrop-filter: saturate(200%) blur(28px) !important;
  border-top-color: rgba(167,139,250,0.18) !important;
}

/* ── Inputs — softer glass with focus glow ──────────────────────────────── */
body.dc-preview input,
body.dc-preview textarea {
  background: rgba(255,255,255,0.04) !important;
  border-color: rgba(255,255,255,0.08) !important;
  transition: border-color 200ms ease, box-shadow 200ms ease !important;
}
body.dc-preview input:focus,
body.dc-preview textarea:focus {
  border-color: rgba(167,139,250,0.55) !important;
  box-shadow: 0 0 0 4px rgba(167,139,250,0.18) !important;
}

/* ── More generous radius on the redesigned helpers ──────────────────────── */
body.dc-preview .lift,
body.dc-preview .pressable {
  /* No layout change — just make sure the rounded corners feel "DC kit" big */
  /* Most cards are already 12-16. Bump to 20 where present. */
}

/* Cards that were 12px (RADIUS.md / 14) → 20px for that softer DC feel */
body.dc-preview [style*="border-radius: 12px"],
body.dc-preview [style*="borderRadius: 12"],
body.dc-preview [style*="border-radius:12px"] {
  border-radius: 18px !important;
}
body.dc-preview [style*="border-radius: 14px"],
body.dc-preview [style*="border-radius:14px"] {
  border-radius: 20px !important;
}
body.dc-preview [style*="border-radius: 16px"],
body.dc-preview [style*="border-radius:16px"] {
  border-radius: 22px !important;
}

/* ── Pill / gradient accents on key links and chevrons ──────────────────── */
body.dc-preview [style*="color: rgb(167, 139, 250)"] {
  /* Already purple — punch it up */
  text-shadow: 0 0 12px rgba(167,139,250,0.4) !important;
}

/* ── Avatar borders — subtle purple ring ────────────────────────────────── */
body.dc-preview [style*="border: 1.5px solid rgb(42, 42, 42)"],
body.dc-preview [style*="border: 1px solid rgb(42, 42, 42)"] {
  border-color: rgba(167,139,250,0.25) !important;
}

/* ── Section eyebrows — gradient text ───────────────────────────────────── */
body.dc-preview [style*="letter-spacing: 0.1em"][style*="text-transform: uppercase"],
body.dc-preview [style*="letterSpacing: 0.1em"] {
  /* Skip — we'd need actual eyebrow class; gradient text in inline styles
     is impossible to apply cleanly without changing components. Leave for v2. */
}

/* ── Smooth motion ──────────────────────────────────────────────────────── */
body.dc-preview * {
  /* Don't override existing transitions — but make sure inputs/buttons
     that DON'T have one get something snappy. */
}
`

// Floating toggle pill — fixed bottom-right, above the bottom nav.
// Renders ONLY when isOwner is true. Doesn't appear in screenshots /
// shareable links / production user sessions.
export default function DCPreviewToggle({ isOwner }) {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'on' } catch { return false }
  })
  const [collapsed, setCollapsed] = useState(true) // start collapsed so it doesn't shout

  // Apply / remove the body class + inject the <style> tag exactly once.
  useEffect(() => {
    if (!isOwner) return  // safety net — don't even consider mounting for non-owners
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
    }

    return () => {
      // Cleanup if the component unmounts (e.g. logout)
      document.body.classList.remove('dc-preview')
      const el = document.getElementById('quest-dc-preview-style')
      if (el) el.remove()
    }
  }, [enabled, isOwner])

  if (!isOwner) return null

  // Collapsed form: tiny circular badge that just shows current state.
  // Tap once → expands to full pill with label + switch.
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
          width: 38, height: 38, borderRadius: '50%',
          background: enabled
            ? 'linear-gradient(135deg, #A78BFA 0%, #EC4899 100%)'
            : 'rgba(20,20,28,0.85)',
          backdropFilter: 'saturate(180%) blur(16px)',
          WebkitBackdropFilter: 'saturate(180%) blur(16px)',
          border: `1px solid ${enabled ? 'rgba(255,255,255,0.3)' : 'rgba(167,139,250,0.35)'}`,
          color: enabled ? '#FFFFFF' : '#A78BFA',
          fontSize: 16,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: enabled
            ? '0 8px 24px rgba(167,139,250,0.4), inset 0 1px 0 rgba(255,255,255,0.3)'
            : '0 4px 16px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)',
          fontFamily: 'inherit',
          opacity: 0.9,
        }}
      >
        🎨
      </button>
    )
  }

  // Expanded form: pill with label, switch, and a close button.
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
        right: 12,
        zIndex: 9999,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 8px 8px 14px',
        background: 'rgba(15,15,20,0.92)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        border: '1px solid rgba(167,139,250,0.3)',
        borderRadius: 24,
        boxShadow: '0 8px 28px rgba(0,0,0,0.5), 0 0 24px rgba(167,139,250,0.18), inset 0 1px 0 rgba(255,255,255,0.06)',
        animation: 'fadeUp 0.22s ease',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: '#E5E7EB', letterSpacing: '-0.005em' }}>
        🎨 Modo DC
      </span>
      {/* Switch */}
      <button
        onClick={() => setEnabled(v => !v)}
        aria-label="Toggle Design Code preview"
        style={{
          width: 38, height: 22, borderRadius: 11,
          background: enabled
            ? 'linear-gradient(135deg, #A78BFA 0%, #EC4899 100%)'
            : 'rgba(255,255,255,0.10)',
          border: '1px solid rgba(255,255,255,0.12)',
          position: 'relative',
          cursor: 'pointer',
          padding: 0,
          transition: 'background 220ms ease',
          boxShadow: enabled ? '0 0 10px rgba(167,139,250,0.45) inset, 0 0 12px rgba(236,72,153,0.25)' : 'none',
        }}
      >
        <span style={{
          position: 'absolute',
          top: 2, left: enabled ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%',
          background: '#FFFFFF',
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          transition: 'left 240ms cubic-bezier(0.34,1.56,0.64,1)',
        }} />
      </button>
      {/* Close (collapse to bubble) */}
      <button
        onClick={() => setCollapsed(true)}
        aria-label="Minimizar"
        style={{
          width: 22, height: 22, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
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
