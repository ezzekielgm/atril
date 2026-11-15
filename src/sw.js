// Service worker de Atril: guarda la app para que funcione sin conexión.
const VERSION = "__APP_VERSION__";
// Canal: «estable» (la dirección de siempre) o «pruebas» (la subcarpeta pruebas/, solo para Ezequiel).
// Comparten origen, así que cada canal usa sus propias cachés y el estable no toca la carpeta de pruebas.
const CANAL = "__APP_CANAL__";
const CACHE = `atril-${CANAL}-${VERSION}`;
const BASE = new URL("./", self.location).pathname;
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
      // Solo las cachés viejas de este canal (y, en el estable, las de antes de los canales: «atril-AAAAMMDD-…»)
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && (k.startsWith(`atril-${CANAL}-`) || (CANAL === "estable" && /^atril-\d{8}-/.test(k)))).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // La versión de pruebas tiene su propio service worker
  if (CANAL === "estable" && url.pathname.startsWith(BASE + "pruebas/")) return;
  // «Buscar actualizaciones» pregunta a internet por sw.js: nunca desde la caché
  if (url.pathname.endsWith("/sw.js")) return;

  // La app es una sola página: cualquier navegación sirve index.html desde la caché
  if (req.mode === "navigate") {
    event.respondWith(
      caches.match("./index.html", { cacheName: CACHE }).then((res) => res || fetch(req))
    );
    return;
  }
  event.respondWith(
    caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: true })).then((res) => res || fetch(req))
  );
});
