/// <reference lib="webworker" />

const CACHE_VERSION = "ideate-v2";
const OFFLINE_URL = "/offline";

// Cache names
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const ASSETS_CACHE = `${CACHE_VERSION}-assets`;
const API_CACHE = `${CACHE_VERSION}-api`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;

const ALL_CACHES = [STATIC_CACHE, ASSETS_CACHE, API_CACHE, PAGES_CACHE];

// Cache size limits (LRU eviction when exceeded)
const CACHE_LIMITS = {
  [STATIC_CACHE]: 50,
  [ASSETS_CACHE]: 100,
  [API_CACHE]: 200,
  [PAGES_CACHE]: 20,
};

// TTL per cache in seconds
const CACHE_TTLS = {
  [STATIC_CACHE]: 365 * 24 * 3600, // 1 year (hashed filenames)
  [ASSETS_CACHE]: 7 * 24 * 3600,   // 7 days
  [API_CACHE]: 300,                 // 5 minutes
  [PAGES_CACHE]: 3600,              // 1 hour
};

// Precache critical resources
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.json",
];

// ─── Cache management ──────────────────────────────────────────────────

function getCacheTTL(cacheName) {
  return CACHE_TTLS[cacheName] || 3600;
}

function isCacheStale(response, maxAge) {
  const dateStr = response.headers.get("date");
  if (!dateStr) return false;
  const cached = new Date(dateStr).getTime();
  if (isNaN(cached)) return false;
  const age = (Date.now() - cached) / 1000;
  return age > maxAge;
}

async function cleanupCacheSizes() {
  const cacheNames = await caches.keys();

  for (const cacheName of cacheNames) {
    const limit = CACHE_LIMITS[cacheName];
    if (!limit) continue;

    const cache = await caches.open(cacheName);
    const requests = await cache.keys();

    if (requests.length > limit) {
      const entries = await Promise.all(
        requests.map(async (req) => {
          const response = await cache.match(req);
          const dateStr = response?.headers.get("date") || "0";
          return {
            request: req,
            time: new Date(dateStr).getTime() || 0,
          };
        })
      );

      // Sort oldest first, remove excess
      entries.sort((a, b) => a.time - b.time);
      const toRemove = entries.slice(0, entries.length - limit);

      for (const entry of toRemove) {
        await cache.delete(entry.request);
      }
    }
  }
}

// ─── Install ────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PAGES_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ───────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all([
        // Remove old cache versions
        Promise.all(
          keys
            .filter((key) => !ALL_CACHES.includes(key))
            .map((key) => caches.delete(key))
        ),
        // Enforce cache size limits
        cleanupCacheSizes(),
      ])
    ).then(() => self.clients.claim())
  );
});

// ─── Strategy helpers (TTL-aware) ─────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached && !isCacheStale(cached, getCacheTTL(cacheName))) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return cached || new Response("Offline", { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached && !isCacheStale(cached, getCacheTTL(cacheName))) {
      return cached;
    }
    return cached || new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      caches.open(cacheName).then((cache) => cache.put(request, response.clone()));
    }
    return response;
  }).catch(() => null);

  return cached || (await fetchPromise) || caches.match(OFFLINE_URL).then((r) => r || new Response("Offline", { status: 503 }));
}

// ─── Fetch handler ──────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests (mutations handled by sync engine)
  if (event.request.method !== "GET") return;

  // Skip WebSocket and SSE
  if (url.pathname.startsWith("/api/ws") || url.pathname.startsWith("/api/sse")) return;

  // Static assets (/_next/static/) — cache-first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  // Icons and images — cache-first
  if (url.pathname.startsWith("/icons/") || url.pathname.startsWith("/images/")) {
    event.respondWith(cacheFirst(event.request, ASSETS_CACHE));
    return;
  }

  // API data (projects, proposals, votes, comments) — network-first
  if (url.pathname.match(/^\/api\/(projects|proposals|votes|comments)/)) {
    event.respondWith(networkFirst(event.request, API_CACHE));
    return;
  }

  // Search API — network-only (skip caching)
  if (url.pathname.startsWith("/api/search")) return;

  // Auth/admin APIs — network-only
  if (url.pathname.startsWith("/api/auth") || url.pathname.startsWith("/api/admin")) return;

  // HTML navigation — stale-while-revalidate
  if (event.request.mode === "navigate") {
    event.respondWith(staleWhileRevalidate(event.request, PAGES_CACHE));
    return;
  }
});

// ─── Periodic cache cleanup ──────────────────────────────────────────────

// Run cache cleanup periodically (every 6 hours)
setInterval(() => {
  cleanupCacheSizes();
}, 6 * 60 * 60 * 1000);

// ─── Push notifications ─────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Ideate", body: event.data.text() };
  }

  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "ideate-notification",
    data: { url: data.url || "/" },
    actions: data.actions || [],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(data.title || "Ideate", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const rawUrl = event.notification.data?.url || "/";
  // Only allow relative paths or same-origin URLs to prevent open redirects
  const url = rawUrl.startsWith("/") ? rawUrl : "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// ─── Background sync ────────────────────────────────────────────────────

self.addEventListener("sync", (event) => {
  if (event.tag === "offline-sync") {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage({ type: "SYNC_REQUESTED" }));
      })
    );
  }
});

// ─── Message handling ───────────────────────────────────────────────────

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data?.type === "CACHE_URLS") {
    // Only cache same-origin URLs to prevent cache poisoning
    const urls = (event.data.urls || []).filter((u) => {
      try { return new URL(u, self.location.origin).origin === self.location.origin; }
      catch { return false; }
    });
    event.waitUntil(
      caches.open(PAGES_CACHE).then((cache) => cache.addAll(urls))
    );
  }
});
