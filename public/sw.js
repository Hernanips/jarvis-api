const CACHE_NAME = 'jarvis-shell-v5';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Nunca interceptar nada que empiece por /api (con o sin barra) ni peticiones POST
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api')) {
    return;
  }

  // Network-first siempre para tener la última versión de index.html
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      return cached || new Response('Offline', { status: 408 });
    })
  );
});