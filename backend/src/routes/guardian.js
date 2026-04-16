import express from 'express';
import crypto from 'crypto';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { createNotification } from '../services/notificationService.js';
import { sendEmail } from '../services/resendClient.js';
import { sendPushNotification } from '../services/pushService.js';
import logger from '../services/logger.js';

const router = express.Router();

const GUARDIAN_EXPIRY_DAYS = 30;

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatGuardianAcknowledgement(ga) {
  return {
    id: ga.id,
    contactId: ga.contact_id,
    contactName: ga.contact_name,
    tripId: ga.trip_id,
    tripName: ga.trip_name,
    status: ga.status,
    acknowledgedAt: ga.acknowledged_at,
    expiresAt: ga.expires_at,
    createdAt: ga.created_at,
  };
}

router.post('/send-request', authenticate, async (req, res) => {
  try {
    const { contactId, tripId } = req.body;
    const userId = req.userId;

    if (!contactId) {
      return res.status(400).json({
        success: false,
        error: 'Contact ID is required',
      });
    }

    const contact = await db.prepare(`
      SELECT ec.*, u.name as user_name, u.email as user_email
      FROM emergency_contacts ec
      JOIN users u ON u.id = ec.user_id
      WHERE ec.id = ? AND ec.user_id = ?
    `).get(contactId, userId);

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
      });
    }

    let tripName = null;
    if (tripId) {
      const trip = await db.prepare(`
        SELECT name FROM trips WHERE id = ? AND user_id = ?
      `).get(tripId, userId);
      tripName = trip?.name || null;
    }

    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + GUARDIAN_EXPIRY_DAYS);

    await db.prepare(`
      INSERT INTO guardian_acknowledgements (user_id, contact_id, trip_id, acknowledgement_token, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, contactId, tripId || null, token, expiresAt.toISOString());

    const acknowledgementId = await db.prepare('SELECT lastval() as id').get();
    const ackId = acknowledgementId?.id || 0;

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5176';
    const acknowledgeUrl = `${baseUrl}/guardian/acknowledge/${token}`;
    const declineUrl = `${baseUrl}/guardian/decline/${token}`;

    const userName = escapeHtml(contact.user_name);
    const safeTripName = escapeHtml(tripName);

    const emailHtml = `
      <h2>You've been asked to be a Guardian for ${userName}'s trip</h2>
      <p>${userName} is planning ${safeTripName ? `a trip to ${safeTripName}` : 'an upcoming trip'} and has selected you as their travel guardian.</p>
      <p>As a Guardian, you'll receive check-in reminders if ${userName} doesn't check in as expected during their trip. In an emergency, you may be contacted to help locate them.</p>
      
      <h3>What does this mean?</h3>
      <ul>
        <li>You'll receive notifications if ${userName} misses a scheduled check-in</li>
        <li>In a genuine emergency, you may be contacted with their last known location</li>
        <li>You don't need to take any action unless contacted</li>
      </ul>
      
      <p style="margin-top: 30px;">
        <a href="${acknowledgeUrl}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 10px;">I Acknowledge</a>
        <a href="${declineUrl}" style="background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">I Decline</a>
      </p>
      
      <p style="margin-top: 20px; color: #666; font-size: 12px;">
        This request expires in ${GUARDIAN_EXPIRY_DAYS} days.
      </p>
    `;

    try {
      await sendEmail({
        to: contact.email || contact.phone,
        subject: `Guardian Request from ${contact.user_name} - Action Required`,
        html: emailHtml,
      });
    } catch (emailError) {
      logger.error('Failed to send guardian acknowledgement email:', emailError);
    }

    logger.info(`Guardian request sent to contact ${contactId} for user ${userId}`);

    res.status(201).json({
      success: true,
      data: {
        id: ackId,
        token,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error sending guardian request:', error);
    res.status(500).json({ success: false, error: 'Failed to send guardian request' });
  }
});

router.get('/requests', authenticate, async (req, res) => {
  try {
    const { tripId } = req.query;
    const userId = req.userId;

    let query = `
      SELECT 
        ga.*,
        ec.name as contact_name,
        t.name as trip_name
      FROM guardian_acknowledgements ga
      JOIN emergency_contacts ec ON ec.id = ga.contact_id
      LEFT JOIN trips t ON t.id = ga.trip_id
      WHERE ga.user_id = ?
    `;
    const params = [userId];

    if (tripId) {
      query += ' AND ga.trip_id = ?';
      params.push(tripId);
    }

    query += ' ORDER BY ga.created_at DESC';

    const requests = await db.prepare(query).all(...params);

    res.json({
      success: true,
      data: requests.map(formatGuardianAcknowledgement),
    });
  } catch (error) {
    logger.error('Error fetching guardian requests:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch guardian requests' });
  }
});

router.post('/acknowledge/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const acknowledgement = await db.prepare(`
      SELECT ga.*, ec.name as contact_name, ec.email as contact_email, u.name as user_name
      FROM guardian_acknowledgements ga
      JOIN emergency_contacts ec ON ec.id = ga.contact_id
      JOIN users u ON u.id = ga.user_id
      WHERE ga.acknowledgement_token = ?
    `).get(token);

    if (!acknowledgement) {
      return res.status(404).json({
        success: false,
        error: 'Invalid acknowledgement token',
      });
    }

    if (acknowledgement.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `This acknowledgement has already been ${acknowledgement.status}`,
      });
    }

    if (new Date(acknowledgement.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'This acknowledgement request has expired',
      });
    }

    await db.prepare(`
      UPDATE guardian_acknowledgements
      SET status = 'acknowledged', acknowledged_at = NOW()
      WHERE id = ?
    `).run(acknowledgement.id);

    await createNotification(
      acknowledgement.user_id,
      'guardian_acknowledged',
      'Guardian Confirmed',
      `${acknowledgement.contact_name} has confirmed they are your travel guardian.`,
      { contactId: acknowledgement.contact_id, tripId: acknowledgement.trip_id }
    );

    await createNotification(
      acknowledgement.user_id,
      'sos_acknowledged',
      'SOS Acknowledged',
      `${acknowledgement.contact_name} acknowledged your emergency alert and is responding.`,
      { contactId: acknowledgement.contact_id, tripId: acknowledgement.trip_id }
    );

    await sendPushNotification(acknowledgement.user_id, {
      title: 'SOS Acknowledged',
      body: `${acknowledgement.contact_name} acknowledged your emergency alert.`,
      priority: 'P0',
      tag: 'sos_acknowledged',
      data: {
        type: 'sos_acknowledged',
        contactId: String(acknowledgement.contact_id || ''),
        tripId: String(acknowledgement.trip_id || ''),
      }
    });

    logger.info(`Guardian acknowledgement confirmed: contact ${acknowledgement.contact_id} acknowledged by token`);

    res.json({
      success: true,
      message: 'Thank you for acknowledging. You are now a confirmed guardian.',
      data: {
        contactName: acknowledgement.contact_name,
        userName: acknowledgement.user_name,
      },
    });
  } catch (error) {
    logger.error('Error acknowledging guardian:', error);
    res.status(500).json({ success: false, error: 'Failed to acknowledge guardian' });
  }
});

router.post('/decline/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const acknowledgement = await db.prepare(`
      SELECT ga.*, ec.name as contact_name, u.name as user_name
      FROM guardian_acknowledgements ga
      JOIN emergency_contacts ec ON ec.id = ga.contact_id
      JOIN users u ON u.id = ga.user_id
      WHERE ga.acknowledgement_token = ?
    `).get(token);

    if (!acknowledgement) {
      return res.status(404).json({
        success: false,
        error: 'Invalid token',
      });
    }

    if (acknowledgement.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `This acknowledgement has already been ${acknowledgement.status}`,
      });
    }

    await db.prepare(`
      UPDATE guardian_acknowledgements
      SET status = 'declined'
      WHERE id = ?
    `).run(acknowledgement.id);

    await createNotification(
      acknowledgement.user_id,
      'guardian_declined',
      'Guardian Declined',
      `${acknowledgement.contact_name} has declined your guardian request.`,
      { contactId: acknowledgement.contact_id }
    );

    logger.info(`Guardian acknowledgement declined: contact ${acknowledgement.contact_id} declined by token`);

    res.json({
      success: true,
      message: 'You have declined the guardian request.',
    });
  } catch (error) {
    logger.error('Error declining guardian:', error);
    res.status(500).json({ success: false, error: 'Failed to decline guardian' });
  }
});

router.delete('/request/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const request = await db.prepare(`
      SELECT * FROM guardian_acknowledgements WHERE id = ? AND user_id = ?
    `).get(id, userId);

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found',
      });
    }

    await db.prepare(`
      DELETE FROM guardian_acknowledgements WHERE id = ?
    `).run(id);

    res.json({
      success: true,
      message: 'Guardian request cancelled',
    });
  } catch (error) {
    logger.error('Error cancelling guardian request:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel guardian request' });
  }
});

router.get('/status', authenticate, async (req, res) => {
  try {
    const { tripId } = req.query;
    const userId = req.userId;

    let query = `
      SELECT 
        ga.*,
        ec.name as contact_name,
        t.name as trip_name
      FROM guardian_acknowledgements ga
      JOIN emergency_contacts ec ON ec.id = ga.contact_id
      LEFT JOIN trips t ON t.id = ga.trip_id
      WHERE ga.user_id = ? AND ga.status = 'acknowledged'
    `;
    const params = [userId];

    if (tripId) {
      query = `
        SELECT 
          ga.*,
          ec.name as contact_name,
          t.name as trip_name
        FROM guardian_acknowledgements ga
        JOIN emergency_contacts ec ON ec.id = ga.contact_id
        LEFT JOIN trips t ON t.id = ga.trip_id
        WHERE ga.user_id = ? AND (ga.trip_id = ? OR ga.trip_id IS NULL) AND ga.status = 'acknowledged'
      `;
      params.push(tripId);
    }

    query += ' ORDER BY ga.acknowledged_at DESC';

    const confirmed = await db.prepare(query).all(...params);

    let pendingQuery = `
      SELECT 
        ga.*,
        ec.name as contact_name,
        t.name as trip_name
      FROM guardian_acknowledgements ga
      JOIN emergency_contacts ec ON ec.id = ga.contact_id
      LEFT JOIN trips t ON t.id = ga.trip_id
      WHERE ga.user_id = ? AND ga.status = 'pending'
    `;
    const pendingParams = [userId];

    if (tripId) {
      pendingQuery += ' AND (ga.trip_id = ? OR ga.trip_id IS NULL)';
      pendingParams.push(tripId);
    }

    pendingQuery += ' ORDER BY ga.created_at DESC';

    const pending = await db.prepare(pendingQuery).all(...pendingParams);

    res.json({
      success: true,
      data: {
        confirmed: confirmed.map(formatGuardianAcknowledgement),
        pending: pending.map(formatGuardianAcknowledgement),
        totalConfirmed: confirmed.length,
        totalPending: pending.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching guardian status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch guardian status' });
  }
});

export default router;
