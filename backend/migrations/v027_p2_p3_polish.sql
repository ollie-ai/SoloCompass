-- Migration v027: P2/P3 Polish - New tables and enhancements
-- Idempotent: safe to run multiple times

BEGIN;

-- 1. Connected accounts for social logins
CREATE TABLE IF NOT EXISTS connected_accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_user_id VARCHAR(255) NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  profile_data JSONB,
  connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_connected_accounts_user ON connected_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_connected_accounts_provider ON connected_accounts(provider, provider_user_id);

-- 2. Notification logs with status/error tracking
CREATE TABLE IF NOT EXISTS notification_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notification_type VARCHAR(100) NOT NULL,
  channel VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'queued',
  provider_message_id VARCHAR(255),
  error_message TEXT,
  error_code VARCHAR(100),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created ON notification_logs(created_at);

-- 3. Notification preferences enhancements
DO $$ BEGIN
  ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN DEFAULT false;
  ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS payment_notifications BOOLEAN DEFAULT true;
  ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS marketing_notifications BOOLEAN DEFAULT false;
  ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS digest_frequency VARCHAR(20) DEFAULT 'weekly';
  ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS quiet_hours_start TIME;
  ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS quiet_hours_end TIME;
  ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS quiet_hours_timezone VARCHAR(50) DEFAULT 'UTC';
  ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS sound_enabled BOOLEAN DEFAULT true;
  ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS vibration_enabled BOOLEAN DEFAULT true;
END $$;

-- 4. Privacy settings
CREATE TABLE IF NOT EXISTS privacy_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_visibility VARCHAR(20) DEFAULT 'public' CHECK(profile_visibility IN ('public', 'friends', 'private')),
  location_sharing BOOLEAN DEFAULT false,
  activity_visibility VARCHAR(20) DEFAULT 'friends' CHECK(activity_visibility IN ('public', 'friends', 'private')),
  show_online_status BOOLEAN DEFAULT true,
  allow_buddy_requests BOOLEAN DEFAULT true,
  show_trip_history BOOLEAN DEFAULT false,
  show_reviews BOOLEAN DEFAULT true,
  data_collection_consent BOOLEAN DEFAULT true,
  analytics_consent BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_privacy_settings_user ON privacy_settings(user_id);

-- 5. Login activity for login history tracking
CREATE TABLE IF NOT EXISTS login_activity (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  device_type VARCHAR(50),
  browser VARCHAR(100),
  os VARCHAR(100),
  location VARCHAR(255),
  login_method VARCHAR(50) DEFAULT 'password',
  success BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_login_activity_user ON login_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_login_activity_created ON login_activity(created_at);

-- 6. User settings for units, accessibility, i18n
CREATE TABLE IF NOT EXISTS user_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  distance_unit VARCHAR(10) DEFAULT 'km' CHECK(distance_unit IN ('km', 'mi')),
  temperature_unit VARCHAR(5) DEFAULT 'C' CHECK(temperature_unit IN ('C', 'F')),
  currency_preference VARCHAR(10) DEFAULT 'GBP',
  locale VARCHAR(10) DEFAULT 'en',
  font_size VARCHAR(10) DEFAULT 'medium' CHECK(font_size IN ('small', 'medium', 'large', 'xlarge')),
  high_contrast BOOLEAN DEFAULT false,
  reduced_motion BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);

-- 7. Billing usage tracking per billing period
CREATE TABLE IF NOT EXISTS billing_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  billing_period_start TIMESTAMP NOT NULL,
  billing_period_end TIMESTAMP NOT NULL,
  ai_itineraries_used INTEGER DEFAULT 0,
  checkins_used INTEGER DEFAULT 0,
  buddy_requests_used INTEGER DEFAULT 0,
  ai_chats_used INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_billing_usage_user ON billing_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_usage_period ON billing_usage(billing_period_start, billing_period_end);

-- 8. Trial columns on users table
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_starts_at TIMESTAMP;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT false;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_tier VARCHAR(20) DEFAULT 'none';
END $$;

-- 9. Read receipts on messages table
DO $$ BEGIN
  ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP;
END $$;

-- 10. Payment retry log for dunning/retry
CREATE TABLE IF NOT EXISTS payment_retry_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_invoice_id VARCHAR(255),
  attempt_number INTEGER DEFAULT 1,
  status VARCHAR(50) DEFAULT 'pending',
  error_message TEXT,
  next_retry_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payment_retry_user ON payment_retry_log(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_retry_status ON payment_retry_log(status);

COMMIT;
