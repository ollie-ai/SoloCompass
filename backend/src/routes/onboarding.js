import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import db from '../db.js';
import logger from '../services/logger.js';

const router = express.Router();

const onboardingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later' } },
});

// GET /api/onboarding/state - get current onboarding state
router.get('/state', onboardingLimiter, authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    let state = await db.get('SELECT * FROM onboarding_state WHERE user_id = ?', userId);
    if (!state) {
      await db.run('INSERT INTO onboarding_state (user_id) VALUES (?)', userId);
      state = { user_id: userId, current_step: 1, completed_steps: '[]', skipped_steps: '[]', completed: false };
    }
    res.json({
      success: true,
      data: {
        currentStep: state.current_step,
        completedSteps: JSON.parse(state.completed_steps || '[]'),
        skippedSteps: JSON.parse(state.skipped_steps || '[]'),
        completed: state.completed,
      }
    });
  } catch (error) {
    logger.error(`[Onboarding] Get state failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// POST /api/onboarding/step/:step/complete - mark a step complete
router.post('/step/:step/complete', onboardingLimiter, authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const step = parseInt(req.params.step);
    if (isNaN(step) || step < 1 || step > 8) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid step number' } });
    }

    let state = await db.get('SELECT * FROM onboarding_state WHERE user_id = ?', userId);
    if (!state) {
      await db.run('INSERT INTO onboarding_state (user_id) VALUES (?)', userId);
      state = { user_id: userId, current_step: 1, completed_steps: '[]', skipped_steps: '[]', completed: false };
    }

    const completedSteps = JSON.parse(state.completed_steps || '[]');
    if (!completedSteps.includes(step)) completedSteps.push(step);

    const nextStep = step < 8 ? step + 1 : step;
    const isCompleted = completedSteps.length >= 8 || step === 8;

    await db.run(
      'UPDATE onboarding_state SET current_step = ?, completed_steps = ?, completed = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      nextStep, JSON.stringify(completedSteps), isCompleted, userId
    );

    // If step 3, save profile basics
    if (step === 3 && req.body && Object.keys(req.body).length > 0) {
      const { name, display_name, pronouns, avatar_url } = req.body;
      if (name) await db.run('UPDATE users SET name = ? WHERE id = ?', name, userId);
      const profileUpdates = {};
      if (display_name) profileUpdates.display_name = display_name;
      if (pronouns) profileUpdates.pronouns = pronouns;
      if (avatar_url) profileUpdates.avatar_url = avatar_url;
      if (Object.keys(profileUpdates).length > 0) {
        const setParts = Object.keys(profileUpdates).map(k => `${k} = ?`).join(', ');
        await db.run(`UPDATE profiles SET ${setParts}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, ...Object.values(profileUpdates), userId);
      }
    }

    res.json({ success: true, data: { currentStep: nextStep, completed: isCompleted } });
  } catch (error) {
    logger.error(`[Onboarding] Complete step failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// POST /api/onboarding/step/:step/skip
router.post('/step/:step/skip', onboardingLimiter, authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const step = parseInt(req.params.step);
    if (isNaN(step) || step < 1 || step > 8) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid step number' } });
    }

    let state = await db.get('SELECT * FROM onboarding_state WHERE user_id = ?', userId);
    if (!state) {
      await db.run('INSERT INTO onboarding_state (user_id) VALUES (?)', userId);
      state = { user_id: userId, current_step: 1, completed_steps: '[]', skipped_steps: '[]', completed: false };
    }

    const skippedSteps = JSON.parse(state.skipped_steps || '[]');
    if (!skippedSteps.includes(step)) skippedSteps.push(step);
    const nextStep = step < 8 ? step + 1 : step;

    await db.run(
      'UPDATE onboarding_state SET current_step = ?, skipped_steps = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      nextStep, JSON.stringify(skippedSteps), userId
    );

    res.json({ success: true, data: { currentStep: nextStep } });
  } catch (error) {
    logger.error(`[Onboarding] Skip step failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

// POST /api/onboarding/complete
router.post('/complete', onboardingLimiter, authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    await db.run(
      'UPDATE onboarding_state SET completed = true, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      userId
    );
    res.json({ success: true, data: { message: 'Onboarding complete!' } });
  } catch (error) {
    logger.error(`[Onboarding] Complete failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  }
});

export default router;
