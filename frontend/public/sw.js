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

  if (event.data === 'replayPushQueue') {
    replayQueuedPushNotifications();
  }
});

// Background sync event — replay queued push notifications when back online
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-checkins') {
    event.waitUntil(syncPendingCheckins());
  }
  if (event.tag === 'replay-push-queue') {
    event.waitUntil(replayQueuedPushNotifications());
  }
});

async function syncPendingCheckins() {
  console.log('[SW] Syncing pending check-ins...');
}

// ─── Offline push queue ────────────────────────────────────────────────────
// When a push arrives and the device is offline (or no clients are visible)
// we store it in IndexedDB so it can be replayed when connectivity returns.

const DB_NAME = 'solocompass-push-queue';
const DB_STORE = 'pending';

async function openPushQueueDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueuePushPayload(payload) {
  try {
    const db = await openPushQueueDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).add({ payload, queuedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[SW] Failed to enqueue push payload:', err);
  }
}

async function dequeuePendingPushPayloads() {
  try {
    const db = await openPushQueueDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      const store = tx.objectStore(DB_STORE);
      const items = [];
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          items.push(cursor.value);
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve(items);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[SW] Failed to dequeue push payloads:', err);
    return [];
  }
}

async function showNotificationFromPayload(data) {
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    actions: data.actions || [],
  };
  return self.registration.showNotification(data.title || 'SoloCompass', options);
}

// Replay queued notifications — triggered by 'sync' or when clients come online
async function replayQueuedPushNotifications() {
  const pending = await dequeuePendingPushPayloads();
  for (const item of pending) {
    try {
      await showNotificationFromPayload(item.payload);
    } catch (err) {
      console.warn('[SW] Failed to show queued notification:', err);
    }
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { body: event.data.text() };
  }

  // If offline, also queue for sync when back online
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (visibleClients) => {
      if (visibleClients.length === 0) {
        // No active clients — queue the notification for replay
        await enqueuePushPayload(data);
      }
      return showNotificationFromPayload(data);
    })
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
