const CACHE = "aequora-v4";

// On install: activate immediately
self.addEventListener("install", () => self.skipWaiting());

// On activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Never cache API calls — always hit the network
  if (url.pathname.startsWith("/api/")) return;

  // Let the browser's own HTTP cache handle Next.js's hashed build chunks —
  // they're already served with long-lived immutable Cache-Control headers,
  // and webpack's own chunk-loading runtime expects to control retries on
  // these requests itself. Intercepting them here previously caused a
  // missing-catch fetch failure to surface as a hard network error for the
  // whole page whenever one of these requests failed for any reason.
  if (url.pathname.startsWith("/_next/static/")) return;

  // Network-first for HTML navigation (always fresh data)
  if (request.headers.get("Accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match("/"))
            .then((cached) => cached || new Response("", { status: 504, statusText: "Gateway Timeout" }))
        )
    );
    return;
  }

  // Cache-first for other static assets (fonts, images, manifest icons).
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => new Response("", { status: 504, statusText: "Gateway Timeout" }));
    })
  );
});
