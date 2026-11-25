// Service worker : l'app s'ouvre même hors-ligne ; les données passent par /api (jamais mises en cache).
const CACHE = 'life-v28';
const SHELL = ['/', '/index.html', '/style.css', '/app.js', '/config.js', '/vendor/supabase.js', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  // réseau d'abord (toujours à jour), cache en secours hors-ligne
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('/index.html'))));
});

// Notifications push (rappels)
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch { /* texte brut */ }
  e.waitUntil(self.registration.showNotification(d.title || 'Ma Vie', { body: d.body || '', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: d.tag, data: { url: d.url || '/' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) if ('focus' in c) { if (c.navigate) c.navigate(url); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
