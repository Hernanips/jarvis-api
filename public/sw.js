self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Petición estándar permitida para la PWA
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});