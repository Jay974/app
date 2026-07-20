// TiMétis Service Worker - Web Push
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', (event) => {
  let data = { title: 'TiMétis', body: 'Nouvelle notification' };
  try { data = event.data ? event.data.json() : data; } catch(e){ try { data.body = event.data?.text() || data.body; } catch(_){} }
  const options = {
    body: data.body,
    icon: data.icon || '/icon.png',
    badge: data.badge || '/icon.png',
    tag: data.tag || 'timetis',
    data: { url: data.url || '/' },
    vibrate: [100, 50, 100],
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(data.title || 'TiMétis', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.matchAll({ type: 'window' }).then((all) => {
    for (const c of all) { if (c.url.includes(location.origin) && 'focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
