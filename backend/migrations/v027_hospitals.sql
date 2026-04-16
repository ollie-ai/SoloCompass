-- v027: Hospitals table with English-speaking indicator
CREATE TABLE IF NOT EXISTS hospitals (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  country_code CHAR(2),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  address TEXT,
  phone TEXT,
  website TEXT,
  english_speaking BOOLEAN DEFAULT false,
  emergency_department BOOLEAN DEFAULT true,
  rating NUMERIC(2,1),
  source TEXT DEFAULT 'overpass',
  last_refreshed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hospitals_country ON hospitals(country_code);
CREATE INDEX IF NOT EXISTS idx_hospitals_location ON hospitals(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_hospitals_english ON hospitals(english_speaking) WHERE english_speaking = true;
