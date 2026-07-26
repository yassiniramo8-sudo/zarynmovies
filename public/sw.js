const CACHE_NAME = "zaryn-v1";

// Stale-While-Revalidate strategy
self.addEventListener("fetch", (event) => {
  // Only cache GET requests
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip non-http(s) and supabase API requests
  if (!url.protocol.startsWith("http")) return;
  if (url.hostname.includes("supabase")) return;

  // Cache strategy: stale-while-revalidate for assets, network-first for HTML
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|webp|avif|svg|woff2?|ttf|ico)$/)
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request)
            .then((response) => {
              if (response.ok) {
                cache.put(event.request, response.clone());
              }
              return response;
            })
            .catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
});
