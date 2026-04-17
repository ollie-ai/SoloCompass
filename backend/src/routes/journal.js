import express from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';
import logger from '../services/logger.js';

const router = express.Router();

const journalReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please slow down.' }
});

const journalWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please slow down.' }
});

const JOURNAL_TEMPLATES = {
  daily_log: {
    id: 'daily_log',
    title: 'Daily Log',
    prompts: ['Where did you go today?', 'What went well?', 'What would you do differently tomorrow?']
  },
  highlight: {
    id: 'highlight',
    title: 'Trip Highlight',
    prompts: ['What was the highlight?', 'Why did it stand out?', 'Would you recommend it to a solo traveler?']
  },
  food_review: {
    id: 'food_review',
    title: 'Food Review',
    prompts: ['What did you order?', 'How was taste/value?', 'Would you revisit?']
  }
};

router.get('/templates', journalReadLimiter, authenticate, async (_req, res) => {
  res.json({ success: true, data: Object.values(JOURNAL_TEMPLATES) });
});

router.post('/:tripId/entries', journalWriteLimiter, authenticate, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { title, content, templateType = 'daily_log', locationName, latitude, longitude, weatherSummary } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'title is required' });

    const trip = await db.prepare('SELECT id FROM trips WHERE id = ? AND user_id = ?').get(tripId, req.userId);
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

    const result = await db.prepare(`
      INSERT INTO journal_entries (trip_id, user_id, title, content, template_type, location_name, latitude, longitude, weather_summary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(tripId, req.userId, title, content || null, templateType, locationName || null, latitude || null, longitude || null, weatherSummary || null);

    const entry = await db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: entry });
  } catch (error) {
    logger.error(`[Journal] Create entry failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to create journal entry' });
  }
});

router.get('/:tripId/entries', journalReadLimiter, authenticate, async (req, res) => {
  try {
    const { tripId } = req.params;
    const trip = await db.prepare('SELECT id FROM trips WHERE id = ? AND user_id = ?').get(tripId, req.userId);
    if (!trip) return res.status(404).json({ success: false, error: 'Trip not found' });

    const entries = await db.prepare('SELECT * FROM journal_entries WHERE trip_id = ? AND user_id = ? ORDER BY created_at DESC').all(tripId, req.userId);
    res.json({ success: true, data: entries });
  } catch (error) {
    logger.error(`[Journal] List entries failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to fetch journal entries' });
  }
});

router.post('/entries/:entryId/share', journalWriteLimiter, authenticate, async (req, res) => {
  try {
    const { entryId } = req.params;
    const entry = await db.prepare('SELECT id, user_id FROM journal_entries WHERE id = ?').get(entryId);
    if (!entry || entry.user_id !== req.userId) {
      return res.status(404).json({ success: false, error: 'Journal entry not found' });
    }

    const shareId = crypto.randomBytes(10).toString('hex');
    await db.prepare(`
      INSERT INTO journal_shares (journal_entry_id, share_id, created_by, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(entryId, shareId, req.userId, req.body.expiresAt || null);

    res.json({ success: true, data: { shareId, url: `/journal/public/${shareId}` } });
  } catch (error) {
    logger.error(`[Journal] Share failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to create public share link' });
  }
});

router.get('/public/:shareId', async (req, res) => {
  try {
    const { shareId } = req.params;
    const shared = await db.prepare(`
      SELECT js.share_id, js.expires_at, je.id, je.trip_id, je.title, je.content, je.template_type, je.location_name,
             je.weather_summary, je.created_at, u.name AS author_name, t.name AS trip_name, t.destination
      FROM journal_shares js
      JOIN journal_entries je ON je.id = js.journal_entry_id
      LEFT JOIN users u ON u.id = je.user_id
      LEFT JOIN trips t ON t.id = je.trip_id
      WHERE js.share_id = ?
    `).get(shareId);

    if (!shared) return res.status(404).json({ success: false, error: 'Shared journal not found' });
    if (shared.expires_at && new Date(shared.expires_at) < new Date()) {
      return res.status(410).json({ success: false, error: 'Shared journal link expired' });
    }

    res.json({ success: true, data: shared });
  } catch (error) {
    logger.error(`[Journal] Public fetch failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to fetch shared journal entry' });
  }
});

router.get('/entries/:entryId/export', journalReadLimiter, authenticate, async (req, res) => {
  res.json({
    success: true,
    data: { status: 'stub', message: 'TODO: Implement PDF memoir/photo-book rendering export pipeline.' }
  });
});

export default router;
