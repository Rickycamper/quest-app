// Kill-switch service worker — unregisters itself and clears all caches.
// This replaces the old SW that was caching broken JS.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', async () => {
  await self.clients.claim()
  const keys = await caches.keys()
  await Promise.all(keys.map(k => caches.delete(k)))
  await self.registration.unregister()
})
