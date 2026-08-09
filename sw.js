/* Setlist Builder service worker — offline support with fresh updates.
   Network-first for page loads (setlist-builder.html, requests.html) so the
   app always reflects the latest deploy; cache-first for static assets.
   Bump CACHE when you change icons/manifest so old entries get purged. */
const CACHE = "setbook-v2";
const STATIC = ["./setlist-builder.html", "./requests.html", "./index.html", "./extra-songs.json", "./manifest.webmanifest", "./icon.svg", "./apple-touch-icon.png"];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(STATIC);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  var isPage = req.mode === "navigate" || (url.pathname && /\.html?$/.test(url.pathname));
  event.respondWith(
    (isPage ? fetch(req) : caches.match(req).then(function (hit) { return hit || fetch(req); }))
      .then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      })
      .catch(function () {
        // offline: serve the cached page (app works for pool/sets), else the last known copy
        return caches.match(req).then(function (hit) {
          return hit || (isPage ? caches.match("./setlist-builder.html") : undefined);
        });
      })
  );
});
