import React from 'react'
import ReactDOM from 'react-dom/client'

// ── Kill stale service workers ───────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()))
}
if ('caches' in window) {
  caches.keys().then(keys => keys.forEach(k => caches.delete(k)))
}

// ── Global error handler — shows error on screen instead of black screen ─────
window.onerror = (msg, src, line, col, err) => {
  document.getElementById('root').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100dvh;background:#0A0A0A;padding:24px;gap:16px;text-align:center;">
      <div style="font-size:32px">⚠️</div>
      <div style="color:#EF4444;font-family:monospace;font-size:12px;max-width:340px;word-break:break-all;line-height:1.6;">
        ${msg}<br/><br/>${src ? src.split('/').pop() + ':' + line + ':' + col : ''}
      </div>
      <button onclick="window.location.reload()" style="margin-top:8px;padding:12px 28px;background:#fff;border:none;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;">Recargar</button>
    </div>
  `
  return false
}

window.onunhandledrejection = (e) => {
  window.onerror(e.reason?.message || String(e.reason), '', 0, 0, e.reason)
}

import('./App.jsx').then(({ default: App }) => {
  ReactDOM.createRoot(document.getElementById('root')).render(<App />)
}).catch(err => {
  window.onerror(err.message || String(err), err.stack || '', 0, 0, err)
})
