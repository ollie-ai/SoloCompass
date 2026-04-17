import express from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import db from '../db.js';

const router = express.Router();
const referralsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

router.get('/me', referralsLimiter, requireAuth, async (req, res) => {
  const referral = await db.prepare('SELECT code, invites, reward_points, updated_at FROM referrals WHERE user_id = ?').get(req.userId);

  if (!referral) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    await db.prepare('INSERT INTO referrals (user_id, code, invites, reward_points) VALUES (?, ?, 0, 0)').run(req.userId, code);
    return res.json({ success: true, data: { code, invites: 0, rewardPoints: 0 } });
  }

  res.json({
    success: true,
    data: {
      code: referral.code,
      invites: referral.invites,
      rewardPoints: referral.reward_points,
      updatedAt: referral.updated_at
    }
  });
});

router.post('/claim', referralsLimiter, requireAuth, async (req, res) => {
  const { code } = req.body || {};
  if (!code) {
    return res.status(400).json({ success: false, error: 'Referral code is required' });
  }

  const referrer = await db.prepare('SELECT user_id FROM referrals WHERE code = ?').get(code.toUpperCase());
  if (!referrer || referrer.user_id === req.userId) {
    return res.status(400).json({ success: false, error: 'Invalid referral code' });
  }

  await db.prepare('UPDATE referrals SET invites = invites + 1, reward_points = reward_points + 100, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(referrer.user_id);

  res.json({ success: true, data: { rewardPointsGranted: 100 } });
});

export default router;
