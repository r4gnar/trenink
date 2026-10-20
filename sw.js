// Při každém nasazení zvýšit VERSION (spolu s APP_VERSION v js/app.js),
// jinak telefon zůstane na staré verzi z cache.
const VERSION = '0.1.0';
const CACHE = `trenink-${VERSION}`;

const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/plan.js',
  './js/store.js',
  './js/content.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('trenink-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Nová verze čeká, dokud uživatel neklikne na „Obnovit“ — ať se appka nepřenačte uprostřed tréninku.
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

// Vše z cache (offline), stránka sama při navigaci.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const lookup = request.mode === 'navigate' ? caches.match('./index.html') : caches.match(request);
  event.respondWith(lookup.then((hit) => hit ?? fetch(request)));
});
