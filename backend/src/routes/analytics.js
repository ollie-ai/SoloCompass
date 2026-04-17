import express from 'express';
import { body, validationResult } from 'express-validator';
import { optionalAuth, requireAdmin } from '../middleware/auth.js';
import { trackPageView, trackEvent, getStats } from '../services/analytics.js';
import logger from '../services/logger.js';

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.post('/track', optionalAuth, [
  body('type').isIn(['page_view', 'event']).withMessage('Invalid tracking type'),
  body('path').optional({ nullable: true }).isString(),
  body('referrer').optional({ nullable: true }).isString(),
  body('eventType').optional({ nullable: true }).isString(),
  body('properties').optional({ nullable: true }).isObject(),
], handleValidationErrors, async (req, res) => {
  try {
    const { type, path, referrer, eventType, properties } = req.body;
    const userId = req.userId || null;

    if (type === 'page_view') {
      if (!path) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'path is required for page_view' } });
      }
      await trackPageView(userId, path, referrer);
    } else if (type === 'event') {
      if (!eventType) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'eventType is required for event' } });
      }
      await trackEvent(userId, eventType, properties || {});
    }

    res.json({ success: true });
  } catch (error) {
    // Silently fail - analytics shouldn't break the app
    res.json({ success: true });
  }
});

router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const period = req.query.period || '7d';
    const stats = await getStats(period);

    if (!stats) {
      return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get stats' } });
    }

    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Get stats error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get stats' } });
  }
});

/**
 * POST /api/analytics/vitals
 * Receive Core Web Vitals measurements from the frontend.
 */
router.post('/vitals', optionalAuth, [
  body('name').isIn(['LCP', 'FID', 'CLS', 'FCP', 'TTFB', 'INP']).withMessage('Invalid metric name'),
  body('value').isNumeric().withMessage('value must be numeric'),
  body('rating').optional({ nullable: true }).isIn(['good', 'needs-improvement', 'poor', 'unknown']),
], handleValidationErrors, async (req, res) => {
  try {
    const { name, value, rating } = req.body;
    const userId = req.userId || null;

    logger.info(`[Vitals] ${name}=${value} rating=${rating || 'unknown'} userId=${userId || 'anon'}`);

    // Store as analytics event so it appears in the admin dashboard alongside
    // other events — no schema change required.
    await trackEvent(userId, 'web_vital', {
      metricName: name,
      metricValue: value,
      metricRating: rating || 'unknown',
    });

    res.json({ success: true });
  } catch (error) {
    logger.error(`[Vitals] Failed to record: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to record vital' } });
  }
});

export default router;
