// ─────────────────────────────────────────────────────────────────────────────
// QUEST — Premium Social Dark (owner-only preview overlay)
//
// Design philosophy:
//   • Refined glass, not theatrical. No multi-color blooms inside cards,
//     no aurora landscapes — just clean translucent surfaces with proper
//     depth so the content (avatars, photos, text) is the protagonist.
//   • One signature accent: indigo. Used sparingly on focus rings, active
//     states, and a single ambient light source in the top-right of the
//     viewport. Everywhere else stays neutral.
//   • Generous but disciplined: 24-28px radius, hairline borders, real
//     multi-layer shadows. Premium = restraint.
//   • Typography stays as-is (SF Pro system stack already gives the
//     premium feel). We just make sure nothing competes with it.
//   • iPhone Control Center DNA: heavy blur + slight saturation boost,
//     translucent white fills that absorb whatever's behind them.
//
// Owner-only. Pure CSS overlay. Tap the 🎨 bubble to toggle. Storage in
// localStorage. No component or logic changes.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'

const STORAGE_KEY = 'quest_dc_preview'

const DC_CSS = `
/* ── 0. Base — Battle Now palette as ambient field so glass cards have
       saturated color behind them to refract. Orange → pink → violet +
       cyan accent, overlapping so wherever a card sits there's color. */
body.dc-preview {
  background:
    /* Orange — top-left + bottom subtle echo */
    radial-gradient(ellipse 80% 65% at 8% 5%,    rgba(251,146,60,0.38)  0%, transparent 60%),
    radial-gradient(ellipse 60% 45% at 78% 95%,  rgba(251,146,60,0.18)  0%, transparent 65%),
    /* Pink — center-right + lower-left echo */
    radial-gradient(ellipse 75% 60% at 92% 38%,  rgba(244,114,182,0.34) 0%, transparent 62%),
    radial-gradient(ellipse 55% 45% at 18% 70%,  rgba(244,114,182,0.18) 0%, transparent 65%),
    /* Violet — bottom + center echo */
    radial-gradient(ellipse 90% 65% at 50% 115%, rgba(167,139,250,0.38) 0%, transparent 60%),
    radial-gradient(ellipse 50% 40% at 50% 45%,  rgba(167,139,250,0.18) 0%, transparent 65%),
    /* Cool cyan kicker — one cool light source so glass picks up a
       cool tint somewhere instead of pure warm everywhere. */
    radial-gradient(ellipse 45% 38% at 32% 30%,  rgba(56,189,248,0.16)  0%, transparent 65%),
    #0A0A12 !important;
  background-attachment: fixed !important;
  color: #F5F5F7 !important;
}

body.dc-preview::before {
  content: '';
  position: fixed; inset: 0;
  pointer-events: none;
  z-index: 0;
  /* No aurora — keep the field clean. The bg gradients above already
     do all the ambient work. */
  background: transparent;
}

body.dc-preview #root { background: transparent !important; position: relative; z-index: 1; }
body.dc-preview .screen-scroll,
body.dc-preview .filter-scroll,
body.dc-preview .phone,
body.dc-preview .phone-wrap,
body.dc-preview .app-header { background: transparent !important; }

@media (max-width: 480px) {
  body.dc-preview {
    background:
      radial-gradient(ellipse 80% 65% at 8% 5%,    rgba(251,146,60,0.38)  0%, transparent 60%),
      radial-gradient(ellipse 60% 45% at 78% 95%,  rgba(251,146,60,0.18)  0%, transparent 65%),
      radial-gradient(ellipse 75% 60% at 92% 38%,  rgba(244,114,182,0.34) 0%, transparent 62%),
      radial-gradient(ellipse 55% 45% at 18% 70%,  rgba(244,114,182,0.18) 0%, transparent 65%),
      radial-gradient(ellipse 90% 65% at 50% 115%, rgba(167,139,250,0.38) 0%, transparent 60%),
      radial-gradient(ellipse 50% 40% at 50% 45%,  rgba(167,139,250,0.18) 0%, transparent 65%),
      radial-gradient(ellipse 45% 38% at 32% 30%,  rgba(56,189,248,0.16)  0%, transparent 65%),
      #0A0A12 !important;
  }
}

/* Layout WRAPPERS (no position / no z-index) → fully transparent so the
   violet body bg can bleed through. Used by FeedScreen / Rankings root. */
body.dc-preview [style*="background: rgb(10, 10, 10)"]:not([style*="position: absolute"]):not([style*="position: fixed"]):not([style*="z-index"]),
body.dc-preview [style*="background:#0A0A0A"]:not([style*="position: absolute"]):not([style*="position: fixed"]):not([style*="z-index"]),
body.dc-preview [style*="background: #0A0A0A"]:not([style*="position: absolute"]):not([style*="position: fixed"]):not([style*="z-index"]) {
  background: transparent !important;
}

/* Full-screen MODALS / overlays (Quest Hub, Admin, Auction, Profile
   overlay, etc.) — same glass recipe as cards but more opaque so the
   content underneath gets blurred + dimmed, not erased. iOS share-sheet
   feel: clearly a layered surface, with hints of depth coming through. */
body.dc-preview [style*="background: rgb(10, 10, 10)"][style*="position: absolute"],
body.dc-preview [style*="background:#0A0A0A"][style*="position: absolute"],
body.dc-preview [style*="background: #0A0A0A"][style*="position: absolute"],
body.dc-preview [style*="background: rgb(10, 10, 10)"][style*="position: fixed"],
body.dc-preview [style*="background:#0A0A0A"][style*="position: fixed"],
body.dc-preview [style*="background: #0A0A0A"][style*="position: fixed"] {
  background:
    /* Top sheen so the modal has a clear "top edge" */
    linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 8%),
    /* Translucent black-ish glass — high enough alpha that what's behind
       reads as 'blurred backdrop', not 'seeing through the wall'. */
    rgba(12,10,18,0.78) !important;
  backdrop-filter: blur(40px) saturate(180%) brightness(105%) !important;
  -webkit-backdrop-filter: blur(40px) saturate(180%) brightness(105%) !important;
  box-shadow:
    0 1px 0 rgba(255,255,255,0.06) inset !important;
}

/* ── 1. Cards — premium social glass ────────────────────────────────────
   Translucent white at 4-7% alpha + a soft top sheen + a hairline border
   tinted very slightly indigo. Heavy blur so the bg's ambient light shows
   through naturally. Multi-layer shadow with indigo undertone — that's
   what makes the cards feel like real objects floating, not flat panels. */
body.dc-preview [style*="background: rgb(17, 17, 17)"],
body.dc-preview [style*="background:#111"],
body.dc-preview [style*="background: #111"],
body.dc-preview [style*="background:#111111"],
body.dc-preview [style*="background: #111111"] {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 28%),
    rgba(255,255,255,0.04) !important;
  backdrop-filter: blur(40px) saturate(180%) brightness(110%) !important;
  -webkit-backdrop-filter: blur(40px) saturate(180%) brightness(110%) !important;
  border: 0.5px solid rgba(255,255,255,0.10) !important;
  border-image: none !important;
  box-shadow:
    0 12px 32px rgba(0,0,0,0.45),
    0 4px 12px rgba(0,0,0,0.25),
    /* A whisper of indigo so cards feel cohesive with the bg's light */
    0 2px 12px rgba(99,102,241,0.08),
    0 1px 0 rgba(255,255,255,0.10) inset,
    0 -1px 0 rgba(0,0,0,0.15) inset !important;
}

/* Raised surfaces (#1A1A1A / #1F1F1F) — same recipe, slightly more lift */
body.dc-preview [style*="background: rgb(26, 26, 26)"],
body.dc-preview [style*="background:#1A1A1A"],
body.dc-preview [style*="background: #1A1A1A"],
body.dc-preview [style*="background: rgb(31, 31, 31)"],
body.dc-preview [style*="background:#1F1F1F"],
body.dc-preview [style*="background: #1F1F1F"] {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 32%),
    rgba(255,255,255,0.06) !important;
  border-color: rgba(255,255,255,0.13) !important;
}

/* ── 2. Header — flat glass, restrained ───────────────────────────────── */
body.dc-preview [style*="rgba(10, 10, 10, 0.95)"],
body.dc-preview [style*="rgba(10,10,10,0.95)"] {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 100%),
    rgba(255,255,255,0.03) !important;
  backdrop-filter: blur(48px) saturate(180%) brightness(108%) !important;
  -webkit-backdrop-filter: blur(48px) saturate(180%) brightness(108%) !important;
  border-bottom: 0.5px solid rgba(255,255,255,0.08) !important;
  box-shadow: none !important;
}

/* ── 3. Bottom nav — same flat glass treatment ────────────────────────── */
body.dc-preview [style*="rgba(10, 10, 10, 0.82)"],
body.dc-preview [style*="rgba(10,10,10,0.82)"] {
  background:
    linear-gradient(0deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 100%),
    rgba(255,255,255,0.03) !important;
  backdrop-filter: blur(48px) saturate(180%) brightness(108%) !important;
  -webkit-backdrop-filter: blur(48px) saturate(180%) brightness(108%) !important;
  border-top: 0.5px solid rgba(255,255,255,0.08) !important;
  box-shadow: none !important;
}

/* ── 4. Primary buttons — clean white, premium not flashy ──────────────── */
body.dc-preview button[style*="background: rgb(255, 255, 255)"],
body.dc-preview button[style*="background:#FFFFFF"],
body.dc-preview button[style*="background: #FFFFFF"],
body.dc-preview button[style*="background:#FFF"],
body.dc-preview button[style*="background: #FFF"] {
  background:
    linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(245,245,247,1) 100%) !important;
  color: #0A0A0F !important;
  border: 0 !important;
  box-shadow:
    0 1px 0 rgba(255,255,255,0.5) inset,
    0 -1px 0 rgba(0,0,0,0.10) inset,
    0 6px 16px rgba(0,0,0,0.30),
    0 0 0 0.5px rgba(255,255,255,0.6) !important;
  transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 200ms ease !important;
}
body.dc-preview button[style*="background: rgb(255, 255, 255)"]:active,
body.dc-preview button[style*="background:#FFFFFF"]:active,
body.dc-preview button[style*="background: #FFFFFF"]:active {
  transform: scale(0.97) !important;
}

/* Secondary buttons — glass pill with hairline */
body.dc-preview button[style*="border: 1.5px solid rgb(42, 42, 42)"],
body.dc-preview button[style*="border: 1px solid rgb(42, 42, 42)"] {
  background: rgba(255,255,255,0.04) !important;
  border-color: rgba(255,255,255,0.12) !important;
  backdrop-filter: blur(12px) !important;
  -webkit-backdrop-filter: blur(12px) !important;
}

/* ── 5. Inputs — color + placeholder solo. Antes pintábamos bg y borde
       a TODOS los inputs con !important, lo cual le metía un recuadro
       a los <input> que estaban dentro de un wrapper que ya provee su
       propio estilo (search bar del Shop, contact form, etc).
       Ahora solo forzamos color de texto + placeholder, y dejamos que
       cada componente decida su propio container. */
body.dc-preview input,
body.dc-preview textarea,
body.dc-preview select {
  color: #F5F5F7 !important;
}
body.dc-preview input:focus,
body.dc-preview textarea:focus,
body.dc-preview select:focus {
  outline: none !important;
}
body.dc-preview input::placeholder,
body.dc-preview textarea::placeholder { color: rgba(245,245,247,0.40) !important; }

/* ─────────────────────────────────────────────────────────────────────────
   6. SHAPE SCALE — discrete tiers, like H1/H2/H3 but for radii
   ─────────────────────────────────────────────────────────────────────────
   Collapses ALL existing inline border-radius values into 5 buckets so
   everything reads as one coherent system. No more 8/10/12/14 differing
   by 2px each.

     XS (8 px)    — tiny: dots, micro chips, small badges
     SM (12 px)   — chips, tags, small buttons, inputs
     MD (18 px)   — standard buttons, list rows
     LG (22 px)   — cards, modals, panels
     XL (28 px)   — hero cards, big featured surfaces
     FULL (9999)  — pills (kept as-is)

   The mapping is range-based: any inline radius in a range collapses to
   that tier. ──────────────────────────────────────────────────────────── */

/* XS — 0-7 px → 8 */
body.dc-preview [style*="border-radius: 4px"],
body.dc-preview [style*="border-radius:4px"],
body.dc-preview [style*="border-radius: 5px"],
body.dc-preview [style*="border-radius:5px"],
body.dc-preview [style*="border-radius: 6px"],
body.dc-preview [style*="border-radius:6px"],
body.dc-preview [style*="border-radius: 7px"],
body.dc-preview [style*="border-radius:7px"]   { border-radius: 8px !important; }

/* SM — 8-11 px → 12 */
body.dc-preview [style*="border-radius: 8px"],
body.dc-preview [style*="border-radius:8px"],
body.dc-preview [style*="border-radius: 9px"],
body.dc-preview [style*="border-radius:9px"],
body.dc-preview [style*="border-radius: 10px"],
body.dc-preview [style*="border-radius:10px"],
body.dc-preview [style*="border-radius: 11px"],
body.dc-preview [style*="border-radius:11px"]  { border-radius: 12px !important; }

/* MD — 12-15 px → 18 */
body.dc-preview [style*="border-radius: 12px"],
body.dc-preview [style*="border-radius:12px"],
body.dc-preview [style*="border-radius: 13px"],
body.dc-preview [style*="border-radius:13px"],
body.dc-preview [style*="border-radius: 14px"],
body.dc-preview [style*="border-radius:14px"],
body.dc-preview [style*="border-radius: 15px"],
body.dc-preview [style*="border-radius:15px"]  { border-radius: 18px !important; }

/* LG — 16-21 px → 22 */
body.dc-preview [style*="border-radius: 16px"],
body.dc-preview [style*="border-radius:16px"],
body.dc-preview [style*="border-radius: 17px"],
body.dc-preview [style*="border-radius:17px"],
body.dc-preview [style*="border-radius: 18px"],
body.dc-preview [style*="border-radius:18px"],
body.dc-preview [style*="border-radius: 19px"],
body.dc-preview [style*="border-radius:19px"],
body.dc-preview [style*="border-radius: 20px"],
body.dc-preview [style*="border-radius:20px"],
body.dc-preview [style*="border-radius: 21px"],
body.dc-preview [style*="border-radius:21px"]  { border-radius: 22px !important; }

/* XL — 22+ px → 28 */
body.dc-preview [style*="border-radius: 22px"],
body.dc-preview [style*="border-radius:22px"],
body.dc-preview [style*="border-radius: 24px"],
body.dc-preview [style*="border-radius:24px"],
body.dc-preview [style*="border-radius: 26px"],
body.dc-preview [style*="border-radius:26px"]  { border-radius: 28px !important; }

/* FULL pill — keep as-is */
body.dc-preview [style*="border-radius: 9999px"],
body.dc-preview [style*="border-radius:9999px"] { border-radius: 9999px !important; }

/* ─────────────────────────────────────────────────────────────────────────
   7. TYPE SCALE — H1/H2/H3 for font sizes
   ─────────────────────────────────────────────────────────────────────────
   Same idea applied to typography. Collapses inline font-size into a
   clean Apple-HIG-style ladder.

     EYEBROW (11) — 9-10 px:      uppercase labels, dot meta
     CAPTION (12) — 11-12 px:     timestamps, smallest body
     FOOTNOTE (14) — 13-14 px:    secondary body, captions
     BODY (15) — 15 px:           default body text
     CALLOUT (16) — 16 px:        prominent body
     SUBHEAD (18) — 17-19 px:     list-row primaries
     TITLE (22) — 20-24 px:       section / screen titles
     DISPLAY (28) — 25+ px:       heroes, big numbers
   ───────────────────────────────────────────────────────────────────── */

/* EYEBROW — 9-10 px → 11 */
body.dc-preview [style*="font-size: 9px"],
body.dc-preview [style*="font-size:9px"],
body.dc-preview [style*="font-size: 9.5px"],
body.dc-preview [style*="font-size:9.5px"],
body.dc-preview [style*="font-size: 10px"],
body.dc-preview [style*="font-size:10px"],
body.dc-preview [style*="font-size: 10.5px"],
body.dc-preview [style*="font-size:10.5px"] { font-size: 11px !important; }

/* CAPTION — 11-12 px → 12 */
body.dc-preview [style*="font-size: 11px"],
body.dc-preview [style*="font-size:11px"],
body.dc-preview [style*="font-size: 11.5px"],
body.dc-preview [style*="font-size:11.5px"],
body.dc-preview [style*="font-size: 12px"],
body.dc-preview [style*="font-size:12px"]   { font-size: 12px !important; }

/* FOOTNOTE — 12.5-14 px → 14 */
body.dc-preview [style*="font-size: 12.5px"],
body.dc-preview [style*="font-size:12.5px"],
body.dc-preview [style*="font-size: 13px"],
body.dc-preview [style*="font-size:13px"],
body.dc-preview [style*="font-size: 13.5px"],
body.dc-preview [style*="font-size:13.5px"],
body.dc-preview [style*="font-size: 14px"],
body.dc-preview [style*="font-size:14px"]   { font-size: 14px !important; }

/* BODY — 14.5-15 px → 15 */
body.dc-preview [style*="font-size: 14.5px"],
body.dc-preview [style*="font-size:14.5px"],
body.dc-preview [style*="font-size: 15px"],
body.dc-preview [style*="font-size:15px"]   { font-size: 15px !important; }

/* CALLOUT — 15.5-16.5 px → 16 */
body.dc-preview [style*="font-size: 15.5px"],
body.dc-preview [style*="font-size:15.5px"],
body.dc-preview [style*="font-size: 16px"],
body.dc-preview [style*="font-size:16px"],
body.dc-preview [style*="font-size: 16.5px"],
body.dc-preview [style*="font-size:16.5px"] { font-size: 16px !important; }

/* SUBHEAD — 17-19 px → 18 */
body.dc-preview [style*="font-size: 17px"],
body.dc-preview [style*="font-size:17px"],
body.dc-preview [style*="font-size: 18px"],
body.dc-preview [style*="font-size:18px"],
body.dc-preview [style*="font-size: 19px"],
body.dc-preview [style*="font-size:19px"]   { font-size: 18px !important; }

/* TITLE — 20-24 px → 22 */
body.dc-preview [style*="font-size: 20px"],
body.dc-preview [style*="font-size:20px"],
body.dc-preview [style*="font-size: 21px"],
body.dc-preview [style*="font-size:21px"],
body.dc-preview [style*="font-size: 22px"],
body.dc-preview [style*="font-size:22px"],
body.dc-preview [style*="font-size: 23px"],
body.dc-preview [style*="font-size:23px"],
body.dc-preview [style*="font-size: 24px"],
body.dc-preview [style*="font-size:24px"]   { font-size: 22px !important; }

/* DISPLAY — 25+ → 28 */
body.dc-preview [style*="font-size: 25px"],
body.dc-preview [style*="font-size:25px"],
body.dc-preview [style*="font-size: 26px"],
body.dc-preview [style*="font-size:26px"],
body.dc-preview [style*="font-size: 28px"],
body.dc-preview [style*="font-size:28px"],
body.dc-preview [style*="font-size: 30px"],
body.dc-preview [style*="font-size:30px"],
body.dc-preview [style*="font-size: 32px"],
body.dc-preview [style*="font-size:32px"]   { font-size: 28px !important; letter-spacing: -0.025em !important; }

/* ── 7. Avatars — clean ring, no gradient flair ────────────────────────── */
body.dc-preview [style*="border: 1.5px solid rgb(42, 42, 42)"][style*="border-radius: 50%"],
body.dc-preview [style*="border: 2px solid rgb(42, 42, 42)"][style*="border-radius: 50%"],
body.dc-preview [style*="border: 1px solid rgb(42, 42, 42)"][style*="border-radius: 50%"] {
  border: 1px solid rgba(255,255,255,0.14) !important;
  box-shadow:
    0 2px 8px rgba(0,0,0,0.35),
    0 0 0 1px rgba(0,0,0,0.3) !important;
}

/* ── 8. Brand-color chips get a soft lift ──────────────────────────────── */
body.dc-preview [style*="rgba(167,139,250,0.10)"],
body.dc-preview [style*="rgba(167, 139, 250, 0.10)"] {
  background: rgba(167,139,250,0.15) !important;
  box-shadow: 0 0 16px rgba(167,139,250,0.10) !important;
}

/* ── 9. Selection + scrollbar ──────────────────────────────────────────── */
body.dc-preview ::selection { background: rgba(99,102,241,0.35) !important; color: #FFFFFF !important; }
body.dc-preview *::-webkit-scrollbar { width: 6px; height: 6px; }
body.dc-preview *::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.08);
  border-radius: 3px;
}
body.dc-preview *::-webkit-scrollbar-track { background: transparent; }

/* ── 10. Tap feedback — universal subtle press ─────────────────────────── */
body.dc-preview button:active,
body.dc-preview [role="button"]:active,
body.dc-preview .pressable:active {
  transform: scale(0.97) !important;
  transition: transform 80ms ease !important;
}
`

export default function DCPreviewToggle() {
  // Glass redesign está prendido siempre para todos. Sin toggle.
  // Mantenemos este componente solo para inyectar el CSS global.
  useEffect(() => {
    document.body.classList.add('dc-preview')
    let styleEl = document.getElementById('quest-dc-preview-style')
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = 'quest-dc-preview-style'
      styleEl.textContent = DC_CSS
      document.head.appendChild(styleEl)
    } else {
      styleEl.textContent = DC_CSS
    }
    return () => {
      document.body.classList.remove('dc-preview')
      const el = document.getElementById('quest-dc-preview-style')
      if (el) el.remove()
    }
  }, [])

  return null
}
