import db from '../db.js';
import { notifyEmergencyContacts, createNotification } from './notificationService.js';
import { notifyEmergencyContactsSMS } from './smsService.js';
import { broadcastToUser } from './websocket.js';
import logger from './logger.js';

const CHECK_INTERVAL_MS = 60000;
const TIER1_MS = 5 * 60 * 1000;   // 5 min: notify first contact only
const TIER2_MS = 15 * 60 * 1000;  // 15 min: notify ALL contacts
const TIER3_MS = 30 * 60 * 1000;  // 30 min: trigger full SOS
const REMINDER_BEFORE_MS = 15 * 60 * 1000;
const REMINDER_AT_MS = 0;          // 0 min: reminder exactly at scheduled time
const REMINDER_AFTER_MS = 5 * 60 * 1000; // 5 min after: gentle follow-up before escalation

export function startScheduledCheckInMonitor() {
  logger.info('[CheckIn Monitor] Starting scheduled check-in monitor');
  
  setInterval(async () => {
    try {
      const now = new Date();
      
      // --- 15-minute advance reminder ---
      const upcomingCheckIns = await db.prepare(`
        SELECT 
          sci.*,
          u.id as user_id,
          u.name as user_name,
          u.email as user_email
        FROM scheduled_check_ins sci
        JOIN users u ON sci.user_id = u.id
        WHERE sci.is_active = true
          AND sci.scheduled_time > ?
          AND sci.scheduled_time <= ?
          AND (sci.reminder_sent IS NULL OR sci.reminder_sent = false)
      `).all(
        new Date(now.getTime() - REMINDER_BEFORE_MS).toISOString(),
        now.toISOString()
      );

      for (const sci of upcomingCheckIns) {
        await db.prepare(`
          UPDATE scheduled_check_ins SET reminder_sent = true WHERE id = ?
        `).run(sci.id);

        broadcastToUser(sci.user_id, {
          type: 'checkin_reminder',
          scheduledCheckIn: {
            id: sci.id,
            scheduledTime: sci.scheduled_time,
            tripId: sci.trip_id
          },
          message: `Check-in due at ${new Date(sci.scheduled_time).toLocaleTimeString()}. Tap to confirm you're safe.`
        });

        await createNotification(
          sci.user_id,
          'checkin_reminder',
          'Scheduled Check-In Due Soon',
          `Your check-in is due at ${new Date(sci.scheduled_time).toLocaleTimeString()}. Confirm now or your contacts will be notified.`,
          { scheduledCheckInId: sci.id, tripId: sci.trip_id },
          sci.id
        );

        logger.info(`[CheckIn Monitor] 15-min advance reminder sent for check-in ${sci.id}`);
      }

      // --- At-time reminder (sent within 1 check-interval window of scheduled_time) ---
      const atTimeCheckIns = await db.prepare(`
        SELECT 
          sci.*,
          u.id as user_id,
          u.name as user_name,
          u.email as user_email
        FROM scheduled_check_ins sci
        JOIN users u ON sci.user_id = u.id
        WHERE sci.is_active = true
          AND sci.scheduled_time > ?
          AND sci.scheduled_time <= ?
          AND sci.missed_at IS NULL
          AND (sci.at_time_reminder_sent IS NULL OR sci.at_time_reminder_sent = false)
      `).all(
        new Date(now.getTime() - CHECK_INTERVAL_MS).toISOString(),
        now.toISOString()
      );

      for (const sci of atTimeCheckIns) {
        await db.prepare(`
          UPDATE scheduled_check_ins SET at_time_reminder_sent = true WHERE id = ?
        `).run(sci.id).catch(() => null); // column may not exist on older DB versions

        broadcastToUser(sci.user_id, {
          type: 'checkin_reminder',
          scheduledCheckIn: {
            id: sci.id,
            scheduledTime: sci.scheduled_time,
            tripId: sci.trip_id
          },
          message: `Your check-in is due NOW. Tap to confirm you're safe!`
        });

        await createNotification(
          sci.user_id,
          'checkin_reminder',
          'Check-In Due Now',
          `Your scheduled check-in is due now. Confirm you're safe to avoid alerting your contacts.`,
          { scheduledCheckInId: sci.id, tripId: sci.trip_id },
          sci.id
        ).catch(() => null);

        logger.info(`[CheckIn Monitor] At-time reminder sent for check-in ${sci.id}`);
      }

      // --- +5-min follow-up reminder (before escalation kicks in at 5 min) ---
      const followUpCheckIns = await db.prepare(`
        SELECT 
          sci.*,
          u.id as user_id,
          u.name as user_name,
          u.email as user_email
        FROM scheduled_check_ins sci
        JOIN users u ON sci.user_id = u.id
        WHERE sci.is_active = true
          AND sci.scheduled_time <= ?
          AND sci.scheduled_time > ?
          AND sci.missed_at IS NULL
          AND sci.escalation_level IS NULL
          AND (sci.followup_reminder_sent IS NULL OR sci.followup_reminder_sent = false)
      `).all(
        new Date(now.getTime() - REMINDER_AT_MS).toISOString(),
        new Date(now.getTime() - REMINDER_AFTER_MS).toISOString()
      );

      for (const sci of followUpCheckIns) {
        await db.prepare(`
          UPDATE scheduled_check_ins SET followup_reminder_sent = true WHERE id = ?
        `).run(sci.id).catch(() => null);

        broadcastToUser(sci.user_id, {
          type: 'checkin_missed',
          scheduledCheckIn: {
            id: sci.id,
            scheduledTime: sci.scheduled_time,
            tripId: sci.trip_id
          },
          scheduledCheckInId: sci.id,
          message: `You missed your check-in 5 minutes ago. Tap to confirm you're safe before your contacts are alerted.`
        });

        await createNotification(
          sci.user_id,
          'checkin_missed',
          'Missed Check-In – Please Respond',
          `Your check-in was 5 minutes ago. Confirm you are safe now, or your primary contact will be notified shortly.`,
          { scheduledCheckInId: sci.id, tripId: sci.trip_id },
          sci.id
        ).catch(() => null);

        logger.info(`[CheckIn Monitor] 5-min follow-up reminder sent for check-in ${sci.id}`);
      }
      
      const missedCheckIns = await db.prepare(`
        SELECT 
          sci.*,
          u.id as user_id,
          u.name as user_name,
          u.email as user_email
        FROM scheduled_check_ins sci
        JOIN users u ON sci.user_id = u.id
        WHERE sci.is_active = true
          AND sci.scheduled_time <= ?
          AND sci.missed_at IS NULL
      `).all(now.toISOString());

      for (const sci of missedCheckIns) {
        const scheduledTime = new Date(sci.scheduled_time);
        const timeSinceMissed = now - scheduledTime;
        
        if (timeSinceMissed >= TIER3_MS && !sci.sos_triggered) {
          await triggerSOS(sci);
        } else if (timeSinceMissed >= TIER2_MS && !sci.final_warning_sent) {
          await sendTier2Warning(sci);
        } else if (timeSinceMissed >= TIER1_MS && !sci.escalation_level) {
          await sendTier1Warning(sci);
        }
      }

    } catch (error) {
      logger.error('[CheckIn Monitor] Error:', error.message);
    }
  }, CHECK_INTERVAL_MS);
  
  logger.info('[CheckIn Monitor] Check-in monitor running (5/15/30 min escalation tiers)');
}

// Tier 1: 5 minutes missed – notify FIRST emergency contact only
async function sendTier1Warning(scheduledCheckIn) {
  try {
    const allContacts = await db.prepare(`
      SELECT * FROM emergency_contacts 
      WHERE user_id = ? AND notify_on_emergency = true
      ORDER BY is_primary DESC, created_at ASC
      LIMIT 1
    `).all(scheduledCheckIn.user_id);

    const user = { id: scheduledCheckIn.user_id, name: scheduledCheckIn.user_name };

    logger.info(`[CheckIn Monitor] Tier-1 warning for user ${scheduledCheckIn.user_id} (first contact only)`);

    broadcastToUser(scheduledCheckIn.user_id, {
      type: 'checkin_missed',
      message: `You missed your scheduled check-in. Your primary contact will be notified if you don't check in within 10 minutes.`,
      scheduledCheckInId: scheduledCheckIn.id
    });

    await createNotification(
      scheduledCheckIn.user_id,
      'checkin_missed',
      'Missed Check-In',
      'You missed your scheduled check-in. Your primary contact has been alerted.',
      { scheduledCheckInId: scheduledCheckIn.id },
      scheduledCheckIn.id
    );

    if (allContacts.length > 0) {
      await notifyEmergencyContacts(allContacts, user, scheduledCheckIn, 'missed');
      await notifyEmergencyContactsSMS(allContacts, user, scheduledCheckIn, 'missed');
    }

    await db.prepare(`
      UPDATE scheduled_check_ins
      SET missed_at = CURRENT_TIMESTAMP, escalation_level = 1
      WHERE id = ?
    `).run(scheduledCheckIn.id);

  } catch (error) {
    logger.error('[CheckIn Monitor] Error sending tier-1 warning:', error.message);
  }
}

// Tier 2: 15 minutes missed – notify ALL contacts
async function sendTier2Warning(scheduledCheckIn) {
  try {
    const contacts = await db.prepare(`
      SELECT * FROM emergency_contacts 
      WHERE user_id = ? AND notify_on_emergency = true
    `).all(scheduledCheckIn.user_id);

    if (contacts.length === 0) return;

    const user = { id: scheduledCheckIn.user_id, name: scheduledCheckIn.user_name };

    logger.info(`[CheckIn Monitor] Tier-2 warning for user ${scheduledCheckIn.user_id} (all ${contacts.length} contacts)`);

    broadcastToUser(scheduledCheckIn.user_id, {
      type: 'checkin_missed',
      message: `All emergency contacts are being notified of your missed check-in.`,
      scheduledCheckInId: scheduledCheckIn.id
    });

    await createNotification(
      scheduledCheckIn.user_id,
      'checkin_missed',
      'Missed Check-In - Final Warning',
      'All emergency contacts have been notified. SOS will be triggered in 15 minutes if you do not check in.',
      { scheduledCheckInId: scheduledCheckIn.id },
      scheduledCheckIn.id
    );

    await notifyEmergencyContacts(contacts, user, scheduledCheckIn, 'missed');
    await notifyEmergencyContactsSMS(contacts, user, scheduledCheckIn, 'missed');

    await db.prepare(`
      UPDATE scheduled_check_ins
      SET final_warning_sent = true, escalation_level = 2
      WHERE id = ?
    `).run(scheduledCheckIn.id);

  } catch (error) {
    logger.error('[CheckIn Monitor] Error sending tier-2 warning:', error.message);
  }
}

// Tier 3: 30 minutes missed – trigger full SOS via sos_events
async function triggerSOS(scheduledCheckIn) {
  try {
    const contacts = await db.prepare(`
      SELECT * FROM emergency_contacts 
      WHERE user_id = ? AND notify_on_emergency = true
    `).all(scheduledCheckIn.user_id);

    if (contacts.length === 0) return;

    const user = { id: scheduledCheckIn.user_id, name: scheduledCheckIn.user_name };

    logger.warn(`[CheckIn Monitor] Triggering SOS for user ${scheduledCheckIn.user_id}`);

    // Create sos_events record
    try {
      await db.prepare(`
        INSERT INTO sos_events (user_id, trip_id, trigger_type, status, message)
        VALUES (?, ?, 'missed_checkin', 'active', ?)
      `).run(
        scheduledCheckIn.user_id,
        scheduledCheckIn.trip_id || null,
        `Missed scheduled check-in at ${new Date(scheduledCheckIn.scheduled_time).toLocaleTimeString()}`
      );
    } catch (sosInsertErr) {
      logger.error('[CheckIn Monitor] Failed to create sos_event:', sosInsertErr.message);
    }

    broadcastToUser(scheduledCheckIn.user_id, {
      type: 'checkin_sos',
      message: `SOS triggered. Your emergency contacts have been notified.`,
      scheduledCheckInId: scheduledCheckIn.id
    });

    await createNotification(
      scheduledCheckIn.user_id,
      'checkin_sos',
      'SOS - Emergency Contacts Notified',
      `Your emergency contacts have been notified that you missed your check-in at ${new Date(scheduledCheckIn.scheduled_time).toLocaleTimeString()}.`,
      { scheduledCheckInId: scheduledCheckIn.id },
      scheduledCheckIn.id
    );

    await notifyEmergencyContacts(contacts, user, scheduledCheckIn, 'emergency');
    await notifyEmergencyContactsSMS(contacts, user, scheduledCheckIn, 'emergency');

    await db.prepare(`
      UPDATE scheduled_check_ins
      SET sos_triggered = true, is_active = false, escalation_level = 3
      WHERE id = ?
    `).run(scheduledCheckIn.id);

  } catch (error) {
    logger.error('[CheckIn Monitor] Error triggering SOS:', error.message);
  }
}
