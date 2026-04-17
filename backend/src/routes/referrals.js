import express from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import db from '../db.js';

const router = express.Router();
const REFERRAL_CODE_BYTES = 4; // 4 bytes → 8 hex chars
const REFERRAL_CODE_REGEX = /^[0-9A-F]{8}$/;
const FRAUD_CLAIM_LIMIT = 10;   // max claims per code per 24-hour window
const NEW_ACCOUNT_MAX_MINUTES = 60; // claim window: account must be ≤ 60 min old

const referralsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

router.get('/me', referralsLimiter, requireAuth, async (req, res) => {
  const referral = await db.prepare('SELECT code, invites, reward_points, is_suspended, updated_at FROM referrals WHERE user_id = ?').get(req.userId);

  if (!referral) {
    const code = crypto.randomBytes(REFERRAL_CODE_BYTES).toString('hex').toUpperCase();
    await db.prepare('INSERT INTO referrals (user_id, code, invites, reward_points) VALUES (?, ?, 0, 0)').run(req.userId, code);
    return res.json({ success: true, data: { code, invites: 0, rewardPoints: 0, isSuspended: false } });
  }

  res.json({
    success: true,
    data: {
      code: referral.code,
      invites: referral.invites,
      rewardPoints: referral.reward_points,
      isSuspended: referral.is_suspended || false,
      updatedAt: referral.updated_at
    }
  });
});

router.post('/claim', referralsLimiter, requireAuth, async (req, res) => {
  const { code } = req.body || {};

  // 1. Code must be present and match expected format
  if (!code) {
    return res.status(400).json({ success: false, error: 'Referral code is required' });
  }
  const normalised = String(code).trim().toUpperCase();
  if (!REFERRAL_CODE_REGEX.test(normalised)) {
    return res.status(400).json({ success: false, error: 'Invalid referral code format' });
  }

  // 2. Account-age gate: only newly registered accounts may claim
  const claimer = await db.prepare('SELECT id, created_at FROM users WHERE id = ?').get(req.userId);
  if (!claimer) {
    return res.status(400).json({ success: false, error: 'Invalid referral code' });
  }
  const accountAgeMs = Date.now() - new Date(claimer.created_at).getTime();
  if (accountAgeMs > NEW_ACCOUNT_MAX_MINUTES * 60 * 1000) {
    return res.status(400).json({ success: false, error: 'Referral codes can only be applied at registration' });
  }

  // 3. One-claim-per-user: check referral_uses for existing claim by this user
  const existingClaim = await db.prepare('SELECT id FROM referral_uses WHERE claimer_user_id = ?').get(req.userId);
  if (existingClaim) {
    return res.status(400).json({ success: false, error: 'You have already used a referral code' });
  }

  // 4. Referrer must exist, code must not be self-referral, must not be suspended
  const referrer = await db.prepare('SELECT user_id, is_suspended FROM referrals WHERE code = ?').get(normalised);
  if (!referrer) {
    return res.status(400).json({ success: false, error: 'Invalid referral code' });
  }
  if (referrer.user_id === req.userId) {
    return res.status(400).json({ success: false, error: 'Invalid referral code' });
  }
  if (referrer.is_suspended) {
    return res.status(400).json({ success: false, error: 'This referral code is no longer active' });
  }

  // 5. Fraud cooldown: count claims for this referrer in the past 24 hours
  const recentClaims = await db.prepare(
    "SELECT COUNT(*) AS cnt FROM referral_uses WHERE referrer_user_id = ? AND claimed_at > NOW() - INTERVAL '24 hours'"
  ).get(referrer.user_id);
  const recentCount = parseInt(recentClaims?.cnt ?? recentClaims?.count ?? 0, 10);

  if (recentCount >= FRAUD_CLAIM_LIMIT) {
    // Auto-suspend the code and flag for review
    await db.prepare('UPDATE referrals SET is_suspended = true, suspended_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(referrer.user_id);
    return res.status(400).json({ success: false, error: 'This referral code has been temporarily suspended' });
  }

  // 6. Record claim in referral_uses (idempotency guard)
  await db.prepare(
    'INSERT INTO referral_uses (code, referrer_user_id, claimer_user_id) VALUES (?, ?, ?)'
  ).run(normalised, referrer.user_id, req.userId);

  // 7. Credit the referrer
  await db.prepare(
    'UPDATE referrals SET invites = invites + 1, reward_points = reward_points + 100, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
  ).run(referrer.user_id);

  res.json({ success: true, data: { rewardPointsGranted: 100 } });
});

export default router;
