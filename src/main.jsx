import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// ── Force PWA update on new service worker ────────────────────────────────
// Problem: iOS home screen PWAs don't re-check the SW on launch, so old
// versions can linger for hours.
// Fix:
//   1. On controllerchange → reload immediately (new SW took over)
//   2. On visibilitychange (app foregrounded) → call registration.update()
//      so the browser fetches the latest SW from the network right away
//   3. Every 60s while the app is open → same update() poll
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })

  navigator.serviceWorker.ready.then(registration => {
    // Check for update immediately on launch
    registration.update()

    // Re-check every time the user brings the app to the foreground
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update()
      }
    })

    // Also poll every 60 seconds while the app is open
    setInterval(() => registration.update(), 60_000)
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
