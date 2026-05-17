import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App.jsx'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()))
}
if ('caches' in window) {
  caches.keys().then(keys => keys.forEach(k => caches.delete(k)))
}

// ── Chunk-load recovery for code-split bundles ────────────────────────────────
// When a new deploy lands, older tabs may try to load lazy chunks that no
// longer exist (filenames have content hashes). Without recovery the user sees
// a blank screen. We catch the rejected import() promise BEFORE it reaches the
// React ErrorBoundary and reload the page once per session (15 s guard prevents
// loop if the user is genuinely offline).
const CHUNK_RELOAD_KEY = 'quest_chunk_reload_at'
window.addEventListener('unhandledrejection', (e) => {
  const m = (e?.reason?.message || e?.reason?.name || '').toLowerCase()
  const isChunk =
    e?.reason?.name === 'ChunkLoadError' ||
    m.includes('chunkloaderror') ||
    m.includes('failed to fetch dynamically imported module') ||
    m.includes('importing a module script failed') ||
    m.includes('error loading chunk')
  if (!isChunk) return
  try {
    const last = parseInt(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0', 10)
    if (Date.now() - last < 15_000) return  // bail to avoid reload loop
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()))
    window.location.reload()
  } catch {}
})

// ── Sentry — production error tracking ────────────────────────────────────────
// Only initialises if a DSN is configured (so dev/preview stay noise-free).
// To enable: add VITE_SENTRY_DSN to Vercel env vars (Settings → Environment Variables).
// Get the DSN from sentry.io → your project → Settings → Client Keys (DSN).
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN
if (SENTRY_DSN && import.meta.env.PROD) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    // Sample 10 % of transactions for performance monitoring — keeps costs low
    // while still catching p95 latency regressions.
    tracesSampleRate: 0.1,
    // Sample 100 % of sessions that include an error (so you always see the
    // full session replay around a crash), and 10 % of healthy sessions.
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    // Filter out noisy errors that are not actionable
    ignoreErrors: [
      'AbortError',                    // User-cancelled fetches
      'Network request failed',        // Transient offline blips
      'Load failed',                   // iOS Safari abort flavour
      'ResizeObserver loop limit exceeded',
    ],
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
