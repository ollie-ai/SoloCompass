-- SoloCompass Database Migration v028
-- Missing Tables & Column Fixes (SC-SHARED-08 audit remediation)
-- Created: 2026-04-14
-- All statements are idempotent (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)

-- ============================================================
-- New Tables
-- ============================================================

-- Trip legs (multi-destination leg structure)
CREATE TABLE IF NOT EXISTS trip_legs (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    leg_order INTEGER NOT NULL DEFAULT 1,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    departure_date DATE,
    arrival_date DATE,
    transport_mode TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transport segments (multi-modal transport per leg)
CREATE TABLE IF NOT EXISTS transport_segments (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    trip_leg_id INTEGER REFERENCES trip_legs(id) ON DELETE SET NULL,
    mode TEXT DEFAULT 'other' CHECK(mode IN ('flight', 'train', 'bus', 'ferry', 'car', 'other')),
    provider TEXT,
    from_location TEXT,
    to_location TEXT,
    departure_datetime TIMESTAMP,
    arrival_datetime TIMESTAMP,
    booking_ref TEXT,
    seat_info TEXT,
    cost NUMERIC,
    currency TEXT DEFAULT 'USD',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Journal entries
CREATE TABLE IF NOT EXISTS journal_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trip_id INTEGER REFERENCES trips(id) ON DELETE SET NULL,
    entry_date DATE DEFAULT CURRENT_DATE,
    title TEXT,
    text TEXT,
    mood TEXT,
    location TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Journal photos
CREATE TABLE IF NOT EXISTS journal_photos (
    id SERIAL PRIMARY KEY,
    journal_entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    caption TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Atlas conversations (AI conversation history)
CREATE TABLE IF NOT EXISTS atlas_conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trip_id INTEGER REFERENCES trips(id) ON DELETE SET NULL,
    title TEXT,
    messages TEXT NOT NULL DEFAULT '[]',
    model_used TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feature flags
CREATE TABLE IF NOT EXISTS feature_flags (
    id SERIAL PRIMARY KEY,
    flag_key TEXT UNIQUE NOT NULL,
    is_enabled BOOLEAN DEFAULT false,
    description TEXT,
    allowed_tiers TEXT DEFAULT '[]',
    rollout_percentage INTEGER DEFAULT 100 CHECK(rollout_percentage >= 0 AND rollout_percentage <= 100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Safe return plans
CREATE TABLE IF NOT EXISTS safe_return_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    plan_json TEXT NOT NULL,
    emergency_contacts_snapshot TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Guardian invites (invite lifecycle, complements guardian_acknowledgements)
CREATE TABLE IF NOT EXISTS guardian_invites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id INTEGER NOT NULL REFERENCES emergency_contacts(id) ON DELETE CASCADE,
    invite_token TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined', 'expired')),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Weather cache (destination weather forecasts)
CREATE TABLE IF NOT EXISTS weather_cache (
    id SERIAL PRIMARY KEY,
    destination_id INTEGER REFERENCES destinations(id) ON DELETE SET NULL,
    location_key TEXT NOT NULL,
    forecast_json TEXT NOT NULL,
    fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    UNIQUE(location_key)
);

-- User usage stats (unified metered usage)
CREATE TABLE IF NOT EXISTS user_usage_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_trips INTEGER DEFAULT 0,
    total_ai_queries INTEGER DEFAULT 0,
    total_check_ins INTEGER DEFAULT 0,
    last_active TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Inbound webhook dedup
CREATE TABLE IF NOT EXISTS webhook_inbound_logs (
    id SERIAL PRIMARY KEY,
    provider TEXT NOT NULL,
    event_id TEXT NOT NULL,
    payload TEXT,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id)
);

-- Travel stats (aggregated personal stats)
CREATE TABLE IF NOT EXISTS travel_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    countries_visited INTEGER DEFAULT 0,
    cities_visited INTEGER DEFAULT 0,
    trips_completed INTEGER DEFAULT 0,
    total_days_abroad INTEGER DEFAULT 0,
    total_distance_km NUMERIC DEFAULT 0,
    favourite_region TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Safety scores (destination safety assessments)
CREATE TABLE IF NOT EXISTS safety_scores (
    id SERIAL PRIMARY KEY,
    destination_id INTEGER NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
    overall_score NUMERIC,
    crime_index NUMERIC,
    health_risk TEXT,
    political_stability TEXT,
    transport_safety TEXT,
    solo_female_score NUMERIC,
    assessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Atlas prompt templates
CREATE TABLE IF NOT EXISTS atlas_prompt_templates (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    version INTEGER DEFAULT 1,
    system_prompt TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Boarding passes (linked to transport_segments)
CREATE TABLE IF NOT EXISTS boarding_passes (
    id SERIAL PRIMARY KEY,
    transport_segment_id INTEGER NOT NULL REFERENCES transport_segments(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    raw_barcode TEXT,
    parsed_data TEXT,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Destination routes (inter-destination connections)
CREATE TABLE IF NOT EXISTS destination_routes (
    id SERIAL PRIMARY KEY,
    from_destination_id INTEGER NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
    to_destination_id INTEGER NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
    transport_modes TEXT,
    avg_duration_hours NUMERIC,
    avg_cost_usd NUMERIC,
    notes TEXT,
    UNIQUE(from_destination_id, to_destination_id)
);

-- ============================================================
-- Column additions to existing tables (all idempotent)
-- ============================================================

DO $$
BEGIN
    -- reviews: add destination_id FK for referential integrity
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'reviews' AND column_name = 'destination_id'
    ) THEN
        ALTER TABLE reviews ADD COLUMN destination_id INTEGER REFERENCES destinations(id) ON DELETE SET NULL;
    END IF;

    -- places: add status column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'places' AND column_name = 'status'
    ) THEN
        ALTER TABLE places ADD COLUMN status TEXT DEFAULT 'saved' CHECK(status IN ('saved', 'visited', 'skipped'));
    END IF;

    -- places: add rating column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'places' AND column_name = 'rating'
    ) THEN
        ALTER TABLE places ADD COLUMN rating NUMERIC CHECK(rating >= 0 AND rating <= 5);
    END IF;

    -- ai_usage: add per-query cost column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_usage' AND column_name = 'cost_usd'
    ) THEN
        ALTER TABLE ai_usage ADD COLUMN cost_usd NUMERIC;
    END IF;

    -- itinerary_versions: add diff column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'itinerary_versions' AND column_name = 'diff'
    ) THEN
        ALTER TABLE itinerary_versions ADD COLUMN diff TEXT;
    END IF;

    -- packing_items: add weight_grams column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'packing_items' AND column_name = 'weight_grams'
    ) THEN
        ALTER TABLE packing_items ADD COLUMN weight_grams NUMERIC;
    END IF;

    -- packing_items: add status column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'packing_items' AND column_name = 'status'
    ) THEN
        ALTER TABLE packing_items ADD COLUMN status TEXT DEFAULT 'unpacked'
            CHECK(status IN ('unpacked', 'packed', 'left_behind'));
    END IF;

    -- destinations: add solo_score alias
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'destinations' AND column_name = 'solo_score'
    ) THEN
        ALTER TABLE destinations ADD COLUMN solo_score INTEGER;
    END IF;

    -- destinations: add cost_level alias
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'destinations' AND column_name = 'cost_level'
    ) THEN
        ALTER TABLE destinations ADD COLUMN cost_level TEXT;
    END IF;
END $$;

-- Sync alias columns from canonical columns
UPDATE destinations
SET solo_score = solo_friendly_rating
WHERE solo_score IS NULL AND solo_friendly_rating IS NOT NULL;

UPDATE destinations
SET cost_level = budget_level
WHERE cost_level IS NULL AND budget_level IS NOT NULL;

-- trip_places view (spec-compliant alias for places table)
-- Only created if a trip_places base table does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'trip_places' AND table_type = 'BASE TABLE'
  ) THEN
    EXECUTE 'CREATE OR REPLACE VIEW trip_places AS SELECT * FROM places';
  END IF;
END $$;

-- ============================================================
-- Indexes for new tables
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_trip_legs_trip ON trip_legs(trip_id);
CREATE INDEX IF NOT EXISTS idx_transport_segments_trip ON transport_segments(trip_id);
CREATE INDEX IF NOT EXISTS idx_transport_segments_leg ON transport_segments(trip_leg_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_trip ON journal_entries(trip_id);
CREATE INDEX IF NOT EXISTS idx_journal_photos_entry ON journal_photos(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_atlas_conversations_user ON atlas_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_weather_cache_key ON weather_cache(location_key);
CREATE INDEX IF NOT EXISTS idx_weather_cache_expires ON weather_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_guardian_invites_user ON guardian_invites(user_id);
CREATE INDEX IF NOT EXISTS idx_guardian_invites_token ON guardian_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_safety_scores_destination ON safety_scores(destination_id);
CREATE INDEX IF NOT EXISTS idx_webhook_inbound_event_id ON webhook_inbound_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_checkins_scheduled ON scheduled_check_ins(scheduled_time);
