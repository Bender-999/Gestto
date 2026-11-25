/* Service worker: guarda la app para abrirla sin conexión.
   Sube VERSION cada vez que publiques cambios para que los dispositivos cojan la versión nueva. */
const VERSION = 'la-hoja-v2.1.0';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/base.css', 'css/styles.css',
  'js/main.js', 'js/ui.js', 'js/logic.js', 'js/controls.js', 'js/storage.js', 'js/push.js', 'js/firebase-config.js', 'js/sample.js', 'js/prompt.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  /* Firebase y Google gestionan su propia red: no se tocan. */
  if (/googleapis\.com$|firebaseapp\.com$|gstatic\.com$/.test(u.hostname) && !u.hostname.startsWith('fonts.')) return;
  if (u.origin === location.origin) {
    /* App: primero la red (para ver cambios al momento) y, sin conexión, la copia guardada. */
    e.respondWith(fetch(e.request).then(r => {const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); return r}).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
  } else if (u.hostname.startsWith('fonts.')) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(n => {const c = n.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); return n})));
  }
});

/* Avisos de la sesión: llegan de la función «avisos» aunque la app esté cerrada. */
self.addEventListener('push', e => {
  let d = {};
  try {d = e.data ? e.data.json() : {}} catch (x) {d = {body: e.data ? e.data.text() : ''}}
  e.waitUntil(self.registration.showNotification(d.title || 'La Hoja', {body: d.body || '', tag: d.tag || 'la-hoja', renotify: true, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png'}));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(cs => {
    const c = cs.find(x => 'focus' in x);
    return c ? c.focus() : self.clients.openWindow('./');
  }));
});
