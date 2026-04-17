import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import db from '../db.js';
import logger from '../services/logger.js';
import { createNotification } from '../services/notificationService.js';

const router = express.Router();
router.use(authenticate);

// Rate limit: 60 requests per minute per IP for meetup reads, 20 per minute for mutations
const readLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// ------------------------------------------------------------------
// Safety: check that a proposed meetup time is reasonably "safe"
// (daytime hours UTC+0, 07:00–22:00). Returns a warning string or null.
// ------------------------------------------------------------------
function getMeetupSafetyWarning(meetupDate) {
  const hour = new Date(meetupDate).getUTCHours();
  if (hour < 7 || hour >= 22) {
    return 'This meetup is scheduled outside typical daytime hours (7am–10pm). Consider meeting during daylight for added safety.';
  }
  return null;
}

// GET /meetups  — list upcoming meetups (optionally filter by destination)
router.get('/', readLimiter, [
  query('destination').optional().isString().trim().isLength({ max: 120 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
], handleValidationErrors, async (req, res) => {
  try {
    const userId = req.userId;
    const destination = req.query.destination;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    let destClause = '';
    const params = [];

    if (destination) {
      destClause = `AND LOWER(bm.destination) LIKE LOWER($${params.length + 1})`;
      params.push(`%${destination}%`);
    }

    const meetups = await db.prepare(`
      SELECT
        bm.id,
        bm.organizer_id,
        bm.title,
        bm.description,
        bm.destination,
        bm.location_name,
        bm.meetup_date,
        bm.max_attendees,
        bm.is_public,
        bm.safety_notes,
        bm.status,
        bm.created_at,
        u.name AS organizer_name,
        (SELECT COUNT(*) FROM buddy_meetup_rsvps r WHERE r.meetup_id = bm.id AND r.status = 'going') AS attendee_count,
        (SELECT status FROM buddy_meetup_rsvps r WHERE r.meetup_id = bm.id AND r.user_id = ?) AS my_rsvp
      FROM buddy_meetups bm
      JOIN users u ON bm.organizer_id = u.id
      WHERE bm.status IN ('open', 'full')
        AND bm.meetup_date >= CURRENT_TIMESTAMP
        AND bm.is_public = true
        ${destClause}
      ORDER BY bm.meetup_date ASC
      LIMIT ? OFFSET ?
    `).all(userId, ...(destination ? [`%${destination}%`] : []), limit, offset);

    res.json({ success: true, data: meetups });
  } catch (error) {
    logger.error(`[Meetups] Failed to list meetups: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to list meetups' });
  }
});

// POST /meetups  — create a new meetup (requires at least 3 attendees capacity)
router.post('/', writeLimiter, [
  body('title').isString().trim().isLength({ min: 3, max: 120 }).withMessage('Title must be 3–120 characters'),
  body('description').optional().isString().trim().isLength({ max: 1000 }),
  body('destination').isString().trim().isLength({ min: 2, max: 120 }).withMessage('Destination is required'),
  body('locationName').optional().isString().trim().isLength({ max: 200 }),
  body('meetupDate').isISO8601().withMessage('meetupDate must be a valid ISO 8601 date'),
  body('maxAttendees').optional().isInt({ min: 3, max: 50 }).withMessage('maxAttendees must be 3–50'),
  body('isPublic').optional().isBoolean(),
  body('safetyNotes').optional().isString().trim().isLength({ max: 500 }),
], handleValidationErrors, async (req, res) => {
  try {
    const userId = req.userId;
    const {
      title, description, destination, locationName,
      meetupDate, maxAttendees = 10, isPublic = true, safetyNotes,
    } = req.body;

    if (new Date(meetupDate) <= new Date()) {
      return res.status(400).json({ success: false, error: 'meetupDate must be in the future' });
    }

    const safetyWarning = getMeetupSafetyWarning(meetupDate);
    const combinedSafetyNotes = [
      'Always meet in public places with other people around.',
      'Share your meetup plans with a trusted contact.',
      safetyNotes,
      safetyWarning,
    ].filter(Boolean).join(' ');

    const result = await db.prepare(`
      INSERT INTO buddy_meetups
        (organizer_id, title, description, destination, location_name, meetup_date, max_attendees, is_public, safety_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId, title.trim(), description?.trim() || null, destination.trim(),
      locationName?.trim() || null, meetupDate, maxAttendees,
      isPublic ? 1 : 0, combinedSafetyNotes,
    );

    // Organizer auto-RSVPs as 'going'
    await db.prepare(`
      INSERT INTO buddy_meetup_rsvps (meetup_id, user_id, status) VALUES (?, ?, 'going')
    `).run(result.lastInsertRowid, userId);

    const meetup = await db.prepare(`
      SELECT bm.*, u.name AS organizer_name,
        (SELECT COUNT(*) FROM buddy_meetup_rsvps r WHERE r.meetup_id = bm.id AND r.status = 'going') AS attendee_count
      FROM buddy_meetups bm
      JOIN users u ON bm.organizer_id = u.id
      WHERE bm.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      data: meetup,
      safetyWarning: safetyWarning || null,
    });
  } catch (error) {
    logger.error(`[Meetups] Failed to create meetup: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to create meetup' });
  }
});

// GET /meetups/:id — get single meetup with attendees
router.get('/:id', readLimiter, [
  param('id').isNumeric(),
], handleValidationErrors, async (req, res) => {
  try {
    const meetupId = parseInt(req.params.id, 10);
    const userId = req.userId;

    const meetup = await db.prepare(`
      SELECT bm.*, u.name AS organizer_name,
        (SELECT COUNT(*) FROM buddy_meetup_rsvps r WHERE r.meetup_id = bm.id AND r.status = 'going') AS attendee_count,
        (SELECT status FROM buddy_meetup_rsvps r WHERE r.meetup_id = bm.id AND r.user_id = ?) AS my_rsvp
      FROM buddy_meetups bm
      JOIN users u ON bm.organizer_id = u.id
      WHERE bm.id = ?
    `).get(userId, meetupId);

    if (!meetup) {
      return res.status(404).json({ success: false, error: 'Meetup not found' });
    }

    const attendees = await db.prepare(`
      SELECT r.status, r.created_at, u.name, u.id AS user_id
      FROM buddy_meetup_rsvps r
      JOIN users u ON r.user_id = u.id
      WHERE r.meetup_id = ? AND r.status = 'going'
      ORDER BY r.created_at ASC
    `).all(meetupId);

    res.json({ success: true, data: { ...meetup, attendees } });
  } catch (error) {
    logger.error(`[Meetups] Failed to get meetup: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to get meetup' });
  }
});

// PUT /meetups/:id/rsvp — RSVP to a meetup
router.put('/:id/rsvp', writeLimiter, [
  param('id').isNumeric(),
  body('status').isIn(['going', 'maybe', 'not_going']).withMessage('status must be going, maybe, or not_going'),
], handleValidationErrors, async (req, res) => {
  try {
    const meetupId = parseInt(req.params.id, 10);
    const userId = req.userId;
    const { status } = req.body;

    const meetup = await db.prepare(`
      SELECT id, status AS meetup_status, max_attendees, organizer_id
      FROM buddy_meetups WHERE id = ?
    `).get(meetupId);

    if (!meetup) {
      return res.status(404).json({ success: false, error: 'Meetup not found' });
    }

    if (meetup.meetup_status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'Meetup is cancelled' });
    }

    // Enforce attendee cap for new 'going' RSVPs
    if (status === 'going') {
      const existing = await db.prepare(`
        SELECT id FROM buddy_meetup_rsvps WHERE meetup_id = ? AND user_id = ?
      `).get(meetupId, userId);

      if (!existing) {
        const goingCount = await db.prepare(`
          SELECT COUNT(*) AS cnt FROM buddy_meetup_rsvps WHERE meetup_id = ? AND status = 'going'
        `).get(meetupId);

        if (goingCount.cnt >= meetup.max_attendees) {
          return res.status(400).json({ success: false, error: 'Meetup is full' });
        }
      }
    }

    await db.prepare(`
      INSERT INTO buddy_meetup_rsvps (meetup_id, user_id, status)
      VALUES (?, ?, ?)
      ON CONFLICT (meetup_id, user_id)
      DO UPDATE SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP
    `).run(meetupId, userId, status);

    // Update meetup status based on capacity
    const goingCount = await db.prepare(`
      SELECT COUNT(*) AS cnt FROM buddy_meetup_rsvps WHERE meetup_id = ? AND status = 'going'
    `).get(meetupId);

    const newMeetupStatus = goingCount.cnt >= meetup.max_attendees ? 'full' : 'open';
    await db.prepare(`
      UPDATE buddy_meetups SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(newMeetupStatus, meetupId);

    // Notify organizer of new RSVP (not if organizer is RSVPing themselves)
    if (status === 'going' && userId !== meetup.organizer_id) {
      const rsvpUser = await db.prepare('SELECT name FROM users WHERE id = ?').get(userId);
      await createNotification(
        meetup.organizer_id,
        'meetup_rsvp',
        'New meetup RSVP',
        `${rsvpUser?.name || 'A traveler'} is going to your meetup`,
        { meetupId, userId }
      );
    }

    res.json({
      success: true,
      data: { meetupId, status, attendeeCount: goingCount.cnt, meetupStatus: newMeetupStatus },
    });
  } catch (error) {
    logger.error(`[Meetups] Failed to RSVP: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to RSVP' });
  }
});

// DELETE /meetups/:id — cancel a meetup (organizer only)
router.delete('/:id', writeLimiter, [
  param('id').isNumeric(),
], handleValidationErrors, async (req, res) => {
  try {
    const meetupId = parseInt(req.params.id, 10);
    const userId = req.userId;

    const meetup = await db.prepare(
      'SELECT id, organizer_id FROM buddy_meetups WHERE id = ?'
    ).get(meetupId);

    if (!meetup) {
      return res.status(404).json({ success: false, error: 'Meetup not found' });
    }

    if (meetup.organizer_id !== userId) {
      return res.status(403).json({ success: false, error: 'Only the organizer can cancel this meetup' });
    }

    await db.prepare(
      `UPDATE buddy_meetups SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(meetupId);

    res.json({ success: true, message: 'Meetup cancelled' });
  } catch (error) {
    logger.error(`[Meetups] Failed to cancel meetup: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to cancel meetup' });
  }
});

export default router;
