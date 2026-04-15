import express from 'express';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { notifyEmergencyContacts } from '../services/notificationService.js';
import { notifyEmergencyContactsSMS } from '../services/smsService.js';
import { broadcastToUser } from '../services/websocket.js';
import logger from '../services/logger.js';

const router = express.Router();

const sosTriggerLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many SOS requests. Please wait before trying again.' }
});

const sosActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many SOS requests. Please wait.' }
});

// POST /sos/trigger - Trigger SOS alert
router.post('/trigger', authenticate, sosTriggerLimiter, async (req, res) => {
  try {
    const userId = req.userId;
    const { latitude, longitude, address, message, tripId, triggerType = 'manual' } = req.body;

    // Check for already-active SOS
    const existingActive = await db.prepare(`
      SELECT id FROM sos_events WHERE user_id = ? AND status = 'active'
    `).get(userId);

    if (existingActive) {
      return res.status(409).json({
        success: false,
        error: 'An active SOS is already in progress',
        sosEventId: existingActive.id
      });
    }

    // Create the SOS event
    const result = await db.prepare(`
      INSERT INTO sos_events (user_id, trip_id, latitude, longitude, address, message, trigger_type, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(userId, tripId || null, latitude || null, longitude || null, address || null, message || null, triggerType);

    const sosEventId = result.lastInsertRowid;

    // Fetch user info and contacts
    const [user, contacts] = await Promise.all([
      db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId),
      db.prepare(`
        SELECT * FROM emergency_contacts WHERE user_id = ? AND notify_on_emergency = true
      `).all(userId)
    ]);

    // Notify contacts and track notification records
    const notificationInserts = [];
    if (contacts.length > 0 && user) {
      const mockCheckIn = {
        id: sosEventId,
        latitude,
        longitude,
        address,
        message: message || 'SOS triggered',
        scheduled_time: new Date().toISOString(),
        trip_id: tripId || null
      };

      // Send email/push notifications
      try {
        await notifyEmergencyContacts(contacts, user, mockCheckIn, 'emergency');
        for (const c of contacts) {
          notificationInserts.push({ contactId: c.id, channel: 'email', status: 'sent' });
        }
      } catch (notifErr) {
        logger.error('[SOS] Email notification failed:', notifErr.message);
        for (const c of contacts) {
          notificationInserts.push({ contactId: c.id, channel: 'email', status: 'failed' });
        }
      }

      // Send SMS notifications
      try {
        await notifyEmergencyContactsSMS(contacts, user, mockCheckIn, 'emergency');
        for (const c of contacts) {
          notificationInserts.push({ contactId: c.id, channel: 'sms', status: 'sent' });
        }
      } catch (smsErr) {
        logger.error('[SOS] SMS notification failed:', smsErr.message);
        for (const c of contacts) {
          notificationInserts.push({ contactId: c.id, channel: 'sms', status: 'failed' });
        }
      }
    }

    // Record notification attempts
    for (const n of notificationInserts) {
      try {
        await db.prepare(`
          INSERT INTO sos_notifications (sos_event_id, contact_id, channel, status, sent_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(sosEventId, n.contactId, n.channel, n.status);
      } catch (err) {
        logger.error('[SOS] Failed to record notification:', err.message);
      }
    }

    // Broadcast via WebSocket
    broadcastToUser(userId, {
      type: 'sos_triggered',
      sosEventId,
      message: 'SOS activated. Your emergency contacts are being notified.',
      latitude,
      longitude,
      address
    });

    logger.warn(`[SOS] SOS triggered by user ${userId}, event ${sosEventId}`);

    res.status(201).json({
      success: true,
      data: {
        sosEventId,
        status: 'active',
        notifiedContacts: contacts.length,
        triggeredAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('[SOS] Error triggering SOS:', error);
    res.status(500).json({ success: false, error: 'Failed to trigger SOS' });
  }
});

// POST /sos/cancel - Cancel active SOS
router.post('/cancel', authenticate, sosActionLimiter, async (req, res) => {
  try {
    const userId = req.userId;
    const { sosEventId } = req.body;

    let query = `SELECT id, status FROM sos_events WHERE user_id = ? AND status = 'active'`;
    const params = [userId];

    if (sosEventId) {
      query += ' AND id = ?';
      params.push(sosEventId);
    }

    const event = await db.prepare(query).get(...params);

    if (!event) {
      return res.status(404).json({ success: false, error: 'No active SOS event found' });
    }

    await db.prepare(`
      UPDATE sos_events
      SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, cancelled_by = 'user', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(event.id);

    broadcastToUser(userId, {
      type: 'sos_cancelled',
      sosEventId: event.id,
      message: 'SOS has been cancelled.'
    });

    logger.info(`[SOS] SOS cancelled by user ${userId}, event ${event.id}`);

    res.json({ success: true, message: 'SOS cancelled', sosEventId: event.id });
  } catch (error) {
    logger.error('[SOS] Error cancelling SOS:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel SOS' });
  }
});

// GET /sos/status - Get current active SOS event
router.get('/status', authenticate, sosActionLimiter, async (req, res) => {
  try {
    const userId = req.userId;

    const event = await db.prepare(`
      SELECT id, user_id, trip_id, triggered_at, status, latitude, longitude, address, message, trigger_type, acknowledged_by, acknowledged_at
      FROM sos_events
      WHERE user_id = ? AND status = 'active'
      ORDER BY triggered_at DESC
      LIMIT 1
    `).get(userId);

    res.json({
      success: true,
      data: {
        active: Boolean(event),
        event: event || null
      }
    });
  } catch (error) {
    logger.error('[SOS] Error fetching SOS status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch SOS status' });
  }
});

// POST /sos/acknowledge - Guardian acknowledges SOS (via token or contact id)
router.post('/acknowledge', async (req, res) => {
  try {
    const { sosEventId, token, contactId, acknowledgedBy } = req.body;

    if (!sosEventId) {
      return res.status(400).json({ success: false, error: 'sosEventId is required' });
    }

    const event = await db.prepare(`
      SELECT id, user_id, status FROM sos_events WHERE id = ?
    `).get(sosEventId);

    if (!event) {
      return res.status(404).json({ success: false, error: 'SOS event not found' });
    }

    if (event.status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'SOS event has been cancelled' });
    }

    const acknowledger = acknowledgedBy || (contactId ? `contact:${contactId}` : 'guardian');

    await db.prepare(`
      UPDATE sos_events
      SET status = 'acknowledged', acknowledged_by = ?, acknowledged_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(acknowledger, sosEventId);

    broadcastToUser(event.user_id, {
      type: 'sos_acknowledged',
      sosEventId,
      acknowledgedBy: acknowledger,
      message: 'Your SOS has been acknowledged.'
    });

    logger.info(`[SOS] SOS event ${sosEventId} acknowledged by ${acknowledger}`);

    res.json({ success: true, message: 'SOS acknowledged', sosEventId });
  } catch (error) {
    logger.error('[SOS] Error acknowledging SOS:', error);
    res.status(500).json({ success: false, error: 'Failed to acknowledge SOS' });
  }
});

export default router;
