const CACHE = "aequora-v6";

// On install: activate immediately
self.addEventListener("install", () => self.skipWaiting());

// On activate: clean up old caches and take control right away
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Allowlist-only: cache exactly these, unambiguously-static, rarely-changing
// assets. Everything else (HTML, Next.js's RSC navigation payloads, JS
// chunks, API calls, fonts served from other paths, etc.) is left
// completely untouched -- the browser handles it natively, same as if this
// service worker didn't exist. This is deliberately conservative after
// repeatedly guessing wrong about which of Next.js's internal request
// shapes were safe to intercept, each guess breaking page loads in a new
// way. A small offline-icon cache is not worth that risk.
const CACHEABLE_PATHS = ["/logo.png", "/icon.png", "/apple-icon.png", "/manifest.webmanifest"];

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!CACHEABLE_PATHS.includes(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone)).catch(() => {});
        }
        return res;
      });
    })
  );
});
