-- SoloCompass Database Migration
-- Add Trip Data Tables
-- Created: 2026-04-03

-- ============================================
-- Table: accommodations
-- ============================================
CREATE TABLE IF NOT EXISTS accommodations (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) CHECK (type IN ('hotel', 'airbnb', 'hostel', 'other')),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    confirmation_number VARCHAR(100),
    check_in_date DATE,
    check_out_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Table: bookings
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) CHECK (type IN ('flight', 'train', 'bus', 'ferry', 'activity', 'restaurant', 'other')),
    provider VARCHAR(255),
    confirmation_number VARCHAR(100),
    departure_location VARCHAR(255),
    arrival_location VARCHAR(255),
    departure_datetime TIMESTAMP,
    arrival_datetime TIMESTAMP,
    cost DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'GBP',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Table: trip_documents
-- ============================================
CREATE TABLE IF NOT EXISTS trip_documents (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(50) CHECK (document_type IN ('passport', 'visa', 'insurance', 'booking_conf', 'other')),
    name VARCHAR(255) NOT NULL,
    file_url TEXT,
    expiry_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Table: trip_places
-- ============================================
CREATE TABLE IF NOT EXISTS trip_places (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    place_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    category VARCHAR(50) CHECK (category IN ('accommodation', 'restaurant', 'attraction', 'transport', 'other')),
    notes TEXT,
    visited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_accommodations_trip ON accommodations(trip_id);
CREATE INDEX IF NOT EXISTS idx_bookings_trip ON bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_documents_trip ON trip_documents(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_places_trip ON trip_places(trip_id);
