// ─── SERVICE WORKER — Fitness Tracker PWA ────────────────────────────────────
// Handles background push notifications and offline caching.
// Registered from initReminders() in the main app.

const CACHE_NAME = 'fitness-tracker-v1';

// ── Install: cache the app shell ─────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(['./', './index.html', './manifest.json'])
        .catch(() => { /* offline - skip caching */ })
    )
  );
});

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: serve from cache, fall back to network ────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Fitness Tracker', {
      body:    data.body    || '',
      icon:    data.icon    || './manifest.json',
      badge:   data.badge   || '',
      tag:     data.tag     || 'fitness-reminder',
      data:    data.data    || {},
    })
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      if (wins.length > 0) return wins[0].focus();
      return clients.openWindow('./');
    })
  );
});

// ── Scheduled alarm via postMessage ──────────────────────────────────────────
// The app sends { type: 'SCHEDULE_NOTIFICATION', ... } to schedule reminders.
// Since true background scheduling isn't available in SW without push server,
// we use periodic sync or the app sends reminders when open.
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(event.data.title, {
      body:  event.data.body,
      icon:  event.data.icon || '',
      tag:   event.data.tag  || 'fitness',
      data:  { url: './' },
    });
  }
});
