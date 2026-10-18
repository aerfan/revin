// Revin PWA Service Worker: Cache-First for static assets, Network-First for documents
const CACHE_NAME = 'revin-cache-v1';
const PRECACHE_URLS = [
  '/',
  '/vendor/preact-core.min.js?v=10.24.3',
  '/vendor/supabase.js?v=2.117.2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Strictly skip non-HTTP requests, non-GET methods, external Supabase API / WebSocket traffic, and Vercel endpoints
  if (!url.protocol.startsWith('http') || req.method !== 'GET' || url.protocol.startsWith('ws') || url.hostname.includes('supabase.co') || url.pathname.startsWith('/_vercel/')) {
    return;
  }

  // Cache-First for versioned vendor assets & fonts
  if (url.pathname.startsWith('/vendor/') || url.hostname.includes('gstatic.com') || url.hostname.includes('googleapis.com')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-First with cache fallback for page navigation
  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(req).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return response;
      }).catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
    );
  }
});
