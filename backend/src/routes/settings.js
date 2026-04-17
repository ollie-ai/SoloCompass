import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import db from '../db.js';
import logger from '../services/logger.js';
import { createNotification, getNotificationPreferences } from '../services/notificationService.js';
import { sendPushNotification } from '../services/pushService.js';
import { sendCustomEmail } from '../services/email.js';
import { sendSMS } from '../services/smsService.js';

const router = express.Router();

// ─── Default values ────────────────────────────────────────────────────────────

const DEFAULT_PRIVACY = {
  profile_visibility: 'friends',
  location_sharing: false,
  activity_visibility: 'friends',
  show_online_status: true,
  allow_buddy_requests: true,
  show_trip_history: true,
  show_reviews: true,
  data_collection_consent: false,
  analytics_consent: false,
};

const DEFAULT_UNITS = {
  distance_unit: 'km',
  temperature_unit: 'C',
  currency_preference: 'GBP',
};

const DEFAULT_ACCESSIBILITY = {
  font_size: 'medium',
  high_contrast: false,
  reduced_motion: false,
};

const PRIVACY_BOOL_FIELDS = [
  'location_sharing',
  'show_online_status',
  'allow_buddy_requests',
  'show_trip_history',
  'show_reviews',
  'data_collection_consent',
  'analytics_consent',
];

// ─── GET /privacy ──────────────────────────────────────────────────────────────

router.get('/privacy', authenticate, async (req, res) => {
  try {
    const row = await db.prepare(
      'SELECT * FROM privacy_settings WHERE user_id = ?'
    ).get(req.userId);

    const data = row
      ? {
          profile_visibility: row.profile_visibility,
          location_sharing: row.location_sharing,
          activity_visibility: row.activity_visibility,
          show_online_status: row.show_online_status,
          allow_buddy_requests: row.allow_buddy_requests,
          show_trip_history: row.show_trip_history,
          show_reviews: row.show_reviews,
          data_collection_consent: row.data_collection_consent,
          analytics_consent: row.analytics_consent,
        }
      : { ...DEFAULT_PRIVACY };

    res.json({ success: true, data });
  } catch (err) {
    logger.error('[Settings] Privacy fetch error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch privacy settings' });
  }
});

// ─── PUT /privacy ──────────────────────────────────────────────────────────────

router.put('/privacy', authenticate, [
  body('profile_visibility').optional().isIn(['public', 'friends', 'private']).withMessage('Invalid profile visibility'),
  body('activity_visibility').optional().isIn(['public', 'friends', 'private']).withMessage('Invalid activity visibility'),
  ...PRIVACY_BOOL_FIELDS.map(f =>
    body(f).optional().isBoolean().withMessage(`${f} must be a boolean`)
  ),
], validate, async (req, res) => {
  try {
    const existing = await db.prepare(
      'SELECT id FROM privacy_settings WHERE user_id = ?'
    ).get(req.userId);

    const allowed = [
      'profile_visibility', 'activity_visibility',
      ...PRIVACY_BOOL_FIELDS,
    ];

    const fields = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields[key] = req.body[key];
      }
    }

    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields provided' });
    }

    if (existing) {
      const setClauses = Object.keys(fields).map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(fields), req.userId];
      await db.prepare(
        `UPDATE privacy_settings SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`
      ).run(...values);
    } else {
      const merged = { ...DEFAULT_PRIVACY, ...fields };
      await db.prepare(
        `INSERT INTO privacy_settings (user_id, profile_visibility, location_sharing, activity_visibility, show_online_status, allow_buddy_requests, show_trip_history, show_reviews, data_collection_consent, analytics_consent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        req.userId,
        merged.profile_visibility,
        merged.location_sharing,
        merged.activity_visibility,
        merged.show_online_status,
        merged.allow_buddy_requests,
        merged.show_trip_history,
        merged.show_reviews,
        merged.data_collection_consent,
        merged.analytics_consent,
      );
    }

    const updated = await db.prepare(
      'SELECT * FROM privacy_settings WHERE user_id = ?'
    ).get(req.userId);

    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error('[Settings] Privacy update error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update privacy settings' });
  }
});

// ─── GET /units ────────────────────────────────────────────────────────────────

router.get('/units', authenticate, async (req, res) => {
  try {
    const row = await db.prepare(
      'SELECT distance_unit, temperature_unit, currency_preference FROM user_settings WHERE user_id = ?'
    ).get(req.userId);

    const data = row
      ? {
          distance_unit: row.distance_unit ?? DEFAULT_UNITS.distance_unit,
          temperature_unit: row.temperature_unit ?? DEFAULT_UNITS.temperature_unit,
          currency_preference: row.currency_preference ?? DEFAULT_UNITS.currency_preference,
        }
      : { ...DEFAULT_UNITS };

    res.json({ success: true, data });
  } catch (err) {
    logger.error('[Settings] Units fetch error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch unit preferences' });
  }
});

// ─── PUT /units ────────────────────────────────────────────────────────────────

router.put('/units', authenticate, [
  body('distance_unit').optional().isIn(['km', 'mi']).withMessage('distance_unit must be km or mi'),
  body('temperature_unit').optional().isIn(['C', 'F']).withMessage('temperature_unit must be C or F'),
  body('currency_preference').optional().isString().trim().notEmpty().withMessage('currency_preference must be a non-empty string'),
], validate, async (req, res) => {
  try {
    const { distance_unit, temperature_unit, currency_preference } = req.body;

    const fields = {};
    if (distance_unit !== undefined) fields.distance_unit = distance_unit;
    if (temperature_unit !== undefined) fields.temperature_unit = temperature_unit;
    if (currency_preference !== undefined) fields.currency_preference = currency_preference;

    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields provided' });
    }

    const existing = await db.prepare(
      'SELECT id FROM user_settings WHERE user_id = ?'
    ).get(req.userId);

    if (existing) {
      const setClauses = Object.keys(fields).map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(fields), req.userId];
      await db.prepare(
        `UPDATE user_settings SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`
      ).run(...values);
    } else {
      const merged = { ...DEFAULT_UNITS, ...DEFAULT_ACCESSIBILITY, ...fields };
      await db.prepare(
        `INSERT INTO user_settings (user_id, distance_unit, temperature_unit, currency_preference, font_size, high_contrast, reduced_motion)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        req.userId,
        merged.distance_unit,
        merged.temperature_unit,
        merged.currency_preference,
        merged.font_size,
        merged.high_contrast,
        merged.reduced_motion,
      );
    }

    const updated = await db.prepare(
      'SELECT distance_unit, temperature_unit, currency_preference FROM user_settings WHERE user_id = ?'
    ).get(req.userId);

    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error('[Settings] Units update error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update unit preferences' });
  }
});

// ─── GET /accessibility ────────────────────────────────────────────────────────

router.get('/accessibility', authenticate, async (req, res) => {
  try {
    const row = await db.prepare(
      'SELECT font_size, high_contrast, reduced_motion FROM user_settings WHERE user_id = ?'
    ).get(req.userId);

    const data = row
      ? {
          font_size: row.font_size ?? DEFAULT_ACCESSIBILITY.font_size,
          high_contrast: row.high_contrast ?? DEFAULT_ACCESSIBILITY.high_contrast,
          reduced_motion: row.reduced_motion ?? DEFAULT_ACCESSIBILITY.reduced_motion,
        }
      : { ...DEFAULT_ACCESSIBILITY };

    res.json({ success: true, data });
  } catch (err) {
    logger.error('[Settings] Accessibility fetch error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch accessibility settings' });
  }
});

// ─── PUT /accessibility ────────────────────────────────────────────────────────

router.put('/accessibility', authenticate, [
  body('font_size').optional().isIn(['small', 'medium', 'large', 'xlarge']).withMessage('font_size must be small, medium, large, or xlarge'),
  body('high_contrast').optional().isBoolean().withMessage('high_contrast must be a boolean'),
  body('reduced_motion').optional().isBoolean().withMessage('reduced_motion must be a boolean'),
], validate, async (req, res) => {
  try {
    const { font_size, high_contrast, reduced_motion } = req.body;

    const fields = {};
    if (font_size !== undefined) fields.font_size = font_size;
    if (high_contrast !== undefined) fields.high_contrast = high_contrast;
    if (reduced_motion !== undefined) fields.reduced_motion = reduced_motion;

    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields provided' });
    }

    const existing = await db.prepare(
      'SELECT id FROM user_settings WHERE user_id = ?'
    ).get(req.userId);

    if (existing) {
      const setClauses = Object.keys(fields).map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(fields), req.userId];
      await db.prepare(
        `UPDATE user_settings SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`
      ).run(...values);
    } else {
      const merged = { ...DEFAULT_UNITS, ...DEFAULT_ACCESSIBILITY, ...fields };
      await db.prepare(
        `INSERT INTO user_settings (user_id, distance_unit, temperature_unit, currency_preference, font_size, high_contrast, reduced_motion)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        req.userId,
        merged.distance_unit,
        merged.temperature_unit,
        merged.currency_preference,
        merged.font_size,
        merged.high_contrast,
        merged.reduced_motion,
      );
    }

    const updated = await db.prepare(
      'SELECT font_size, high_contrast, reduced_motion FROM user_settings WHERE user_id = ?'
    ).get(req.userId);

    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error('[Settings] Accessibility update error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update accessibility settings' });
  }
});

// ─── GET /login-activity ───────────────────────────────────────────────────────

router.get('/login-activity', authenticate, async (req, res) => {
  try {
    const rows = await db.prepare(
      `SELECT ip_address, device_type, browser, os, location, login_method, success, created_at
       FROM login_activity
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 20`
    ).all(req.userId);

    res.json({ success: true, data: rows || [] });
  } catch (err) {
    logger.error('[Settings] Login activity fetch error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch login activity' });
  }
});

// ─── POST /notifications/test ──────────────────────────────────────────────────

router.post('/notifications/test', authenticate, async (req, res) => {
  try {
    const user = await db.prepare('SELECT id, email, phone FROM users WHERE id = ?').get(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const prefs = await getNotificationPreferences(req.userId);
    const results = {};

    // In-app notification
    try {
      await createNotification(
        req.userId,
        'test',
        'Test Notification',
        'This is a test notification — all channels are being verified.',
        { test: true },
        null
      );
      results.in_app = { success: true };
    } catch (err) {
      logger.error('[Settings] Test in-app notification error:', err.message);
      results.in_app = { success: false, error: err.message };
    }

    // Push notification
    if (prefs?.pushNotifications !== false) {
      try {
        const pushResult = await sendPushNotification(req.userId, {
          title: 'Test Notification',
          body: 'Push notifications are working!',
          priority: 'P3',
          tag: 'test',
        });
        results.push = { success: true, data: pushResult };
      } catch (err) {
        logger.error('[Settings] Test push notification error:', err.message);
        results.push = { success: false, error: err.message };
      }
    } else {
      results.push = { success: false, error: 'Push notifications disabled' };
    }

    // Email notification
    if (prefs?.emailNotifications !== false && user.email) {
      try {
        await sendCustomEmail(user.email, 'test_notification', {
          name: user.name || 'Traveller',
          message: 'This is a test email from SoloCompass to verify your notification settings.',
        });
        results.email = { success: true };
      } catch (err) {
        logger.error('[Settings] Test email notification error:', err.message);
        results.email = { success: false, error: err.message };
      }
    } else {
      results.email = { success: false, error: user.email ? 'Email notifications disabled' : 'No email on file' };
    }

    // SMS notification
    if (prefs?.smsNotifications !== false && user.phone) {
      try {
        await sendSMS(user.phone, 'SoloCompass test: Your SMS notifications are working!', req.userId);
        results.sms = { success: true };
      } catch (err) {
        logger.error('[Settings] Test SMS notification error:', err.message);
        results.sms = { success: false, error: err.message };
      }
    } else {
      results.sms = { success: false, error: user.phone ? 'SMS notifications disabled' : 'No phone number on file' };
    }

    res.json({ success: true, data: results });
  } catch (err) {
    logger.error('[Settings] Test notification error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to send test notifications' });
  }
});

// ─── GET /connected-accounts ───────────────────────────────────────────────────

router.get('/connected-accounts', authenticate, async (req, res) => {
  try {
    const rows = await db.prepare(
      `SELECT id, provider, provider_account_id, display_name, email, avatar_url, scopes, connected_at, updated_at
       FROM connected_accounts
       WHERE user_id = ?
       ORDER BY connected_at DESC`
    ).all(req.userId);

    res.json({ success: true, data: rows || [] });
  } catch (err) {
    logger.error('[Settings] Connected accounts fetch error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch connected accounts' });
  }
});

// ─── DELETE /connected-accounts/:provider ──────────────────────────────────────

router.delete('/connected-accounts/:provider', authenticate, async (req, res) => {
  try {
    const { provider } = req.params;

    const account = await db.prepare(
      'SELECT id FROM connected_accounts WHERE user_id = ? AND provider = ?'
    ).get(req.userId, provider);

    if (!account) {
      return res.status(404).json({ success: false, error: 'Connected account not found' });
    }

    await db.prepare(
      'DELETE FROM connected_accounts WHERE user_id = ? AND provider = ?'
    ).run(req.userId, provider);

    res.json({ success: true, message: `${provider} account disconnected` });
  } catch (err) {
    logger.error('[Settings] Disconnect account error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to disconnect account' });
  }
});

export default router;
