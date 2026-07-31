/* ═══════════════════════════════════════════
   TRAGOS — Service Worker
═══════════════════════════════════════════ */

const CACHE = 'tragos-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/supabase.js',
  './js/app.js',
  './assets/logo.png',
  './fonts/Ray.ttf',
  './fonts/Ray-Bold.ttf',
  './fonts/Ray-Black.ttf',
  './fonts/Ray-ExtraBold.ttf',
  './fonts/Ray-ExtraBlack.ttf',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // فقط فایل‌های استاتیک رو cache کن — Supabase رو نه
  if (e.request.url.includes('supabase.co')) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});
