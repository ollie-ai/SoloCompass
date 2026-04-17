/**
 * useOfflineQueue — Generic offline action queue hook.
 *
 * Persists pending actions to localStorage and replays them when back online.
 *
 * Usage:
 *   const { enqueue, queue, isSyncing } = useOfflineQueue('journal', async (item) => {
 *     await api.post('/journal', item.payload);
 *   });
 *   // Enqueue an action:
 *   enqueue({ type: 'create', payload: { content: '...' } });
 *
 * The sync handler receives one queued item at a time.
 * Successful items are removed from the queue; failed items are retried on next sync.
 */
import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY_PREFIX = 'solocompass_offline_queue_';

function loadQueue(namespace) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + namespace);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(namespace, queue) {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + namespace, JSON.stringify(queue));
  } catch {
    // Storage full — silently ignore
  }
}

/**
 * @param {string} namespace  Unique key for this queue (e.g. 'journal', 'expenses')
 * @param {(item: object) => Promise<void>} syncHandler  Called once per item to replay it
 */
export function useOfflineQueue(namespace, syncHandler) {
  const [queue, setQueue] = useState(() => loadQueue(namespace));
  const [isSyncing, setIsSyncing] = useState(false);
  const syncHandlerRef = useRef(syncHandler);
  syncHandlerRef.current = syncHandler;

  // Enqueue an item for later sync
  const enqueue = useCallback((item) => {
    const entry = { id: crypto.randomUUID(), queuedAt: new Date().toISOString(), ...item };
    setQueue(prev => {
      const next = [...prev, entry];
      saveQueue(namespace, next);
      return next;
    });
  }, [namespace]);

  // Remove a successfully-synced item
  const dequeue = useCallback((id) => {
    setQueue(prev => {
      const next = prev.filter(i => i.id !== id);
      saveQueue(namespace, next);
      return next;
    });
  }, [namespace]);

  // Flush the queue when the browser comes back online
  const flush = useCallback(async () => {
    const current = loadQueue(namespace);
    if (current.length === 0 || isSyncing) return;

    setIsSyncing(true);
    for (const item of current) {
      try {
        await syncHandlerRef.current(item);
        dequeue(item.id);
      } catch (err) {
        // Leave failed items in the queue for the next sync
        console.warn(`[OfflineQueue:${namespace}] Failed to sync item ${item.id}:`, err.message);
        break;
      }
    }
    setIsSyncing(false);
  }, [namespace, isSyncing, dequeue]);

  useEffect(() => {
    const handleOnline = () => flush();
    window.addEventListener('online', handleOnline);
    // Also attempt flush on mount if already online
    if (navigator.onLine) flush();
    return () => window.removeEventListener('online', handleOnline);
  }, [flush]);

  return { enqueue, dequeue, queue, isSyncing, flush };
}

export default useOfflineQueue;
