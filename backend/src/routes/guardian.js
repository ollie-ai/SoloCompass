import express from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { PLAN_TIERS } from '../middleware/paywall.js';
import { createNotification } from '../services/notificationService.js';
import { sendEmail } from '../services/resendClient.js';
import logger from '../services/logger.js';
const router = express.Router();

const GUARDIAN_EXPIRY_DAYS = 30;

// Max guardian relationships per subscription tier
const GUARDIAN_LIMITS = {
  [PLAN_TIERS.EXPLORER]: 1,
  [PLAN_TIERS.GUARDIAN]: 3,
  [PLAN_TIERS.NAVIGATOR]: Infinity
};

const guardianWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many guardian requests. Please wait.' }
});

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

router.post('/send-request', authenticate, guardianWriteLimiter, async (req, res) => {
  try {
    const { contactId, tripId } = req.body;
    const userId = req.userId;

    if (!contactId) {
      return res.status(400).json({
        success: false,
        error: 'Contact ID is required',
      });
    }

    // Enforce per-tier guardian limit
    const userRow = await db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(userId);
    const tier = userRow?.subscription_tier || PLAN_TIERS.EXPLORER;
    const limit = GUARDIAN_LIMITS[tier] ?? 1;
    if (isFinite(limit)) {
      const existing = await db.prepare(`
        SELECT COUNT(*) as count FROM guardian_acknowledgements
        WHERE user_id = ? AND status != 'declined'
      `).get(userId);
      if ((existing?.count || 0) >= limit) {
        return res.status(403).json({
          success: false,
          error: `Your plan allows a maximum of ${limit} guardian${limit !== 1 ? 's' : ''}. Upgrade to add more.`,
          upgradeUrl: '/settings?tab=billing'
        });
      }
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
      { contactId: acknowledgement.contact_id }
    );

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

router.delete('/request/:id', authenticate, async (req, res) => {  try {
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

// POST /guardian/invite - Invite a guardian by email (creates guardian_relationships record)
router.post('/invite', authenticate, guardianWriteLimiter, async (req, res) => {
  try {
    const userId = req.userId;
    const {
      guardianEmail,
      guardianName,
      tripId,
      permissionViewLocation = true,
      permissionReceiveAlerts = true,
      permissionViewItinerary = false
    } = req.body;

    if (!guardianEmail) {
      return res.status(400).json({ success: false, error: 'Guardian email is required' });
    }

    const emailTrimmed = String(guardianEmail).slice(0, 254);
    const atIdx = emailTrimmed.indexOf('@');
    if (atIdx < 1 || emailTrimmed.lastIndexOf('.') <= atIdx + 1) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }

    // Enforce per-tier guardian limit
    const userRow = await db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(userId);
    const tier = userRow?.subscription_tier || PLAN_TIERS.EXPLORER;
    const limit = GUARDIAN_LIMITS[tier] ?? 1;
    if (isFinite(limit)) {
      const existing = await db.prepare(`
        SELECT COUNT(*) as count FROM guardian_relationships
        WHERE traveller_id = ? AND status != 'declined'
      `).get(userId);
      if ((existing?.count || 0) >= limit) {
        return res.status(403).json({
          success: false,
          error: `Your plan allows a maximum of ${limit} guardian${limit !== 1 ? 's' : ''}. Upgrade to add more.`,
          upgradeUrl: '/settings?tab=billing'
        });
      }
    }

    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + GUARDIAN_EXPIRY_DAYS);

    const result = await db.prepare(`
      INSERT INTO guardian_relationships (
        traveller_id, guardian_token, guardian_email, guardian_name,
        trip_id, permission_view_location, permission_receive_alerts,
        permission_view_itinerary, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      token,
      guardianEmail,
      guardianName || null,
      tripId || null,
      permissionViewLocation,
      permissionReceiveAlerts,
      permissionViewItinerary,
      expiresAt.toISOString()
    );

    const user = await db.prepare('SELECT name FROM users WHERE id = ?').get(userId);
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5176';
    const acceptUrl = `${baseUrl}/guardian/acknowledge/${token}`;
    const declineUrl = `${baseUrl}/guardian/decline/${token}`;
    const userName = escapeHtml(user?.name || 'A SoloCompass traveller');

    try {
      await sendEmail({
        to: guardianEmail,
        subject: `${user?.name || 'Someone'} wants you as their Travel Guardian`,
        html: `
          <h2>You've been invited to be a Travel Guardian</h2>
          <p>${userName} would like you to be their travel guardian on SoloCompass.</p>
          <p>As a guardian you'll be notified if they miss a scheduled check-in.</p>
          <p style="margin-top:24px;">
            <a href="${acceptUrl}" style="background:#10b981;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin-right:10px;">Accept</a>
            <a href="${declineUrl}" style="background:#ef4444;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">Decline</a>
          </p>
          <p style="color:#666;font-size:12px;margin-top:20px;">This invitation expires in ${GUARDIAN_EXPIRY_DAYS} days.</p>
        `
      });
    } catch (emailErr) {
      logger.error('[Guardian] Failed to send invite email:', emailErr.message);
    }

    logger.info(`[Guardian] Invite sent to ${guardianEmail} for user ${userId}`);

    res.status(201).json({
      success: true,
      data: { id: result.lastInsertRowid, token, expiresAt: expiresAt.toISOString() }
    });
  } catch (error) {
    logger.error('[Guardian] Error creating invite:', error);
    res.status(500).json({ success: false, error: 'Failed to create guardian invite' });
  }
});

// GET /guardian/list - Returns all guardians (from both tables)
router.get('/list', authenticate, async (req, res) => {
  try {
    const userId = req.userId;

    const [legacy, relationships] = await Promise.all([
      db.prepare(`
        SELECT ga.id, ec.name as guardian_name, ec.email as guardian_email, ga.status,
               ga.created_at, 'legacy' as source
        FROM guardian_acknowledgements ga
        JOIN emergency_contacts ec ON ec.id = ga.contact_id
        WHERE ga.user_id = ?
        ORDER BY ga.created_at DESC
      `).all(userId),
      db.prepare(`
        SELECT id, guardian_email, guardian_name, status, permission_view_location,
               permission_receive_alerts, permission_view_itinerary, location_sharing_enabled,
               invited_at, accepted_at, created_at, 'relationship' as source
        FROM guardian_relationships
        WHERE traveller_id = ?
        ORDER BY created_at DESC
      `).all(userId)
    ]);

    res.json({ success: true, data: { guardians: [...legacy, ...relationships] } });
  } catch (error) {
    logger.error('[Guardian] Error listing guardians:', error);
    res.status(500).json({ success: false, error: 'Failed to list guardians' });
  }
});

// GET /guardian/dashboard - Returns guardian's view of travellers they guard
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const guardianEmail = req.userEmail;

    if (!guardianEmail) {
      const user = await db.prepare('SELECT email FROM users WHERE id = ?').get(req.userId);
      if (!user) return res.status(400).json({ success: false, error: 'User email not found' });
    }

    const user = await db.prepare('SELECT email FROM users WHERE id = ?').get(req.userId);
    const email = user?.email;

    if (!email) {
      return res.status(400).json({ success: false, error: 'User email not found' });
    }

    const travellers = await db.prepare(`
      SELECT
        gr.id,
        gr.traveller_id,
        u.name as traveller_name,
        u.email as traveller_email,
        gr.status,
        gr.permission_view_location,
        gr.permission_receive_alerts,
        gr.permission_view_itinerary,
        gr.location_sharing_enabled,
        gr.last_location_lat,
        gr.last_location_lng,
        gr.last_location_at,
        gr.accepted_at,
        gr.trip_id
      FROM guardian_relationships gr
      JOIN users u ON u.id = gr.traveller_id
      WHERE LOWER(gr.guardian_email) = LOWER(?) AND gr.status = 'active'
    `).all(email);

    // For each traveller, get their last check-in and any active SOS
    const enriched = await Promise.all(travellers.map(async (t) => {
      const [lastCheckIn, activeSOS] = await Promise.all([
        db.prepare(`
          SELECT id, type, created_at, address, latitude, longitude
          FROM check_ins WHERE user_id = ? ORDER BY created_at DESC LIMIT 1
        `).get(t.traveller_id),
        db.prepare(`
          SELECT id, triggered_at, status, latitude, longitude, address
          FROM sos_events WHERE user_id = ? AND status = 'active' LIMIT 1
        `).get(t.traveller_id)
      ]);
      return { ...t, lastCheckIn, activeSOS };
    }));

    res.json({ success: true, data: { travellers: enriched } });
  } catch (error) {
    logger.error('[Guardian] Error fetching dashboard:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch guardian dashboard' });
  }
});

// PUT /guardian/:id/location - Update location sharing for a guardian relationship
router.put('/:id/location', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { locationSharingEnabled, latitude, longitude } = req.body;

    const rel = await db.prepare(`
      SELECT id FROM guardian_relationships WHERE id = ? AND traveller_id = ?
    `).get(id, userId);

    if (!rel) {
      return res.status(404).json({ success: false, error: 'Guardian relationship not found' });
    }

    const updates = ['updated_at = CURRENT_TIMESTAMP'];
    const params = [];

    if (locationSharingEnabled !== undefined) {
      updates.push('location_sharing_enabled = ?');
      params.push(locationSharingEnabled);
    }
    if (latitude !== undefined && longitude !== undefined) {
      updates.push('last_location_lat = ?', 'last_location_lng = ?', 'last_location_at = CURRENT_TIMESTAMP');
      params.push(latitude, longitude);
    }

    params.push(id);
    await db.prepare(`
      UPDATE guardian_relationships SET ${updates.join(', ')} WHERE id = ?
    `).run(...params);

    res.json({ success: true, message: 'Location sharing updated' });
  } catch (error) {
    logger.error('[Guardian] Error updating location:', error);
    res.status(500).json({ success: false, error: 'Failed to update location sharing' });
  }
});

// GET /guardian/:id/location - Guardian reads a traveller's shared location
router.get('/:id/location', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const guardianUserId = req.userId;

    // Look up the relationship — the caller must be the guardian
    const guardianUser = await db.prepare('SELECT email FROM users WHERE id = ?').get(guardianUserId);
    if (!guardianUser) {
      return res.status(400).json({ success: false, error: 'User not found' });
    }

    const rel = await db.prepare(`
      SELECT gr.id, gr.traveller_id, gr.location_sharing_enabled,
             gr.last_location_lat, gr.last_location_lng, gr.last_location_at,
             gr.permission_view_location,
             u.name as traveller_name
      FROM guardian_relationships gr
      JOIN users u ON u.id = gr.traveller_id
      WHERE gr.id = ? AND LOWER(gr.guardian_email) = LOWER(?) AND gr.status = 'active'
    `).get(id, guardianUser.email);

    if (!rel) {
      return res.status(404).json({ success: false, error: 'Guardian relationship not found' });
    }

    if (!rel.permission_view_location) {
      return res.status(403).json({ success: false, error: 'Traveller has not granted location permission' });
    }

    if (!rel.location_sharing_enabled) {
      return res.json({
        success: true,
        data: {
          relationshipId: rel.id,
          travellerId: rel.traveller_id,
          travellerName: rel.traveller_name,
          locationSharingEnabled: false,
          location: null
        }
      });
    }

    res.json({
      success: true,
      data: {
        relationshipId: rel.id,
        travellerId: rel.traveller_id,
        travellerName: rel.traveller_name,
        locationSharingEnabled: true,
        location: rel.last_location_lat ? {
          latitude: rel.last_location_lat,
          longitude: rel.last_location_lng,
          updatedAt: rel.last_location_at
        } : null
      }
    });
  } catch (error) {
    logger.error('[Guardian] Error fetching traveller location:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch location' });
  }
});

// DELETE /guardian/:id - Remove a guardian relationship (traveller removes a guardian)
router.delete('/:id', authenticate, guardianWriteLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Allow removal if caller is traveller OR guardian
    const rel = await db.prepare(`
      SELECT id FROM guardian_relationships
      WHERE id = ? AND (traveller_id = ? OR guardian_email = (SELECT email FROM users WHERE id = ?))
    `).get(id, userId, userId);

    if (!rel) {
      return res.status(404).json({ success: false, error: 'Guardian relationship not found' });
    }

    await db.prepare('DELETE FROM guardian_relationships WHERE id = ?').run(id);

    logger.info(`[Guardian] Relationship ${id} removed by user ${userId}`);
    res.json({ success: true, message: 'Guardian relationship removed' });
  } catch (error) {
    logger.error('[Guardian] Error removing guardian:', error);
    res.status(500).json({ success: false, error: 'Failed to remove guardian' });
  }
});

export default router;
