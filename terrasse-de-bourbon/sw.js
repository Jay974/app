/* Service worker : ouverture instantanée et page disponible hors connexion.
   Les données (Supabase) ne sont jamais mises en cache : elles restent toujours à jour. */
const CACHE = 'tdb-v5';
const SHELL = ['/index.html', '/manifest.webmanifest', '/manifest-equipe.webmanifest', '/icons/icon-192.png', '/icons/icon-equipe-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if(req.method !== 'GET' || url.hostname.endsWith('supabase.co')) return;
  // Pages : le réseau d'abord pour toujours avoir la dernière version, le cache si pas de connexion.
  if(req.mode === 'navigate'){
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('/index.html', copy)); return r; })
      .catch(() => caches.match('/index.html')));
    return;
  }
  // Icônes, polices, bibliothèque Supabase : le cache d'abord, mis à jour en arrière-plan.
  if(url.origin === location.origin || url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'){
    e.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(r => { if(r.ok || r.type === 'opaque'){ const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});

/* Notifications push : nouvelle demande, même quand l'app est fermée. */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch(err){ d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.title || 'La Terrasse de Bourbon', {
      body: d.body || '', tag: d.tag, renotify: true,
      icon: d.icon || '/icons/icon-equipe-192.png', badge: d.icon || '/icons/icon-equipe-192.png',
      data: { url: d.url || '/equipe' }
    }),
    d.badge && self.navigator.setAppBadge ? self.navigator.setAppBadge(d.badge).catch(() => {}) : null
  ]));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  // Équipe : ouvre le hub ; client : ouvre sa page de suivi. Réutilise une fenêtre déjà ouverte sur la même page.
  const url = new URL((e.notification.data && e.notification.data.url) || '/equipe', self.location.origin);
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for(const c of list){
      if(new URL(c.url).pathname !== url.pathname || !('focus' in c)) continue;
      return (url.hash && 'navigate' in c ? c.navigate(url.href).catch(() => c) : Promise.resolve(c)).then(w => (w || c).focus());
    }
    return self.clients.openWindow(url.href);
  }));
});
