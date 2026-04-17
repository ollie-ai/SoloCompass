import express from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import logger from '../services/logger.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const ONBOARDING_STEPS = ['profile', 'quiz', 'first_trip', 'safety_setup', 'emergency_contacts', 'tour_complete'];

const onboardingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * GET /api/onboarding/status
 * Return completed steps and overall progress for the authenticated user
 */
router.get('/status', onboardingLimiter, requireAuth, async (req, res) => {
  try {
    const rows = await db.all(
      'SELECT step, completed_at, metadata FROM onboarding_progress WHERE user_id = ? ORDER BY completed_at ASC',
      req.userId
    );

    const completedSteps = (rows || []).map((r) => r.step);
    const totalSteps = ONBOARDING_STEPS.length;
    const completedCount = ONBOARDING_STEPS.filter((s) => completedSteps.includes(s)).length;
    const completionPercent = Math.round((completedCount / totalSteps) * 100);
    const isComplete = completedCount === totalSteps;

    const stepStatus = ONBOARDING_STEPS.map((step) => {
      const row = (rows || []).find((r) => r.step === step);
      return { step, completed: !!row, completedAt: row?.completed_at || null };
    });

    res.json({
      success: true,
      data: {
        completionPercent,
        isComplete,
        completedSteps,
        steps: stepStatus,
        totalSteps,
        completedCount,
      }
    });
  } catch (error) {
    logger.error(`[Onboarding] Failed to get status: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to get onboarding status' });
  }
});

/**
 * POST /api/onboarding/complete
 * Mark an onboarding step as completed
 */
router.post('/complete', onboardingLimiter, requireAuth, [
  body('step').isIn(ONBOARDING_STEPS).withMessage(`Step must be one of: ${ONBOARDING_STEPS.join(', ')}`),
  body('metadata').optional().isObject(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { step, metadata = {} } = req.body;

    await db.run(
      `INSERT INTO onboarding_progress (user_id, step, metadata)
       VALUES (?, ?, ?::jsonb)
       ON CONFLICT (user_id, step) DO NOTHING`,
      req.userId, step, JSON.stringify(metadata)
    );

    // Fetch updated status
    const rows = await db.all(
      'SELECT step, completed_at FROM onboarding_progress WHERE user_id = ? ORDER BY completed_at ASC',
      req.userId
    );

    const completedSteps = (rows || []).map((r) => r.step);
    const completedCount = ONBOARDING_STEPS.filter((s) => completedSteps.includes(s)).length;
    const completionPercent = Math.round((completedCount / ONBOARDING_STEPS.length) * 100);
    const isComplete = completedCount === ONBOARDING_STEPS.length;

    if (isComplete) {
      await db.run(
        'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
        req.userId, 'onboarding_completed', JSON.stringify({ completedAt: new Date().toISOString() })
      );
    }

    logger.info(`[Onboarding] User ${req.userId} completed step: ${step}`);

    res.json({
      success: true,
      data: { step, completedSteps, completionPercent, isComplete }
    });
  } catch (error) {
    logger.error(`[Onboarding] Failed to complete step: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to mark onboarding step complete' });
  }
});

export default router;
