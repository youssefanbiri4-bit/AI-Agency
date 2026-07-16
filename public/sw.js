/* AgentFlow AI — Service Worker v2
 * Provides:
 *  - App-shell precache + runtime caching (network-first for pages, SWR for static)
 *  - Offline fallback page
 *  - Background Sync for queued mutations (the "Queues")
 *  - Push notifications with action buttons
 *  - Dashboard data caching (stale-while-revalidate for API reads)
 *
 * NOTE: This file is plain JavaScript in /public so it is served at /sw.js.
 * It must stay framework-free (no imports).
 */

const VERSION = 'v2';
const STATIC_CACHE = `agentflow-static-${VERSION}`;
const RUNTIME_CACHE = `agentflow-runtime-${VERSION}`;
const DASHBOARD_CACHE = `agentflow-dashboard-${VERSION}`;
const OFFLINE_URL = '/offline';
const PRECACHE_URLS = ['/', OFFLINE_URL, '/manifest.json', '/icon.svg', '/icon-512.png', '/maskable-512.png'];

const SYNC_TAG = 'agentflow-queues';
const DB_NAME = 'agentflow-pwa';
const STORE_NAME = 'sync-queue';

const DASHBOARD_API_PATHS = [
  '/api/dashboard/operational/summary',
  '/api/dashboard/operational/alerts',
  '/api/usage/analytics',
];

/* ----------------------------- install / activate ---------------------------- */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE && key !== DASHBOARD_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ------------------------------- fetch routing ------------------------------- */

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.startsWith('/fonts/') ||
    /\.(?:js|css|woff2?|ttf|otf|svg|png|jpe?g|gif|webp|ico|json)$/.test(url.pathname)
  );
}

function isNavigation(request) {
  return request.mode === 'navigate';
}

function isDashboardApi(url) {
  return DASHBOARD_API_PATHS.some((p) => url.pathname.startsWith(p));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isNavigation(request)) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    if (isDashboardApi(url)) {
      event.respondWith(staleWhileRevalidate(request, DASHBOARD_CACHE));
    } else {
      event.respondWith(networkFirstApi(request));
    }
    return;
  }

  event.respondWith(networkFirstApi(request));
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    return offline || Response.error();
  }
}

async function networkFirstApi(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

/* --------------------------- IndexedDB (sync queue) --------------------------- */

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllQueued() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function deleteQueued(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function updateQueuedItem(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ------------------------------ Background Sync ------------------------------ */

const MAX_RETRIES = 5;

async function replayQueue() {
  const items = await getAllQueued();
  let synced = 0;

  for (const item of items) {
    if ((item.retryCount || 0) >= MAX_RETRIES) continue;

    try {
      const response = await fetch(item.url, {
        method: item.method || 'POST',
        headers: item.headers || { 'Content-Type': 'application/json' },
        body: item.body,
        credentials: 'include',
      });
      if (response && response.ok) {
        await deleteQueued(item.id);
        synced += 1;
      } else {
        await updateQueuedItem({
          ...item,
          retryCount: (item.retryCount || 0) + 1,
          lastError: 'HTTP ' + response.status,
        });
      }
    } catch (err) {
      await updateQueuedItem({
        ...item,
        retryCount: (item.retryCount || 0) + 1,
        lastError: err.message || 'Network error',
      });
    }
  }

  await notifyClients({ type: 'QUEUE_UPDATED', count: (await getAllQueued()).length, synced });
  return synced;
}

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(replayQueue());
  }
});

/* --------------------------------- messages ---------------------------------- */

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (data.type === 'FLUSH') {
    event.waitUntil(replayQueue());
  }
});

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  for (const client of clients) {
    client.postMessage(message);
  }
}

/* ----------------------------------- push ------------------------------------ */

self.addEventListener('push', (event) => {
  let data = { title: 'AgentFlow AI', body: 'You have an update.' };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch (err) {
    /* ignore malformed payloads */
  }

  const options = {
    body: data.body,
    icon: '/icon-512.png',
    badge: '/maskable-192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/dashboard', dateOfArrival: Date.now() },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    tag: data.tag || 'agentflow-notification',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const target = (event.notification.data && event.notification.data.url) || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
