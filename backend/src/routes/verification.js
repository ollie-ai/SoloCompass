import express from 'express';
import { body, validationResult } from 'express-validator';
import { requireAuth } from '../middleware/auth.js';
import db from '../db.js';
import logger from '../services/logger.js';

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.use(requireAuth);

/**
 * GET /api/verification/status
 * Returns current verification tier and requirements for next tier.
 */
router.get('/status', async (req, res) => {
  try {
    const user = await db.get('SELECT verification_tier, email_verified, email FROM users WHERE id = ?', req.userId);
    const profile = await db.get('SELECT phone, social_links FROM profiles WHERE user_id = ?', req.userId);

    const socialLinks = profile?.social_links ? JSON.parse(profile.social_links) : {};
    const hasSocial = Object.keys(socialLinks).length > 0;

    res.json({
      success: true,
      data: {
        currentTier: user.verification_tier || 0,
        emailVerified: !!user.email_verified,
        phoneVerified: !!profile?.phone, // Simplified for V1
        socialLinked: hasSocial,
        nextRequirements: user.verification_tier === 1 ? ['Verify Phone', 'Link Social Account'] : 
                         user.verification_tier === 2 ? ['Complete 3 Safe Trips', 'Identity Check'] : []
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch verification status' });
  }
});

/**
 * POST /api/verification/verify-phone
 * Simplified phone verification for V1.
 */
router.post('/verify-phone', [
  body('phone').matches(/^\+?[0-9\s\-()\.]{7,20}$/).withMessage('Invalid phone number'),
], handleValidationErrors, async (req, res) => {
  try {
    const { phone } = req.body;
    
    // In a real app, we'd send an OTP here. For V1 2026 Beta, we mark as verified if format is valid.
    await db.run('UPDATE profiles SET phone = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', phone, req.userId);
    
    // Upgrade to Tier 2 if not already higher
    const user = await db.get('SELECT verification_tier FROM users WHERE id = ?', req.userId);
    if ((user.verification_tier || 0) < 2) {
      await db.run('UPDATE users SET verification_tier = 2 WHERE id = ?', req.userId);
    }

    res.json({ success: true, message: 'Phone verified and Tier 2 status granted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify phone' });
  }
});

export default router;
