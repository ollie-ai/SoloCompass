import { notifyEmergencyContactsSMS } from './smsService.js';
import db from '../db.js';
import logger from './logger.js';
import { FROM_EMAIL, FROM_NAME, getResendClient } from './resendClient.js';
import { broadcastToUser } from './websocket.js';

function getUnsubscribeUrl(token = 'pending-token') {
  const apiBase = process.env.BACKEND_URL || 'http://localhost:3005';
  return `${apiBase}/api/notifications/unsubscribe?token=${token}`;
}

function unsubscribeFooter(token) {
  const url = getUnsubscribeUrl(token);
  return `<p style="color:#64748b;font-size:12px;margin-top:16px;">To unsubscribe: <a href="${url}">${url}</a></p>`;
}

// Helper for formatting location in emails
export function formatLocation(latitude, longitude, address) {
  if (address) return address;
  if (latitude && longitude) return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  return 'Location not available';
}

export function generateLocationMapUrl(latitude, longitude) {
  if (!latitude || !longitude) return null;
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`;
}

export async function sendSafeCheckinNotification(contact, user, checkIn, location) {
  try {
    const resend = getResendClient();
    if (!resend) return { success: false, error: 'Email service not initialized' };

    const locationText = formatLocation(checkIn.latitude, checkIn.longitude, checkIn.address);
    const mapUrl = generateLocationMapUrl(checkIn.latitude, checkIn.longitude);
    const checkInTime = new Date(checkIn.created_at).toLocaleString('en-US', {
      timeZone: 'UTC',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981, #059669); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <h1 style="color: white; margin: 0; font-size: 28px;">✓ Checked In Safely</h1>
          <p style="color: #ecfdf5; margin: 8px 0 0 0;">From SoloCompass</p>
        </div>
        <p>Hi ${contact.name},</p>
        <p><strong>${user.name}</strong> has checked in safely from their trip.</p>
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;"><strong>📍 Location:</strong> ${locationText}</p>
          ${mapUrl ? `<p style="margin: 8px 0 0 0;"><a href="${mapUrl}" style="color: #10b981;">View on Map</a></p>` : ''}
          <p style="margin: 8px 0 0 0;"><strong>🕐 Time:</strong> ${checkInTime}</p>
          ${checkIn.message ? `<p style="margin: 8px 0 0 0;"><strong>💬 Message:</strong> ${checkIn.message}</p>` : ''}
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
        <p style="color: #64748b; font-size: 12px; margin: 0;">This notification was sent by SoloCompass Safety Check-In.</p>
        ${unsubscribeFooter(`contact-${contact.id || 'unknown'}`)}
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL(),
      to: [contact.email],
      subject: `[SoloCompass] ${user.name} checked in safely ✓`,
      html,
      headers: { 'List-Unsubscribe': `<${getUnsubscribeUrl(`contact-${contact.id || 'unknown'}`)}>` }
    });

    if (error) return { success: false, error };
    return { success: true, data };
  } catch (err) {
    logger.error('Unhandled email error (Safe Checkin):', err);
    return { success: false, error: err.message };
  }
}

export async function sendEmergencyAlertNotification(contact, user, checkIn, location) {
  try {
    const resend = getResendClient();
    if (!resend) return { success: false, error: 'Email service not initialized' };

    const locationText = formatLocation(checkIn.latitude, checkIn.longitude, checkIn.address);
    const mapUrl = generateLocationMapUrl(checkIn.latitude, checkIn.longitude);
    const alertTime = new Date(checkIn.created_at).toLocaleString('en-US', {
      timeZone: 'UTC',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <h1 style="color: white; margin: 0; font-size: 28px;">⚠️ EMERGENCY ALERT</h1>
          <p style="color: #fef2f2; margin: 8px 0 0 0;">Immediate Attention Required</p>
        </div>
        <div style="background: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; color: #b91c1c; font-weight: bold; font-size: 18px;">
            ${user.name} has triggered an emergency alert!
          </p>
        </div>
        <p>Dear ${contact.name},</p>
        <p><strong>${user.name}</strong> has sent an emergency alert through SoloCompass.</p>
        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0;"><strong>📍 Location:</strong> ${locationText}</p>
          ${mapUrl ? `<p style="margin: 8px 0 0 0;"><a href="${mapUrl}" style="color: #dc2626; font-weight: bold;">View Location on Map</a></p>` : ''}
          <p style="margin: 8px 0 0 0;"><strong>🕐 Time:</strong> ${alertTime}</p>
          ${checkIn.message ? `<p style="margin: 8px 0 0 0;"><strong>💬 Message:</strong> ${checkIn.message}</p>` : ''}
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
        <p style="color: #64748b; font-size: 12px; margin: 0;">SoloCompass Support: support@solocompass.com</p>
        ${unsubscribeFooter(`contact-${contact.id || 'unknown'}`)}
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL(),
      to: [contact.email],
      subject: `[URGENT] ${user.name} - Emergency Alert from SoloCompass`,
      html,
      headers: { 'List-Unsubscribe': `<${getUnsubscribeUrl(`contact-${contact.id || 'unknown'}`)}>` }
    });

    if (error) return { success: false, error };
    return { success: true, data };
  } catch (err) {
    logger.error('Unhandled email error (Emergency):', err);
    return { success: false, error: err.message };
  }
}

export async function sendMissedCheckinNotification(contact, user, scheduledCheckIn) {
  try {
    const resend = getResendClient();
    if (!resend) return { success: false, error: 'Email service not initialized' };

    const scheduledTime = new Date(scheduledCheckIn.scheduled_time).toLocaleString('en-US', {
      timeZone: scheduledCheckIn.timezone || 'UTC',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <h1 style="color: white; margin: 0; font-size: 28px;">⚠️ Missed Check-In</h1>
          <p style="color: #fef3c7; margin: 8px 0 0 0;">Action May Be Required</p>
        </div>
        <p>Hi ${contact.name},</p>
        <p><strong>${user.name}</strong> scheduled a check-in for <strong>${scheduledTime}</strong> but has not checked in yet.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
        <p style="color: #64748b; font-size: 12px; margin: 0;">This notification was sent by SoloCompass Safety Check-In.</p>
        ${unsubscribeFooter(`contact-${contact.id || 'unknown'}`)}
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL(),
      to: [contact.email],
      subject: `[SoloCompass] ${user.name} - Missed Check-In`,
      html,
      headers: { 'List-Unsubscribe': `<${getUnsubscribeUrl(`contact-${contact.id || 'unknown'}`)}>` }
    });

    if (error) return { success: false, error };
    return { success: true, data };
  } catch (err) {
    logger.error('Unhandled email error (Missed Checkin):', err);
    return { success: false, error: err.message };
  }
}

export async function notifyEmergencyContacts(contacts, user, checkIn, type) {
  const results = [];
  for (const contact of contacts) {
    const shouldNotify = type === 'emergency' ? contact.notify_on_emergency : contact.notify_on_checkin;
    if (!shouldNotify) continue;
    
    const preferEmail = contact.prefer_email !== false;
    const preferSms = contact.prefer_sms === true;
    const deliveryOrder = contact.delivery_order || 'email_first';
    
    let emailRes = { success: false, error: 'Skipped - not preferred' };
    let smsRes = { success: false, error: 'Skipped - not preferred' };
    
    if (deliveryOrder === 'email_first') {
      if (preferEmail && contact.email) {
        if (type === 'emergency') emailRes = await sendEmergencyAlertNotification(contact, user, checkIn);
        else if (type === 'missed') emailRes = await sendMissedCheckinNotification(contact, user, checkIn);
        else emailRes = await sendSafeCheckinNotification(contact, user, checkIn);
      }
      if (preferSms && contact.phone) {
        const smsResults = await notifyEmergencyContactsSMS([contact], user, checkIn, type);
        smsRes = smsResults.length > 0 ? smsResults[0] : { success: false };
      }
    } else {
      if (preferSms && contact.phone) {
        const smsResults = await notifyEmergencyContactsSMS([contact], user, checkIn, type);
        smsRes = smsResults.length > 0 ? smsResults[0] : { success: false };
      }
      if (preferEmail && contact.email) {
        if (type === 'emergency') emailRes = await sendEmergencyAlertNotification(contact, user, checkIn);
        else if (type === 'missed') emailRes = await sendMissedCheckinNotification(contact, user, checkIn);
        else emailRes = await sendSafeCheckinNotification(contact, user, checkIn);
      }
    }
    
    results.push({
      contactId: contact.id,
      email: contact.email,
      phone: contact.phone,
      emailResult: contact.email && preferEmail ? emailRes : null,
      smsResult: contact.phone && preferSms ? smsRes : null,
      deliveryOrder
    });
  }
  return results;
}

export async function sendTestNotification(contact, user) {
  try {
    const resend = getResendClient();
    if (!resend) return { success: false, error: 'Email service not initialized' };

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🔔 Test Notification</h1>
        </div>
        <p>Hi ${contact.name},</p>
        <p>This is a test notification from SoloCompass.</p>
        ${unsubscribeFooter(`contact-${contact.id || 'unknown'}`)}
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL(),
      to: [contact.email],
      subject: '[SoloCompass] Test Notification - Emergency Contact Setup',
      html,
      headers: { 'List-Unsubscribe': `<${getUnsubscribeUrl(`contact-${contact.id || 'unknown'}`)}>` }
    });

    if (error) return { success: false, error };
    return { success: true, data };
  } catch (err) {
    logger.error('Unhandled email error (Test):', err);
    return { success: false, error: err.message };
  }
}

// ... the rest of the db methods stay same ...
export async function createNotification(userId, type, title, message, data = null, relatedId = null) {
  try {
    const result = await db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, data, is_read, related_id)
      VALUES (?, ?, ?, ?, ?, false, ?)
    `).run(userId, type, title, message, data ? JSON.stringify(data) : null, relatedId || null);
    
    // Real-time broadcast
    broadcastToUser(userId, {
      type: 'notification',
      notification: {
        userId, type, title, message, data, relatedId,
        id: result.lastInsertRowid,
        created_at: new Date().toISOString()
      }
    });

    return result;
  } catch (err) {
    logger.error('[Notification] Error creating notification:', err.message);
    return null;
  }
}

export async function getUserNotifications(userId, { limit = 50, offset = 0, unreadOnly = false } = {}) {
    try {
        const where = unreadOnly ? 'WHERE user_id = ? AND is_read = false' : 'WHERE user_id = ?';
        return {
          notifications: await db.prepare(`SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(userId, limit, offset),
          total: (await db.prepare(`SELECT COUNT(*) as count FROM notifications ${where}`).get(userId))?.count || 0,
          unread: await getUnreadCount(userId)
        };
    } catch (err) {
        logger.error('[NotificationService] getUserNotifications error:', err.message);
        return { notifications: [], total: 0, unread: 0 };
    }
}

export async function getUnreadCount(userId) {
    try {
        const result = await db.prepare(`SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = false`).get(userId);
        return parseInt(result?.count || 0);
    } catch (err) {
        logger.error('[NotificationService] getUnreadCount error:', err.message);
        return 0;
    }
}

export async function markAllNotificationsRead(userId) {
    try {
        return await db.prepare(`UPDATE notifications SET is_read = true WHERE user_id = ? AND is_read = false`).run(userId);
    } catch (err) {
        logger.error('[NotificationService] markAllNotificationsRead error:', err.message);
        return null;
    }
}

export async function deleteNotification(notificationId, userId) {
    try {
        return await db.prepare(`DELETE FROM notifications WHERE id = ? AND user_id = ?`).run(notificationId, userId);
    } catch (err) {
        logger.error('[NotificationService] deleteNotification error:', err.message);
        return null;
    }
}

export async function markNotificationRead(notificationId, userId) {
    try {
        return await db.prepare(`UPDATE notifications SET is_read = true WHERE id = ? AND user_id = ?`).run(notificationId, userId);
    } catch (err) {
        logger.error('[NotificationService] markNotificationRead error:', err.message);
        return null;
    }
}

export async function updateNotificationPreferences(userId, prefs) {
    try {
        const existing = await db.get('SELECT id FROM notification_preferences WHERE user_id = ?', userId);
        const toDbBool = (val) => val === true || val === 'true' || val === 1 ? 1 : 0;
        
        if (existing) {
            const fields = [];
            const values = [];
            
            if (prefs.emailNotifications !== undefined) { fields.push('email_notifications = ?'); values.push(toDbBool(prefs.emailNotifications)); }
            if (prefs.pushNotifications !== undefined) { fields.push('push_notifications = ?'); values.push(toDbBool(prefs.pushNotifications)); }
            if (prefs.smsNotifications !== undefined) { fields.push('sms_notifications = ?'); values.push(toDbBool(prefs.smsNotifications)); }
            if (prefs.checkinReminders !== undefined) { fields.push('checkin_reminders = ?'); values.push(toDbBool(prefs.checkinReminders)); }
            if (prefs.checkinMissed !== undefined) { fields.push('checkin_missed = ?'); values.push(toDbBool(prefs.checkinMissed)); }
            if (prefs.checkinEmergency !== undefined) { fields.push('checkin_emergency = ?'); values.push(toDbBool(prefs.checkinEmergency)); }
            if (prefs.tripReminders !== undefined) { fields.push('trip_reminders = ?'); values.push(toDbBool(prefs.tripReminders)); }
            if (prefs.buddyRequests !== undefined) { fields.push('buddy_requests = ?'); values.push(toDbBool(prefs.buddyRequests)); }
            if (prefs.budgetAlerts !== undefined) { fields.push('budget_alerts = ?'); values.push(toDbBool(prefs.budgetAlerts)); }
            if (prefs.reminderMinutesBefore !== undefined) { fields.push('reminder_minutes_before = ?'); values.push(parseInt(prefs.reminderMinutesBefore) || 15); }
            
            if (fields.length === 0) return await getNotificationPreferences(userId);
            
            values.push(userId);
            await db.run(`UPDATE notification_preferences SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, ...values);
        } else {
            await db.run(`
                INSERT INTO notification_preferences (
                    user_id, email_notifications, push_notifications, sms_notifications,
                    checkin_reminders, checkin_missed, checkin_emergency,
                    trip_reminders, buddy_requests, budget_alerts, reminder_minutes_before
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, 
                userId, 
                toDbBool(prefs.emailNotifications ?? true), 
                toDbBool(prefs.pushNotifications ?? true), 
                toDbBool(prefs.smsNotifications ?? false),
                toDbBool(prefs.checkinReminders ?? true),
                toDbBool(prefs.checkinMissed ?? true),
                toDbBool(prefs.checkinEmergency ?? true),
                toDbBool(prefs.tripReminders ?? true),
                toDbBool(prefs.buddyRequests ?? true),
                toDbBool(prefs.budgetAlerts ?? true),
                parseInt(prefs.reminderMinutesBefore) || 15
            );
        }
        
        return await getNotificationPreferences(userId);
    } catch (err) {
        logger.error('[NotificationService] updateNotificationPreferences error:', err.message);
        return null;
    }
}

export async function getNotificationPreferences(userId) {
    try {
        let prefs = await db.get('SELECT * FROM notification_preferences WHERE user_id = ?', userId);
        
        if (!prefs) {
            // Create default preferences
            await db.run('INSERT INTO notification_preferences (user_id) VALUES (?)', userId);
            prefs = await db.get('SELECT * FROM notification_preferences WHERE user_id = ?', userId);
        }
        
        // Map database snake_case to camelCase for frontend
        return {
            emailNotifications: !!prefs.email_notifications,
            pushNotifications: !!prefs.push_notifications,
            smsNotifications: !!prefs.sms_notifications,
            checkinReminders: !!prefs.checkin_reminders,
            checkinMissed: !!prefs.checkin_missed,
            checkinEmergency: !!prefs.checkin_emergency,
            tripReminders: !!prefs.trip_reminders,
            buddyRequests: !!prefs.buddy_requests,
            budgetAlerts: !!prefs.budget_alerts,
            reminderMinutesBefore: prefs.reminder_minutes_before
        };
    } catch (err) {
        logger.error('[NotificationService] getNotificationPreferences error:', err.message);
        return { emailNotifications: true, pushNotifications: true };
    }
}

export async function sendAdvisoryNotification(userId, advisory) {
  return createNotification(userId, 'advisory', `Advisory: ${advisory.country}`, advisory.summary);
}

export async function sendCheckinReminder(userId, tripId) {
  return createNotification(userId, 'checkin_reminder', 'Check-In Reminder', 'Time to check in!');
}

export async function sendTripUpdate(userId, tripId, message) {
  return createNotification(userId, 'trip_update', 'Trip Update', message);
}
