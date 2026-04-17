import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import db from '../db.js';
import logger from '../services/logger.js';

const router = express.Router();

const preferencesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later' } },
});

// Get user preferences
router.get('/', requireAuth, async (req, res) => {
  try {
    const preferences = await db.prepare(`
      SELECT travel_style, budget_level, pace, accommodation_type, 
             interests, preferred_climate, trip_duration, 
             solo_travel_experience, safety_priority
      FROM profiles 
      WHERE user_id = ?
    `).get(req.userId);

    if (!preferences) {
      // Return empty preferences object if none exist
      return res.json({ 
        travel_style: null,
        budget_level: null,
        pace: null,
        accommodation_type: null,
        interests: null,
        preferred_climate: null,
        trip_duration: null,
        solo_travel_experience: null,
        safety_priority: null
      });
    }

    // Parse interests from JSON string if it exists
    if (preferences.interests) {
      try {
        preferences.interests = JSON.parse(preferences.interests);
      } catch (e) {
        preferences.interests = null;
      }
    }

    res.json(preferences);
    } catch (error) {
      logger.error('Get preferences error:', error);
      res.status(500).json({ error: 'Failed to get preferences' });
    }
});

// Update user preferences
router.put('/', requireAuth, async (req, res) => {
  try {
    const {
      travel_style,
      budget_level,
      pace,
      accommodation_type,
      interests,
      preferred_climate,
      trip_duration,
      solo_travel_experience,
      safety_priority
    } = req.body;

    // Convert interests array to JSON string for storage
    const interestsJson = interests !== undefined && interests !== null 
      ? JSON.stringify(interests) 
      : null;

    // Check if profile exists
    const existingProfile = await db.prepare('SELECT id FROM profiles WHERE user_id = ?').get(req.userId);

    if (existingProfile) {
      // Update existing profile
      await db.prepare(`
        UPDATE profiles SET 
          travel_style = ?,
          budget_level = ?,
          pace = ?,
          accommodation_type = ?,
          interests = ?,
          preferred_climate = ?,
          trip_duration = ?,
          solo_travel_experience = ?,
          safety_priority = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(
        travel_style,
        budget_level,
        pace,
        accommodation_type,
        interestsJson,
        preferred_climate,
        trip_duration,
        solo_travel_experience,
        safety_priority,
        req.userId
      );
    } else {
      // Create new profile
      await db.prepare(`
        INSERT INTO profiles (
          user_id, travel_style, budget_level, pace, accommodation_type, 
          interests, preferred_climate, trip_duration, 
          solo_travel_experience, safety_priority
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.userId,
        travel_style,
        budget_level,
        pace,
        accommodation_type,
        interestsJson,
        preferred_climate,
        trip_duration,
        solo_travel_experience,
        safety_priority
      );
    }

    res.json({ message: 'Preferences updated successfully' });
    } catch (error) {
      logger.error('Update preferences error:', error);
      res.status(500).json({ error: 'Failed to update preferences' });
    }
});

// GET /api/preferences/app — get language, currency, units, timezone settings
router.get('/app', preferencesLimiter, requireAuth, async (req, res) => {
  try {
    const row = await db.get(
      'SELECT language, currency, units, timezone, date_format FROM user_preferences WHERE user_id = ?',
      req.userId
    );
    res.json({
      success: true,
      data: row || { language: 'en', currency: 'USD', units: 'metric', timezone: 'UTC', date_format: 'YYYY-MM-DD' }
    });
  } catch (error) {
    logger.error('Get app preferences error:', error);
    res.status(500).json({ success: false, error: 'Failed to get app preferences' });
  }
});

// PUT /api/preferences/app — save language, currency, units, timezone settings
router.put('/app', preferencesLimiter, requireAuth, async (req, res) => {
  try {
    const { language, currency, units, timezone, date_format } = req.body;

    const ALLOWED_UNITS = new Set(['metric', 'imperial']);
    if (units && !ALLOWED_UNITS.has(units)) {
      return res.status(400).json({ success: false, error: 'units must be metric or imperial' });
    }

    const existing = await db.get('SELECT id FROM user_preferences WHERE user_id = ?', req.userId);
    if (existing) {
      await db.run(
        `UPDATE user_preferences SET language = COALESCE($1, language), currency = COALESCE($2, currency),
         units = COALESCE($3, units), timezone = COALESCE($4, timezone), date_format = COALESCE($5, date_format),
         updated_at = CURRENT_TIMESTAMP WHERE user_id = $6`,
        language || null, currency || null, units || null, timezone || null, date_format || null, req.userId
      );
    } else {
      await db.run(
        `INSERT INTO user_preferences (user_id, language, currency, units, timezone, date_format)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        req.userId,
        language || 'en',
        currency || 'USD',
        units || 'metric',
        timezone || 'UTC',
        date_format || 'YYYY-MM-DD'
      );
    }

    const updated = await db.get(
      'SELECT language, currency, units, timezone, date_format FROM user_preferences WHERE user_id = ?',
      req.userId
    );
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Update app preferences error:', error);
    res.status(500).json({ success: false, error: 'Failed to update app preferences' });
  }
});

export default router;