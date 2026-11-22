const SHELL_CACHE = "pumped-shell-v1";
const STATIC_CACHE = "pumped-static-v1";
const MEDIA_CACHE = "pumped-media-v1";

const PRECACHE_ROUTES = [
  "/",
  "/routines",
  "/exercises",
  "/history",
  "/settings",
  "/offline",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ROUTES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  const allowed = new Set([SHELL_CACHE, STATIC_CACHE, MEDIA_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (!allowed.has(key)) {
              return caches.delete(key);
            }
            return Promise.resolve(false);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

function isMediaAsset(pathname) {
  return pathname.startsWith("/icons/") || pathname.startsWith("/exercises/");
}

function isStaticAsset(pathname) {
  return pathname.startsWith("/_next/static/");
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cachedPage = await cache.match(request);
    if (cachedPage) {
      return cachedPage;
    }
    const offlineFallback = await cache.match("/offline");
    if (offlineFallback) {
      return offlineFallback;
    }
    return new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Never intercept cross-origin APIs (including Supabase) or Next.js API routes
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") {
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (isMediaAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
  }
});
