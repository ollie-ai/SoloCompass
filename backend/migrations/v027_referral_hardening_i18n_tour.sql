-- Migration v027: Referral anti-abuse, i18n tour tracking
-- Adds referral_uses join table, fraud suspension columns, and per-user tour_seen flag.

-- 1. referral_uses: tracks every successful claim (one row per claimer)
CREATE TABLE IF NOT EXISTS referral_uses (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  referrer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(claimer_user_id)          -- one claim per user, ever
);

CREATE INDEX IF NOT EXISTS idx_referral_uses_code ON referral_uses(code);
CREATE INDEX IF NOT EXISTS idx_referral_uses_referrer ON referral_uses(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_uses_claimer ON referral_uses(claimer_user_id);

-- 2. Fraud-suspension columns on the referrals table
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE;

-- 3. Per-user feature-tour tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS tour_seen BOOLEAN DEFAULT false;

COMMENT ON TABLE referral_uses IS 'Idempotency log for referral claims — each user may appear as claimer at most once';
COMMENT ON COLUMN referrals.is_suspended IS 'Set to true when fraud cooldown threshold is breached';
COMMENT ON COLUMN referrals.suspended_at IS 'Timestamp when the code was auto-suspended';
COMMENT ON COLUMN users.tour_seen IS 'Whether the user has dismissed the feature-tour across all devices';
