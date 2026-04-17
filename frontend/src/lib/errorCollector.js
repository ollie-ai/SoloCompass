import api from './api';
import { trackFrontendError } from './errorTracking';

const BATCH_INTERVAL = 10000;
const BATCH_THRESHOLD = 5;
const DEDUP_WINDOW_MS = 60000;

let errorQueue = [];
let batchTimer = null;
const dedupCache = new Map();

function getDedupKey(error) {
  return `${error.message}::${error.url}`;
}

function isDuplicate(error) {
  const key = getDedupKey(error);
  const lastSeen = dedupCache.get(key);
  const now = Date.now();

  if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) {
    return true;
  }

  dedupCache.set(key, now);

  for (const [k, v] of dedupCache.entries()) {
    if (now - v > DEDUP_WINDOW_MS * 2) {
      dedupCache.delete(k);
    }
  }

  return false;
}

function normalizeError(error, type) {
  const normalized = {
    message: '',
    stack: '',
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    type,
  };

  if (type === 'unhandled_rejection') {
    const reason = error.reason;
    if (reason instanceof Error) {
      normalized.message = reason.message || String(reason);
      normalized.stack = reason.stack || '';
    } else if (typeof reason === 'string') {
      normalized.message = reason;
    } else if (reason && reason.message) {
      normalized.message = reason.message;
      normalized.stack = reason.stack || '';
    } else {
      normalized.message = String(reason);
    }
  } else if (error instanceof ErrorEvent) {
    normalized.message = error.message || '';
    normalized.stack = error.error?.stack || '';
  } else if (error instanceof Error) {
    normalized.message = error.message;
    normalized.stack = error.stack || '';
  } else if (typeof error === 'string') {
    normalized.message = error;
  } else if (error && typeof error === 'object') {
    normalized.message = error.message || JSON.stringify(error);
    normalized.stack = error.stack || '';
  }

  return normalized;
}

async function flushQueue() {
  if (errorQueue.length === 0) return;

  const batch = [...errorQueue];
  errorQueue = [];

  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }

  try {
    await api.post('/errors/report', { errors: batch });
  } catch {
    // Silently fail — error reporting should never break the app
  }
}

function enqueueError(error, type) {
  const normalized = normalizeError(error, type);

  if (isDuplicate(normalized)) return;

  errorQueue.push(normalized);
  trackFrontendError(new Error(normalized.message), normalized).catch(() => {});

  if (errorQueue.length >= BATCH_THRESHOLD) {
    flushQueue();
  } else if (!batchTimer) {
    batchTimer = setTimeout(flushQueue, BATCH_INTERVAL);
  }
}

export function initErrorCollector() {
  window.onerror = (message, _source, _lineno, _colno, error) => {
    enqueueError(error || new Error(String(message)), 'uncaught_exception');
    return false;
  };

  window.addEventListener('unhandledrejection', (event) => {
    enqueueError(event, 'unhandled_rejection');
  });

  window.addEventListener('error', (event) => {
    if (event.target !== window && event.target !== document) {
      enqueueError(event, 'resource_error');
    }
  }, true);
}

export function reportError(error, context = {}) {
  const normalized = normalizeError(error, 'manual');
  Object.assign(normalized, context);

  if (isDuplicate(normalized)) return;

  errorQueue.push(normalized);
  trackFrontendError(new Error(normalized.message), normalized).catch(() => {});

  if (errorQueue.length >= BATCH_THRESHOLD) {
    flushQueue();
  } else if (!batchTimer) {
    batchTimer = setTimeout(flushQueue, BATCH_INTERVAL);
  }
}
