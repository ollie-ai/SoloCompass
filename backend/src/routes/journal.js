import express from 'express';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { requireAuth } from '../middleware/auth.js';
import { sanitizeAll } from '../middleware/validate.js';
import db from '../db.js';
import logger from '../services/logger.js';

const router = express.Router();

const journalMutateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many journal requests. Please slow down.' }
});

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.array()[0].msg } });
  }
  next();
};

const VALID_MOODS = ['amazing', 'good', 'okay', 'difficult', 'terrible'];

// GET /api/journal/:tripId - Get all journal entries for a trip
router.get('/:tripId', requireAuth, async (req, res) => {
  try {
    const { tripId } = req.params;

    const trip = await db.prepare('SELECT id FROM trips WHERE id = ? AND user_id = ?').get(tripId, req.userId);
    if (!trip) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Trip not found' } });
    }

    const entries = await db.prepare(`
      SELECT je.id, je.trip_id, je.title, je.content, je.mood, je.weather, je.location,
             je.latitude, je.longitude, je.entry_date, je.is_private, je.created_at, je.updated_at
      FROM journal_entries je
      WHERE je.trip_id = ? AND je.user_id = ?
      ORDER BY je.entry_date DESC, je.created_at DESC
    `).all(tripId, req.userId);

    // Attach photo counts - SQLite compatible
    const entryIds = entries.map(e => e.id);
    let photoCounts = {};
    if (entryIds.length > 0) {
      const placeholders = entryIds.map(() => '?').join(',');
      const photos = await db.prepare(`
        SELECT entry_id, COUNT(*) as count FROM journal_photos
        WHERE entry_id IN (${placeholders})
        GROUP BY entry_id
      `).all(...entryIds);
      photoCounts = Object.fromEntries(photos.map(p => [p.entry_id, parseInt(p.count)]));
    }

    const formatted = entries.map(e => ({
      id: e.id,
      tripId: e.trip_id,
      title: e.title,
      content: e.content,
      mood: e.mood,
      weather: e.weather,
      location: e.location,
      latitude: e.latitude,
      longitude: e.longitude,
      entryDate: e.entry_date,
      isPrivate: Boolean(e.is_private),
      photoCount: photoCounts[e.id] || 0,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    logger.error('[Journal] Get entries error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch journal entries' } });
  }
});

// GET /api/journal/:tripId/:entryId - Get single entry with photos
router.get('/:tripId/:entryId', requireAuth, async (req, res) => {
  try {
    const { tripId, entryId } = req.params;

    const entry = await db.prepare(`
      SELECT id, trip_id, title, content, mood, weather, location, latitude, longitude,
             entry_date, is_private, created_at, updated_at
      FROM journal_entries WHERE id = ? AND trip_id = ? AND user_id = ?
    `).get(entryId, tripId, req.userId);

    if (!entry) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Journal entry not found' } });
    }

    const photos = await db.prepare(`
      SELECT id, file_url, caption, taken_at, created_at FROM journal_photos
      WHERE entry_id = ? ORDER BY created_at ASC
    `).all(entryId);

    res.json({
      success: true,
      data: {
        id: entry.id,
        tripId: entry.trip_id,
        title: entry.title,
        content: entry.content,
        mood: entry.mood,
        weather: entry.weather,
        location: entry.location,
        latitude: entry.latitude,
        longitude: entry.longitude,
        entryDate: entry.entry_date,
        isPrivate: Boolean(entry.is_private),
        photos: photos.map(p => ({
          id: p.id,
          fileUrl: p.file_url,
          caption: p.caption,
          takenAt: p.taken_at,
          createdAt: p.created_at,
        })),
        createdAt: entry.created_at,
        updatedAt: entry.updated_at,
      }
    });
  } catch (error) {
    logger.error('[Journal] Get entry error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch journal entry' } });
  }
});

// POST /api/journal/:tripId - Create a journal entry
router.post('/:tripId', journalMutateLimiter, requireAuth,
  sanitizeAll(['title', 'content', 'location', 'weather']),
  [
    body('title').notEmpty().withMessage('Title is required').isLength({ max: 255 }),
    body('content').optional(),
    body('mood').optional().isIn(VALID_MOODS).withMessage(`Mood must be one of: ${VALID_MOODS.join(', ')}`),
    body('entryDate').optional().isISO8601().withMessage('Invalid date format'),
    body('isPrivate').optional().isBoolean(),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { tripId } = req.params;
      const { title, content, mood, weather, location, latitude, longitude, entryDate, isPrivate } = req.body;

      const trip = await db.prepare('SELECT id FROM trips WHERE id = ? AND user_id = ?').get(tripId, req.userId);
      if (!trip) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Trip not found' } });
      }

      const result = await db.prepare(`
        INSERT INTO journal_entries (trip_id, user_id, title, content, mood, weather, location, latitude, longitude, entry_date, is_private)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tripId, req.userId, title, content || null, mood || null, weather || null,
        location || null, latitude || null, longitude || null,
        entryDate || new Date().toISOString().split('T')[0],
        isPrivate || false
      );

      const entry = await db.prepare(`
        SELECT id, trip_id, title, content, mood, weather, location, latitude, longitude,
               entry_date, is_private, created_at, updated_at
        FROM journal_entries WHERE id = ?
      `).get(result.lastInsertRowid);

      logger.info(`[Journal] Created entry ${entry.id} for trip ${tripId}`);
      res.status(201).json({
        success: true,
        data: {
          id: entry.id, tripId: entry.trip_id, title: entry.title, content: entry.content,
          mood: entry.mood, weather: entry.weather, location: entry.location,
          latitude: entry.latitude, longitude: entry.longitude, entryDate: entry.entry_date,
          isPrivate: Boolean(entry.is_private), photos: [], createdAt: entry.created_at, updatedAt: entry.updated_at,
        }
      });
    } catch (error) {
      logger.error('[Journal] Create entry error:', error);
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create journal entry' } });
    }
  }
);

// PUT /api/journal/:tripId/:entryId - Update a journal entry
router.put('/:tripId/:entryId', journalMutateLimiter, requireAuth,
  sanitizeAll(['title', 'content', 'location', 'weather']),
  [
    body('title').optional().notEmpty().isLength({ max: 255 }),
    body('mood').optional().isIn(VALID_MOODS),
    body('entryDate').optional().isISO8601(),
    body('isPrivate').optional().isBoolean(),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { tripId, entryId } = req.params;
      const { title, content, mood, weather, location, latitude, longitude, entryDate, isPrivate } = req.body;

      const existing = await db.prepare('SELECT id FROM journal_entries WHERE id = ? AND trip_id = ? AND user_id = ?').get(entryId, tripId, req.userId);
      if (!existing) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Journal entry not found' } });
      }

      const updates = ['updated_at = CURRENT_TIMESTAMP'];
      const params = [];
      if (title !== undefined) { updates.push('title = ?'); params.push(title); }
      if (content !== undefined) { updates.push('content = ?'); params.push(content); }
      if (mood !== undefined) { updates.push('mood = ?'); params.push(mood); }
      if (weather !== undefined) { updates.push('weather = ?'); params.push(weather); }
      if (location !== undefined) { updates.push('location = ?'); params.push(location); }
      if (latitude !== undefined) { updates.push('latitude = ?'); params.push(latitude); }
      if (longitude !== undefined) { updates.push('longitude = ?'); params.push(longitude); }
      if (entryDate !== undefined) { updates.push('entry_date = ?'); params.push(entryDate); }
      if (isPrivate !== undefined) { updates.push('is_private = ?'); params.push(isPrivate); }

      params.push(entryId);
      await db.prepare(`UPDATE journal_entries SET ${updates.join(', ')} WHERE id = ?`).run(...params);

      const entry = await db.prepare(`
        SELECT id, trip_id, title, content, mood, weather, location, latitude, longitude,
               entry_date, is_private, created_at, updated_at
        FROM journal_entries WHERE id = ?
      `).get(entryId);

      const photos = await db.prepare('SELECT id, file_url, caption, taken_at, created_at FROM journal_photos WHERE entry_id = ? ORDER BY created_at ASC').all(entryId);

      res.json({
        success: true,
        data: {
          id: entry.id, tripId: entry.trip_id, title: entry.title, content: entry.content,
          mood: entry.mood, weather: entry.weather, location: entry.location,
          latitude: entry.latitude, longitude: entry.longitude, entryDate: entry.entry_date,
          isPrivate: Boolean(entry.is_private),
          photos: photos.map(p => ({ id: p.id, fileUrl: p.file_url, caption: p.caption, takenAt: p.taken_at, createdAt: p.created_at })),
          createdAt: entry.created_at, updatedAt: entry.updated_at,
        }
      });
    } catch (error) {
      logger.error('[Journal] Update entry error:', error);
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update journal entry' } });
    }
  }
);

// DELETE /api/journal/:tripId/:entryId - Delete a journal entry
router.delete('/:tripId/:entryId', journalMutateLimiter, requireAuth, async (req, res) => {
  try {
    const { tripId, entryId } = req.params;

    const existing = await db.prepare('SELECT id FROM journal_entries WHERE id = ? AND trip_id = ? AND user_id = ?').get(entryId, tripId, req.userId);
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Journal entry not found' } });
    }

    await db.prepare('DELETE FROM journal_entries WHERE id = ?').run(entryId);
    logger.info(`[Journal] Deleted entry ${entryId}`);
    res.json({ success: true, message: 'Journal entry deleted' });
  } catch (error) {
    logger.error('[Journal] Delete entry error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete journal entry' } });
  }
});

// POST /api/journal/:tripId/:entryId/photos - Add photo to entry
router.post('/:tripId/:entryId/photos', journalMutateLimiter, requireAuth,
  [body('fileUrl').notEmpty().withMessage('File URL is required')],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { tripId, entryId } = req.params;
      const { fileUrl, caption, takenAt } = req.body;

      const entry = await db.prepare('SELECT id FROM journal_entries WHERE id = ? AND trip_id = ? AND user_id = ?').get(entryId, tripId, req.userId);
      if (!entry) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Journal entry not found' } });
      }

      const result = await db.prepare(`
        INSERT INTO journal_photos (entry_id, user_id, file_url, caption, taken_at) VALUES (?, ?, ?, ?, ?)
      `).run(entryId, req.userId, fileUrl, caption || null, takenAt || null);

      const photo = await db.prepare('SELECT id, file_url, caption, taken_at, created_at FROM journal_photos WHERE id = ?').get(result.lastInsertRowid);

      res.status(201).json({
        success: true,
        data: { id: photo.id, fileUrl: photo.file_url, caption: photo.caption, takenAt: photo.taken_at, createdAt: photo.created_at }
      });
    } catch (error) {
      logger.error('[Journal] Add photo error:', error);
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to add photo' } });
    }
  }
);

// DELETE /api/journal/:tripId/:entryId/photos/:photoId - Delete photo
router.delete('/:tripId/:entryId/photos/:photoId', journalMutateLimiter, requireAuth, async (req, res) => {
  try {
    const { entryId, photoId } = req.params;

    const photo = await db.prepare(`
      SELECT jp.id FROM journal_photos jp
      JOIN journal_entries je ON jp.entry_id = je.id
      WHERE jp.id = ? AND jp.entry_id = ? AND je.user_id = ?
    `).get(photoId, entryId, req.userId);

    if (!photo) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Photo not found' } });
    }

    await db.prepare('DELETE FROM journal_photos WHERE id = ?').run(photoId);
    res.json({ success: true, message: 'Photo deleted' });
  } catch (error) {
    logger.error('[Journal] Delete photo error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete photo' } });
  }
});

export default router;
