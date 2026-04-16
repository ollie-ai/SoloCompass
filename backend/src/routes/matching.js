import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { requireAuth } from '../middleware/auth.js';
import db from '../db.js';
import logger from '../services/logger.js';
import { createNotification, getNotificationPreferences } from '../services/notificationService.js';
import { getChannelsForType, CHANNEL } from '../services/notificationRegistry.js';
import * as pushService from '../services/pushService.js';
import * as email from '../services/email.js';
import multer from 'multer';
import { supabaseStorage } from '../services/supabaseStorage.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'), false);
    }
  },
});

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

async function sendBuddyNotification(userId, notificationType, title, message, data = null) {
  try {
    await createNotification(userId, notificationType, title, message, data);
    
    const prefs = await getNotificationPreferences(userId);
    const channels = getChannelsForType(notificationType, prefs);
    
    if (channels.includes(CHANNEL.PUSH)) {
      await pushService.sendPushNotification(userId, { title, body: message, ...data });
    }
  } catch (err) {
    logger.error(`[BuddyNotification] Failed to send ${notificationType}:`, err.message);
  }
}

async function getConnectionForUser(connectionId, userId) {
  return db.prepare(`
    SELECT id, sender_id, receiver_id, status
    FROM buddy_requests
    WHERE id = ?
      AND status = 'accepted'
      AND (sender_id = ? OR receiver_id = ?)
  `).get(connectionId, userId, userId);
}

router.use(requireAuth);

router.get('/trips', async (req, res) => {
  try {
    const { destination, startDate, endDate } = req.query;

    const userId = req.userId;

    const trips = await db.prepare(`
      SELECT id FROM trips WHERE user_id = ? AND status IN ('planning', 'confirmed')
    `).all(userId);
    const userTripIds = trips.map(t => t.id);

    if (userTripIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const blocked = await db.prepare(`
      SELECT blocked_id FROM buddy_blocks WHERE blocker_id = ?
    `).all(userId);
    const blockedUsers = blocked.map(b => b.blocked_id);

    const placeholders = userTripIds.map(() => '?').join(',');
    const blockedPlaceholders = blockedUsers.length > 0 ? blockedUsers.map(() => '?').join(',') : null;

    let query = `
      SELECT 
        tb.id,
        tb.user_id,
        tb.trip_id,
        tb.destination,
        tb.start_date,
        tb.end_date,
        tb.status,
        tb.created_at,
        u.name as user_name,
        u.verification_tier,
        p.avatar_url,
        p.bio,
        p.travel_style,
        p.interests,
        p.solo_travel_experience
      FROM travel_buddies tb
      JOIN users u ON tb.user_id = u.id
      LEFT JOIN profiles p ON tb.user_id = p.user_id
      WHERE tb.trip_id IN (${placeholders})
      AND tb.user_id != ?
      AND tb.status IN ('searching', 'matched')
    `;

    const params = [...userTripIds, userId];

    if (blockedPlaceholders) {
      query += ` AND tb.user_id NOT IN (${blockedPlaceholders})`;
      params.push(...blockedUsers);
    }

    if (destination) {
      query += ` AND LOWER(tb.destination) LIKE LOWER(?)`;
      params.push(`%${destination}%`);
    }

    query += ` ORDER BY tb.created_at DESC`;

    const buddies = await db.prepare(query).all(...params);

    const enrichedBuddies = buddies.map(buddy => ({
      ...buddy,
      interests: buddy.interests ? JSON.parse(buddy.interests) : [],
      showContact: false,
      firstName: buddy.user_name ? buddy.user_name.split(' ')[0] : 'Traveler'
    }));

    res.json({ success: true, data: enrichedBuddies });
  } catch (error) {
    logger.error(`[Matching] Failed to fetch matching trips: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch matching trips' });
  }
});

// Discovery: Find buddies for a destination without needing a trip context
router.get('/discovery', async (req, res) => {
  try {
    const { destination } = req.query;
    const userId = req.userId;

    if (!destination) {
      return res.status(400).json({ error: 'Destination is required' });
    }

    const buddies = await db.prepare(`
      SELECT 
        tb.id, tb.user_id, tb.destination, tb.start_date, tb.end_date, tb.status,
        u.name as user_name, u.verification_tier,
        p.avatar_url, p.bio, p.travel_style, p.interests
      FROM travel_buddies tb
      JOIN users u ON tb.user_id = u.id
      LEFT JOIN profiles p ON tb.user_id = p.user_id
      WHERE LOWER(tb.destination) LIKE LOWER(?)
      AND tb.user_id != ?
      AND tb.status IN ('searching', 'matched')
      ORDER BY tb.start_date ASC
      LIMIT 10
    `).all(`%${destination}%`, userId);

    res.json({ 
      success: true, 
      data: buddies.map(b => ({
        ...b,
        firstName: b.user_name ? b.user_name.split(' ')[0] : 'Traveler'
      }))
    });
  } catch (error) {
    logger.error(`[Matching] Failed to discover buddies: ${error.message}`);
    res.status(500).json({ error: 'Failed to discover buddies' });
  }
});

router.post('/buddies', [
  body('tripId').isNumeric().withMessage('Trip ID is required'),
  body('message').optional().isLength({ max: 500 }).withMessage('Message must be under 500 characters'),
], handleValidationErrors, async (req, res) => {
  try {
    const { tripId, message } = req.body;
    const senderId = req.userId;

    const trip = await db.prepare(`
      SELECT id, user_id, destination, start_date, end_date FROM trips WHERE id = ?
    `).get(tripId);

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const existingBuddy = await db.prepare(`
      SELECT id FROM travel_buddies WHERE user_id = ? AND trip_id = ?
    `).get(senderId, tripId);

    if (!existingBuddy) {
      await db.prepare(`
        INSERT INTO travel_buddies (user_id, trip_id, destination, start_date, end_date, interests, status)
        VALUES (?, ?, ?, ?, ?, NULL, 'active')
      `).run(senderId, tripId, trip.destination, trip.start_date, trip.end_date);
    }

    const receiverId = trip.user_id;

    if (receiverId === senderId) {
      return res.status(400).json({ error: 'Cannot send request to yourself' });
    }

    const existingRequest = await db.prepare(`
      SELECT id FROM buddy_requests 
      WHERE sender_id = ? AND receiver_id = ? AND trip_id = ? AND status IN ('pending', 'accepted')
    `).get(senderId, receiverId, tripId);

    if (existingRequest) {
      return res.status(400).json({ error: 'Request already exists' });
    }

    const result = await db.prepare(`
      INSERT INTO buddy_requests (sender_id, receiver_id, trip_id, message, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(senderId, receiverId, tripId, message || null);

    const sender = await db.prepare('SELECT name FROM users WHERE id = ?').get(senderId);
    const senderName = sender?.name || 'A traveler';
    
    await sendBuddyNotification(
      receiverId,
      'buddy_request',
      'New Buddy Request',
      `${senderName} wants to connect for your trip to ${trip.destination}`,
      { requestId: result.lastInsertRowid, tripId, senderId, senderName, destination: trip.destination }
    );

    res.json({ 
      success: true, 
      data: { id: result.lastInsertRowid, status: 'pending' }
    });
  } catch (error) {
    logger.error(`[Matching] Failed to create buddy request: ${error.message}`);
    res.status(500).json({ error: 'Failed to create buddy request' });
  }
});

router.get('/requests', async (req, res) => {
  try {
    const userId = req.userId;

    const incomingRequests = await db.prepare(`
      SELECT 
        br.id,
        br.sender_id,
        br.receiver_id,
        br.trip_id,
        br.message,
        br.status,
        br.created_at,
        u.name as sender_name,
        u.email as sender_email,
        p.avatar_url,
        p.bio,
        p.travel_style,
        t.name as trip_name,
        t.destination as trip_destination,
        t.start_date,
        t.end_date
      FROM buddy_requests br
      JOIN users u ON br.sender_id = u.id
      LEFT JOIN profiles p ON br.sender_id = p.user_id
      LEFT JOIN trips t ON br.trip_id = t.id
      WHERE br.receiver_id = ?
      ORDER BY br.created_at DESC
    `).all(userId);

    const outgoingRequests = await db.prepare(`
      SELECT 
        br.id,
        br.sender_id,
        br.receiver_id,
        br.trip_id,
        br.message,
        br.status,
        br.created_at,
        u.name as receiver_name,
        u.email as receiver_email,
        p.avatar_url,
        p.bio,
        p.travel_style,
        t.name as trip_name,
        t.destination as trip_destination,
        t.start_date,
        t.end_date
      FROM buddy_requests br
      JOIN users u ON br.receiver_id = u.id
      LEFT JOIN profiles p ON br.receiver_id = p.user_id
      LEFT JOIN trips t ON br.trip_id = t.id
      WHERE br.sender_id = ?
      ORDER BY br.created_at DESC
    `).all(userId);

    const enrichedIncoming = incomingRequests.map(req => ({
      ...req,
      senderFirstName: req.sender_name ? req.sender_name.split(' ')[0] : 'Traveler',
      emailVerified: !!req.sender_email,
      trip: req.trip_destination ? {
        destination: req.trip_destination,
        name: req.trip_name,
        startDate: req.start_date,
        endDate: req.end_date,
      } : null,
      requester: {
        name: req.sender_name,
        bio: req.bio,
        travelStyle: req.travel_style,
      }
    }));

    const enrichedOutgoing = outgoingRequests.map(req => ({
      ...req,
      receiverFirstName: req.receiver_name ? req.receiver_name.split(' ')[0] : 'Traveler',
      emailVerified: !!req.receiver_email,
      trip: req.trip_destination ? {
        destination: req.trip_destination,
        name: req.trip_name,
        startDate: req.start_date,
        endDate: req.end_date,
      } : null,
      recipient: {
        name: req.receiver_name,
        bio: req.bio,
        travelStyle: req.travel_style,
      }
    }));

    res.json({ 
      success: true, 
      data: { 
        incoming: enrichedIncoming, 
        outgoing: enrichedOutgoing 
      } 
    });
  } catch (error) {
    logger.error(`[Matching] Failed to fetch requests: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

router.put('/requests/:id', [
  body('action').isIn(['accept', 'decline', 'block']).withMessage('Invalid action'),
], handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    const userId = req.userId;

    const request = await db.prepare(`
      SELECT id, sender_id, trip_id, status FROM buddy_requests WHERE id = ? AND receiver_id = ?
    `).get(id, userId);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request already processed' });
    }

    if (action === 'block') {
      await db.prepare(`
        INSERT INTO buddy_blocks (blocker_id, blocked_id, reason)
        VALUES (?, ?, 'User blocked')
        ON CONFLICT (blocker_id, blocked_id) DO NOTHING
      `).run(userId, request.sender_id);

      await db.prepare(`
        UPDATE buddy_requests SET status = 'blocked', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(id);
    } else {
      const newStatus = action === 'accept' ? 'accepted' : 'declined';
      await db.prepare(`
        UPDATE buddy_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(newStatus, id);

      const user = await db.prepare('SELECT name FROM users WHERE id = ?').get(userId);
      const userName = user?.name || 'Someone';
      const trip = await db.prepare('SELECT destination FROM trips WHERE id = ?').get(request.trip_id);
      const destination = trip?.destination || 'your trip';
      
      if (action === 'accept') {
        await sendBuddyNotification(
          request.sender_id,
          'buddy_accepted',
          'Buddy Request Accepted',
          `${userName} accepted your buddy request for ${destination}`,
          { requestId: id, receiverId: userId, userName, destination }
        );
      } else if (action === 'decline') {
        await sendBuddyNotification(
          request.sender_id,
          'buddy_declined',
          'Buddy Request Declined',
          `${userName} declined your buddy request for ${destination}`,
          { requestId: id, receiverId: userId, userName, destination }
        );
      }
    }

    res.json({ success: true, message: `Request ${action}ed` });
  } catch (error) {
    logger.error(`[Matching] Failed to update request: ${error.message}`);
    res.status(500).json({ error: 'Failed to update request' });
  }
});

router.get('/connections', async (req, res) => {
  try {
    const userId = req.userId;

    const sentConnections = await db.prepare(`
      SELECT 
        br.id,
        br.receiver_id as buddy_id,
        br.trip_id,
        br.status,
        br.created_at,
        u.name as buddy_name,
        p.avatar_url,
        p.bio,
        t.name as trip_name,
        t.destination as trip_destination,
        t.start_date,
        t.end_date
      FROM buddy_requests br
      JOIN users u ON br.receiver_id = u.id
      LEFT JOIN profiles p ON br.receiver_id = p.user_id
      JOIN trips t ON br.trip_id = t.id
      WHERE br.sender_id = ? AND br.status = 'accepted'
    `).all(userId);

    const receivedConnections = await db.prepare(`
      SELECT 
        br.id,
        br.sender_id as buddy_id,
        br.trip_id,
        br.status,
        br.created_at,
        u.name as buddy_name,
        p.avatar_url,
        p.bio,
        t.name as trip_name,
        t.destination as trip_destination,
        t.start_date,
        t.end_date
      FROM buddy_requests br
      JOIN users u ON br.sender_id = u.id
      LEFT JOIN profiles p ON br.sender_id = p.user_id
      JOIN trips t ON br.trip_id = t.id
      WHERE br.receiver_id = ? AND br.status = 'accepted'
    `).all(userId);

    const connections = [...sentConnections, ...receivedConnections].map(conn => ({
      ...conn,
      showContact: true,
      firstName: conn.buddy_name ? conn.buddy_name.split(' ')[0] : 'Traveler'
    }));

    res.json({ success: true, data: connections });
  } catch (error) {
    logger.error(`[Matching] Failed to fetch connections: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
});

router.delete('/connections/:id', [
  param('id').isNumeric().withMessage('Connection ID is required'),
], handleValidationErrors, async (req, res) => {
  try {
    const connectionId = parseInt(req.params.id, 10);
    const userId = req.userId;

    const connection = await getConnectionForUser(connectionId, userId);
    if (!connection || connection.status !== 'accepted') {
      return res.status(404).json({ error: 'Connection not found' });
    }

    await db.prepare(`DELETE FROM buddy_requests WHERE id = ?`).run(connectionId);

    await db.prepare(`
      DELETE FROM buddy_conversations
      WHERE (participant_a = ? AND participant_b = ?)
         OR (participant_a = ? AND participant_b = ?)
    `).run(connection.sender_id, connection.receiver_id, connection.receiver_id, connection.sender_id);

    res.json({ success: true, message: 'Connection removed' });
  } catch (error) {
    logger.error(`[Matching] Failed to remove connection: ${error.message}`);
    res.status(500).json({ error: 'Failed to remove connection' });
  }
});

router.post('/connections/:id/block', [
  param('id').isNumeric().withMessage('Connection ID is required'),
  body('reason').optional().isLength({ max: 500 }).withMessage('Reason must be under 500 characters'),
], handleValidationErrors, async (req, res) => {
  try {
    const connectionId = parseInt(req.params.id, 10);
    const userId = req.userId;
    const connection = await getConnectionForUser(connectionId, userId);

    if (!connection || connection.status !== 'accepted') {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const blockedId = connection.sender_id === userId ? connection.receiver_id : connection.sender_id;

    await db.prepare(`
      INSERT INTO buddy_blocks (blocker_id, blocked_id, reason, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (blocker_id, blocked_id)
      DO UPDATE SET reason = EXCLUDED.reason, created_at = EXCLUDED.created_at
    `).run(userId, blockedId, req.body.reason || 'Blocked from connection');

    await db.prepare(`
      UPDATE buddy_requests
      SET status = 'blocked', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(connectionId);

    res.json({ success: true, message: 'User blocked' });
  } catch (error) {
    logger.error(`[Matching] Failed to block connection: ${error.message}`);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

router.post('/connections/:id/report', [
  param('id').isNumeric().withMessage('Connection ID is required'),
  body('reason').isString().isLength({ min: 5, max: 500 }).withMessage('Reason must be 5-500 characters'),
  body('details').optional().isString().trim().isLength({ max: 2000 }).withMessage('Details must be under 2000 characters'),
  body('category').optional().isIn(['harassment', 'spam', 'scam', 'inappropriate_content', 'safety_concern', 'other']),
], handleValidationErrors, async (req, res) => {
  try {
    const connectionId = parseInt(req.params.id, 10);
    const userId = req.userId;
    const connection = await getConnectionForUser(connectionId, userId);

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const reportedUserId = connection.sender_id === userId ? connection.receiver_id : connection.sender_id;
    const { reason, details, category = 'other' } = req.body;

    const reportResult = await db.prepare(`
      INSERT INTO buddy_reports (reporter_id, reported_user_id, connection_id, category, reason, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, reportedUserId, connectionId, category, reason.trim(), details?.trim() || null);

    res.status(201).json({
      success: true,
      data: { id: reportResult.lastInsertRowid, connectionId, reportedUserId, status: 'open' },
      message: 'Report submitted successfully'
    });
  } catch (error) {
    logger.error(`[Matching] Failed to report connection: ${error.message}`);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

router.post('/blocks', [
  body('userId').isNumeric().withMessage('User ID is required'),
  body('reason').optional().isLength({ max: 200 }),
], handleValidationErrors, async (req, res) => {
  try {
    const { userId: blockedId } = req.body;
    const blockerId = req.userId;

    if (blockerId === blockedId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    await db.prepare(`
      INSERT INTO buddy_blocks (blocker_id, blocked_id, reason, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (blocker_id, blocked_id) DO UPDATE SET reason = EXCLUDED.reason, created_at = EXCLUDED.created_at
    `).run(blockerId, blockedId, req.body.reason || null);

    res.json({ success: true, message: 'User blocked' });
  } catch (error) {
    logger.error(`[Matching] Failed to block user: ${error.message}`);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// Enhanced matching endpoints
const handlePotentialMatches = async (req, res) => {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 20;
    const { destination, startDate, endDate, genderPref } = req.query;

    const blocked = await db.prepare(`
      SELECT blocked_id FROM buddy_blocks WHERE blocker_id = ?
    `).all(userId);
    const blockedUsers = blocked.map(b => b.blocked_id);

    const blockedClause = blockedUsers.length > 0
      ? `AND tb.user_id NOT IN (${blockedUsers.map(() => '?').join(',')})`
      : '';

    const params = blockedUsers.length > 0 ? [userId, ...blockedUsers] : [userId];

    let destClause = '';
    if (destination) {
      destClause = `AND LOWER(tb.destination) LIKE LOWER(?)`;
      params.push(`%${destination}%`);
    }

    let dateClause = '';
    if (startDate) {
      dateClause += ` AND tb.end_date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      dateClause += ` AND tb.start_date <= ?`;
      params.push(endDate);
    }

    // Gender preference filter (optional): match users whose gender_identity equals the requested value
    const VALID_GENDER_PREFS = ['female', 'male', 'non_binary'];
    let genderClause = '';
    if (genderPref && VALID_GENDER_PREFS.includes(genderPref)) {
      genderClause = `AND p.gender_identity = ?`;
      params.push(genderPref);
    }

    params.push(limit);

    const matches = await db.prepare(`
      SELECT 
        tb.id, tb.user_id, tb.destination, tb.start_date, tb.end_date, tb.interests,
        u.name as user_name, u.email as user_email,
        p.avatar_url, p.bio, p.travel_style, p.budget_level, p.pace,
        p.solo_travel_experience, p.accommodation_type, p.gender_identity
      FROM travel_buddies tb
      JOIN users u ON tb.user_id = u.id
      LEFT JOIN profiles p ON tb.user_id = p.user_id
      WHERE tb.user_id != ?
      AND tb.status IN ('searching', 'matched')
      ${blockedClause}
      ${destClause}
      ${dateClause}
      ${genderClause}
      ORDER BY tb.created_at DESC
      LIMIT ?
    `).all(...params);

    const myProfile = await db.prepare(`
      SELECT interests, budget_level, travel_style, pace, solo_travel_experience
      FROM profiles WHERE user_id = ?
    `).get(userId);
    
    // Safety check for new users without profiles
    const myInterests = myProfile?.interests ? JSON.parse(myProfile.interests) : [];

    const enrichedMatches = matches.map(match => {
      const interests = match.interests ? JSON.parse(match.interests) : [];
      
      let score = 30;
      const matchReasons = [];
      
      if (match.destination) {
        score += 20;
        matchReasons.push('Same destination');
      }
      
      if (match.start_date && match.end_date) {
        score += 15;
        matchReasons.push('Overlapping dates');
      }
      
      const sharedInterests = interests.filter(i => myInterests.includes(i));
      if (sharedInterests.length > 0) {
        score += Math.min(sharedInterests.length * 5, 20);
        matchReasons.push(`${sharedInterests.length} shared interest${sharedInterests.length > 1 ? 's' : ''}`);
      }
      
      if (match.budget_level && myProfile?.budget_level === match.budget_level) {
        score += 10;
        matchReasons.push('Similar budget');
      }
      
      if (match.travel_style && myProfile?.travel_style === match.travel_style) {
        score += 5;
        matchReasons.push('Similar vibe');
      }

      if (matchReasons.length === 0) {
        matchReasons.push('Solo traveler');
      }

      return {
        userId: match.user_id,
        name: match.user_name?.split(' ')[0] || 'Traveler',
        avatar: match.avatar_url,
        destination: match.destination,
        startDate: match.start_date,
        endDate: match.end_date,
        bio: match.bio,
        travelStyle: match.travel_style,
        budgetLevel: match.budget_level,
        interests,
        emailVerified: !!match.user_email,
        compatibilityScore: Math.min(score, 95),
        matchReasons,
      };
    });

    res.json({ success: true, data: enrichedMatches });
  } catch (error) {
    logger.error(`[Matching] Failed to fetch potential matches: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch potential matches' });
  }
};

router.get('/potential', handlePotentialMatches);
router.get('/discover', handlePotentialMatches);

router.get('/solo-id', async (req, res) => {
  try {
    const userId = req.userId;

    const profile = await db.prepare(`
      SELECT 
        u.name, u.email, u.verification_tier, u.is_premium,
        p.travel_style, p.budget_level, p.pace, p.interests, 
        p.avatar_url, p.bio, p.display_name, p.home_city, p.visible, p.updated_at
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id = ?
    `).get(userId);

    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    let quizResult = null;
    try {
      quizResult = await db.prepare(`
        SELECT dominant_style, scores, summary, adventure_level, social_style, updated_at
        FROM quiz_results WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1
      `).get(userId);
    } catch (err) {}

    const interests = profile.interests ? JSON.parse(profile.interests) : [];
    const hasDna = !!quizResult;
    
    // Completeness Scoring (20% increments as requested)
    // Avatar: 20%, Display Name: 20%, Public Bio: 20%, Travel DNA: 20%, 3+ Interests: 20%
    const completenessSteps = [
      { field: 'avatar', value: !!profile.avatar_url, weight: 20 },
      { field: 'displayName', value: !!profile.display_name, weight: 20 },
      { field: 'bio', value: !!profile.bio, weight: 20 },
      { field: 'dna', value: hasDna, weight: 20 },
      { field: 'interests', value: interests.length >= 3, weight: 20 }
    ];
    
    const percentage = completenessSteps.reduce((acc, step) => acc + (step.value ? step.weight : 0), 0);
    const missingFields = completenessSteps.filter(s => !s.value).map(s => s.field);

    res.json({
      success: true,
      data: {
        id: userId,
        name: profile.name,
        displayName: profile.display_name || profile.name,
        email: profile.email,
        bio: profile.bio,
        avatarUrl: profile.avatar_url,
        homeCity: profile.home_city,
        verificationTier: profile.verification_tier || 0,
        isPremium: !!profile.is_premium,
        visible: profile.visible !== false,
        interests,
        travelStyle: profile.travel_style,
        completeness: {
          percentage,
          missingFields,
          label: percentage >= 80 ? 'Complete' : percentage >= 40 ? 'Mostly Complete' : 'Incomplete'
        },
        travelDna: quizResult ? {
          style: quizResult.dominant_style,
          adventureLevel: quizResult.adventure_level,
          socialStyle: quizResult.social_style,
          summary: quizResult.summary,
          updatedAt: quizResult.updated_at
        } : null
      }
    });
  } catch (error) {
    logger.error(`[Matching] Failed to fetch solo-id: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch solo-id' });
  }
});

router.post('/avatar/upload', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const userId = req.userId;
    const fileExt = req.file.originalname.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { fileUrl, error } = await supabaseStorage.uploadFile(
      filePath, 
      req.file.buffer, 
      req.file.mimetype, 
      'avatars'
    );

    if (error) {
      throw new Error(error);
    }

    res.json({
      success: true,
      data: { avatarUrl: fileUrl }
    });
  } catch (err) {
    logger.error('[AvatarUpload] Failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to upload avatar' });
  }
});

router.get('/profile', async (req, res) => {
  try {
    const userId = req.userId;

    const profile = await db.prepare(`
      SELECT travel_style, budget_level, pace, interests, solo_travel_experience, accommodation_type, avatar_url, bio, display_name, home_base, visible, updated_at
      FROM profiles WHERE user_id = ?
    `).get(userId);

    let quizResult = null;
    try {
      quizResult = await db.prepare(`
        SELECT dominant_style, scores, summary, adventure_level, social_style, updated_at
        FROM quiz_results WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1
      `).get(userId);
    } catch (quizErr) {
      logger.warn(`[Matching] quiz_results query failed: ${quizErr.message}`);
    }

    if (!profile && !quizResult) {
      return res.json({ success: true, data: null });
    }
    res.json({
      success: true,
      data: {
        displayName: profile?.display_name || null,
        bio: profile?.bio || null,
        avatarUrl: profile?.avatar_url || null,
        homeBase: profile?.home_base || null,
        visible: profile?.visible !== false,
        travelStyle: profile?.travel_style || null,
        budgetLevel: profile?.budget_level || null,
        accommodation_type: profile?.accommodation_type || null,
        interests: profile?.interests ? JSON.parse(profile.interests) : [],
        meetPreferences: profile?.meet_preferences ? JSON.parse(profile.meet_preferences) : [],
        comfortLevel: profile?.comfort_level || 'Open to anyone',
        travelDna: quizResult ? {
          dominantStyle: quizResult.dominant_style,
          scores: quizResult.scores ? JSON.parse(quizResult.scores) : {},
          summary: quizResult.summary,
          adventureLevel: quizResult.adventure_level,
          socialStyle: quizResult.social_style,
          updatedAt: quizResult.updated_at,
        } : null,
        updatedAt: profile?.updated_at,
      },
    });
  } catch (error) {
    logger.error(`[Matching] Failed to fetch profile: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.put('/profile', [
  body('adventureLevel').optional().isString(),
  body('socialPreference').optional().isString(),
  body('pacePreference').optional().isString(),
  body('budgetLevel').optional().isString(),
  body('interests').optional().isArray(),
  body('displayName').optional().isString().trim().isLength({ max: 50 }),
  body('bio').optional().isString().trim().isLength({ max: 500 }),
  body('homeBase').optional().isString().trim().isLength({ max: 100 }),
  body('avatarUrl').optional().isString(),
  body('meetPreferences').optional().isArray(),
  body('comfortLevel').optional().isString(),
  body('visible').optional().isBoolean(),
], handleValidationErrors, async (req, res) => {
  try {
    const userId = req.userId;
    const { 
      adventureLevel, socialPreference, pacePreference, budgetLevel, interests,
      displayName, bio, homeBase, avatarUrl, meetPreferences, comfortLevel, visible
    } = req.body;

    const updates = [];
    const params = [];

    if (adventureLevel !== undefined) { updates.push('solo_travel_experience = ?'); params.push(adventureLevel); }
    if (socialPreference !== undefined) { updates.push('travel_style = ?'); params.push(socialPreference); }
    if (pacePreference !== undefined) { updates.push('pace = ?'); params.push(pacePreference); }
    if (budgetLevel !== undefined) { updates.push('budget_level = ?'); params.push(budgetLevel); }
    if (interests !== undefined) { updates.push('interests = ?'); params.push(JSON.stringify(interests)); }
    if (displayName !== undefined) { 
      updates.push('display_name = ?'); 
      params.push(displayName);
      // Also update the core users table if name is changed here
      await db.prepare('UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(displayName, userId);
    }
    if (bio !== undefined) { updates.push('bio = ?'); params.push(bio); }
    if (homeBase !== undefined || req.body.home_city !== undefined) { 
      const city = homeBase || req.body.home_city;
      updates.push('home_city = ?'); 
      params.push(city); 
    }
    if (avatarUrl !== undefined) { updates.push('avatar_url = ?'); params.push(avatarUrl); }
    if (meetPreferences !== undefined) { updates.push('meet_preferences = ?'); params.push(JSON.stringify(meetPreferences)); }
    if (comfortLevel !== undefined) { updates.push('comfort_level = ?'); params.push(comfortLevel); }
    if (visible !== undefined) { updates.push('visible = ?'); params.push(visible); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId);

    await db.prepare(`UPDATE profiles SET ${updates.join(', ')} WHERE user_id = ?`).run(...params);

    res.json({ success: true, message: 'Profile updated' });
  } catch (error) {
    logger.error(`[Matching] Failed to update profile: ${error.message}`);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.post('/request', [
  body('recipientId').isNumeric().withMessage('Recipient ID is required'),
], handleValidationErrors, async (req, res) => {
  try {
    const { recipientId } = req.body;
    const senderId = req.userId;

    if (senderId === recipientId) {
      return res.status(400).json({ error: 'Cannot send request to yourself' });
    }

    const existingRequest = await db.prepare(`
      SELECT id FROM buddy_requests 
      WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
      AND status IN ('pending', 'accepted')
    `).get(senderId, recipientId, recipientId, senderId);

    if (existingRequest) {
      return res.status(400).json({ error: 'Request already exists' });
    }

    await db.prepare(`
      INSERT INTO buddy_requests (sender_id, receiver_id, trip_id, message, status)
      VALUES (?, ?, NULL, NULL, 'pending')
    `).run(senderId, recipientId);

    const sender = await db.prepare('SELECT name FROM users WHERE id = ?').get(senderId);
    const senderName = sender?.name || 'A traveler';
    
    await sendBuddyNotification(
      recipientId,
      'buddy_request',
      'New Buddy Request',
      `${senderName} wants to connect with you`,
      { requestId: result?.lastInsertRowid, senderId, senderName }
    );

    res.json({ success: true, message: 'Connection request sent' });
  } catch (error) {
    logger.error(`[Matching] Failed to send connection request: ${error.message}`);
    res.status(500).json({ error: 'Failed to send connection request' });
  }
});

router.post('/request/:id/accept', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const request = await db.prepare(`
      SELECT id, sender_id, trip_id, status FROM buddy_requests WHERE id = ? AND receiver_id = ?
    `).get(id, userId);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request already processed' });
    }

    await db.prepare(`
      UPDATE buddy_requests SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(id);

    const user = await db.prepare('SELECT name FROM users WHERE id = ?').get(userId);
    const userName = user?.name || 'Someone';
    
    await sendBuddyNotification(
      request.sender_id,
      'buddy_accepted',
      'Buddy Request Accepted',
      `${userName} accepted your connection request`,
      { requestId: id, receiverId: userId, userName }
    );

    res.json({ success: true, message: 'Connection accepted' });
  } catch (error) {
    logger.error(`[Matching] Failed to accept request: ${error.message}`);
    res.status(500).json({ error: 'Failed to accept request' });
  }
});

router.post('/request/:id/decline', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const request = await db.prepare(`
      SELECT id, sender_id, trip_id, status FROM buddy_requests WHERE id = ? AND receiver_id = ?
    `).get(id, userId);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request already processed' });
    }

    await db.prepare(`
      UPDATE buddy_requests SET status = 'declined', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(id);

    const user = await db.prepare('SELECT name FROM users WHERE id = ?').get(userId);
    const userName = user?.name || 'Someone';
    
    await sendBuddyNotification(
      request.sender_id,
      'buddy_declined',
      'Buddy Request Declined',
      `${userName} declined your connection request`,
      { requestId: id, receiverId: userId, userName }
    );

    res.json({ success: true, message: 'Request declined' });
  } catch (error) {
    logger.error(`[Matching] Failed to decline request: ${error.message}`);
    res.status(500).json({ error: 'Failed to decline request' });
  }
});

router.post('/block/:userId', async (req, res) => {
  try {
    const blockedId = parseInt(req.params.userId);
    const blockerId = req.userId;

    if (blockerId === blockedId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    await db.prepare(`
      INSERT INTO buddy_blocks (blocker_id, blocked_id, reason)
      VALUES (?, ?, 'User blocked')
      ON CONFLICT (blocker_id, blocked_id) DO NOTHING
    `).run(blockerId, blockedId);

    res.json({ success: true, message: 'User blocked' });
  } catch (error) {
    logger.error(`[Matching] Failed to block user: ${error.message}`);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

export default router;
