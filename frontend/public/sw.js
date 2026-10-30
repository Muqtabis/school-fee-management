/* THE AGE SCHOOL — service worker (offline shell + API read fallback)
 *
 * Strategies:
 *  - Navigations : network-first, offline falls back to cached shell ("/")
 *  - /api GETs   : network-first, offline falls back to the last cached reply
 *  - Static files: cache-first, then network and stored at runtime
 *
 * Bump VERSION on each deploy to force-refresh old caches.
 */
const VERSION = "age-school-v1";
const SHELL_CACHE = VERSION + "-shell";
const RUNTIME_CACHE = VERSION + "-runtime";

const SHELL_URLS = ["/", "/index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // SPA navigations: network-first; offline -> cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches
            .open(SHELL_CACHE)
            .then((cache) => cache.put("/index.html", copy))
            .catch(() => {});
          return response;
        })
        .catch(() =>
          caches
            .match("/index.html", { cacheName: SHELL_CACHE })
            .then(
              (hit) =>
                hit ||
                caches.match("/index.html") ||
                Response.error()
            )
        )
    );
    return;
  }

  // API reads: network-first; offline -> last cached reply (read-only view).
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches
              .open(RUNTIME_CACHE)
              .then((cache) => cache.put(request, copy))
              .catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || Response.error()))
    );
    return;
  }

  // Static assets (hashed build files, icons, fonts): cache-first.
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches
            .open(RUNTIME_CACHE)
            .then((cache) => cache.put(request, copy))
            .catch(() => {});
        }
        return response;
      });
    })
  );
});
