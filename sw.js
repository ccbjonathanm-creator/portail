/* Service worker Portail - hors-ligne, réseau d'abord pour le code. */
const CACHE = 'portail-v6';
// Les gros modèles GLB ne sont PAS précachés (trop lourds à l'install) :
// ils sont mis en cache à la volée par le gestionnaire fetch ci-dessous.
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.webmanifest',
  './vendor/three.min.js',
  './vendor/GLTFLoader.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Les gros modèles GLB passent en direct au réseau, sans interception :
  // les cloner/mettre en cache bloque le flux d'un fichier de plusieurs Mo.
  if (e.request.url.endsWith('.glb') || e.request.url.includes('/models/')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
