/* Sinew service worker — hand-written to avoid a webpack-only PWA plugin (Next 16 builds with Turbopack).
 * - App shell + static assets: cache-first (hashed /_next/static files are immutable).
 * - Navigations: network-first, falling back to the cached page, then to "/".
 * - API calls are never cached here; offline writes go through IndexedDB + sync.
 */
const VERSION = "sinew-v2";
// Pages are auth-gated, so they are cached on successful navigation, not at install
const SHELL = ["/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Never cache a redirect (e.g. to /signin) under the page's URL
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("/")) || Response.error()),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || /\.(svg|png|woff2?|css|js)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
