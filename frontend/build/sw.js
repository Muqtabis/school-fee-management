/* School ERP service worker — offline app shell only.
   NEVER caches API/data responses (student data stays live & private). */
const CACHE = "school-erp-v1";
const SHELL = ["/", "/index.html", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
    self.skipWaiting();
    event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    // Never touch API calls or external requests — always network.
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith("/api/")) return;
    // Navigation: network-first, fall back to cached shell offline.
    if (req.mode === "navigate") {
        event.respondWith(
            fetch(req).catch(() => caches.match("/index.html"))
        );
        return;
    }
    // Static assets (js/css/icons): cache-first.
    event.respondWith(
        caches.match(req).then((hit) => hit || fetch(req).then((res) => {
            if (res.ok) {
                const copy = res.clone();
                caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
        }).catch(() => hit))
    );
});
