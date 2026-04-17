-- v030: Analytics funnels, experiments, and engagement metrics
CREATE TABLE IF NOT EXISTS analytics_funnels (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  steps JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_funnel_events (
  id SERIAL PRIMARY KEY,
  funnel_id INTEGER REFERENCES analytics_funnels(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  step_index INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  session_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS experiments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  variants JSONB NOT NULL DEFAULT '["control","treatment"]',
  traffic_pct NUMERIC(5,2) DEFAULT 100.00,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','running','paused','completed')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS experiment_assignments (
  id SERIAL PRIMARY KEY,
  experiment_id INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  variant TEXT NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(experiment_id, user_id)
);

CREATE TABLE IF NOT EXISTS experiment_exposures (
  id SERIAL PRIMARY KEY,
  experiment_id INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  variant TEXT NOT NULL,
  event_name TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_funnel_events_funnel ON analytics_funnel_events(funnel_id, step_index);
CREATE INDEX IF NOT EXISTS idx_experiment_assignments_exp ON experiment_assignments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_exposures_exp ON experiment_exposures(experiment_id, event_name);
