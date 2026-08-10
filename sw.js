/* TOOLGIG service worker — intentionally a no-op.
   Caching the app HTML caused stale-version bugs (requests/popups stopped
   working until "clear cache"). This SW only makes sure old caches are wiped
   and the app ALWAYS loads the freshest build from the network. */
self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return caches.delete(k); }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// No fetch handler: the browser uses the default network-first behaviour,
// so the app is never served stale.
