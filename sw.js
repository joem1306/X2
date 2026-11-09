// Bump this version for EVERY release that changes a precached file.
const CACHE = 'x2-shell-v1.0.0';
const ASSETS = [
  './', './index.html', './css/app.css', './css/print.css',
  './js/app.js', './js/model.js', './js/db.js', './js/ui.js', './js/export-pdf.js',
  './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png',
  './icons/icon-512.png', './icons/apple-touch-icon.png',
];
const allowed = new Set(ASSETS.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  // Updates wait until a user explicitly chooses activation.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('x2-shell-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  // Exact static allowlist only. Never cache diary exports, query strings or arbitrary requests.
  if (event.request.method !== 'GET' || !allowed.has(event.request.url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request);
    return cached || fetch(event.request);
  })());
});
