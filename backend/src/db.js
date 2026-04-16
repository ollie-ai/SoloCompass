import pg from 'pg';
import logger from './services/logger.js';

const { Pool } = pg;

// Lazy Pool initialization
let pool;
const getPool = () => {
    if (!pool) {
        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) {
            logger.warn('[DB] DATABASE_URL not yet available. Waiting for secrets.');
            return null;
        }
        
        const isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
        const poolConfig = {
          connectionString: databaseUrl,
          ssl: isLocal ? false : { rejectUnauthorized: false },
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
        };

        pool = new Pool(poolConfig);
        pool.on('error', (err) => logger.error('[DB] Unexpected error on idle client:', err.message));
    }
    return pool;
};



// Helper: convert SQLite-style ? placeholders to PostgreSQL $1, $2, etc.
function convertPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

// Helper: automatically add RETURNING id to INSERT queries so lastInsertRowid works in PostgreSQL
function addReturningForInsert(sql) {
  const trimmed = sql.trim().toUpperCase();
  if (trimmed.startsWith('INSERT') && !trimmed.includes('RETURNING')) {
    return sql + ' RETURNING id';
  }
  return sql;
}

// Database wrapper that mimics better-sqlite3 API
const db = {
  /**
   * Execute a query and return all rows
   */
  all(sql, ...params) {
    const p = getPool();
    if (!p) throw new Error('Database pool not initialized');
    return p.query(convertPlaceholders(sql), params).then(res => res.rows);
  },

  /**
   * Execute a query and return first row
   */
  get(sql, ...params) {
    const p = getPool();
    if (!p) throw new Error('Database pool not initialized');
    return p.query(convertPlaceholders(sql), params).then(res => res.rows[0] || null);
  },

  /**
   * Execute a query and return metadata (lastInsertRowid, etc.)
   */
  run(sql, ...params) {
    const p = getPool();
    if (!p) throw new Error('Database pool not initialized');
    const convertedSql = addReturningForInsert(convertPlaceholders(sql));
    return p.query(convertedSql, params).then(res => {
      const row = res.rows[0];
      const lastInsertRowid = row ? (row.id || row.ID || row.lastval || Object.values(row)[0]) : null;
      return {
        lastInsertRowid,
        changes: res.rowCount,
        rows: res.rows
      };
    }).catch(err => {
      // Only log SQL in debug mode to avoid leaking sensitive data in production
      if (process.env.DEBUG_DB === 'true') {
        logger.error(`[DB] run failed: ${err.message} | SQL: ${convertedSql}`);
      } else {
        logger.error(`[DB] run failed: ${err.message}`);
      }
      throw err;
    });
  },

  /**
   * Execute raw SQL
   */
  exec(sql) {
    const p = getPool();
    if (!p) throw new Error('Database pool not initialized');
    return p.query(sql);
  },

  /**
   * Execute query directly on pool (returns raw pg result)
   */
  query(sql, params) {
    const p = getPool();
    if (!p) throw new Error('Database pool not initialized');
    return p.query(convertPlaceholders(sql), params);
  },

  /**
   * Prepare statement (for transactions - simplified for PostgreSQL)
   */
  prepare(sql) {
    const convertedSql = addReturningForInsert(convertPlaceholders(sql));
    return {
      all: (...params) => {
          const p = getPool();
          if (!p) throw new Error('Database pool not initialized');
          return p.query(convertedSql, params).then(res => res.rows);
      },
      get: (...params) => {
          const p = getPool();
          if (!p) throw new Error('Database pool not initialized');
          return p.query(convertedSql, params).then(res => res.rows[0] || null);
      },
      run: (...params) => {
          const p = getPool();
          if (!p) throw new Error('Database pool not initialized');
          return p.query(convertedSql, params).then(res => {
            const row = res.rows[0];
            const lastInsertRowid = row ? (row.id || row.ID || row.lastval || Object.values(row)[0]) : null;
            return {
              lastInsertRowid,
              changes: res.rowCount,
              rows: res.rows
            };
          }).catch(err => {
            // Only log SQL in debug mode to avoid leaking sensitive data in production
            if (process.env.DEBUG_DB === 'true') {
              logger.error(`[DB] prepare.run failed: ${err.message} | SQL: ${convertedSql}`);
            } else {
              logger.error(`[DB] prepare.run failed: ${err.message}`);
            }
            throw err;
          });
      }
    };
  },

/**
    * Transaction support
    */
  transaction(fn) {
    const pool = getPool();
    if (!pool) throw new Error('Database pool not initialized');
    
    return (async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({
          query: (sql, ...params) => client.query(convertPlaceholders(sql), params).then(res => res.rows),
          get: (sql, ...params) => client.query(convertPlaceholders(sql), params).then(res => res.rows[0] || null),
          run: (sql, ...params) => client.query(convertPlaceholders(sql), params).then(res => ({
            lastInsertRowid: res.rows[0]?.id,
            changes: res.rowCount,
            rows: res.rows
          }))
        });
await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    })();
  },

  /**
   * Close pool
   */
  close() {
    return pool ? pool.end() : Promise.resolve();
  }
};

// Initialize database schema
async function initializeDatabase() {
  try {
    const p = getPool();
    if (!p) {
        logger.warn('[DB] initializeDatabase skipped: Pool not ready.');
        return;
    }
    logger.info('[DB] Initializing PostgreSQL database...');

    // Create all tables
    await p.query(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        role TEXT DEFAULT 'user' CHECK(role IN ('user', 'viewer', 'admin')),
        is_premium BOOLEAN DEFAULT false,
        is_flagged BOOLEAN DEFAULT false,
        subscription_tier TEXT DEFAULT 'free',
        stripe_customer_id TEXT,
        premium_expires_at TIMESTAMP,
        reset_token TEXT,
        reset_token_expires TIMESTAMP,
        is_verified BOOLEAN DEFAULT false,
        verification_token TEXT,
        failed_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Profiles table
      CREATE TABLE IF NOT EXISTS profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        avatar_url TEXT,
        bio TEXT,
        display_name TEXT,
        phone TEXT,
        home_city TEXT,
        home_base TEXT,
        company TEXT,
        website TEXT,
        travel_style TEXT,
        budget_level TEXT,
        pace TEXT,
        accommodation_type TEXT,
        interests TEXT,
        meet_preferences TEXT,
        comfort_level TEXT,
        preferred_climate TEXT,
        trip_duration INTEGER,
        solo_travel_experience TEXT,
        safety_priority TEXT,
        visible BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Sessions table
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        refresh_token TEXT,
        device_info TEXT,
        ip_address TEXT,
        user_agent TEXT,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Create index on sessions table
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);
      CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);

      -- Categories table
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Resources table
      CREATE TABLE IF NOT EXISTS resources (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        type TEXT,
        name TEXT NOT NULL,
        description TEXT,
        data TEXT,
        status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
        tags TEXT,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Quiz responses table
      CREATE TABLE IF NOT EXISTS quiz_responses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        answers TEXT, 
        result TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Quiz results table (processed quiz outcomes)
      CREATE TABLE IF NOT EXISTS quiz_results (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        dominant_style TEXT,
        scores TEXT,
        summary TEXT,
        adventure_level TEXT,
        social_style TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Countries table (AI-researched destination data)
      CREATE TABLE IF NOT EXISTS countries (
        id SERIAL PRIMARY KEY,
        code VARCHAR(2) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        slug TEXT UNIQUE,
        region VARCHAR(50),
        subregion VARCHAR(50),
        flag_emoji VARCHAR(10),
        currency VARCHAR(10),
        currency_symbol VARCHAR(5),
        language VARCHAR(100),
        timezone VARCHAR(50),
        calling_code VARCHAR(10),

        -- Base metadata
        population BIGINT,
        capital_city VARCHAR(100),
        
        -- AI Researched Content - Overview (EN)
        overview TEXT,
        solo_safety_score INTEGER,
        solo_friendly_rating VARCHAR(20),
        safety_overview TEXT,
        best_regions_for_solo TEXT,
        regions_to_avoid TEXT,
        transport_tips TEXT,
        cultural_etiquette TEXT,
        common_scams TEXT,
        local_customs TEXT,
        
        -- Emergency & Costs
        emergency_number VARCHAR(20),
        police_number VARCHAR(20),
        ambulance_number VARCHAR(20),
        embassy_info TEXT,
        budget_daily_local DECIMAL(10,2),
        budget_daily_tourist DECIMAL(10,2),
        budget_accommodation DECIMAL(10,2),
        budget_food DECIMAL(10,2),
        
        -- Solo-Specific Insights
        solo_female_safe BOOLEAN,
        lgbtq_friendly BOOLEAN,
        digital_nomad_score INTEGER,
        nightlife_safety TEXT,
        
        -- Images
        hero_image VARCHAR(500),
        
        -- Research metadata
        research_status VARCHAR(20) DEFAULT 'pending' CHECK(research_status IN ('pending', 'processing', 'completed', 'failed')),
        publication_status VARCHAR(20) DEFAULT 'pending_review' CHECK(publication_status IN ('pending_review', 'approved', 'rejected', 'published')),
        reviewed_by INTEGER REFERENCES users(id),
        reviewed_at TIMESTAMP,
        research_version INTEGER DEFAULT 1,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Cities table (AI-researched city data)
      CREATE TABLE IF NOT EXISTS cities (
        id SERIAL PRIMARY KEY,
        country_id INTEGER REFERENCES countries(id),
        name VARCHAR(100) NOT NULL,
        slug TEXT UNIQUE,
        population BIGINT,
        
        -- AI Researched Content (EN)
        overview TEXT,
        solo_score INTEGER,
        solo_nightlife TEXT,
        solo_dining TEXT,
        best_neighborhoods_for_solo TEXT,
        areas_to_avoid TEXT,
        transport_system TEXT,
        transport_tips TEXT,
        safety_areas TEXT,
        coworking_spaces TEXT,
        emergency_info TEXT,
        
        -- Costs (in local currency)
        avg_daily_budget DECIMAL(10,2),
        accommodation_avg DECIMAL(10,2),
        meal_avg DECIMAL(10,2),
        
        -- Solo-specific
        solo_female_friendly BOOLEAN,
        coworking_hub BOOLEAN,
        
        -- Images
        hero_image VARCHAR(500),
        
        -- Metadata
        research_status VARCHAR(20) DEFAULT 'pending',
        publication_status VARCHAR(20) DEFAULT 'pending_review',
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Destinations table
      CREATE TABLE IF NOT EXISTS destinations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE,
        destination_type TEXT,
        country TEXT NOT NULL,
        region TEXT,
        city TEXT,
        primary_city TEXT,
        timezone TEXT,
        description TEXT,
        highlights TEXT,
        travel_styles TEXT,
        budget_level TEXT,
        climate TEXT,
        best_months TEXT,
        safety_rating TEXT,
        solo_friendly_rating INTEGER,
        image_url TEXT,
        destination_tips TEXT,
        fcdo_slug TEXT,
        fcdo_alert_status TEXT,
        fcdo_updated_at TEXT,
        latitude REAL,
        longitude REAL,
        emergency_contacts TEXT,
        safety_intelligence TEXT,
        
        -- Publishing and Governance Fields
        publication_status TEXT DEFAULT 'draft' CHECK(publication_status IN ('draft', 'pending_review', 'live', 'paused', 'blocked')),
        safety_gate_status TEXT DEFAULT 'unchecked' CHECK(safety_gate_status IN ('unchecked', 'pass', 'fail')),
        manual_review_status TEXT DEFAULT 'pending' CHECK(manual_review_status IN ('pending', 'approved', 'rejected')),
        reviewer INTEGER REFERENCES users(id),
        reviewed_at TIMESTAMP,
        advisory_checked_at TIMESTAMP,
        advisory_source TEXT,
        advisory_summary TEXT,
        stale_after TIMESTAMP,
        notes_for_internal_review TEXT,
        
        -- Safety Intelligence Fields
        internal_safety_tier TEXT,
        internal_confidence_score REAL,
        common_risks TEXT,
        safer_areas_summary TEXT,
        areas_extra_caution TEXT,
        after_dark_guidance TEXT,
        transport_safety_notes TEXT,
        women_solo_notes TEXT,
        lgbtq_notes TEXT,
        emergency_prep_note TEXT,
        scam_harassment_patterns TEXT,
        
        -- Product Content Fields
        short_summary TEXT,
        why_solo_travellers TEXT,
        best_for_tags TEXT,
        climate_summary TEXT,
        arrival_tips TEXT,
        local_etiquette_notes TEXT,
        ideal_trip_length TEXT,
        neighbourhood_shortlist TEXT,
        content_freshness_date TIMESTAMP,
        
        -- AI Generation Ops Fields
        ai_batch_run_id TEXT,
        ai_prompt_version TEXT,
        ai_briefing_status TEXT DEFAULT 'pending' CHECK(ai_briefing_status IN ('pending', 'generated', 'reviewed', 'published')),
        ai_quality_score REAL,
        fallback_summary_available BOOLEAN DEFAULT FALSE,
        source_pack_complete BOOLEAN DEFAULT FALSE,
        ai_card_summary TEXT,
        ai_safety_brief TEXT,
        ai_solo_suitability TEXT,
        ai_arrival_checklist TEXT,
        ai_neighbourhood_guidance TEXT,
        ai_after_dark TEXT,
        ai_common_friction TEXT,
        ai_quick_facts TEXT,
        ai_fallback_summary TEXT,
        
        -- Legacy fields
        status TEXT DEFAULT 'live' CHECK(status IN ('pending', 'live', 'flagged')),
        source TEXT DEFAULT 'manual' CHECK(source IN ('manual', 'ai')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Trips table
      CREATE TABLE IF NOT EXISTS trips (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        destination TEXT NOT NULL,
        start_date DATE,
        end_date DATE,
        budget NUMERIC,
        vibe_check TEXT,
        solo_vibe TEXT DEFAULT 'balanced',
        generation_status TEXT DEFAULT 'idle',
        status TEXT DEFAULT 'planning' CHECK(status IN ('planning', 'confirmed', 'completed', 'cancelled')),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Trip shares for public sharing
      CREATE TABLE IF NOT EXISTS trip_shares (
        id SERIAL PRIMARY KEY,
        trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        share_code TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Trip collaborators (for shared editing)
      CREATE TABLE IF NOT EXISTS trip_collaborators (
        id SERIAL PRIMARY KEY,
        trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        role TEXT DEFAULT 'editor' CHECK(role IN ('editor', 'viewer')),
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(trip_id, user_id)
      );

      -- Itinerary days table
      CREATE TABLE IF NOT EXISTS itinerary_days (
        id SERIAL PRIMARY KEY,
        trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        day_number INTEGER NOT NULL,
        date DATE,
        activities TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Activities table
      CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        day_id INTEGER NOT NULL REFERENCES itinerary_days(id) ON DELETE CASCADE,
        trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT,
        location TEXT,
        time TEXT,
        duration_hours NUMERIC,
        cost NUMERIC,
        booking_info TEXT,
        notes TEXT,
        order_index INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- AI itinerary cache
      CREATE TABLE IF NOT EXISTS ai_itinerary_cache (
        id SERIAL PRIMARY KEY,
        destination TEXT NOT NULL,
        days INTEGER NOT NULL,
        pace TEXT NOT NULL,
        solo_vibe TEXT NOT NULL,
        travel_style TEXT NOT NULL,
        itinerary_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Itinerary versions table (for preserving old itineraries when regenerating)
      CREATE TABLE IF NOT EXISTS itinerary_versions (
        id SERIAL PRIMARY KEY,
        trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        days_json TEXT NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Accommodations table
      CREATE TABLE IF NOT EXISTS accommodations (
        id SERIAL PRIMARY KEY,
        trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'other' CHECK(type IN ('hotel', 'airbnb', 'hostel', 'other')),
        address TEXT,
        check_in_date DATE,
        check_out_date DATE,
        confirmation_number TEXT,
        notes TEXT,
        cost NUMERIC,
        currency TEXT DEFAULT 'USD',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Bookings table (flights, trains, tours, etc.)
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        type TEXT DEFAULT 'other' CHECK(type IN ('flight', 'train', 'tour', 'activity', 'insurance', 'other')),
        provider TEXT,
        confirmation_number TEXT,
        booking_reference TEXT,
        booking_date DATE,
        travel_date DATE,
        return_date DATE,
        departure_location TEXT,
        arrival_location TEXT,
        departure_datetime TIMESTAMP,
        arrival_datetime TIMESTAMP,
        cost NUMERIC,
        currency TEXT DEFAULT 'USD',
        reference TEXT,
        notes TEXT,
        status TEXT DEFAULT 'confirmed' CHECK(status IN ('confirmed', 'pending', 'cancelled', 'completed')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Saved places table
      CREATE TABLE IF NOT EXISTS places (
        id SERIAL PRIMARY KEY,
        trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        address TEXT,
        category TEXT DEFAULT 'other' CHECK(category IN ('restaurant', 'cafe', 'museum', 'park', 'shopping', 'nightlife', 'landmark', 'transport', 'accommodation', 'other')),
        latitude REAL,
        longitude REAL,
        notes TEXT,
        visited BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Buddy Messages table
      CREATE TABLE IF NOT EXISTS buddy_messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL REFERENCES users(id),
        content TEXT NOT NULL,
        message_type TEXT DEFAULT 'text' CHECK(message_type IN ('text', 'image', 'system')),
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Buddy Conversations table
      CREATE TABLE IF NOT EXISTS buddy_conversations (
        id SERIAL PRIMARY KEY,
        participant_a INTEGER NOT NULL REFERENCES users(id),
        participant_b INTEGER NOT NULL REFERENCES users(id),
        trip_id INTEGER REFERENCES trips(id),
        last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Check-ins table
      CREATE TABLE IF NOT EXISTS check_ins (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        trip_id INTEGER,
        type TEXT DEFAULT 'safe',
        latitude REAL,
        longitude REAL,
        address TEXT,
        message TEXT,
        check_in_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'missed', 'cancelled')),
        sent_to TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Scheduled check-ins
      CREATE TABLE IF NOT EXISTS scheduled_check_ins (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        trip_id INTEGER,
        scheduled_time TIMESTAMP,
        timezone TEXT DEFAULT 'UTC',
        is_active BOOLEAN DEFAULT true,
        missed_at TIMESTAMP,
        final_warning_sent BOOLEAN DEFAULT false,
        sos_triggered BOOLEAN DEFAULT false,
        interval_minutes INTEGER,
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        is_recurring BOOLEAN DEFAULT false,
        next_checkin_time TIMESTAMP,
        missed_count INTEGER DEFAULT 0,
        escalation_level INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Emergency contacts
      CREATE TABLE IF NOT EXISTS emergency_contacts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        relationship TEXT DEFAULT 'friend',
        is_primary BOOLEAN DEFAULT false,
        notify_on_checkin BOOLEAN DEFAULT true,
        notify_on_emergency BOOLEAN DEFAULT true,
        prefer_email BOOLEAN DEFAULT true,
        prefer_sms BOOLEAN DEFAULT false,
        delivery_order TEXT DEFAULT 'email_first',
        verified BOOLEAN DEFAULT false,
        verification_code TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Webhook subscriptions
      CREATE TABLE IF NOT EXISTS webhook_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        webhook_url TEXT NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Push notification subscriptions (FCM)
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        keys TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, endpoint)
      );

      -- Page views
      CREATE TABLE IF NOT EXISTS page_views (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        path TEXT NOT NULL,
        referrer TEXT,
        user_agent TEXT,
        ip_hash TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Events
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        event_name TEXT NOT NULL,
        event_data TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Packing lists table
      CREATE TABLE IF NOT EXISTS packing_lists (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        is_shared BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Packing items table
      CREATE TABLE IF NOT EXISTS packing_items (
        id SERIAL PRIMARY KEY,
        packing_list_id INTEGER NOT NULL REFERENCES packing_lists(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'other',
        quantity INTEGER DEFAULT 1,
        is_packed BOOLEAN DEFAULT false,
        is_essential BOOLEAN DEFAULT false,
        is_custom BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Packing templates table
      CREATE TABLE IF NOT EXISTS packing_templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        climate TEXT,
        trip_type TEXT,
        items TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Packing list shares table
      CREATE TABLE IF NOT EXISTS packing_list_shares (
        id SERIAL PRIMARY KEY,
        packing_list_id INTEGER NOT NULL REFERENCES packing_lists(id) ON DELETE CASCADE,
        shared_with_user_id INTEGER,
        share_token TEXT UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Reviews table
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        destination TEXT,
        venue_name TEXT,
        venue_address TEXT,
        venue_type TEXT DEFAULT 'other',
        overall_rating INTEGER NOT NULL CHECK(overall_rating >= 1 AND overall_rating <= 5),
        solo_friendly_rating INTEGER CHECK(solo_friendly_rating >= 1 AND solo_friendly_rating <= 5),
        safety_rating INTEGER CHECK(safety_rating >= 1 AND safety_rating <= 5),
        value_rating INTEGER CHECK(value_rating >= 1 AND value_rating <= 5),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        photos TEXT DEFAULT '[]',
        is_verified BOOLEAN DEFAULT false,
        helpful_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS review_helpful (
        id SERIAL PRIMARY KEY,
        review_id INTEGER REFERENCES reviews(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(review_id, user_id)
      );

      -- Budget tracking table
      CREATE TABLE IF NOT EXISTS budget_entries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        trip_id INTEGER REFERENCES trips(id) ON DELETE SET NULL,
        category TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        currency TEXT DEFAULT 'GBP',
        description TEXT,
        date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Travel buddies table
      CREATE TABLE IF NOT EXISTS travel_buddies (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        destination TEXT NOT NULL,
        start_date DATE,
        end_date DATE,
        travel_style TEXT,
        interests TEXT,
        bio TEXT,
        status TEXT DEFAULT 'searching' CHECK(status IN ('searching', 'matched', 'met')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- User analytics
      CREATE TABLE IF NOT EXISTS user_analytics (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        session_id TEXT,
        page TEXT,
        action TEXT,
        metadata TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Webhook subscriptions (legacy - used by webhook delivery logs)
      -- NOTE: webhookService.js uses the webhook_subscriptions table above (line 489)
      -- This table has a different schema (endpoint, events as JSON, secret) and is kept for backward compatibility
      CREATE TABLE IF NOT EXISTS webhook_subs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        events TEXT NOT NULL,
        active INTEGER DEFAULT 1,
        secret TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Trip documents table
      CREATE TABLE IF NOT EXISTS trip_documents (
        id SERIAL PRIMARY KEY,
        trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        document_type TEXT NOT NULL CHECK(document_type IN ('passport', 'visa', 'insurance', 'booking_conf', 'other')),
        name TEXT NOT NULL,
        file_url TEXT,
        expiry_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- =====================
      -- MISSING TABLES (from SUPABASE-MIGRATION.md)
      -- =====================

      -- Buddy requests
      CREATE TABLE IF NOT EXISTS buddy_requests (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        message TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined', 'blocked')),
        archived_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Buddy reports
      CREATE TABLE IF NOT EXISTS buddy_reports (
        id SERIAL PRIMARY KEY,
        reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reported_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        details TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP,
        reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL
      );

      -- AI usage tracking
      CREATE TABLE IF NOT EXISTS ai_usage (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        month TEXT NOT NULL,
        type TEXT NOT NULL,
        count INTEGER DEFAULT 0,
        UNIQUE(user_id, month, type)
      );

      -- Buddy blocks
      CREATE TABLE IF NOT EXISTS buddy_blocks (
        id SERIAL PRIMARY KEY,
        blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(blocker_id, blocked_id)
      );

      -- Budgets (trip-level totals)
      CREATE TABLE IF NOT EXISTS budgets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        total_budget REAL DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(trip_id, user_id)
      );

      -- Budget items (line items under a budget)
      CREATE TABLE IF NOT EXISTS budget_items (
        id SERIAL PRIMARY KEY,
        budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
        category TEXT NOT NULL DEFAULT 'other' CHECK(category IN (
          'accommodation', 'transport', 'food', 'activities',
          'shopping', 'health', 'communication', 'other'
        )),
        description TEXT,
        amount REAL NOT NULL,
        original_currency TEXT DEFAULT 'USD',
        original_amount REAL,
        type TEXT DEFAULT 'expense' CHECK(type IN ('expense', 'income')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Notifications table
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        data TEXT,
        is_read BOOLEAN DEFAULT false,
        related_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Migration: Ensure is_read is boolean if it was created as integer
      DO $$ 
      BEGIN 
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'notifications' AND column_name = 'is_read' AND data_type = 'integer'
        ) THEN
          ALTER TABLE notifications ALTER COLUMN is_read TYPE BOOLEAN USING is_read::boolean;
          ALTER TABLE notifications ALTER COLUMN is_read SET DEFAULT false;
        END IF;
      END $$;

      -- Notification preferences
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email_notifications BOOLEAN DEFAULT true,
        push_notifications BOOLEAN DEFAULT true,
        sms_notifications BOOLEAN DEFAULT false,
        checkin_reminders BOOLEAN DEFAULT true,
        checkin_missed BOOLEAN DEFAULT true,
        checkin_emergency BOOLEAN DEFAULT true,
        trip_reminders BOOLEAN DEFAULT true,
        buddy_requests BOOLEAN DEFAULT true,
        budget_alerts BOOLEAN DEFAULT true,
        reminder_minutes_before INTEGER DEFAULT 15,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Notification delivery logs
      CREATE TABLE IF NOT EXISTS notification_delivery_logs (
        id SERIAL PRIMARY KEY,
        notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        channel TEXT NOT NULL,
        status TEXT NOT NULL,
        provider_response TEXT,
        attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        retry_count INTEGER DEFAULT 0,
        error_message TEXT
      );

      -- Ops alerts (internal alerts for outages and failures)
      CREATE TABLE IF NOT EXISTS ops_alerts (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        notification_type TEXT,
        affected_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        provider TEXT,
        error_details TEXT,
        status TEXT DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
      );

      -- Schema migration tracking
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Analytics sessions
      CREATE TABLE IF NOT EXISTS analytics_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        session_id TEXT NOT NULL,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP,
        ip_address TEXT,
        user_agent TEXT
      );

      -- Webhook delivery logs
      CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
        id SERIAL PRIMARY KEY,
        subscription_id INTEGER REFERENCES webhook_subs(id) ON DELETE CASCADE,
        subscription_new_id INTEGER REFERENCES webhook_subscriptions(id) ON DELETE SET NULL,
        event_type TEXT NOT NULL,
        payload TEXT,
        response_status INTEGER,
        response_body TEXT,
        delivered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        success INTEGER DEFAULT 0,
        attempt INTEGER DEFAULT 1
      );

      -- Notification templates (stored templates for email/SMS)
      CREATE TABLE IF NOT EXISTS notification_templates (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL CHECK(type IN ('email', 'sms')),
        notification_type TEXT NOT NULL,
        subject TEXT,
        body TEXT NOT NULL,
        variables JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(notification_type, type)
      );

      -- Trip checklist items (persisted readiness state)
      CREATE TABLE IF NOT EXISTS trip_checklist_items (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        item_key TEXT NOT NULL,
        completed BOOLEAN DEFAULT false,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, trip_id, item_key)
      );

      -- Guardian acknowledgements (Verified Guardian System)
      CREATE TABLE IF NOT EXISTS guardian_acknowledgements (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        contact_id INTEGER NOT NULL REFERENCES emergency_contacts(id) ON DELETE CASCADE,
        trip_id INTEGER REFERENCES trips(id) ON DELETE SET NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'acknowledged', 'declined')),
        acknowledgement_token TEXT UNIQUE,
        acknowledged_at TIMESTAMP,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Buddy calls table
      CREATE TABLE IF NOT EXISTS buddy_calls (
        id SERIAL PRIMARY KEY,
        caller_id INTEGER NOT NULL REFERENCES users(id),
        receiver_id INTEGER NOT NULL REFERENCES users(id),
        conversation_id INTEGER REFERENCES buddy_conversations(id),
        call_type TEXT DEFAULT 'video' CHECK(call_type IN ('video', 'audio')),
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined', 'ended', 'missed')),
        started_at TIMESTAMP,
        ended_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes
    await pool.query(`
      -- Performance indexes
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
      CREATE INDEX IF NOT EXISTS idx_activities_day_id ON activities(day_id);
      CREATE INDEX IF NOT EXISTS idx_activities_trip_id ON activities(trip_id);
      CREATE INDEX IF NOT EXISTS idx_itinerary_days_trip_id ON itinerary_days(trip_id);
      CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user_id ON emergency_contacts(user_id);
      CREATE INDEX IF NOT EXISTS idx_check_ins_user_id ON check_ins(user_id);
      CREATE INDEX IF NOT EXISTS idx_scheduled_check_ins_user_id ON scheduled_check_ins(user_id);
      CREATE INDEX IF NOT EXISTS idx_ai_cache_lookup ON ai_itinerary_cache(destination, days, pace, solo_vibe);
      
      -- Destination filtering
      CREATE INDEX IF NOT EXISTS idx_destinations_country ON destinations(country);
      CREATE INDEX IF NOT EXISTS idx_destinations_budget_level ON destinations(budget_level);
      CREATE INDEX IF NOT EXISTS idx_destinations_solo_friendly ON destinations(solo_friendly_rating DESC);
      
      -- Packing lists indexes
      CREATE INDEX IF NOT EXISTS idx_packing_lists_user ON packing_lists(user_id);
      CREATE INDEX IF NOT EXISTS idx_packing_lists_trip ON packing_lists(trip_id);
      CREATE INDEX IF NOT EXISTS idx_packing_items_list ON packing_items(packing_list_id);
      CREATE INDEX IF NOT EXISTS idx_packing_items_category ON packing_items(category);
      CREATE INDEX IF NOT EXISTS idx_packing_templates_climate ON packing_templates(climate);
      
      -- Reviews indexes
      CREATE INDEX IF NOT EXISTS idx_reviews_destination ON reviews(destination);
      CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
      
      -- Budget indexes
      CREATE INDEX IF NOT EXISTS idx_budget_user ON budget_entries(user_id);
      CREATE INDEX IF NOT EXISTS idx_budget_trip ON budget_entries(trip_id);
      CREATE INDEX IF NOT EXISTS idx_budget_category ON budget_entries(category);
      
      -- Travel buddies indexes
      CREATE INDEX IF NOT EXISTS idx_travel_buddies_user ON travel_buddies(user_id);
      CREATE INDEX IF NOT EXISTS idx_travel_buddies_destination ON travel_buddies(destination);
      
      -- Accommodations indexes
      CREATE INDEX IF NOT EXISTS idx_accommodations_trip ON accommodations(trip_id);
      
      -- Review helpful indexes
      CREATE INDEX IF NOT EXISTS idx_review_helpful_review ON review_helpful(review_id);
      CREATE INDEX IF NOT EXISTS idx_review_helpful_user ON review_helpful(user_id);
      
      -- Buddy request indexes
      CREATE INDEX IF NOT EXISTS idx_buddy_requests_sender ON buddy_requests(sender_id);
      CREATE INDEX IF NOT EXISTS idx_buddy_requests_receiver ON buddy_requests(receiver_id);
      CREATE INDEX IF NOT EXISTS idx_buddy_requests_trip ON buddy_requests(trip_id);
      
      -- Buddy block indexes
      CREATE INDEX IF NOT EXISTS idx_buddy_blocks_blocker ON buddy_blocks(blocker_id);
      CREATE INDEX IF NOT EXISTS idx_buddy_blocks_blocked ON buddy_blocks(blocked_id);
      CREATE INDEX IF NOT EXISTS idx_buddy_reports_reported_status ON buddy_reports(reported_id, status);
      CREATE INDEX IF NOT EXISTS idx_buddy_reports_reporter_created ON buddy_reports(reporter_id, created_at DESC);

      -- Buddy messages indexes
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON buddy_messages(conversation_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_conversations_participant_a ON buddy_conversations(participant_a);
      CREATE INDEX IF NOT EXISTS idx_conversations_participant_b ON buddy_conversations(participant_b);
      
      -- Budget indexes
      CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id);
      CREATE INDEX IF NOT EXISTS idx_budgets_trip ON budgets(trip_id);
      CREATE INDEX IF NOT EXISTS idx_budget_items_budget ON budget_items(budget_id);
      CREATE INDEX IF NOT EXISTS idx_budget_items_category ON budget_items(category);
      
      -- Extra performance indexes
      CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);
      CREATE INDEX IF NOT EXISTS idx_trips_user_query ON trips(user_id, created_at DESC);
      
      -- Bookings and places indexes
      CREATE INDEX IF NOT EXISTS idx_bookings_trip ON bookings(trip_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_type ON bookings(type);
      CREATE INDEX IF NOT EXISTS idx_places_trip ON places(trip_id);
      CREATE INDEX IF NOT EXISTS idx_places_category ON places(category);
      
      -- Notifications indexes
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
      CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);
      
      -- Moderation/Research indexes
      CREATE INDEX IF NOT EXISTS idx_destinations_status ON destinations(status);
      CREATE INDEX IF NOT EXISTS idx_destinations_source ON destinations(source);
      
      -- Trip checklist indexes
      CREATE INDEX IF NOT EXISTS idx_checklist_user_trip ON trip_checklist_items(user_id, trip_id);
      CREATE INDEX IF NOT EXISTS idx_checklist_item_key ON trip_checklist_items(item_key);
      
      -- Guardian acknowledgement indexes
      CREATE INDEX IF NOT EXISTS idx_guardian_user ON guardian_acknowledgements(user_id);
      CREATE INDEX IF NOT EXISTS idx_guardian_token ON guardian_acknowledgements(acknowledgement_token);
      CREATE INDEX IF NOT EXISTS idx_guardian_status ON guardian_acknowledgements(status);
      
      -- Buddy calls indexes
      CREATE INDEX IF NOT EXISTS idx_calls_caller ON buddy_calls(caller_id);
      CREATE INDEX IF NOT EXISTS idx_calls_receiver ON buddy_calls(receiver_id);
      CREATE INDEX IF NOT EXISTS idx_calls_conversation ON buddy_calls(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_calls_status ON buddy_calls(status);
    `);

    // Migration for existing tables: Add status and source to destinations
    try {
      await p.query(`
        DO $$ 
        BEGIN
          -- Status column
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'destinations' AND column_name = 'status') THEN
            ALTER TABLE destinations ADD COLUMN status TEXT DEFAULT 'live';
            -- Add check constraint separately to be safe
            ALTER TABLE destinations ADD CONSTRAINT dest_status_check CHECK (status IN ('pending', 'live', 'flagged'));
          END IF;

          -- Source column
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'destinations' AND column_name = 'source') THEN
            ALTER TABLE destinations ADD COLUMN source TEXT DEFAULT 'manual';
            ALTER TABLE destinations ADD CONSTRAINT dest_source_check CHECK (source IN ('manual', 'ai'));
          END IF;
        END $$;
      `);
      
      // Ensure existing data is marked as live
      await p.query("UPDATE destinations SET status = 'live' WHERE status IS NULL");
    } catch (migErr) {
      logger.warn('[DB] destinations migration note:', migErr.message);
    }

    logger.info('[DB] PostgreSQL database initialized successfully');
  } catch (error) {
    // Don't throw - table likely already exists. Log details for debugging.
    if (error.message.includes('already exists')) {
      logger.info('[DB] Tables already initialized (this is fine)');
    } else {
      logger.warn('[DB] Database initialization note:', error.message);
    }
  }
}

// Test connection
async function testConnection() {
  try {
    const p = getPool();
    if (!p) return false;
    const result = await p.query('SELECT NOW() as now');
    logger.info(`[DB] PostgreSQL connected: ${result.rows[0].now}`);
    return true;
  } catch (error) {
    logger.error('[DB] Connection test failed:', error.message);
    return false;
  }
}

// Run migrations (call these after initializeDatabase)
async function runMigrations() {
  // Ensure schema_migrations table exists (created in initializeDatabase, but guard for safety)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Helper: check if a migration has already been applied
  async function hasMigration(version) {
    const result = await pool.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);
    return result.rows.length > 0;
  }

  async function markMigration(version) {
    await pool.query('INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING', [version]);
  }

  // --- Migration v001: Default packing templates ---
  if (!await hasMigration('v001_packing_templates')) {
    try {
      const templatesExist = await pool.query('SELECT COUNT(*) as count FROM packing_templates');
      if (parseInt(templatesExist.rows[0].count) === 0) {
        logger.info('[Migration v001] Inserting default packing templates...');
        const templates = [
          { name: 'City Break Essentials', description: 'Perfect for short trips to urban destinations', climate: 'mixed', trip_type: 'mixed' },
          { name: 'Beach & Tropical', description: 'Everything you need for sun, sand, and sea', climate: 'tropical', trip_type: 'relaxation' },
          { name: 'Cold Weather', description: 'Stay warm and comfortable in chilly destinations', climate: 'cold', trip_type: 'mixed' },
          { name: 'Business Trip', description: 'Professional essentials for work travel', climate: 'mixed', trip_type: 'business' },
        ];
        
        for (const t of templates) {
          await pool.query(
            'INSERT INTO packing_templates (name, description, climate, trip_type, items) VALUES ($1, $2, $3, $4, $5)',
            [t.name, t.description, t.climate, t.trip_type, '[]']
          );
        }
        logger.info('[Migration v001] Default packing templates inserted');
      }
      await markMigration('v001_packing_templates');
    } catch (error) {
      logger.warn('[Migration v001] Note:', error.message);
    }
  }
  
  // --- Migration v002: Add missing columns to travel_buddies ---
  if (!await hasMigration('v002_travel_buddies_columns')) {
    try {
      await pool.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'travel_buddies' AND column_name = 'neighborhood') THEN
            ALTER TABLE travel_buddies ADD COLUMN neighborhood TEXT;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'travel_buddies' AND column_name = 'stay_location') THEN
            ALTER TABLE travel_buddies ADD COLUMN stay_location TEXT;
          END IF;
        END $$;
      `);
      logger.info('[Migration v002] travel_buddies columns added');
      await markMigration('v002_travel_buddies_columns');
    } catch (error) {
      logger.warn('[Migration v002] Note:', error.message);
    }
  }

  // --- Migration v003: Add trip_id to travel_buddies if missing ---
  if (!await hasMigration('v003_travel_buddies_trip_id')) {
    try {
      await pool.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'travel_buddies' AND column_name = 'trip_id') THEN
            ALTER TABLE travel_buddies ADD COLUMN trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE;
          END IF;
        END $$;
      `);
      logger.info('[Migration v003] travel_buddies.trip_id added');
      await markMigration('v003_travel_buddies_trip_id');
    } catch (error) {
      logger.warn('[Migration v003] Note:', error.message);
    }
  }

  // --- Migration v004: Add subscription_tier to users ---
  if (!await hasMigration('v004_users_subscription_tier')) {
    try {
      await pool.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'subscription_tier') THEN
            ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT 'free';
          END IF;
        END $$;
      `);
      logger.info('[Migration v004] users.subscription_tier added');
      await markMigration('v004_users_subscription_tier');
    } catch (error) {
      logger.warn('[Migration v004] Note:', error.message);
    }
  }

  // --- Migration v005: Add recurring schedule columns to scheduled_check_ins ---
  if (!await hasMigration('v005_scheduled_check_ins_recurring')) {
    try {
      await pool.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_check_ins' AND column_name = 'interval_minutes') THEN
            ALTER TABLE scheduled_check_ins ADD COLUMN interval_minutes INTEGER;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_check_ins' AND column_name = 'start_time') THEN
            ALTER TABLE scheduled_check_ins ADD COLUMN start_time TIMESTAMP;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_check_ins' AND column_name = 'end_time') THEN
            ALTER TABLE scheduled_check_ins ADD COLUMN end_time TIMESTAMP;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_check_ins' AND column_name = 'is_recurring') THEN
            ALTER TABLE scheduled_check_ins ADD COLUMN is_recurring INTEGER DEFAULT 0;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_check_ins' AND column_name = 'next_checkin_time') THEN
            ALTER TABLE scheduled_check_ins ADD COLUMN next_checkin_time TIMESTAMP;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_check_ins' AND column_name = 'missed_count') THEN
            ALTER TABLE scheduled_check_ins ADD COLUMN missed_count INTEGER DEFAULT 0;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_check_ins' AND column_name = 'escalation_level') THEN
            ALTER TABLE scheduled_check_ins ADD COLUMN escalation_level INTEGER DEFAULT 0;
          END IF;
        END $$;
      `);
      logger.info('[Migration v005] scheduled_check_ins recurring columns added');
      await markMigration('v005_scheduled_check_ins_recurring');
    } catch (error) {
      logger.warn('[Migration v005] Note:', error.message);
    }
  }

  // --- Migration v006: Fix boolean columns + add missing profile columns ---
  if (!await hasMigration('v006_fix_booleans_and_profiles')) {
    try {
      await pool.query(`
        DO $$ 
        BEGIN
          -- Add missing profile columns
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'display_name') THEN
            ALTER TABLE profiles ADD COLUMN display_name TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'home_base') THEN
            ALTER TABLE profiles ADD COLUMN home_base TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'visible') THEN
            ALTER TABLE profiles ADD COLUMN visible BOOLEAN DEFAULT true;
          END IF;
        END $$;
      `);

      // Fix boolean columns that may still be INTEGER
      const boolFixCols = [
        ['notifications', 'is_read'],
        ['scheduled_check_ins', 'is_active'],
        ['scheduled_check_ins', 'is_recurring'],
        ['scheduled_check_ins', 'reminder_sent'],
        ['scheduled_check_ins', 'final_warning_sent'],
        ['scheduled_check_ins', 'sos_triggered'],
        ['emergency_contacts', 'notify_on_checkin'],
        ['emergency_contacts', 'notify_on_emergency'],
      ];

      for (const [table, col] of boolFixCols) {
        try {
          const colInfo = await pool.query(
            `SELECT data_type FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
            [table, col]
          );
          if (colInfo.rows.length > 0 && colInfo.rows[0].data_type !== 'boolean') {
            await pool.query(`
              ALTER TABLE ${table} 
              ALTER COLUMN ${col} TYPE BOOLEAN 
              USING CASE WHEN ${col}::text IN ('1', 'true', 't') THEN true ELSE false END
            `);
            logger.info(`[Migration v006] Converted ${table}.${col} to BOOLEAN`);
          }
        } catch (colErr) {
          logger.warn(`[Migration v006] ${table}.${col}: ${colErr.message}`);
        }
      }

      logger.info('[Migration v006] Boolean fixes and profile columns applied');
      await markMigration('v006_fix_booleans_and_profiles');
    } catch (error) {
      logger.warn('[Migration v006] Note:', error.message);
    }
  }

  // --- Migration v007: Fix notifications and scheduled_check_ins columns ---
  if (!await hasMigration('v007_schema_stabilization')) {
    try {
      // 1. Fix notifications: rename 'read' to 'is_read' and convert to boolean
      await pool.query(`
        DO $$ 
        BEGIN
          -- Rename read -> is_read if it exists
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'read') THEN
            ALTER TABLE notifications RENAME COLUMN "read" TO is_read;
          END IF;
          
          -- Ensure is_read is BOOLEAN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'is_read') THEN
            IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'is_read') <> 'boolean' THEN
              ALTER TABLE notifications 
              ALTER COLUMN is_read TYPE BOOLEAN 
              USING CASE WHEN is_read::text IN ('1', 'true', 't') THEN true ELSE false END;
            END IF;
          END IF;
        END $$;
      `);

      // 2. Fix scheduled_check_ins: add reminder_sent
      await pool.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_check_ins' AND column_name = 'reminder_sent') THEN
            ALTER TABLE scheduled_check_ins ADD COLUMN reminder_sent BOOLEAN DEFAULT false;
          END IF;
        END $$;
      `);

      logger.info('[Migration v007] Notifications and Checkin columns stabilized');
      await markMigration('v007_schema_stabilization');
    } catch (error) {
      logger.error('[Migration v007] FAILED:', error.message);
    }
  }

  // --- Migration v008: Add status and source columns to destinations ---
  if (!await hasMigration('v008_destinations_status_source')) {
    try {
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'destinations' AND column_name = 'status') THEN
            ALTER TABLE destinations ADD COLUMN status TEXT DEFAULT 'live';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'destinations' AND column_name = 'source') THEN
            ALTER TABLE destinations ADD COLUMN source TEXT DEFAULT 'manual';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'destinations' AND column_name = 'safety_intelligence') THEN
            ALTER TABLE destinations ADD COLUMN safety_intelligence TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'destinations' AND column_name = 'emergency_contacts') THEN
            ALTER TABLE destinations ADD COLUMN emergency_contacts TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'destinations' AND column_name = 'highlights') THEN
            ALTER TABLE destinations ADD COLUMN highlights TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'destinations' AND column_name = 'travel_styles') THEN
            ALTER TABLE destinations ADD COLUMN travel_styles TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'destinations' AND column_name = 'climate') THEN
            ALTER TABLE destinations ADD COLUMN climate TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'destinations' AND column_name = 'best_months') THEN
            ALTER TABLE destinations ADD COLUMN best_months TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'destinations' AND column_name = 'fcdo_slug') THEN
            ALTER TABLE destinations ADD COLUMN fcdo_slug TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'destinations' AND column_name = 'latitude') THEN
            ALTER TABLE destinations ADD COLUMN latitude REAL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'destinations' AND column_name = 'longitude') THEN
            ALTER TABLE destinations ADD COLUMN longitude REAL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'destinations' AND column_name = 'solo_friendly_rating') THEN
            ALTER TABLE destinations ADD COLUMN solo_friendly_rating INTEGER;
          END IF;
        END $$;
      `);
      logger.info('[Migration v008] destinations: status, source and AI columns added');
      await markMigration('v008_destinations_status_source');
    } catch (error) {
      logger.error('[Migration v008] FAILED:', error.message);
    }
  }

  // --- Migration v009: Add related_id to notifications if missing ---
  if (!await hasMigration('v009_notifications_related_id')) {
    try {
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'related_id') THEN
            ALTER TABLE notifications ADD COLUMN related_id INTEGER;
          END IF;
        END $$;
      `);
      logger.info('[Migration v009] notifications.related_id added');
      await markMigration('v009_notifications_related_id');
    } catch (error) {
      logger.error('[Migration v009] FAILED:', error.message);
    }
  }

  // --- Migration v010: Add status column to reviews for moderation ---
  if (!await hasMigration('v010_reviews_status')) {
    try {
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'status') THEN
            ALTER TABLE reviews ADD COLUMN status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected'));
          END IF;
        END $$;
      `);
      logger.info('[Migration v010] reviews.status added');
      await markMigration('v010_reviews_status');
    } catch (error) {
      logger.error('[Migration v010] FAILED:', error.message);
    }
  }

  // --- Migration v011: Add event_type and properties columns to events ---
  if (!await hasMigration('v011_events_type_properties')) {
    try {
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'event_type') THEN
            ALTER TABLE events ADD COLUMN event_type TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'properties') THEN
            ALTER TABLE events ADD COLUMN properties TEXT;
          END IF;
        END $$;
      `);
      logger.info('[Migration v011] events.event_type and events.properties added');
      await markMigration('v011_events_type_properties');
    } catch (error) {
      logger.error('[Migration v011] FAILED:', error.message);
    }
  }

  // --- Migration v012: Add theme_preference to users ---
  if (!await hasMigration('v012_users_theme_preference')) {
    try {
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'theme_preference') THEN
            ALTER TABLE users ADD COLUMN theme_preference TEXT DEFAULT 'system';
          END IF;
        END $$;
      `);
      logger.info('[Migration v012] users.theme_preference added');
      await markMigration('v012_users_theme_preference');
    } catch (error) {
      logger.error('[Migration v012] FAILED:', error.message);
    }
  }

  // --- Migration v013: Add checklist_items table for trip readiness tracking ---
  if (!await hasMigration('v013_checklist_items')) {
    try {
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'checklist_items') THEN
            CREATE TABLE checklist_items (
              id SERIAL PRIMARY KEY,
              user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
              trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
              item_id TEXT NOT NULL,
              completed BOOLEAN DEFAULT false,
              completed_at TIMESTAMP,
              manually_confirmed BOOLEAN DEFAULT false,
              created_at TIMESTAMP DEFAULT NOW(),
              UNIQUE(trip_id, item_id)
            );
          END IF;
        END $$;
      `);
      logger.info('[Migration v013] checklist_items table created');
      await markMigration('v013_checklist_items');
    } catch (error) {
      logger.error('[Migration v013] FAILED:', error.message);
    }
  }

  // --- Migration v014: Add trip_checklist_items table ---
  if (!await hasMigration('v014_trip_checklist_items')) {
    try {
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trip_checklist_items') THEN
            CREATE TABLE trip_checklist_items (
              id SERIAL PRIMARY KEY,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
              item_key TEXT NOT NULL,
              completed BOOLEAN DEFAULT false,
              completed_at TIMESTAMP,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(user_id, trip_id, item_key)
            );
          END IF;
        END $$;
      `);
      logger.info('[Migration v014] trip_checklist_items table created');
      await markMigration('v014_trip_checklist_items');
    } catch (error) {
      logger.error('[Migration v014] FAILED:', error.message);
    }
  }

  // --- Migration v015: Add guardian_acknowledgements table ---
  if (!await hasMigration('v015_guardian_acknowledgements')) {
    try {
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'guardian_acknowledgements') THEN
            CREATE TABLE guardian_acknowledgements (
              id SERIAL PRIMARY KEY,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              contact_id INTEGER NOT NULL REFERENCES emergency_contacts(id) ON DELETE CASCADE,
              trip_id INTEGER REFERENCES trips(id) ON DELETE SET NULL,
              status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'acknowledged', 'declined')),
              acknowledgement_token TEXT UNIQUE,
              acknowledged_at TIMESTAMP,
              expires_at TIMESTAMP,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          END IF;
        END $$;
      `);
      logger.info('[Migration v015] guardian_acknowledgements table created');
      await markMigration('v015_guardian_acknowledgements');
    } catch (error) {
      logger.error('[Migration v015] FAILED:', error.message);
    }
  }

  // --- Migration v016: Add sessions.last_activity (optional) ---
  if (!await hasMigration('v016_sessions_last_activity')) {
    try {
      await pool.query(`ALTER TABLE sessions ADD COLUMN last_activity TIMESTAMPTZ`);
      logger.info('[Migration v016] sessions.last_activity added');
    } catch (error) {
      logger.warn('[Migration v016] skipped:', error.message);
    }
    await markMigration('v016_sessions_last_activity');
  }

  // Note: v017 events dismissed columns - managed via Supabase dashboard or separate migration script
  await markMigration('v017_events_dismissed'); // Skip for now, columns can be added manually

  // --- Migration v018: Add trips soft-delete columns ---
  if (!await hasMigration('v018_trips_soft_delete')) {
    try {
      await pool.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
      await pool.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id)`);
      logger.info('[Migration v018] trips soft-delete columns added');
    } catch (error) {
      logger.warn('[Migration v018] skipped:', error.message);
    }
    await markMigration('v018_trips_soft_delete');
  }

  // --- Migration v019: Add admin_role levels ---
  if (!await hasMigration('v019_admin_roles')) {
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_level TEXT DEFAULT 'support'`);
      logger.info('[Migration v019] admin_level column added');
    } catch (error) {
      logger.warn('[Migration v019] skipped:', error.message);
    }
    await markMigration('v019_admin_roles');
  }

  // --- Migration v019b: Ensure users table has all required columns ---
  if (!await hasMigration('v019b_users_columns')) {
    try {
      // Ensure these columns exist (safe to run even if they do)
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id)`);
      logger.info('[Migration v019b] users table columns ensured');
    } catch (error) {
      logger.warn('[Migration v019b] skipped:', error.message);
    }
    await markMigration('v019b_users_columns');
  }

  // --- Migration v019c: Allow viewer role in RBAC ---
  if (!await hasMigration('v019c_viewer_role')) {
    try {
      await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
      await pool.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'viewer', 'admin'))`);
      logger.info('[Migration v019c] viewer role enabled');
    } catch (error) {
      logger.warn('[Migration v019c] skipped:', error.message);
    }
    await markMigration('v019c_viewer_role');
  }

  // --- Migration v019d: Create system_config table for admin settings ---
  if (!await hasMigration('v019d_system_config')) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS system_config (
          config_key TEXT PRIMARY KEY,
          config_value TEXT,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_by UUID REFERENCES users(id)
        )
      `);
      logger.info('[Migration v019d] system_config table created');
    } catch (error) {
      logger.warn('[Migration v019d] skipped:', error.message);
    }
    await markMigration('v019d_system_config');
  }

  // --- Migration v020: Add users soft-delete columns ---
  if (!await hasMigration('v020_users_soft_delete')) {
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id)`);
      logger.info('[Migration v020] users soft-delete columns added');
    } catch (error) {
      logger.warn('[Migration v020] skipped:', error.message);
    }
    await markMigration('v020_users_soft_delete');
  }

  // --- Migration v021: Add performance indexes ---
  if (!await hasMigration('v021_performance_indexes')) {
    try {
      // Indexes for common admin queries
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_events_timestamp_desc ON events(timestamp DESC)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_events_dismissed_at ON events(dismissed_at)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at)`);
      logger.info('[Migration v021] performance indexes added');
    } catch (error) {
      logger.warn('[Migration v021] skipped:', error.message);
    }
    await markMigration('v021_performance_indexes');
  }

  // --- Migration v022: Create incidents table ---
  if (!await hasMigration('v022_incidents')) {
    try {
      // Create incidents table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS incidents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          description TEXT,
          severity TEXT DEFAULT 'info',
          type TEXT DEFAULT 'operational',
          status TEXT DEFAULT 'active',
          created_by UUID REFERENCES users(id),
          acknowledged_by UUID REFERENCES users(id),
          acknowledged_at TIMESTAMPTZ,
          resolved_by UUID REFERENCES users(id),
          resolved_at TIMESTAMPTZ,
          resolution TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity)`);
      logger.info('[Migration v022] incidents table created');
    } catch (error) {
      logger.warn('[Migration v022] skipped:', error.message);
    }
    await markMigration('v022_incidents');
  }

  // --- Migration v023: Destination schema v2 (destination_level, slug, publication pipeline) ---
  if (!await hasMigration('v023_destinations_v2')) {
    try {
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS destination_level TEXT DEFAULT 'city' CHECK(destination_level IN ('country', 'city', 'region'))`);
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS parent_destination_id INTEGER REFERENCES destinations(id) ON DELETE SET NULL`);
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS slug TEXT`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_destinations_slug ON destinations(slug) WHERE slug IS NOT NULL`);
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS title TEXT`);
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS region_name TEXT`);
      // Publication workflow replaces the old status 3-value enum
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS publication_status TEXT DEFAULT 'draft' CHECK(publication_status IN ('draft','in_progress','needs_review','ready_to_publish','live','paused','blocked','stale'))`);
      // Backfill: existing 'live' rows become publication_status='live'
      await pool.query(`UPDATE destinations SET publication_status = CASE WHEN status = 'live' THEN 'live' WHEN status = 'pending' THEN 'needs_review' ELSE 'draft' END WHERE publication_status = 'draft'`);
      // Safety gate
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS safety_gate_status TEXT DEFAULT 'pending' CHECK(safety_gate_status IN ('pending','pass','fail','bypass'))`);
      await pool.query(`UPDATE destinations SET safety_gate_status = CASE WHEN status = 'live' THEN 'pass' ELSE 'pending' END WHERE safety_gate_status = 'pending'`);
      // Advisory
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS advisory_source TEXT`);
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS advisory_summary TEXT`);
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS advisory_checked_at TIMESTAMPTZ`);
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS advisory_stance TEXT CHECK(advisory_stance IN ('normal','exercise_caution','advise_against','advise_against_all'))`);
      // Freshness
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS content_fresh_until TIMESTAMPTZ`);
      // Research pipeline
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS research_status TEXT DEFAULT 'not_started' CHECK(research_status IN ('not_started','in_progress','complete','failed','needs_rerun'))`);
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS research_last_run_at TIMESTAMPTZ`);
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS research_pipeline_version TEXT`);
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS source_pack_status TEXT`);
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS source_pack_last_built_at TIMESTAMPTZ`);
      // AI quality
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS ai_prompt_version TEXT`);
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS ai_quality_score NUMERIC`);
      // Review workflow
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS manual_review_required BOOLEAN DEFAULT false`);
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS manual_review_status TEXT DEFAULT 'pending' CHECK(manual_review_status IN ('pending','approved','rejected','rewrite_requested'))`);
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`);
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS reviewer_notes TEXT`);
      // Block/pause reasons
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS paused_reason TEXT`);
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS blocked_reason TEXT`);
      // Trust tags
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS solo_fit_tags TEXT`);
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS best_for_tags TEXT`);
      // Featured
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false`);
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS featured_group TEXT`);
      await pool.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS featured_order INTEGER`);
      // Backfill slugs for existing destinations
      await pool.query(`UPDATE destinations SET slug = LOWER(REGEXP_REPLACE(TRIM(name), '[^a-zA-Z0-9]+', '-', 'g')) WHERE slug IS NULL AND name IS NOT NULL`);
      // Backfill title from name
      await pool.query(`UPDATE destinations SET title = name WHERE title IS NULL AND name IS NOT NULL`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_destinations_publication_status ON destinations(publication_status)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_destinations_safety_gate ON destinations(safety_gate_status)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_destinations_level ON destinations(destination_level)`);
      logger.info('[Migration v023] destinations v2 schema applied');
    } catch (error) {
      logger.warn('[Migration v023] skipped:', error.message);
    }
    await markMigration('v023_destinations_v2');
  }

  // --- Migration v024: destination_content_blocks table ---
  if (!await hasMigration('v024_destination_content_blocks')) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS destination_content_blocks (
          id SERIAL PRIMARY KEY,
          destination_id INTEGER NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
          block_type TEXT NOT NULL CHECK(block_type IN (
            'card_summary','safety_brief','solo_suitability','arrival_checklist',
            'neighbourhood_guidance','after_dark','friction_points','quick_facts','fallback_summary'
          )),
          content TEXT NOT NULL,
          content_format TEXT DEFAULT 'markdown',
          prompt_version TEXT,
          ai_quality_score NUMERIC,
          review_status TEXT DEFAULT 'pending' CHECK(review_status IN ('pending','approved','rejected','rewrite_requested')),
          reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          reviewed_at TIMESTAMPTZ,
          reviewer_notes TEXT,
          generated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_content_blocks_destination ON destination_content_blocks(destination_id, block_type)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_content_blocks_review_status ON destination_content_blocks(review_status)`);
      logger.info('[Migration v024] destination_content_blocks table created');
    } catch (error) {
      logger.warn('[Migration v024] skipped:', error.message);
    }
    await markMigration('v024_destination_content_blocks');
  }

  // --- Migration v025: activities v2 (time_of_day, solo context, safety_note) ---
  if (!await hasMigration('v025_activities_v2')) {
    try {
      await pool.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS time_of_day TEXT CHECK(time_of_day IN ('morning','afternoon','evening','night'))`);
      await pool.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS solo_friendly BOOLEAN DEFAULT true`);
      await pool.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS solo_dining_ok BOOLEAN DEFAULT true`);
      await pool.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS safety_note TEXT`);
      await pool.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS travel_time_from_previous_minutes INTEGER`);
      await pool.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS booking_recommended BOOLEAN DEFAULT false`);
      await pool.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS category TEXT`);
      logger.info('[Migration v025] activities v2 columns added');
    } catch (error) {
      logger.warn('[Migration v025] skipped:', error.message);
    }
    await markMigration('v025_activities_v2');
  }

  // --- Migration v026: trips v2 (draft status, readiness, safety_setup) ---
  if (!await hasMigration('v026_trips_v2')) {
    try {
      // Extend status constraint to include 'draft' and 'archived'
      await pool.query(`ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_status_check`);
      await pool.query(`ALTER TABLE trips ADD CONSTRAINT trips_status_check CHECK(status IN ('draft','planning','confirmed','completed','cancelled','archived'))`);
      await pool.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS readiness_score INTEGER DEFAULT 0`);
      await pool.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS safety_setup_status TEXT DEFAULT 'none' CHECK(safety_setup_status IN ('none','partial','active'))`);
      await pool.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS advisory_status TEXT`);
      await pool.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS destination_ref_id INTEGER REFERENCES destinations(id) ON DELETE SET NULL`);
      logger.info('[Migration v026] trips v2 columns added');
    } catch (error) {
      logger.warn('[Migration v026] skipped:', error.message);
    }
    await markMigration('v026_trips_v2');
  }

  // --- Migration v027: AI observability log ---
  if (!await hasMigration('v027_ai_observability')) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ai_observability_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          use_case TEXT NOT NULL,
          source TEXT NOT NULL CHECK(source IN ('azure_openai','litellm','fallback','cache')),
          latency_ms INTEGER,
          prompt_version TEXT,
          is_fallback BOOLEAN DEFAULT false,
          token_estimate INTEGER,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_obs_use_case ON ai_observability_logs(use_case, created_at DESC)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_obs_source ON ai_observability_logs(source, created_at DESC)`);
      logger.info('[Migration v027] ai_observability_logs table created');
    } catch (error) {
      logger.warn('[Migration v027] skipped:', error.message);
    }
    await markMigration('v027_ai_observability');
  }

  // --- Migration v028: Buddy safety reports and connection archival ---
  if (!await hasMigration('v028_buddy_safety')) {
    try {
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false
      `);

      await pool.query(`
        ALTER TABLE buddy_requests
        ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS buddy_reports (
          id SERIAL PRIMARY KEY,
          reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          reported_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          reason TEXT NOT NULL,
          details TEXT,
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          reviewed_at TIMESTAMP,
          reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL
        )
      `);

      await pool.query(`CREATE INDEX IF NOT EXISTS idx_buddy_reports_reported_status ON buddy_reports(reported_id, status)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_buddy_reports_reporter_created ON buddy_reports(reporter_id, created_at DESC)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_buddy_blocks_blocked ON buddy_blocks(blocked_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_buddy_requests_archived_at ON buddy_requests(archived_at)`);

      logger.info('[Migration v028] buddy safety schema applied');
    } catch (error) {
      logger.warn('[Migration v028] skipped:', error.message);
    }
    await markMigration('v028_buddy_safety');
  }

  logger.info('[Migration] All migrations complete');
}

// Auto-initialize sequence
let isInitialized = false;
let initPromise = null;

async function init() {
  if (isInitialized) return;
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    try {
      let p = getPool();
      if (!p) {
        await new Promise(resolve => setTimeout(resolve, 500));
        p = getPool();
        if (!p) throw new Error('DATABASE_URL missing');
      }

      // 1. Verify connection and handle SSL fallback
      try {
        const client = await p.connect();
        client.release();
        logger.info('[DB] PostgreSQL connected successfully');
      } catch (err) {
        if (err.message.includes('does not support SSL')) {
          logger.warn('[DB] SSL not supported, falling back... (non-SSL)');
          await p.end();
          const databaseUrl = process.env.DATABASE_URL;
          pool = new Pool({
            connectionString: databaseUrl,
            ssl: false,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
          });
          p = pool;
          const client = await p.connect();
          client.release();
        } else {
          throw err;
        }
      }

      // 2. Initialize schema and migrations
      await initializeDatabase();
      await runMigrations();
      
      isInitialized = true;
      logger.info('[DB] Database fully initialized');
    } catch (err) {
      logger.error('[DB] Initialization failed:', err.message);
    }
  })();
  
  return initPromise;
}

// Ensure init runs
init();

export default db;
export { pool, initializeDatabase, testConnection, init };
