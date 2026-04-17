import express from 'express';
import { authenticate } from '../middleware/auth.js';
import db from '../db.js';
import logger from '../services/logger.js';
import { evaluateFlag, getAllFlags } from '../services/featureFlagService.js';
import { apiLimiter } from '../middleware/rateLimiters.js';

const router = express.Router();

// GET /api/v1/feature-flags - Get all flags evaluated for current user
router.get('/', authenticate, apiLimiter, async (req, res) => {
  try {
    const user = await db.get('SELECT subscription_tier FROM users WHERE id = ?', req.userId);
    const tier = user?.subscription_tier || 'explorer';
    const allFlags = await getAllFlags();

    const evaluated = {};
    for (const [key] of Object.entries(allFlags)) {
      evaluated[key] = await evaluateFlag(key, req.userId, tier);
    }

    res.json({ success: true, data: evaluated });
  } catch (err) {
    logger.error(`[FeatureFlags] Get flags error: ${err.message}`);
    res.status(500).json({ success: false, error: { code: 'SC-ERR-500', message: 'Failed to get feature flags' } });
  }
});

// GET /api/v1/feature-flags/:key - Evaluate a single flag
router.get('/:key', authenticate, apiLimiter, async (req, res) => {
  try {
    const user = await db.get('SELECT subscription_tier FROM users WHERE id = ?', req.userId);
    const tier = user?.subscription_tier || 'explorer';
    const isEnabled = await evaluateFlag(req.params.key, req.userId, tier);
    res.json({ success: true, data: { key: req.params.key, isEnabled } });
  } catch (err) {
    logger.error(`[FeatureFlags] Evaluate flag error: ${err.message}`);
    res.status(500).json({ success: false, error: { code: 'SC-ERR-500', message: 'Failed to evaluate flag' } });
  }
});

export default router;
