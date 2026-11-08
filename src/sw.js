// Service worker de Atril: guarda la app para que funcione sin conexión.
const VERSION = "__APP_VERSION__";
const CACHE = "atril-" + VERSION;
const ASSETS = __ASSETS__;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("atril-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // La app es una sola página: cualquier navegación sirve index.html desde la caché
  if (req.mode === "navigate") {
    event.respondWith(
      caches.match("./index.html", { cacheName: CACHE }).then((res) => res || fetch(req))
    );
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((res) => res || fetch(req))
  );
});
