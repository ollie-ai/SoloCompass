import express from 'express';
import db from '../db.js';
import logger from '../services/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { PLAN_TIERS, FEATURES, PLAN_ACCESS } from '../middleware/paywall.js';

const router = express.Router();

// Ordered plan list
const PLAN_ORDER = [PLAN_TIERS.EXPLORER, PLAN_TIERS.GUARDIAN, PLAN_TIERS.NAVIGATOR];

/**
 * GET /api/features
 * List all features with per-plan availability
 */
router.get('/', async (req, res) => {
  try {
    const featureMatrix = Object.values(FEATURES).map((featureKey) => {
      const availableInPlans = PLAN_ORDER.filter((plan) =>
        (PLAN_ACCESS[plan] || []).includes(featureKey)
      );
      const minPlan = availableInPlans[0] || PLAN_TIERS.EXPLORER;
      return {
        feature: featureKey,
        label: featureKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        minPlan,
        availableInPlans,
      };
    });

    res.json({ success: true, data: { features: featureMatrix } });
  } catch (error) {
    logger.error(`[Features] Failed to list features: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to list features' });
  }
});

export default router;
