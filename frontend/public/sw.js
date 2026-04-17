/**
 * SoloCompass Service Worker
 * Handles offline caching and provides offline fallback pages
 *
 * Caching strategy per resource type:
 *   Static assets (JS/CSS/fonts/images)  → Cache-first (long-lived)
 *   HTML pages                           → Network-first, offline fallback
 *   API: stable data (destinations,      → Network-first, 30-min TTL cache
 *         advisories, countries)
 *   API: volatile data (safety, trips,   → Network-first, 5-min TTL cache
 *         notifications, analytics)
 *   API: mutation requests (POST/PUT…)   → Network-only (never cached)
 */

const CACHE_NAME = 'solocompass-v2';
const STATIC_CACHE = 'solocompass-static-v2';
const DYNAMIC_CACHE = 'solocompass-dynamic-v2';
const OFFLINE_PAGE = '/offline.html';
const IS_DEV = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

// ─── TTL configuration (ms) ───────────────────────────────────────────────

/** Stable endpoints: destination data, advisories, country guides */
const STABLE_API_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Volatile endpoints: trips, safety, notifications, user profile */
const VOLATILE_API_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** URL path prefixes treated as "stable" (cache for longer) */
const STABLE_API_PATTERNS = [
  '/api/destinations',
  '/api/advisories',
  '/api/emergency-numbers',
  '/api/help',
];

// Assets to cache immediately on install
const STATIC_ASSETS = IS_DEV ? [] : [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  if (IS_DEV) {
    console.log('[SW] Dev mode detected - skipping cache, using network only');
    self.skipWaiting();
    return;
  }
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        )
      })
      .then(() => {
        // Prune stale dynamic-cache entries on activation
        pruneStaleCache();
        return self.clients.claim();
      })
  );
});

// ─── Fetch event — routing table ──────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // In dev mode, always go to network - never cache
  if (IS_DEV) return;

  // Skip Chrome extensions and dev tools
  if (url.protocol === 'chrome-extension:') return;

  // API requests — routing based on method + path
  if (url.pathname.startsWith('/api/')) {
    // Never cache mutation requests (POST, PUT, PATCH, DELETE)
    if (request.method !== 'GET') return; // fall through to default browser behaviour

    // Stable endpoints get a 30-minute TTL
    if (STABLE_API_PATTERNS.some(prefix => url.pathname.startsWith(prefix))) {
      event.respondWith(timedNetworkFirstStrategy(request, STABLE_API_TTL_MS));
      return;
    }

    // All other GET API calls — volatile 5-minute TTL
    event.respondWith(timedNetworkFirstStrategy(request, VOLATILE_API_TTL_MS));
    return;
  }

  // Static assets - cache first, fallback to network
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // HTML pages - network first with offline fallback
  if (request.destination === 'document') {
    event.respondWith(htmlStrategy(request));
    return;
  }

  // Default - network first
  event.respondWith(networkFirstStrategy(request));
});

// ─── Caching strategies ───────────────────────────────────────────────────

/**
 * Network-first with TTL-aware cache fallback.
 * Stores a `sw-cached-at` header alongside each response so stale entries
 * can be detected and re-fetched on subsequent visits.
 *
 * @param {Request} request
 * @param {number} ttlMs  Maximum age of a cached response in milliseconds
 */
async function timedNetworkFirstStrategy(request, ttlMs) {
  const cache = await caches.open(DYNAMIC_CACHE);

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Clone and inject a timestamp header so we can check TTL on cache hit
      const timestampedResponse = await injectTimestamp(networkResponse.clone());
      cache.put(request, timestampedResponse);
    }

    return networkResponse;
  } catch (_networkError) {
    // Network failed — try cache, respecting TTL
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      const cachedAt = parseInt(cachedResponse.headers.get('sw-cached-at') || '0', 10);
      if (Date.now() - cachedAt < ttlMs) {
        return cachedResponse;
      }
      // Entry is stale — delete it so next visit triggers a fresh fetch
      cache.delete(request);
    }

    // Return offline JSON stub for API requests
    return new Response(
      JSON.stringify({
        success: false,
        error: 'offline',
        message: 'You are currently offline. Some features may be limited.',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Clone a response and add a `sw-cached-at` header (epoch ms).
 * Required because Response headers are immutable, so we rebuild.
 */
async function injectTimestamp(response) {
  const body = await response.arrayBuffer();
  const headers = new Headers(response.headers);
  headers.set('sw-cached-at', String(Date.now()));
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Original network-first (no TTL, used for non-API fallback) */
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline JSON for API requests
    if (request.url.includes('/api/')) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'offline',
          message: 'You are currently offline. Some features may be limited.' 
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    throw error;
  }
}

// Cache First Strategy
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Return a fallback for images
    if (request.destination === 'image') {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="#f3f4f6" width="100" height="100"/><text fill="#9ca3af" font-family="sans-serif" font-size="12" x="50" y="50" text-anchor="middle" dy=".3em">Offline</text></svg>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }
    
    throw error;
  }
}

// HTML Strategy - Network first with offline page fallback
async function htmlStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Try to return cached page
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page
    const offlinePage = await caches.match(OFFLINE_PAGE);
    if (offlinePage) {
      return offlinePage;
    }

    // Ultimate fallback - basic HTML
    return new Response(
      `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Offline - SoloCompass</title>
        <style>
          body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f3f4f6; }
          .container { text-align: center; padding: 2rem; max-width: 400px; }
          h1 { color: #6366f1; margin-bottom: 1rem; }
          p { color: #6b7280; margin-bottom: 1.5rem; }
          button { background: #6366f1; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer; }
          button:hover { background: #4f46e5; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>You're Offline</h1>
          <p>Please check your internet connection and try again.</p>
          <button onclick="location.reload()">Retry</button>
        </div>
      </body>
      </html>`,
      {
        status: 503,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}

// ─── Cache maintenance ────────────────────────────────────────────────────

/**
 * Evict any dynamic-cache entries whose `sw-cached-at` timestamp is older
 * than the longest TTL we use (30 minutes). This keeps the cache lean across
 * activations without manual intervention.
 */
async function pruneStaleCache() {
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    const keys = await cache.keys();
    const now = Date.now();
    const MAX_AGE_MS = STABLE_API_TTL_MS;

    for (const request of keys) {
      const cached = await cache.match(request);
      if (!cached) continue;
      const cachedAt = parseInt(cached.headers.get('sw-cached-at') || '0', 10);
      if (cachedAt && now - cachedAt > MAX_AGE_MS) {
        cache.delete(request);
      }
    }
  } catch (_) {
    // Cache maintenance errors are non-fatal
  }
}

// ─── Message handler ──────────────────────────────────────────────────────

// Handle messages from the main app
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  
  if (event.data === 'clearCache') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});

// ─── Background sync ──────────────────────────────────────────────────────

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-checkins') {
    event.waitUntil(syncPendingCheckins());
  }
});

async function syncPendingCheckins() {
  console.log('[SW] Syncing pending check-ins...');
}

// ─── Push notifications ───────────────────────────────────────────────────

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'SoloCompass', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

console.log('[SW] Service worker loaded');
