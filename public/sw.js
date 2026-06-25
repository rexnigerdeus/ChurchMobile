/* Service Worker pour ChurchMobile PWA
 * Stratégies :
 *  - App shell (HTML, JS, CSS) : stale-while-revalidate
 *  - Assets statiques (icônes, images) : cache-first
 *  - Appels Supabase (REST) : network-only (jamais de cache pour l'auth/data sensible)
 */

const VERSION = 'v1.0.0';
const STATIC_CACHE = `static-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/assets/favicon.png',
  '/assets/icon.png',
  '/assets/splash-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Toujours passer par le réseau pour Supabase (auth, données)
  if (url.hostname.endsWith('.supabase.co')) {
    return; // comportement par défaut du navigateur
  }

  // Cache-first pour les assets statiques
  if (url.pathname.startsWith('/assets/') || /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          return response;
        });
      })
    );
    return;
  }

  // Stale-while-revalidate pour tout le reste (JS, CSS, HTML)
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
