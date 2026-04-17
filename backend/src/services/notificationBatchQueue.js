/**
 * Notification Batch Queue
 *
 * P3 (informational) notifications — e.g. buddy_request, trip_reminder,
 * buddy_declined — are low priority and should not spam the user with
 * individual toasts/emails. Instead, they are held in a per-user in-memory
 * queue and flushed as a single "digest" notification after a quiet period
 * (default: 5 minutes of inactivity, or whenever FLUSH_INTERVAL fires).
 *
 * Usage (from notificationService.js):
 *   import { enqueueP3Notification } from './notificationBatchQueue.js';
 *   enqueueP3Notification(userId, type, title, message, data);
 *
 * The flush callback is injected at startup to avoid a circular import with
 * notificationService.js:
 *   import { setFlushCallback } from './notificationBatchQueue.js';
 *   setFlushCallback(createNotification);
 */

import logger from './logger.js';
import { PRIORITY, NOTIFICATION_TYPES } from './notificationRegistry.js';

// ─── Configuration ────────────────────────────────────────────────────────

/** How long to accumulate P3 notifications before flushing (ms) */
const QUIET_PERIOD_MS = 5 * 60 * 1000; // 5 minutes

/** Absolute maximum hold time — flush even if new notifications keep arriving */
const MAX_HOLD_MS = 15 * 60 * 1000; // 15 minutes

// ─── State ────────────────────────────────────────────────────────────────

/**
 * Per-user queue entry:
 *   { notifications: [{type, title, message, data}], quietTimer, maxTimer, createdAt }
 */
const queues = new Map();

/** Injected flush function (signature: createNotification(userId, type, title, message, data)) */
let _flushCallback = null;

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Inject the notification creation function.
 * Call this once from notificationService.js at module load.
 *
 * @param {Function} fn  async (userId, type, title, message, data?) => void
 */
export function setFlushCallback(fn) {
  _flushCallback = fn;
}

/**
 * Determine whether a notification type should be batched.
 * Only P3_INFO types that are USER_CONTROLLED are batched.
 *
 * @param {string} type
 * @returns {boolean}
 */
export function shouldBatch(type) {
  const def = NOTIFICATION_TYPES[type];
  return def?.priority === PRIORITY.P3_INFO;
}

/**
 * Add a P3 notification to the user's queue and schedule a flush.
 *
 * @param {number|string} userId
 * @param {string} type
 * @param {string} title
 * @param {string} message
 * @param {object|null} [data]
 */
export function enqueueP3Notification(userId, type, title, message, data = null) {
  const key = String(userId);

  if (!queues.has(key)) {
    // Start the absolute maximum-hold timer
    const maxTimer = setTimeout(() => flushUserQueue(key), MAX_HOLD_MS);
    queues.set(key, {
      notifications: [],
      quietTimer: null,
      maxTimer,
      createdAt: Date.now(),
    });
  }

  const entry = queues.get(key);
  entry.notifications.push({ type, title, message, data });

  // Reset the quiet-period timer on every new notification
  if (entry.quietTimer) clearTimeout(entry.quietTimer);
  entry.quietTimer = setTimeout(() => flushUserQueue(key), QUIET_PERIOD_MS);

  logger.debug(`[NotifBatch] Queued "${type}" for user ${userId} (queue size: ${entry.notifications.length})`);
}

/**
 * Flush the queue for a specific user, creating a digest notification.
 *
 * @param {string} key  String-coerced userId
 */
async function flushUserQueue(key) {
  const entry = queues.get(key);
  if (!entry || entry.notifications.length === 0) {
    queues.delete(key);
    return;
  }

  // Capture and clear the queue before any async work
  const batch = [...entry.notifications];
  clearTimeout(entry.quietTimer);
  clearTimeout(entry.maxTimer);
  queues.delete(key);

  if (!_flushCallback) {
    logger.warn(`[NotifBatch] No flush callback set — dropping ${batch.length} queued notifications for user ${key}`);
    return;
  }

  try {
    if (batch.length === 1) {
      // Single item — deliver as-is (no point wrapping in a digest)
      const { type, title, message, data } = batch[0];
      await _flushCallback(key, type, title, message, data);
    } else {
      // Multiple items — produce a digest
      const typeLabels = batch.map(n => n.title).join(', ');
      const digestTitle = `You have ${batch.length} new updates`;
      const digestMessage = typeLabels.length <= 200
        ? typeLabels
        : `${batch.length} notifications including: ${batch[0].title} and more`;

      await _flushCallback(key, 'digest', digestTitle, digestMessage, {
        count: batch.length,
        items: batch.map(({ type, title }) => ({ type, title })),
      });
    }

    logger.info(`[NotifBatch] Flushed ${batch.length} notification(s) as digest for user ${key}`);
  } catch (err) {
    logger.error(`[NotifBatch] Flush failed for user ${key}: ${err.message}`);
  }
}

/**
 * Flush all queued users immediately (e.g. on server shutdown).
 */
export async function flushAll() {
  const keys = [...queues.keys()];
  await Promise.allSettled(keys.map(k => flushUserQueue(k)));
}

export default { setFlushCallback, shouldBatch, enqueueP3Notification, flushAll };
