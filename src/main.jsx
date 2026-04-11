import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// ── Kill ALL service workers + caches so stale JS never blocks the app ──────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister())
  })
}
if ('caches' in window) {
  caches.keys().then(keys => keys.forEach(k => caches.delete(k)))
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
