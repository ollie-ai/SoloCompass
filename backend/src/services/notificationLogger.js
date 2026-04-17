import db from '../db.js';
import logger from './logger.js';

/**
 * Log a notification delivery attempt
 */
export async function logNotificationDelivery(userId, notificationType, channel, status, metadata = {}) {
  try {
    const result = await db.run(
      `INSERT INTO notification_logs (user_id, notification_type, channel, status, provider_message_id, error_message, error_code, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      userId, notificationType, channel, status,
      metadata.messageId || null,
      metadata.error || null,
      metadata.errorCode || null,
      JSON.stringify(metadata)
    );
    return { success: true, id: result.lastInsertRowid };
  } catch (err) {
    logger.error('[NotificationLogger] Log error:', err.message);
    return { success: false };
  }
}

/**
 * Update delivery status (for webhooks from email providers)
 */
export async function updateDeliveryStatus(providerMessageId, status, metadata = {}) {
  try {
    const updates = { status };
    if (status === 'delivered') updates.delivered_at = new Date().toISOString();
    if (status === 'opened') updates.opened_at = new Date().toISOString();
    if (status === 'clicked') updates.clicked_at = new Date().toISOString();
    if (metadata.error) updates.error_message = metadata.error;
    
    const setClauses = Object.entries(updates).map(([key], i) => `${key} = $${i + 1}`).join(', ');
    const values = Object.values(updates);
    values.push(providerMessageId);
    
    await db.run(
      `UPDATE notification_logs SET ${setClauses} WHERE provider_message_id = $${values.length}`,
      ...values
    );
    
    return { success: true };
  } catch (err) {
    logger.error('[NotificationLogger] Update status error:', err.message);
    return { success: false };
  }
}

/**
 * Handle email bounce/complaint webhooks from Resend
 */
export async function handleEmailWebhook(event) {
  try {
    const { type, data } = event;
    
    switch (type) {
      case 'email.delivered':
        await updateDeliveryStatus(data.email_id, 'delivered');
        break;
      case 'email.opened':
        await updateDeliveryStatus(data.email_id, 'opened');
        break;
      case 'email.clicked':
        await updateDeliveryStatus(data.email_id, 'clicked');
        break;
      case 'email.bounced':
        await updateDeliveryStatus(data.email_id, 'bounced', { error: data.bounce?.type || 'bounce' });
        logger.warn(`[EmailWebhook] Bounce for ${data.email_id}: ${data.bounce?.type}`);
        break;
      case 'email.complained':
        await updateDeliveryStatus(data.email_id, 'complained', { error: 'spam_complaint' });
        logger.warn(`[EmailWebhook] Complaint for ${data.email_id}`);
        break;
      default:
        logger.info(`[EmailWebhook] Unhandled event: ${type}`);
    }
    
    return { success: true };
  } catch (err) {
    logger.error('[EmailWebhook] Error:', err.message);
    return { success: false, error: err.message };
  }
}

export default { logNotificationDelivery, updateDeliveryStatus, handleEmailWebhook };
