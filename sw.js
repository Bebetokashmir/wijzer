// Wijzer Service Worker v1.0
var CACHE_NAME = 'wijzer-v1';
var OFFLINE_URL = '/';

// Assets to cache on install
var PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ── INSTALL: pre-cache core assets ──
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS.filter(function(url) {
        // Only cache what exists — skip icons if not uploaded yet
        return true;
      })).catch(function(err) {
        console.log('Wijzer SW: cache pre-load gedeeltelijk mislukt', err);
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE: clean old caches ──
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── FETCH: network-first, fallback to cache ──
self.addEventListener('fetch', function(event) {
  var req = event.request;

  // Skip non-GET, cross-origin, Supabase and CDN requests
  if (req.method !== 'GET') return;
  if (!req.url.startsWith(self.location.origin)) {
    // Allow CDN fetches through without caching
    event.respondWith(fetch(req).catch(function() {
      return new Response('', { status: 503 });
    }));
    return;
  }

  // For HTML pages: network first, cache fallback
  if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(req).then(function(response) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(req, clone); });
        return response;
      }).catch(function() {
        return caches.match(req).then(function(cached) {
          return cached || caches.match('/index.html');
        });
      })
    );
    return;
  }

  // For other assets: cache first, network fallback
  event.respondWith(
    caches.match(req).then(function(cached) {
      if (cached) return cached;
      return fetch(req).then(function(response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(req, clone); });
        }
        return response;
      });
    })
  );
});

// ── PUSH NOTIFICATIONS (voorbereid voor toekomst) ──
self.addEventListener('push', function(event) {
  if (!event.data) return;
  var data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Wijzer', {
      body: data.body || 'U heeft een nieuw bericht.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'wijzer-notification',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
