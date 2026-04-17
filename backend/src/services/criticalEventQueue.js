import db from '../db.js';
import logger from './logger.js';

const POLL_INTERVAL_MS = 5000; // 5 seconds
const MAX_CONCURRENT = 3;
let isRunning = false;
let processingCount = 0;

const HANDLERS = {
  sos_triggered: async (payload) => {
    logger.warn(`[CriticalQueue] SOS triggered for user ${payload.userId}`);
    // In production, this would send SMS, push notification, email to guardians
    // For now, log and mark as delivered
    return { delivered: true, channels: ['log'] };
  },
  check_in_missed: async (payload) => {
    logger.warn(`[CriticalQueue] Check-in missed for user ${payload.userId}`);
    return { delivered: true };
  },
  emergency_alert: async (payload) => {
    logger.warn(`[CriticalQueue] Emergency alert for user ${payload.userId}`);
    return { delivered: true };
  },
};

async function processEvent(event) {
  const payload = JSON.parse(event.payload);
  const handler = HANDLERS[event.event_type];

  try {
    await db.run(
      `UPDATE critical_event_queue SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      event.id
    );

    const result = handler ? await handler(payload) : { delivered: false, error: 'No handler' };

    await db.run(
      `UPDATE critical_event_queue 
       SET status = 'delivered', processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      event.id
    );
    logger.info(`[CriticalQueue] Event ${event.id} (${event.event_type}) delivered`);
  } catch (err) {
    const nextAttempts = event.attempts + 1;
    const isDead = nextAttempts >= event.max_attempts;
    const backoffMs = Math.min(Math.pow(2, nextAttempts) * 1000, 300000); // max 5 min
    const nextRetry = new Date(Date.now() + backoffMs).toISOString();

    await db.run(
      `UPDATE critical_event_queue
       SET status = ?, attempts = ?, next_retry_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      isDead ? 'dead_letter' : 'pending', nextAttempts, nextRetry, event.id
    );
    logger.error(`[CriticalQueue] Event ${event.id} failed (attempt ${nextAttempts}): ${err.message}`);
  } finally {
    processingCount--;
  }
}

async function poll() {
  if (processingCount >= MAX_CONCURRENT) return;

  try {
    const events = await db.all(
      `SELECT * FROM critical_event_queue 
       WHERE status = 'pending' AND next_retry_at <= CURRENT_TIMESTAMP
       ORDER BY priority ASC, created_at ASC
       LIMIT ?`,
      MAX_CONCURRENT - processingCount
    );

    for (const event of events) {
      processingCount++;
      processEvent(event); // fire and forget (no await)
    }
  } catch (err) {
    logger.error(`[CriticalQueue] Poll error: ${err.message}`);
  }
}

export async function enqueueEvent(eventType, payload, priority = 5, userId = null) {
  try {
    const result = await db.run(
      `INSERT INTO critical_event_queue (event_type, user_id, payload, priority, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      eventType, userId, JSON.stringify(payload), priority
    );
    logger.info(`[CriticalQueue] Enqueued ${eventType} event (id: ${result.lastInsertRowid})`);
    return result.lastInsertRowid;
  } catch (err) {
    logger.error(`[CriticalQueue] Failed to enqueue ${eventType}: ${err.message}`);
    throw err;
  }
}

export function startCriticalEventQueue() {
  if (isRunning) return;
  isRunning = true;
  setInterval(poll, POLL_INTERVAL_MS);
  logger.info('[CriticalQueue] Critical event queue processor started');
}

export default { enqueueEvent, startCriticalEventQueue };
