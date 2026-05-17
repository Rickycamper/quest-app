// ─────────────────────────────────────────────
// QUEST — Share/Copy fallback helper
//
// `navigator.clipboard.writeText` fails silently in several common cases on
// our target audience's devices:
//   • Older Safari on iOS without HTTPS-secure context
//   • In-app browsers (WhatsApp, Instagram, Facebook, Snapchat)
//   • Private/Incognito mode on some browsers
//   • Browsers with strict clipboard permissions
//
// This helper tries 3 methods in order so a copy never fails silently:
//   1. navigator.share()           — native sheet on mobile
//   2. navigator.clipboard.writeText() — modern clipboard
//   3. document.execCommand('copy') with a hidden textarea — legacy but
//      practically supported everywhere, including the cases above.
// ─────────────────────────────────────────────

/**
 * Open the native share sheet, falling back to clipboard copy.
 * @param {{ title?: string, text?: string, url?: string }} payload
 * @returns {Promise<{ ok: boolean, method: 'share'|'clipboard'|'legacy'|'cancelled'|'none' }>}
 */
export async function shareOrCopy({ title, text, url }) {
  // 1. Native share sheet (mobile / some desktop)
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url })
      return { ok: true, method: 'share' }
    } catch (e) {
      // User cancelled the share sheet — do NOT fall through to copy
      // (otherwise the link gets silently copied when they meant to abort).
      if (e?.name === 'AbortError') return { ok: false, method: 'cancelled' }
      // Other errors → try clipboard fallbacks
    }
  }

  // Compose the text to copy. If we have both text and URL, join them.
  const composed = url
    ? (text ? `${text}\n${url}` : url)
    : (text ?? '')

  // 2. Modern Clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(composed)
      return { ok: true, method: 'clipboard' }
    } catch {
      // fall through
    }
  }

  // 3. Legacy fallback — works in Safari iOS, in-app browsers, older Chrome,
  //    private mode, etc. Creates an offscreen textarea, selects it, copies.
  try {
    const ta = document.createElement('textarea')
    ta.value = composed
    // Avoid scrolling to the bottom on iOS; keep it offscreen.
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '0'
    ta.style.left = '0'
    ta.style.opacity = '0'
    ta.style.pointerEvents = 'none'
    document.body.appendChild(ta)
    // iOS Safari requires selectionStart/End for selection to take.
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, composed.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    if (ok) return { ok: true, method: 'legacy' }
  } catch {}

  return { ok: false, method: 'none' }
}
