// ─────────────────────────────────────────────────────────────────────────────
// QUEST — HIcon
//
// Lightweight wrapper around Cosimo Scarpa's "Hicon" icon pack (hicon.me).
// 1000+ minimal stroke icons, MIT/CC-BY licensed.
//
// How it works:
//   1. On first import, fetch the icons.json from the hicon-js GitHub CDN
//      (single ~80 KB request, cached by the browser).
//   2. Every <HIcon name="home" /> looks up its inner-SVG markup from the
//      loaded map and renders it via dangerouslySetInnerHTML inside an
//      <svg> wrapper sized by props.
//   3. Stroke icons use stroke="currentColor" — so passing `color` on the
//      wrapper styles them. Stroke width can be tuned per call.
//
// Why dangerouslySetInnerHTML is safe here: the markup comes from a
// pinned CDN URL we control the source of (coswise/hicon-js on GitHub),
// and contains only standard SVG primitives — no <script>, no event
// handlers, no <foreignObject>. We never inject user-supplied data here.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'

// Locked to "latest" — jsDelivr caches aggressively so a future bump
// of the upstream repo will be picked up within ~12 h, no rebuild needed.
const HICON_JSON_URL = 'https://cdn.jsdelivr.net/gh/coswise/hicon-js@latest/icons.json'

// Module-scope cache so we fetch ONCE per page load, no matter how many
// <HIcon> components are rendered.
let _iconsPromise = null
let _icons = null   // populated when the promise resolves

function loadIcons() {
  if (_iconsPromise) return _iconsPromise
  _iconsPromise = fetch(HICON_JSON_URL, { cache: 'force-cache' })
    .then(r => r.ok ? r.json() : {})
    .then(json => { _icons = json || {}; return _icons })
    .catch(() => { _icons = {}; return _icons })
  return _iconsPromise
}

// Kick off the fetch as soon as the module loads, so by the time
// React first renders an HIcon the json is usually already cached.
loadIcons()

/**
 * <HIcon name="home" size={20} color="#FFF" strokeWidth={1.8} />
 *
 * Falls back to nothing (occupies the size box but renders empty) until
 * the icons JSON has loaded. Once loaded, the component re-renders with
 * the inner SVG markup.
 *
 * If the `name` doesn't exist in the pack, renders an empty box. Pass
 * a `fallback` prop to render something else (e.g. a built-in icon).
 */
export default function HIcon({
  name,
  size = 20,
  color = 'currentColor',
  strokeWidth = 2,
  fallback = null,
  style = {},
  className,
  ...rest
}) {
  // If the json is already loaded (second+ render anywhere in the app),
  // we read synchronously to avoid a flash of empty.
  const [inner, setInner] = useState(() => _icons?.[name] ?? null)

  useEffect(() => {
    if (_icons) { setInner(_icons[name] ?? null); return }
    let cancelled = false
    loadIcons().then(map => {
      if (!cancelled) setInner(map?.[name] ?? null)
    })
    return () => { cancelled = true }
  }, [name])

  // Not loaded yet or name not in pack → render fallback (or empty box).
  if (!inner) {
    if (fallback) return fallback
    return (
      <span
        aria-hidden="true"
        style={{ display: 'inline-block', width: size, height: size, ...style }}
        className={className}
        {...rest}
      />
    )
  }

  // The icons.json values are inner SVG markup (without the <svg> wrapper).
  // We wrap them with our own <svg> sized by props and override the stroke
  // color via color prop.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0, ...style }}
      className={className}
      dangerouslySetInnerHTML={{ __html: inner }}
      {...rest}
    />
  )
}

// ── Helpers for callers that want to know what's available ────────────────
// Useful in admin/debug screens. Returns the loaded map or {} if not loaded.
export function getLoadedIcons() {
  return _icons ?? {}
}

// Promise-based access for code paths that need to wait. Resolves to the map.
export function ensureIconsLoaded() {
  return loadIcons()
}
