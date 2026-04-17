-- SoloCompass Database Migration v027
-- Critical Events Table (guaranteed-delivery for SOS and high-priority alerts)
-- Created: 2026-04-14

-- A background retry job should query:
--   SELECT * FROM critical_events
--   WHERE status IN ('pending', 'failed') AND delivery_attempts < 10
--   ORDER BY created_at ASC;
-- and attempt re-delivery, incrementing delivery_attempts on each attempt
-- and setting status = 'delivered' / delivered_at when successful.

CREATE TABLE IF NOT EXISTS critical_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'delivered', 'failed')),
    delivery_attempts INTEGER DEFAULT 0,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_critical_events_user ON critical_events(user_id);
CREATE INDEX IF NOT EXISTS idx_critical_events_status ON critical_events(status);
