// Service worker: tiene l'app disponibile anche senza internet.
// Cambia VERSIONE a ogni rilascio, così il telefono scarica i file nuovi.
const VERSIONE = 'folletto-v1.7.0';
const FILE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/db.js',
  './js/stats.js',
  './js/agenda.js',
  './js/segnalazioni.js',
  './js/raggruppa.js',
  './js/notifiche.js',
  './js/parser/index.js',
  './js/parser/dates.js',
  './js/parser/normalize.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' = scarica sempre dalla rete, mai copie vecchie tenute dal browser (GitHub Pages le tiene 10 minuti)
  e.waitUntil(caches.open(VERSIONE)
    .then((c) => c.addAll(FILE.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSIONE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Prima la copia salvata (l'app si apre subito anche con poco campo), poi aggiorna in background.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(VERSIONE).then(async (cache) => {
      const salvata = await cache.match(e.request, { ignoreSearch: true });
      const rete = fetch(e.request, { cache: 'no-cache' })
        .then((r) => { if (r.ok) cache.put(e.request, r.clone()); return r; })
        .catch(() => null);
      return salvata || (await rete) || cache.match('./index.html');
    }),
  );
});
