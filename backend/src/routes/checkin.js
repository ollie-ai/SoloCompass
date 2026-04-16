import express from 'express';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { requireFeature, getUserPlan, FEATURES, PLAN_TIERS } from '../middleware/paywall.js';
import { notifyEmergencyContacts, createNotification } from '../services/notificationService.js';
import { broadcastToUser } from '../services/websocket.js';
import logger from '../services/logger.js';

const router = express.Router();

const checkinActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many check-in requests. Please wait.' }
});

const emergencyRateLimit = new Map();
const EMERGENCY_RATE_LIMIT = 5;
const EMERGENCY_WINDOW_MS = 60 * 60 * 1000;

function checkEmergencyRateLimit(userId) {
  const now = Date.now();
  const record = emergencyRateLimit.get(userId);
  
  if (!record || now - record.timestamp > EMERGENCY_WINDOW_MS) {
    emergencyRateLimit.set(userId, { count: 1, timestamp: now });
    return { allowed: true, remaining: EMERGENCY_RATE_LIMIT - 1 };
  }
  
  if (record.count >= EMERGENCY_RATE_LIMIT) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((record.timestamp + EMERGENCY_WINDOW_MS - now) / 1000) };
  }
  
  record.count++;
  return { allowed: true, remaining: EMERGENCY_RATE_LIMIT - record.count };
}

function formatCheckInResponse(c) {
  return {
    id: c.id,
    userId: c.user_id,
    tripId: c.trip_id,
    type: c.type,
    latitude: c.latitude,
    longitude: c.longitude,
    address: c.address,
    message: c.message,
    sentTo: c.sent_to ? JSON.parse(c.sent_to) : [],
    createdAt: c.created_at
  };
}

function formatScheduleResponse(s) {
  return {
    id: s.id,
    userId: s.user_id,
    tripId: s.trip_id,
    interval: s.interval_minutes,
    startTime: s.start_time,
    endTime: s.end_time,
    timezone: s.timezone,
    isActive: Boolean(s.is_active),
    isRecurring: Boolean(s.is_recurring),
    nextCheckinTime: s.next_checkin_time,
    missedCount: s.missed_count || 0,
    escalationLevel: s.escalation_level || 0,
    createdAt: s.created_at
  };
}

// POST /checkin/schedule - Create a recurring check-in schedule
router.post('/schedule', authenticate, async (req, res) => {
  try {
    const { tripId, interval, startTime, endTime, timezone = 'UTC' } = req.body;

    if (!interval || !startTime) {
      return res.status(400).json({
        success: false,
        error: 'Interval (minutes) and startTime are required'
      });
    }

    const intervalMinutes = parseInt(interval);
    if (isNaN(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 1440) {
      return res.status(400).json({
        success: false,
        error: 'Interval must be between 1 and 1440 minutes (1 day)'
      });
    }

    const startDateTime = new Date(startTime);
    if (isNaN(startDateTime.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid startTime format'
      });
    }

    if (endTime) {
      const endDateTime = new Date(endTime);
      if (isNaN(endDateTime.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid endTime format'
        });
      }
      if (endDateTime <= startDateTime) {
        return res.status(400).json({
          success: false,
          error: 'endTime must be after startTime'
        });
      }
    }

    const nextCheckinTime = startDateTime.toISOString();

    const result = await db.prepare(`
      INSERT INTO scheduled_check_ins (
        user_id, trip_id, interval_minutes, start_time, end_time, timezone,
        is_active, is_recurring, next_checkin_time, missed_count, escalation_level
      ) VALUES (?, ?, ?, ?, ?, ?, true, true, ?, 0, 0)
    `).run(
      req.userId,
      tripId || null,
      intervalMinutes,
      startTime,
      endTime || null,
      timezone,
      nextCheckinTime
    );

    const schedule = await db.prepare(`
      SELECT id, user_id, trip_id, interval_minutes, start_time, end_time, timezone,
             is_active, is_recurring, next_checkin_time, missed_count, escalation_level, created_at
      FROM scheduled_check_ins WHERE id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      data: formatScheduleResponse(schedule)
    });
  } catch (error) {
    logger.error('Error creating check-in schedule:', error);
    res.status(500).json({ success: false, error: 'Failed to create check-in schedule' });
  }
});

// GET /checkin/schedule - Get all user's active schedules (recurring)
router.get('/schedule', authenticate, async (req, res) => {
  try {
    const schedules = await db.prepare(`
      SELECT id, user_id, trip_id, interval_minutes, start_time, end_time, timezone,
             is_active, is_recurring, next_checkin_time, missed_count, escalation_level, created_at
      FROM scheduled_check_ins
      WHERE user_id = ? AND is_active = true
      ORDER BY created_at DESC
    `).all(req.userId);

    res.json({
      success: true,
      data: schedules.length > 0 ? formatScheduleResponse(schedules[0]) : null
    });
  } catch (error) {
    logger.error('Error fetching general check-in schedule:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch check-in schedule' });
  }
});

// GET /checkin/schedule/:tripId - Get active schedule for a trip
router.get('/schedule/:tripId', authenticate, async (req, res) => {
  try {
    const { tripId } = req.params;

    const schedules = await db.prepare(`
      SELECT id, user_id, trip_id, interval_minutes, start_time, end_time, timezone,
             is_active, is_recurring, next_checkin_time, missed_count, escalation_level, created_at
      FROM scheduled_check_ins
      WHERE user_id = ? AND trip_id = ? AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `).all(req.userId, tripId);

    if (schedules.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No active schedule found for this trip'
      });
    }

    res.json({
      success: true,
      data: formatScheduleResponse(schedules[0])
    });
  } catch (error) {
    logger.error('Error fetching check-in schedule:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch check-in schedule' });
  }
});

// PUT /checkin/schedule/:id - Update schedule
router.put('/schedule/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { interval, startTime, endTime, timezone, isActive } = req.body;

    const schedule = await db.prepare(`
      SELECT id, user_id, trip_id, interval_minutes, start_time, end_time, timezone,
             is_active, is_recurring, next_checkin_time, missed_count, escalation_level, created_at
      FROM scheduled_check_ins WHERE id = ? AND user_id = ?
    `).get(id, req.userId);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found'
      });
    }

    const updates = [];
    const params = [];

    if (interval !== undefined) {
      const intervalMinutes = parseInt(interval);
      if (isNaN(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 1440) {
        return res.status(400).json({
          success: false,
          error: 'Interval must be between 1 and 1440 minutes'
        });
      }
      updates.push('interval_minutes = ?');
      params.push(intervalMinutes);
    }

    if (startTime !== undefined) {
      const startDateTime = new Date(startTime);
      if (isNaN(startDateTime.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid startTime format'
        });
      }
      updates.push('start_time = ?');
      params.push(startTime);
      updates.push('next_checkin_time = ?');
      params.push(startTime);
    }

    if (endTime !== undefined) {
      if (endTime !== null) {
        const endDateTime = new Date(endTime);
        if (isNaN(endDateTime.getTime())) {
          return res.status(400).json({
            success: false,
            error: 'Invalid endTime format'
          });
        }
        const currentStart = new Date(startTime || schedule.start_time);
        if (endDateTime <= currentStart) {
          return res.status(400).json({
            success: false,
            error: 'endTime must be after startTime'
          });
        }
      }
      updates.push('end_time = ?');
      params.push(endTime);
    }

    if (timezone !== undefined) {
      updates.push('timezone = ?');
      params.push(timezone);
    }

    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(!!isActive);
      if (!isActive) {
        updates.push('next_checkin_time = NULL');
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    params.push(id);

    await db.prepare(`
      UPDATE scheduled_check_ins SET ${updates.join(', ')} WHERE id = ?
    `).run(...params);

    const updated = await db.prepare(`
      SELECT id, user_id, trip_id, interval_minutes, start_time, end_time, timezone,
             is_active, is_recurring, next_checkin_time, missed_count, escalation_level, created_at
      FROM scheduled_check_ins WHERE id = ?
    `).get(id);

    res.json({
      success: true,
      data: formatScheduleResponse(updated)
    });
  } catch (error) {
    logger.error('Error updating check-in schedule:', error);
    res.status(500).json({ success: false, error: 'Failed to update check-in schedule' });
  }
});

// DELETE /checkin/schedule/:id - Cancel schedule
router.delete('/schedule/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const schedule = await db.prepare(`
      SELECT id, user_id, trip_id, interval_minutes, start_time, end_time, timezone,
             is_active, is_recurring, next_checkin_time, missed_count, escalation_level, created_at
      FROM scheduled_check_ins WHERE id = ? AND user_id = ?
    `).get(id, req.userId);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found'
      });
    }

    await db.prepare(`
      UPDATE scheduled_check_ins
      SET is_active = false, next_checkin_time = NULL
      WHERE id = ?
    `).run(id);

    res.json({
      success: true,
      message: 'Schedule cancelled successfully'
    });
  } catch (error) {
    logger.error('Error cancelling check-in schedule:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel check-in schedule' });
  }
});

// GET /checkin/status/:tripId - Get current check-in status
router.get('/status/:tripId', authenticate, async (req, res) => {
  try {
    const { tripId } = req.params;

    const lastCheckIn = await db.prepare(`
      SELECT id, user_id, trip_id, type, latitude, longitude, address, message, sent_to, created_at
      FROM check_ins
      WHERE user_id = ? AND trip_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(req.userId, tripId);

    const activeSchedule = await db.prepare(`
      SELECT id, user_id, trip_id, interval_minutes, start_time, end_time, timezone,
             is_active, is_recurring, next_checkin_time, missed_count, escalation_level, created_at
      FROM scheduled_check_ins
      WHERE user_id = ? AND trip_id = ? AND is_active = true AND is_recurring = true
      ORDER BY created_at DESC
      LIMIT 1
    `).get(req.userId, tripId);

    let nextScheduledCheckIn = null;
    let missedCount = 0;
    let escalationStatus = 'none';

    if (activeSchedule) {
      nextScheduledCheckIn = activeSchedule.next_checkin_time;
      missedCount = activeSchedule.missed_count || 0;
      escalationStatus = activeSchedule.escalation_level === 0 ? 'none' :
                         activeSchedule.escalation_level === 1 ? 'reminder_sent' :
                         activeSchedule.escalation_level === 2 ? 'contacts_notified' : 'emergency';
    }

    res.json({
      success: true,
      data: {
        lastCheckIn: lastCheckIn ? formatCheckInResponse(lastCheckIn) : null,
        nextScheduledCheckIn,
        missedCount,
        escalationStatus,
        scheduleActive: Boolean(activeSchedule),
        scheduleInterval: activeSchedule ? activeSchedule.interval_minutes : null
      }
    });
  } catch (error) {
    logger.error('Error fetching check-in status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch check-in status' });
  }
});

// POST /checkin - Create safe check-in
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      tripId,
      type = 'safe',
      latitude,
      longitude,
      address,
      message
    } = req.body;

    // Validate type
    const validTypes = ['safe', 'arrived'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid check-in type' 
      });
    }

    // Get user's emergency contacts
    const contacts = await db.prepare(`
      SELECT id, user_id, name, relationship, is_primary, notify_on_checkin,
             notify_on_emergency, prefer_email, prefer_sms, verified, created_at
      FROM emergency_contacts 
      WHERE user_id = ? AND notify_on_checkin = true
    `).all(req.userId);

    // Get user info
    const user = await db.prepare(`
      SELECT id, name, email FROM users WHERE id = ?
    `).get(req.userId);

    // Insert check-in
    const result = await db.prepare(`
      INSERT INTO check_ins (
        user_id, trip_id, type, latitude, longitude, address, message, sent_to
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.userId,
      tripId || null,
      type,
      latitude || null,
      longitude || null,
      address || null,
      message || null,
      JSON.stringify(contacts.map(c => c.id))
    );

    const checkIn = await db.prepare(`
      SELECT id, user_id, trip_id, type, latitude, longitude, address, message, sent_to, created_at
      FROM check_ins WHERE id = ?
    `).get(result.lastInsertRowid);

    // Send notifications to contacts
    if (contacts.length > 0 && user) {
      await notifyEmergencyContacts(contacts, user, checkIn, 'safe');
    }

    // Create in-app notification for successful check-in
    if (tripId) {
      await createNotification(
        req.userId,
        'checkin_reminder',
        'Check-In Recorded',
        'Your safe check-in has been recorded and contacts have been notified.',
        { tripId, checkInId: checkIn.id }
      );
    }

    // Reset missed check-in counter and update next scheduled time
    if (tripId) {
      const activeSchedule = await db.prepare(`
        SELECT id, user_id, trip_id, interval_minutes, start_time, end_time, timezone,
               is_active, is_recurring, next_checkin_time, missed_count, escalation_level, created_at
        FROM scheduled_check_ins
        WHERE user_id = ? AND trip_id = ? AND is_active = true AND is_recurring = true
        ORDER BY created_at DESC
        LIMIT 1
      `).get(req.userId, tripId);

      if (activeSchedule) {
        const intervalMinutes = activeSchedule.interval_minutes;
        const now = new Date();
        const nextCheckin = new Date(now.getTime() + intervalMinutes * 60 * 1000);

        await db.prepare(`
          UPDATE scheduled_check_ins
          SET missed_count = 0,
              escalation_level = 0,
              next_checkin_time = ?
          WHERE id = ?
        `).run(nextCheckin.toISOString(), activeSchedule.id);
      }
    }

    res.status(201).json({
      success: true,
      data: {
        id: checkIn.id,
        userId: checkIn.user_id,
        tripId: checkIn.trip_id,
        type: checkIn.type,
        latitude: checkIn.latitude,
        longitude: checkIn.longitude,
        address: checkIn.address,
        message: checkIn.message,
        sentTo: contacts.map(c => c.id),
        createdAt: checkIn.created_at
      },
      notifiedContacts: contacts.length
    });
  } catch (error) {
    logger.error('Error creating check-in:', error);
    res.status(500).json({ success: false, error: 'Failed to create check-in' });
  }
});

// POST /checkin/emergency - Create emergency alert
router.post('/emergency', authenticate, async (req, res) => {
  try {
    const rateCheck = checkEmergencyRateLimit(req.userId);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many emergency alerts. Please wait before triggering another.`,
          retryAfter: rateCheck.retryAfter
        }
      });
    }

    const {
      tripId,
      latitude,
      longitude,
      address,
      message
    } = req.body;

    // Get ALL emergency contacts (notify_on_emergency is checked in service)
    const contacts = await db.prepare(`
      SELECT id, user_id, name, relationship, is_primary, notify_on_checkin,
             notify_on_emergency, prefer_email, prefer_sms, verified, created_at
      FROM emergency_contacts 
      WHERE user_id = ?
    `).all(req.userId);

    // Get user info
    const user = await db.prepare(`
      SELECT id, name, email FROM users WHERE id = ?
    `).get(req.userId);

    // Insert emergency check-in
    const result = await db.prepare(`
      INSERT INTO check_ins (
        user_id, trip_id, type, latitude, longitude, address, message, sent_to
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.userId,
      tripId || null,
      'emergency',
      latitude || null,
      longitude || null,
      address || null,
      message || 'Emergency alert triggered',
      JSON.stringify(contacts.map(c => c.id))
    );

    const checkIn = await db.prepare(`
      SELECT id, user_id, trip_id, type, latitude, longitude, address, message, sent_to, created_at
      FROM check_ins WHERE id = ?
    `).get(result.lastInsertRowid);

    // Send emergency notifications to ALL contacts
    const notificationResults = [];
    if (contacts.length > 0 && user) {
      for (const contact of contacts) {
        if (contact.notify_on_emergency && contact.email) {
          notificationResults.push(contact.email);
        }
      }
      await notifyEmergencyContacts(contacts, user, checkIn, 'emergency');
    }

    // Cancel active scheduled check-ins (user is safe now)
    await db.prepare(`
      UPDATE scheduled_check_ins 
      SET is_active = false 
      WHERE user_id = ? AND is_active = true
    `).run(req.userId);

    res.status(201).json({
      success: true,
      data: {
        id: checkIn.id,
        userId: checkIn.user_id,
        tripId: checkIn.trip_id,
        type: checkIn.type,
        latitude: checkIn.latitude,
        longitude: checkIn.longitude,
        address: checkIn.address,
        message: checkIn.message,
        sentTo: contacts.map(c => c.id),
        createdAt: checkIn.created_at
      },
      notifiedContacts: notificationResults.length,
      emergencyResources: {
        message: 'If you are in immediate danger, contact local emergency services.',
        tip: 'Stay calm and find a safe location.'
      }
    });
  } catch (error) {
    logger.error('Error creating emergency alert:', error);
    res.status(500).json({ success: false, error: 'Failed to create emergency alert' });
  }
});

// GET /checkin/history/:tripId - Get check-in history for a trip
router.get('/history/:tripId', authenticate, async (req, res) => {
  try {
    const { tripId } = req.params;

    const checkIns = await db.prepare(`
      SELECT id, user_id, trip_id, type, latitude, longitude, address, message, sent_to, created_at
      FROM check_ins 
      WHERE user_id = ? AND trip_id = ?
      ORDER BY created_at DESC
    `).all(req.userId, tripId);

    const formattedCheckIns = checkIns.map(c => ({
      id: c.id,
      userId: c.user_id,
      tripId: c.trip_id,
      type: c.type,
      latitude: c.latitude,
      longitude: c.longitude,
      address: c.address,
      message: c.message,
      sentTo: c.sent_to ? JSON.parse(c.sent_to) : [],
      createdAt: c.created_at
    }));

    res.json({
      success: true,
      data: formattedCheckIns
    });
  } catch (error) {
    logger.error('Error fetching check-in history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch check-in history' });
  }
});

// GET /checkin/history - Get all user's check-ins
router.get('/history', authenticate, async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const checkIns = await db.prepare(`
      SELECT id, user_id, trip_id, type, latitude, longitude, address, message, sent_to, created_at
      FROM check_ins 
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(req.userId, parseInt(limit), offset);

    const countResult = await db.prepare(`
      SELECT COUNT(*) as total FROM check_ins WHERE user_id = ?
    `).get(req.userId);

    const formattedCheckIns = checkIns.map(c => ({
      id: c.id,
      userId: c.user_id,
      tripId: c.trip_id,
      type: c.type,
      latitude: c.latitude,
      longitude: c.longitude,
      address: c.address,
      message: c.message,
      sentTo: c.sent_to ? JSON.parse(c.sent_to) : [],
      createdAt: c.created_at
    }));

    res.json({
      success: true,
      data: formattedCheckIns,
      meta: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total
      }
    });
  } catch (error) {
    logger.error('Error fetching check-in history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch check-in history' });
  }
});

// POST /scheduled-checkins - Schedule a check-in
router.post('/scheduled', authenticate, checkinActionLimiter, async (req, res) => {
  try {
    const userId = req.userId;
    const {
      tripId,
      scheduledTime,
      timezone = 'UTC',
      frequency = 'one-time',
      intervalMinutes
    } = req.body;

    // Feature gate: Explorer cannot use scheduled check-ins
    const plan = await getUserPlan(userId);
    if (plan === PLAN_TIERS.EXPLORER) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FEATURE_NOT_INCLUDED',
          message: 'Scheduled check-ins require the Guardian or Navigator plan.',
          currentPlan: plan,
          requiredFeature: FEATURES.SCHEDULED_CHECKIN
        }
      });
    }

    // Validation
    if (!scheduledTime) {
      return res.status(400).json({ 
        success: false, 
        error: 'Scheduled time is required' 
      });
    }

    const scheduledDate = new Date(scheduledTime);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid scheduled time format' 
      });
    }

    if (scheduledDate <= new Date()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Scheduled time must be in the future' 
      });
    }

    // Guardian plan: max 5 active per trip; Navigator: unlimited
    if (plan !== PLAN_TIERS.NAVIGATOR) {
      const existingActive = await db.prepare(`
        SELECT COUNT(*) as count FROM scheduled_check_ins 
        WHERE user_id = ? AND trip_id = ? AND is_active = true
      `).get(userId, tripId || null);

      if (existingActive.count >= 5) {
        return res.status(400).json({ 
          success: false, 
          error: 'Maximum of 5 active scheduled check-ins per trip on the Guardian plan' 
        });
      }
    }

    // Resolve frequency to interval_minutes
    const FREQ_TO_INTERVAL = {
      'one-time': null,
      'daily': 1440,
      '12h': 720,
      '6h': 360,
      '4h': 240,
      'custom': intervalMinutes ? parseInt(intervalMinutes) : null
    };
    const resolvedInterval = FREQ_TO_INTERVAL[frequency] ?? null;
    const isRecurring = resolvedInterval !== null;

    // Insert scheduled check-in
    const result = await db.prepare(`
      INSERT INTO scheduled_check_ins (
        user_id, trip_id, scheduled_time, timezone, is_active,
        is_recurring, interval_minutes, next_checkin_time
      ) VALUES (?, ?, ?, ?, true, ?, ?, ?)
    `).run(
      userId,
      tripId || null,
      scheduledTime,
      timezone,
      isRecurring ? 1 : 0,
      resolvedInterval,
      isRecurring ? scheduledTime : null
    );

    const scheduledCheckIn = await db.prepare(`
      SELECT id, user_id, trip_id, scheduled_time, timezone, is_active, missed_at,
             final_warning_sent, sos_triggered, interval_minutes, start_time, end_time,
             is_recurring, next_checkin_time, missed_count, escalation_level, created_at
      FROM scheduled_check_ins WHERE id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      data: {
        id: scheduledCheckIn.id,
        userId: scheduledCheckIn.user_id,
        tripId: scheduledCheckIn.trip_id,
        scheduledTime: scheduledCheckIn.scheduled_time,
        timezone: scheduledCheckIn.timezone,
        isActive: Boolean(scheduledCheckIn.is_active),
        isRecurring: Boolean(scheduledCheckIn.is_recurring),
        intervalMinutes: scheduledCheckIn.interval_minutes,
        frequency,
        missedAt: scheduledCheckIn.missed_at,
        createdAt: scheduledCheckIn.created_at
      }
    });
  } catch (error) {
    logger.error('Error creating scheduled check-in:', error);
    res.status(500).json({ success: false, error: 'Failed to create scheduled check-in' });
  }
});

// PUT /scheduled-checkins/:id - Update scheduled check-in
router.put('/scheduled/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      scheduledTime,
      timezone,
      isActive
    } = req.body;

    // Check ownership
    const scheduledCheckIn = await db.prepare(`
      SELECT id, user_id, trip_id, scheduled_time, timezone, is_active, missed_at,
             final_warning_sent, sos_triggered, interval_minutes, start_time, end_time,
             is_recurring, next_checkin_time, missed_count, escalation_level, created_at
      FROM scheduled_check_ins WHERE id = ? AND user_id = ?
    `).get(id, req.userId);

    if (!scheduledCheckIn) {
      return res.status(404).json({ success: false, error: 'Scheduled check-in not found' });
    }

    // Validate new time if provided
    if (scheduledTime) {
      const scheduledDate = new Date(scheduledTime);
      if (isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid scheduled time format' 
        });
      }

      if (scheduledDate <= new Date()) {
        return res.status(400).json({ 
          success: false, 
          error: 'Scheduled time must be in the future' 
        });
      }
    }

    // Build update query
    const updates = [];
    const params = [];

    if (scheduledTime !== undefined) {
      updates.push('scheduled_time = ?');
      params.push(scheduledTime);
    }
    if (timezone !== undefined) {
      updates.push('timezone = ?');
      params.push(timezone);
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(!!isActive);
    }

    if (updates.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No fields to update' 
      });
    }

    params.push(id);

    await db.prepare(`
      UPDATE scheduled_check_ins SET ${updates.join(', ')} WHERE id = ?
    `).run(...params);

    const updated = await db.prepare(`
      SELECT id, user_id, trip_id, scheduled_time, timezone, is_active, missed_at,
             final_warning_sent, sos_triggered, interval_minutes, start_time, end_time,
             is_recurring, next_checkin_time, missed_count, escalation_level, created_at
      FROM scheduled_check_ins WHERE id = ?
    `).get(id);

    res.json({
      success: true,
      data: {
        id: updated.id,
        userId: updated.user_id,
        tripId: updated.trip_id,
        scheduledTime: updated.scheduled_time,
        timezone: updated.timezone,
        isActive: Boolean(updated.is_active),
        missedAt: updated.missed_at,
        createdAt: updated.created_at
      }
    });
  } catch (error) {
    logger.error('Error updating scheduled check-in:', error);
    res.status(500).json({ success: false, error: 'Failed to update scheduled check-in' });
  }
});

// GET /scheduled-checkins - Get user's scheduled check-ins
router.get('/scheduled', authenticate, async (req, res) => {
  try {
    const { tripId, activeOnly = 'true' } = req.query;

    let query = `
      SELECT id, user_id, trip_id, scheduled_time, timezone, is_active, missed_at,
             final_warning_sent, sos_triggered, interval_minutes, start_time, end_time,
             is_recurring, next_checkin_time, missed_count, escalation_level, created_at
      FROM scheduled_check_ins 
      WHERE user_id = ?
    `;
    const params = [req.userId];

    if (tripId) {
      query += ' AND trip_id = ?';
      params.push(tripId);
    }

    if (activeOnly === 'true') {
      query += ' AND is_active = true';
    }

    query += ' ORDER BY scheduled_time ASC';

    const scheduledCheckIns = await db.prepare(query).all(...params);

    const formatted = scheduledCheckIns.map(s => ({
      id: s.id,
      userId: s.user_id,
      tripId: s.trip_id,
      scheduledTime: s.scheduled_time,
      timezone: s.timezone,
      isActive: Boolean(s.is_active),
      missedAt: s.missed_at,
      createdAt: s.created_at
    }));

    res.json({
      success: true,
      data: formatted
    });
  } catch (error) {
    logger.error('Error fetching scheduled check-ins:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch scheduled check-ins' });
  }
});

// DELETE /scheduled-checkins/:id - Cancel scheduled check-in
router.delete('/scheduled/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Check ownership
    const scheduledCheckIn = await db.prepare(`
      SELECT user_id FROM scheduled_check_ins WHERE id = ?
    `).get(id);

    if (!scheduledCheckIn) {
      return res.status(404).json({ success: false, error: 'Scheduled check-in not found' });
    }

    if (scheduledCheckIn.user_id !== req.userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    // Soft delete - set inactive
    await db.prepare(`
      UPDATE scheduled_check_ins SET is_active = false WHERE id = ?
    `).run(id);

    res.json({ success: true, message: 'Scheduled check-in cancelled' });
  } catch (error) {
    logger.error('Error cancelling scheduled check-in:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel scheduled check-in' });
  }
});

// POST /checkin/trigger-missed - Manually trigger missed check-in (for testing)
router.post('/trigger-missed/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Check ownership
    const scheduledCheckIn = await db.prepare(`
      SELECT id, user_id, trip_id, scheduled_time, timezone, is_active, missed_at,
             final_warning_sent, sos_triggered, interval_minutes, start_time, end_time,
             is_recurring, next_checkin_time, missed_count, escalation_level, created_at
      FROM scheduled_check_ins WHERE id = ? AND user_id = ?
    `).get(id, req.userId);

    if (!scheduledCheckIn) {
      return res.status(404).json({ success: false, error: 'Scheduled check-in not found' });
    }

    // Get user's emergency contacts
    const contacts = await db.prepare(`
      SELECT id, user_id, name, relationship, is_primary, notify_on_checkin,
             notify_on_emergency, prefer_email, prefer_sms, verified, created_at
      FROM emergency_contacts 
      WHERE user_id = ? AND notify_on_emergency = true
    `).all(req.userId);

    // Get user info
    const user = await db.prepare(`
      SELECT id, name, email FROM users WHERE id = ?
    `).get(req.userId);

    // Mark as missed
    await db.prepare(`
      UPDATE scheduled_check_ins SET missed_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(id);

    // Send missed notification
    if (contacts.length > 0 && user) {
      await notifyEmergencyContacts(contacts, user, scheduledCheckIn, 'missed');
    }

    res.json({
      success: true,
      message: 'Missed check-in triggered, contacts notified',
      notifiedContacts: contacts.length
    });
  } catch (error) {
    logger.error('Error triggering missed check-in:', error);
    res.status(500).json({ success: false, error: 'Failed to trigger missed check-in' });
  }
});

// POST /checkin/scheduled/:id/confirm - Confirm a scheduled check-in (I'm safe)
router.post('/scheduled/:id/confirm', authenticate, checkinActionLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { latitude, longitude, address, message } = req.body;

    const scheduledCheckIn = await db.prepare(`
      SELECT id, user_id, is_active, is_recurring, interval_minutes, missed_at, missed_count, escalation_level
      FROM scheduled_check_ins WHERE id = ? AND user_id = ?
    `).get(id, userId);

    if (!scheduledCheckIn) {
      return res.status(404).json({ success: false, error: 'Scheduled check-in not found' });
    }

    // Create confirmation record
    const result = await db.prepare(`
      INSERT INTO check_in_confirmations (scheduled_check_in_id, user_id, latitude, longitude, address, message)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, userId, latitude || null, longitude || null, address || null, message || null);

    // Reset missed/warning state
    const updates = ['missed_at = NULL', 'final_warning_sent = false', 'sos_triggered = false',
                     'missed_count = 0', 'escalation_level = 0'];
    const params = [];

    // Advance next check-in time if recurring
    if (scheduledCheckIn.is_recurring && scheduledCheckIn.interval_minutes) {
      const nextTime = new Date(Date.now() + scheduledCheckIn.interval_minutes * 60 * 1000);
      updates.push('next_checkin_time = ?');
      params.push(nextTime.toISOString());
    }

    params.push(id);
    await db.prepare(`
      UPDATE scheduled_check_ins SET ${updates.join(', ')} WHERE id = ?
    `).run(...params);

    broadcastToUser(userId, {
      type: 'checkin_confirmed',
      scheduledCheckInId: id,
      message: "Check-in confirmed. You're safe!"
    });

    res.json({
      success: true,
      message: "Check-in confirmed. Stay safe!",
      confirmationId: result.lastInsertRowid
    });
  } catch (error) {
    logger.error('Error confirming check-in:', error);
    res.status(500).json({ success: false, error: 'Failed to confirm check-in' });
  }
});

// POST /checkin/scheduled/:id/snooze - Snooze a scheduled check-in
router.post('/scheduled/:id/snooze', authenticate, checkinActionLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { minutes = 15 } = req.body;

    const validSnooze = [15, 30, 60];
    const snoozeMin = parseInt(minutes);
    if (!validSnooze.includes(snoozeMin)) {
      return res.status(400).json({ success: false, error: 'Snooze must be 15, 30, or 60 minutes' });
    }

    const scheduledCheckIn = await db.prepare(`
      SELECT id, user_id, scheduled_time, next_checkin_time
      FROM scheduled_check_ins WHERE id = ? AND user_id = ?
    `).get(id, userId);

    if (!scheduledCheckIn) {
      return res.status(404).json({ success: false, error: 'Scheduled check-in not found' });
    }

    const snoozeUntil = new Date(Date.now() + snoozeMin * 60 * 1000);

    // Create confirmation record marking the snooze
    await db.prepare(`
      INSERT INTO check_in_confirmations (scheduled_check_in_id, user_id, snooze_until, message)
      VALUES (?, ?, ?, ?)
    `).run(id, userId, snoozeUntil.toISOString(), `Snoozed for ${snoozeMin} minutes`);

    // Advance the scheduled time
    await db.prepare(`
      UPDATE scheduled_check_ins
      SET scheduled_time = ?, next_checkin_time = ?, missed_at = NULL,
          final_warning_sent = false
      WHERE id = ?
    `).run(snoozeUntil.toISOString(), snoozeUntil.toISOString(), id);

    broadcastToUser(userId, {
      type: 'checkin_snoozed',
      scheduledCheckInId: id,
      snoozeUntil: snoozeUntil.toISOString(),
      message: `Check-in snoozed for ${snoozeMin} minutes.`
    });

    res.json({
      success: true,
      message: `Check-in snoozed for ${snoozeMin} minutes`,
      snoozeUntil: snoozeUntil.toISOString()
    });
  } catch (error) {
    logger.error('Error snoozing check-in:', error);
    res.status(500).json({ success: false, error: 'Failed to snooze check-in' });
  }
});

// GET /checkin/scheduled/:id/status - Get status of a single scheduled check-in
router.get('/scheduled/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const checkIn = await db.prepare(`
      SELECT id, user_id, trip_id, scheduled_time, timezone, is_active, missed_at,
             final_warning_sent, sos_triggered, interval_minutes, is_recurring,
             next_checkin_time, missed_count, escalation_level, created_at
      FROM scheduled_check_ins
      WHERE id = ? AND user_id = ?
    `).get(id, userId);

    if (!checkIn) {
      return res.status(404).json({ success: false, error: 'Scheduled check-in not found' });
    }

    const now = new Date();
    const scheduledTime = new Date(checkIn.scheduled_time);
    const effectiveTime = checkIn.next_checkin_time
      ? new Date(checkIn.next_checkin_time)
      : scheduledTime;

    let status = 'upcoming';
    if (!checkIn.is_active) {
      status = 'cancelled';
    } else if (checkIn.missed_at) {
      status = 'missed';
    } else if (checkIn.sos_triggered) {
      status = 'sos_triggered';
    } else if (effectiveTime < now) {
      status = 'overdue';
    }

    // Most recent confirmation
    const lastConfirmation = await db.prepare(`
      SELECT id, created_at, latitude, longitude, address, message
      FROM check_in_confirmations
      WHERE scheduled_check_in_id = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(id);

    res.json({
      success: true,
      data: {
        id: checkIn.id,
        userId: checkIn.user_id,
        tripId: checkIn.trip_id,
        scheduledTime: checkIn.scheduled_time,
        nextCheckinTime: checkIn.next_checkin_time,
        timezone: checkIn.timezone,
        isActive: Boolean(checkIn.is_active),
        isRecurring: Boolean(checkIn.is_recurring),
        intervalMinutes: checkIn.interval_minutes,
        missedAt: checkIn.missed_at,
        missedCount: checkIn.missed_count || 0,
        escalationLevel: checkIn.escalation_level || 0,
        sosTriggered: Boolean(checkIn.sos_triggered),
        status,
        lastConfirmation: lastConfirmation || null
      }
    });
  } catch (error) {
    logger.error('Error fetching check-in status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch check-in status' });
  }
});

export default router;
