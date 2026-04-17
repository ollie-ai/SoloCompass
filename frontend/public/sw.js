/**
 * SoloCompass Service Worker
 * Handles offline caching and provides offline fallback pages
 */

const CACHE_NAME = 'solocompass-v2';
const STATIC_CACHE = 'solocompass-static-v2';
const DYNAMIC_CACHE = 'solocompass-dynamic-v2';
const OFFLINE_PAGE = '/offline.html';
const IS_DEV = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

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
      .then(() => self.clients.claim())
  );
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // In dev mode, always go to network - never cache
  if (IS_DEV) return;

  // Skip Chrome extensions and dev tools
  if (url.protocol === 'chrome-extension:') return;

  // API requests - network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
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

// Network First Strategy
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

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-checkins') {
    event.waitUntil(syncPendingCheckins());
  }
  if (event.tag === 'sync-push-queue') {
    event.waitUntil(processOfflinePushQueue());
  }
});

async function syncPendingCheckins() {
  console.log('[SW] Syncing pending check-ins...');
}

const PUSH_QUEUE_CACHE = 'solocompass-push-queue';

/**
 * Queue a push notification for later display when back online
 */
async function queuePushNotification(data) {
  try {
    const cache = await caches.open(PUSH_QUEUE_CACHE);
    const response = await cache.match('queue');
    const queue = response ? await response.json() : [];
    queue.push({ ...data, queuedAt: Date.now() });
    await cache.put('queue', new Response(JSON.stringify(queue)));
    console.log('[SW] Push notification queued for offline delivery');
  } catch (err) {
    console.error('[SW] Failed to queue push notification:', err);
  }
}

/**
 * Process queued push notifications when back online
 */
async function processOfflinePushQueue() {
  try {
    const cache = await caches.open(PUSH_QUEUE_CACHE);
    const response = await cache.match('queue');
    if (!response) return;

    const queue = await response.json();
    if (!queue || queue.length === 0) return;

    console.log(`[SW] Processing ${queue.length} queued push notifications`);
    for (const data of queue) {
      // Skip stale notifications (older than 24 hours)
      if (Date.now() - data.queuedAt > 24 * 60 * 60 * 1000) continue;
      
      await self.registration.showNotification(data.title || 'SoloCompass', {
        body: data.body || 'You have a notification',
        icon: '/logo192.png',
        badge: '/logo192.png',
        vibrate: data.vibrate || [100, 50, 100],
        data: { url: data.url || '/' },
        actions: data.actions || [],
        tag: data.tag || undefined,
      });
    }

    // Clear queue
    await cache.put('queue', new Response(JSON.stringify([])));
    console.log('[SW] Offline push queue cleared');
  } catch (err) {
    console.error('[SW] Failed to process offline push queue:', err);
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'SoloCompass', body: event.data.text() };
  }

  const options = {
    body: data.body || 'You have a new notification',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: data.silent ? undefined : (data.vibrate || [100, 50, 100]),
    silent: data.silent || false,
    tag: data.tag || data.type || undefined,
    renotify: !!data.tag,
    requireInteraction: data.priority === 'P0' || data.priority === 'P1',
    data: {
      url: data.url || '/',
      type: data.type,
      notificationId: data.notificationId,
    },
    actions: data.actions || []
  };

  // If offline, also queue for sync when back online
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || 'SoloCompass', options),
      // Track for analytics via POST when possible
      data.notificationId ? fetch('/api/notifications/track-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: data.notificationId, status: 'delivered' })
      }).catch(() => {
        // Offline - queue for later
        return queuePushNotification(data);
      }) : Promise.resolve()
    ])
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
