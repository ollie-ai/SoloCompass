import crypto from 'crypto';
import db from '../db.js';
import logger from './logger.js';

const WEBHOOK_TIMEOUT = 10000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

const VALID_EVENTS = [
  'trip.created',
  'trip.completed',
  'checkin.sent',
  'emergency.triggered'
];

function generateSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function generateSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
    .digest('hex');
}

async function sendWebhookWithRetry(url, payload, secret, eventType) {
  const signature = generateSignature(payload, secret);
  const headers = {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature,
    'X-Webhook-Event': eventType,
    'X-Webhook-Timestamp': Date.now().toString()
  };

  let lastError;
  let backoffMs = INITIAL_BACKOFF_MS;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (response.ok) {
        return {
          success: true,
          statusCode: response.status,
          attempt
        };
      }

      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      backoffMs *= 2;
    }
  }

  return {
    success: false,
    error: lastError.message,
    attempts: MAX_RETRIES
  };
}

export async function triggerWebhook(eventType, data) {
  if (!VALID_EVENTS.includes(eventType)) {
    logger.error(`[Webhook] Invalid event type: ${eventType}`);
    return { success: false, error: 'Invalid event type' };
  }

  // Generate idempotency key from event type + data hash
  const idempotencyKey = crypto
    .createHash('sha256')
    .update(`${eventType}:${JSON.stringify(data)}:${Date.now()}`)
    .digest('hex');

  const subscriptions = await db.prepare(`
    SELECT * FROM webhook_subscriptions
    WHERE active = true AND events LIKE ?
  `).all(`%${eventType}%`);

  const results = [];

  for (const subscription of subscriptions) {
    // Dedup check — skip if this exact delivery was already logged
    const subKey = `${idempotencyKey}:${subscription.id}`;
    try {
      const existing = await db.get(
        'SELECT id FROM webhook_delivery_logs WHERE idempotency_key = $1',
        subKey
      );
      if (existing) {
        results.push({ subscriptionId: subscription.id, url: subscription.url, success: true, deduplicated: true });
        continue;
      }
    } catch {
      // Column may not exist yet; proceed without dedup
    }

    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data
    };

    const result = await sendWebhookWithRetry(
      subscription.url,
      payload,
      subscription.secret,
      eventType
    );

    const now = new Date().toISOString();
    try {
      db.prepare(`
        INSERT INTO webhook_delivery_logs 
        (subscription_id, event_type, url, status, status_code, attempts, response_error, idempotency_key, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        subscription.id,
        eventType,
        subscription.url,
        result.success ? 'success' : 'failed',
        result.statusCode || null,
        result.attempt || result.attempts,
        result.error || null,
        subKey,
        now
      );
    } catch {
      // Fallback without idempotency_key column
      db.prepare(`
        INSERT INTO webhook_delivery_logs 
        (subscription_id, event_type, url, status, status_code, attempts, response_error, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        subscription.id,
        eventType,
        subscription.url,
        result.success ? 'success' : 'failed',
        result.statusCode || null,
        result.attempt || result.attempts,
        result.error || null,
        now
      );
    }

    results.push({
      subscriptionId: subscription.id,
      url: subscription.url,
      ...result
    });
  }

  return {
    success: results.some(r => r.success),
    results
  };
}

export async function createSubscription(userId, url, events, active = true) {
  const secret = generateSecret();
  const now = new Date().toISOString();

  const result = await db.prepare(`
    INSERT INTO webhook_subscriptions (user_id, url, events, secret, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, url, JSON.stringify(events), secret, active, now, now);

  return {
    id: result.lastInsertRowid,
    userId,
    url,
    events,
    secret,
    active
  };
}

export async function getSubscriptions(userId) {
  const subscriptions = await db.prepare(`
    SELECT id, user_id, url, events, active, created_at, updated_at
    FROM webhook_subscriptions
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId);

  return subscriptions.map(sub => ({
    ...sub,
    events: JSON.parse(sub.events),
    active: !!sub.active
  }));
}

export async function deleteSubscription(subscriptionId, userId) {
  const result = await db.prepare(`
    DELETE FROM webhook_subscriptions
    WHERE id = ? AND user_id = ?
  `).run(subscriptionId, userId);

  return result.changes > 0;
}

export async function toggleSubscription(subscriptionId, userId, active) {
  const now = new Date().toISOString();
  const result = await db.prepare(`
    UPDATE webhook_subscriptions
    SET active = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(active, now, subscriptionId, userId);

  return result.changes > 0;
}

export async function testWebhook(subscriptionId, userId) {
  const subscription = await db.prepare(`
    SELECT * FROM webhook_subscriptions
    WHERE id = ? AND user_id = ?
  `).get(subscriptionId, userId);

  if (!subscription) {
    return { success: false, error: 'Subscription not found' };
  }

  const payload = {
    event: 'webhook.test',
    timestamp: new Date().toISOString(),
    data: {
      message: 'This is a test webhook from SoloCompass',
      subscriptionId: subscription.id
    }
  };

  return await sendWebhookWithRetry(
    subscription.url,
    payload,
    subscription.secret,
    'webhook.test'
  );
}

// Exponential backoff configuration
const BACKOFF_INTERVALS = [
  60 * 1000,           // 1 minute
  5 * 60 * 1000,      // 5 minutes
  30 * 60 * 1000,     // 30 minutes
  2 * 60 * 60 * 1000, // 2 hours
  24 * 60 * 60 * 1000 // 24 hours
];
const MAX_BACKOFF = 24 * 60 * 60 * 1000;
const MAX_RETRIES_DB = 5;

function calculateBackoff(attempt, maxWait = MAX_BACKOFF) {
  if (attempt <= 0) return BACKOFF_INTERVALS[0];
  if (attempt <= BACKOFF_INTERVALS.length) {
    return Math.min(BACKOFF_INTERVALS[attempt - 1], maxWait);
  }
  return Math.min(BACKOFF_INTERVALS[0] * Math.pow(2, attempt), maxWait);
}

function getBackoffSchedule() {
  return BACKOFF_INTERVALS.map((ms, i) => ({
    attempt: i + 1,
    waitMs: ms,
    waitFormatted: ms < 60000 ? `${ms / 1000}s` : ms < 3600000 ? `${ms / 60000}m` : `${ms / 3600000}h`
  }));
}

export async function retryWebhook(id, immediate = false) {
  try {
    let delivery = await db.prepare('SELECT * FROM webhook_deliveries WHERE id = ?').get(id);
    
    if (!delivery) {
      // Create new delivery record if doesn't exist (for external webhooks)
      logger.warn(`[Webhook] Delivery ${id} not found - creating new record`);
      return { success: false, error: 'Delivery not found' };
    }
    
    if (delivery.status === 'success') {
      return { success: false, error: 'Webhook already succeeded' };
    }
    
    if (delivery.attempts >= delivery.max_attempts) {
      return { success: false, error: 'Max retry attempts reached' };
    }
    
    const now = new Date();
    let nextRetryAt = null;
    let waitTime = 0;
    
    // Calculate next retry time
    if (!immediate) {
      waitTime = calculateBackoff(delivery.attempts || 0);
      nextRetryAt = new Date(now.getTime() + waitTime);
    }
    
    // Log attempt
    logger.info(`[Webhook] Retry ${immediate ? 'immediate' : 'scheduled'} for delivery ${id} (attempt ${(delivery.attempts || 0) + 1})`);
    
    // If immediate, execute the webhook
    if (immediate) {
      try {
        const headers = delivery.headers || {
          'Content-Type': 'application/json'
        };
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT);
        
        const response = await fetch(delivery.url, {
          method: 'POST',
          headers,
          body: typeof delivery.payload === 'string' ? delivery.payload : JSON.stringify(delivery.payload),
          signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        const responseBody = await response.text();
        
        if (response.ok) {
          await db.prepare(`
            UPDATE webhook_deliveries 
            SET status = 'success',
                response_code = ?,
                response_body = ?,
                attempts = attempts + 1,
                last_attempt_at = ?,
                next_retry_at = NULL,
                updated_at = ?
            WHERE id = ?
          `).run(response.status, responseBody, now.toISOString(), now.toISOString(), id);
          
          logger.info(`[Webhook] Delivery ${id} succeeded on attempt ${delivery.attempts + 1}`);
          
          return { 
            success: true, 
            statusCode: response.status,
            attempt: delivery.attempts + 1
          };
        } else {
          // Failed, schedule next retry
          const nextWait = calculateBackoff(delivery.attempts + 1);
          const retryAt = new Date(now.getTime() + nextWait);
          
          await db.prepare(`
            UPDATE webhook_deliveries 
            SET status = 'failed',
                response_code = ?,
                response_body = ?,
                attempts = attempts + 1,
                last_attempt_at = ?,
                next_retry_at = ?,
                updated_at = ?
            WHERE id = ?
          `).run(response.status, responseBody, now.toISOString(), retryAt.toISOString(), now.toISOString(), id);
          
          logger.warn(`[Webhook] Delivery ${id} failed with ${response.status}, next retry in ${nextWait}ms`);
          
          return { 
            success: false, 
            statusCode: response.status,
            retryAt: retryAt.toISOString(),
            attempt: delivery.attempts + 1
          };
        }
      } catch (error) {
        // Network error, schedule retry
        const nextWait = calculateBackoff(delivery.attempts + 1);
        const retryAt = new Date(now.getTime() + nextWait);
        
        await db.prepare(`
          UPDATE webhook_deliveries 
          SET status = 'failed',
              response_code = NULL,
              response_body = ?,
              attempts = attempts + 1,
              last_attempt_at = ?,
              next_retry_at = ?,
              updated_at = ?
          WHERE id = ?
        `).run(error.message, now.toISOString(), retryAt.toISOString(), now.toISOString(), id);
        
        logger.error(`[Webhook] Delivery ${id} error: ${error.message}`);
        
        return { 
          success: false, 
          error: error.message,
          retryAt: retryAt.toISOString(),
          attempt: delivery.attempts + 1
        };
      }
    } else {
      // Just schedule the retry for later
      await db.prepare(`
        UPDATE webhook_deliveries 
        SET status = 'pending',
            next_retry_at = ?,
            updated_at = ?
        WHERE id = ?
      `).run(nextRetryAt.toISOString(), now.toISOString(), id);
      
      return { 
        success: true, 
        scheduled: true,
        retryAt: nextRetryAt.toISOString(),
        waitTime,
        backoffSchedule: getBackoffSchedule()
      };
    }
  } catch (error) {
    logger.error(`[Webhook] Retry failed for ${id}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export async function createWebhookDelivery(webhookId, url, payload, headers = {}) {
  const now = new Date().toISOString();
  
  try {
    const result = await db.prepare(`
      INSERT INTO webhook_deliveries (webhook_id, url, payload, headers, status, attempts, max_attempts, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, ?)
    `).run(webhookId, url, JSON.stringify(payload), JSON.stringify(headers), MAX_RETRIES_DB, now, now);
    
    return {
      id: result.lastInsertRowid,
      webhookId,
      url,
      payload,
      status: 'pending',
      attempts: 0,
      maxAttempts: MAX_RETRIES_DB
    };
  } catch (error) {
    logger.error(`[Webhook] Failed to create delivery: ${error.message}`);
    return null;
  }
}

export { generateSecret, generateSignature, VALID_EVENTS, getBackoffSchedule, calculateBackoff };
