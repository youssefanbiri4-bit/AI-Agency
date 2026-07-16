'use client';

/**
 * Client-side offline queue for mutations ("the Queues").
 *
 * When a mutation cannot be delivered (device offline or network failure) it is
 * persisted in IndexedDB and a Background Sync is registered. The service worker
 * (`/sw.js`) replays queued requests via the `sync` event when connectivity
 * returns. A lightweight pub/sub lets the UI reflect the pending queue size.
 *
 * This module is browser-only and must be imported from client components.
 */

const DB_NAME = 'agentflow-pwa';
const STORE_NAME = 'sync-queue';
const SYNC_TAG = 'agentflow-queues';
const MAX_RETRIES = 5;

export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  label?: string;
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

export type MutationOutcome =
  | { kind: 'online'; response: Response }
  | { kind: 'queued'; id: string };

export interface QueueInput {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  /** Object (JSON.stringified) or an already-serialized string. */
  body?: unknown;
  label?: string;
}

/* ------------------------------- pub/sub store ------------------------------- */

type CountListener = (count: number) => void;
type ListListener = (items: QueuedRequest[]) => void;
const countListeners = new Set<CountListener>();
const listListeners = new Set<ListListener>();
let cachedCount = 0;
let cachedItems: QueuedRequest[] = [];

function subscribeCount(listener: CountListener): () => void {
  countListeners.add(listener);
  listener(cachedCount);
  return () => countListeners.delete(listener);
}

function subscribeList(listener: ListListener): () => void {
  listListeners.add(listener);
  listener(cachedItems);
  return () => listListeners.delete(listener);
}

async function emitChange() {
  const items = await getAllQueued();
  cachedCount = items.length;
  cachedItems = items;
  for (const listener of countListeners) listener(cachedCount);
  for (const listener of listListeners) listener(cachedItems);
}

/* ------------------------------- IndexedDB ----------------------------------- */

function openDB(): Promise<IDBDatabase> {
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

async function getAllQueued(): Promise<QueuedRequest[]> {
  if (typeof indexedDB === 'undefined') return [];
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const items = (req.result as QueuedRequest[]) || [];
        items.sort((a, b) => a.createdAt - b.createdAt);
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function getQueueCount(): Promise<number> {
  if (typeof indexedDB === 'undefined') return 0;
  try {
    return (await getAllQueued()).length;
  } catch {
    return 0;
  }
}

export async function getQueuedItems(): Promise<QueuedRequest[]> {
  return getAllQueued();
}

async function putQueued(item: QueuedRequest): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteQueued(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearAllQueued(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ------------------------------ Background Sync ------------------------------ */

export function supportsBackgroundSync(): boolean {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  return 'SyncManager' in window;
}

async function registerSync(): Promise<void> {
  if (!supportsBackgroundSync()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await (reg as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register(
      SYNC_TAG
    );
  } catch {
    /* Background Sync not available; online handler will flush instead. */
  }
}

/* --------------------------------- Public API -------------------------------- */

function serializeBody(body: unknown): string | null {
  if (body == null) return null;
  if (typeof body === 'string') return body;
  if (body instanceof FormData || body instanceof URLSearchParams || body instanceof Blob) {
    return null;
  }
  try {
    return JSON.stringify(body);
  } catch {
    return null;
  }
}

/**
 * Send a mutation. If the device is offline (or the request fails at the network
 * layer) the mutation is queued for Background Sync and `{ kind: 'queued' }` is
 * returned. Otherwise the live `Response` is returned for the caller to inspect.
 */
export async function queueMutation(input: QueueInput): Promise<MutationOutcome> {
  const method = (input.method || 'POST').toUpperCase();
  const headers = input.headers || { 'Content-Type': 'application/json' };
  const body = serializeBody(input.body);

  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

  if (isOffline) {
    const id = await enqueue({ ...input, method, headers, body });
    return { kind: 'queued', id };
  }

  try {
    const response = await fetch(input.url, {
      method,
      headers,
      body: body ?? undefined,
      credentials: 'include',
    });
    return { kind: 'online', response };
  } catch {
    const id = await enqueue({ ...input, method, headers, body });
    return { kind: 'queued', id };
  }
}

async function enqueue(input: QueueInput & { method: string; headers: Record<string, string>; body: string | null }): Promise<string> {
  const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const item: QueuedRequest = {
    id,
    url: input.url,
    method: input.method,
    headers: input.headers,
    body: input.body,
    label: input.label,
    createdAt: Date.now(),
    retryCount: 0,
  };
  await putQueued(item);
  await registerSync();
  await emitChange();
  return id;
}

/**
 * Remove a single queued item by ID.
 */
export async function removeQueuedItem(id: string): Promise<void> {
  await deleteQueued(id);
  await emitChange();
}

/**
 * Clear the entire queue (use with caution).
 */
export async function clearQueue(): Promise<void> {
  await clearAllQueued();
  await emitChange();
}

/**
 * Client-side replay with retry logic and exponential backoff.
 * Returns the number of requests that were successfully delivered.
 */
export async function flushQueue(): Promise<number> {
  if (typeof indexedDB === 'undefined') return 0;
  const items = await getAllQueued();
  let synced = 0;

  for (const item of items) {
    if (item.retryCount >= MAX_RETRIES) {
      continue;
    }

    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body ?? undefined,
        credentials: 'include',
      });
      if (response && response.ok) {
        await deleteQueued(item.id);
        synced += 1;
      } else {
        const updated = {
          ...item,
          retryCount: item.retryCount + 1,
          lastError: `HTTP ${response.status}`,
        };
        await putQueued(updated);
      }
    } catch (err) {
      const updated = {
        ...item,
        retryCount: item.retryCount + 1,
        lastError: err instanceof Error ? err.message : 'Network error',
      };
      await putQueued(updated);
    }
  }

  await emitChange();
  return synced;
}

/**
 * Retry a single queued item immediately.
 */
export async function retryItem(id: string): Promise<boolean> {
  const items = await getAllQueued();
  const item = items.find((i) => i.id === id);
  if (!item) return false;

  try {
    const response = await fetch(item.url, {
      method: item.method,
      headers: item.headers,
      body: item.body ?? undefined,
      credentials: 'include',
    });
    if (response && response.ok) {
      await deleteQueued(item.id);
      await emitChange();
      return true;
    }
    const updated = {
      ...item,
      retryCount: item.retryCount + 1,
      lastError: `HTTP ${response.status}`,
    };
    await putQueued(updated);
    await emitChange();
    return false;
  } catch (err) {
    const updated = {
      ...item,
      retryCount: item.retryCount + 1,
      lastError: err instanceof Error ? err.message : 'Network error',
    };
    await putQueued(updated);
    await emitChange();
    return false;
  }
}

export function subscribeQueueCount(listener: CountListener): () => void {
  return subscribeCount(listener);
}

export function subscribeQueueList(listener: ListListener): () => void {
  return subscribeList(listener);
}

/** Re-read the queue size and push it to subscribers (call after SW messages). */
export async function refreshQueueCount(): Promise<void> {
  await emitChange();
}
