import crypto from 'crypto';
import db from '../db.js';
import logger from '../services/logger.js';

const WEBHOOK_SIGNATURE_HEADER = 'x-webhook-signature';
const WEBHOOK_TIMESTAMP_HEADER = 'x-webhook-timestamp';
const WEBHOOK_TOLERANCE_SECONDS = 300;

/**
 * Deduplicate an inbound webhook event using the `webhook_inbound_logs` table.
 *
 * @param {string} provider   — e.g. 'stripe', 'solocompass'
 * @param {string} eventId    — unique event identifier from the provider
 * @param {object} payload    — raw request body (for logging)
 * @returns {boolean}  true if the event was already processed (duplicate), false if new
 */
async function checkAndRecordInboundEvent(provider, eventId, payload) {
  try {
    // Attempt insert; unique constraint on event_id will throw if duplicate
    await db.run(
      `INSERT INTO webhook_inbound_logs (provider, event_id, payload, processed_at, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      provider,
      eventId,
      typeof payload === 'string' ? payload : JSON.stringify(payload),
      new Date().toISOString(),
      new Date().toISOString()
    );
    return false; // new event
  } catch (err) {
    // PostgreSQL unique_violation = 23505; SQLite = SQLITE_CONSTRAINT_UNIQUE / errno 19
    const isDuplicate =
      err.code === '23505' ||           // PostgreSQL
      err.code === 'SQLITE_CONSTRAINT_UNIQUE' || // SQLite (better-sqlite3)
      err.errno === 19 ||               // SQLite (node-sqlite3)
      (err.message && err.message.toLowerCase().includes('unique'));
    if (isDuplicate) {
      logger.warn(`[WebhookDedup] Duplicate event ignored: provider=${provider} event_id=${eventId}`);
      return true; // duplicate
    }
    // Other DB error — log but do not block processing
    logger.error(`[WebhookDedup] DB error during dedup check: ${err.message}`);
    return false;
  }
}

export function verifyWebhook(secret, requiredEvent = null) {
  return (req, res, next) => {
    const signature = req.headers[WEBHOOK_SIGNATURE_HEADER];
    const timestamp = req.headers['x-webhook-timestamp'] || req.headers[WEBHOOK_TIMESTAMP_HEADER];

    if (!signature) {
      return res.status(401).json({
        success: false,
        error: { code: 'MISSING_SIGNATURE', message: 'Webhook signature is required' }
      });
    }

    if (!timestamp) {
      return res.status(401).json({
        success: false,
        error: { code: 'MISSING_TIMESTAMP', message: 'Webhook timestamp is required' }
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const webhookTime = parseInt(timestamp, 10);

    if (isNaN(webhookTime) || Math.abs(now - webhookTime) > WEBHOOK_TOLERANCE_SECONDS) {
      return res.status(401).json({
        success: false,
        error: { code: 'TIMESTAMP_EXPIRED', message: 'Webhook timestamp is expired' }
      });
    }

    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const providedSignature = signature.replace(/^sha256=/, '');

    if (!crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    )) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' }
      });
    }

    if (requiredEvent && req.headers['x-webhook-event'] !== requiredEvent) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_EVENT', message: `Expected event type: ${requiredEvent}` }
      });
    }

    req.webhookVerified = true;
    next();
  };
}

/**
 * Middleware that performs idempotency dedup for inbound webhooks.
 * Uses the `webhook_inbound_logs` table to detect and reject replays.
 *
 * The provider and event ID are read from the following locations (in order):
 *   - req.headers['x-webhook-provider'] and req.headers['x-webhook-event-id']
 *   - req.body.type / req.body.id  (Stripe convention)
 *   - Falls back to a SHA-256 of the raw body if no ID header is available.
 *
 * Must be applied AFTER `express.json()` / `express.raw()` body parsing.
 */
export function deduplicateInboundWebhook(provider) {
  return async (req, res, next) => {
    // Resolve event ID
    const eventId =
      req.headers['x-webhook-event-id'] ||
      req.headers['stripe-idempotency-key'] ||
      req.body?.id ||
      req.body?.event_id ||
      // Fallback: deterministic hash of the raw body so identical retransmissions are caught
      crypto
        .createHash('sha256')
        .update(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? ''))
        .digest('hex');

    const resolvedProvider = provider || req.headers['x-webhook-provider'] || 'unknown';

    const isDuplicate = await checkAndRecordInboundEvent(resolvedProvider, eventId, req.body);

    if (isDuplicate) {
      // Return 200 to prevent the sender from retrying indefinitely
      return res.status(200).json({
        success: true,
        message: 'Event already processed',
        duplicate: true,
      });
    }

    next();
  };
}

export function verifyPaymentWebhook(secret) {
  return verifyWebhook(secret, 'payment.event');
}

export function extractWebhookData(req) {
  return {
    event: req.headers['x-webhook-event'],
    timestamp: req.headers['x-webhook-timestamp'],
    signature: req.headers['x-webhook-signature'],
    body: req.body
  };
}
