import db from '../db.js';
import logger from './logger.js';
import { createNotification, getNotificationPreferences } from './notificationService.js';
import { CHANNEL, NOTIFICATION_TYPES, PRIORITY, getChannelsForType } from './notificationRegistry.js';
import * as pushService from './pushService.js';
import * as emailService from './email.js';
import { broadcastToUser } from './websocket.js';
import { queueNotificationJob, processNotificationQueue, getRetryDelayMs } from './notificationQueue.js';

function priorityWeight(priority) {
  if (priority === PRIORITY.P0_EMERGENCY) return 0;
  if (priority === PRIORITY.P1_URGENT) return 1;
  if (priority === PRIORITY.P2_IMPORTANT) return 2;
  return 3;
}

async function logDelivery(notificationId, userId, channel, status, providerResponse = null, retryCount = 0, errorMessage = null) {
  await db.prepare(`
    INSERT INTO notification_delivery_logs (notification_id, user_id, channel, status, provider_response, retry_count, error_message, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    notificationId || null,
    userId,
    channel,
    status,
    providerResponse ? JSON.stringify(providerResponse) : null,
    retryCount,
    errorMessage || null,
  );
}

async function hasExceededHourlyLimit(userId, priority) {
  if (priority === PRIORITY.P0_EMERGENCY || priority === PRIORITY.P1_URGENT) return false;
  const result = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM notification_delivery_logs
    WHERE user_id = ? AND attempted_at >= (CURRENT_TIMESTAMP - INTERVAL '1 hour') AND status IN ('sent', 'delivered')
  `).get(userId);
  return (Number(result?.count || 0) >= 20);
}

async function deliverChannel({ userId, channel, title, message, data, type, notificationId, retryCount = 0 }) {
  if (channel === CHANNEL.IN_APP) {
    await logDelivery(notificationId, userId, channel, 'delivered', null, retryCount, null);
    broadcastToUser(userId, {
      type: 'notification:new',
      notification: { id: notificationId, type, title, message, data, created_at: new Date().toISOString() },
    });
    return;
  }

  if (channel === CHANNEL.PUSH) {
    await pushService.sendPushNotification(userId, { title, body: message, ...data, type });
    await logDelivery(notificationId, userId, channel, 'sent', null, retryCount, null);
    return;
  }

  if (channel === CHANNEL.EMAIL) {
    const user = await db.prepare('SELECT email, name FROM users WHERE id = ?').get(userId);
    if (user?.email) {
      await emailService.sendCustomEmail(user.email, type, { name: user.name, title, message, ...data });
      await logDelivery(notificationId, userId, channel, 'sent', null, retryCount, null);
    }
  }
}

async function tryDispatchJob(job) {
  const { userId, type, title, message, data, retryCount = 0 } = job;
  const prefs = await getNotificationPreferences(userId);
  const typeDef = NOTIFICATION_TYPES[type] || {};
  let channels = getChannelsForType(type, prefs);
  const priority = typeDef.priority || PRIORITY.P3_INFO;

  // P2 routing policy: ensure high-priority business notifications include push + email.
  if (priority === PRIORITY.P2_IMPORTANT) {
    channels = Array.from(new Set([...channels, CHANNEL.PUSH, CHANNEL.EMAIL]));
  }

  const notificationResult = await createNotification(userId, type, title, message, data, data?.relatedId || null);
  const notificationId = notificationResult?.lastInsertRowid || notificationResult?.id || null;

  for (const channel of channels) {
    try {
      await deliverChannel({ userId, channel, title, message, data, type, notificationId, retryCount });
    } catch (error) {
      await logDelivery(notificationId, userId, channel, retryCount >= 2 ? 'permanently_failed' : 'failed', null, retryCount + 1, error.message);
      if (retryCount < 2) {
        queueNotificationJob(
          { ...job, retryCount: retryCount + 1, runAt: Date.now() + getRetryDelayMs(retryCount + 1), priorityWeight: priorityWeight(priority) },
          { immediate: false },
        );
      }
    }
  }

  // DND hook placeholder: P0/P1 always bypass when DND is implemented.
}

export async function dispatchNotification(userId, type, data = {}) {
  const typeDef = NOTIFICATION_TYPES[type];
  const priority = typeDef?.priority || PRIORITY.P3_INFO;
  const title = data.title || typeDef?.name || 'Notification';
  const message = data.message || data.body || 'You have a new notification';

  const exceeded = await hasExceededHourlyLimit(userId, priority);
  const job = { userId, type, title, message, data, retryCount: 0, priorityWeight: priorityWeight(priority) };

  if (exceeded) {
    queueNotificationJob({ ...job, runAt: Date.now() + 15 * 60 * 1000 }, { immediate: false });
    return { queued: true, reason: 'rate_limited', channels: [] };
  }

  if (priorityWeight(priority) <= 1) {
    await tryDispatchJob(job);
    return { queued: false, priority, immediate: true };
  }

  queueNotificationJob(job, { immediate: false });
  await processNotificationQueue(tryDispatchJob);
  return { queued: true, priority };
}

setInterval(() => {
  processNotificationQueue(tryDispatchJob).catch((err) => {
    logger.error(`[NotificationDispatcher] queue tick failed: ${err.message}`);
  });
}, 1000);
