import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// ── Service Worker: nuke old caches + force update ────────────────────────
if ('serviceWorker' in navigator) {
  // 1. Unregister ALL old service workers so stale caches can't block loading
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(r => r.unregister())
  })

  // 2. Clear ALL caches
  if ('caches' in window) {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k)))
  }

  // 3. After clearing, register fresh SW
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      registration.update()
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload()
      })
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
