// ─────────────────────────────────────────────
// QUEST — Custom Service Worker  v2
// vite-plugin-pwa (injectManifest mode) injects
// __WB_MANIFEST at build time.
// ─────────────────────────────────────────────
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { skipWaiting, clientsClaim } from 'workbox-core'

// Take control immediately when a new SW activates
skipWaiting()
clientsClaim()
cleanupOutdatedCaches()

// Precache all build assets (injected by vite-plugin-pwa)
precacheAndRoute(self.__WB_MANIFEST)

// ── Push Notifications ────────────────────────
self.addEventListener('push', (event) => {
  const d = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(d.title ?? 'Quest', {
      body:    d.body  ?? '',
      icon:    d.icon  ?? '/icons/icon-192.png',
      badge:   '/icons/icon-192.png',
      data:    d.data  ?? {},
      vibrate: [200, 100, 200],
    })
  )
})

// Tap on push notification → focus existing tab or open app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        if (list.length > 0) return list[0].focus()
        return clients.openWindow('/')
      })
  )
})
