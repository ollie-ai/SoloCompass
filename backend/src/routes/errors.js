import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import db from '../db.js';
import logger from '../services/logger.js';
import { forwardErrorTrackingEvent } from '../services/errorTrackingService.js';

const router = Router();

router.post('/report', optionalAuth, async (req, res) => {
  try {
    const { errors } = req.body;

    if (!errors || !Array.isArray(errors)) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    const userId = req.userId || null;

    for (const err of errors) {
      const { message, stack, url, userAgent, timestamp, type } = err;

      logger.warn(`[ClientError] ${type}: ${message}${url ? ` @ ${url}` : ''}`);
      await forwardErrorTrackingEvent({ source: 'frontend', message, stack, url, userAgent, timestamp, type, userId });

      try {
        await db.prepare(
          `INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)`
        ).run(
          userId,
          'client_error',
          JSON.stringify({ message, stack, url, userAgent, timestamp, type })
        );
      } catch (dbErr) {
        logger.error(`[ClientError] DB write failed: ${dbErr.message}`);
      }
    }

    res.json({ success: true });
  } catch (err) {
    logger.error(`[ClientError] Report handler error: ${err.message}`);
    res.json({ success: true });
  }
});

export default router;
