/**
 * Hospitals Service — Nearby hospitals lookup with English-speaking indicator
 * Data sourced from OpenStreetMap Overpass API and refreshed on a daily schedule.
 */

import db from '../db.js';
import logger from './logger.js';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
let refreshTimer = null;

/**
 * English-speaking country codes (primary/official English)
 */
const ENGLISH_SPEAKING_COUNTRIES = new Set([
  'GB', 'US', 'AU', 'NZ', 'CA', 'IE', 'ZA', 'SG', 'MT', 'JM',
  'TT', 'BB', 'BS', 'BZ', 'GY', 'FJ', 'PH', 'IN', 'KE', 'GH',
  'NG', 'UG', 'TZ', 'ZW', 'BW', 'RW', 'MW', 'LS', 'SZ', 'SL'
]);

/**
 * Fetch hospitals near coordinates from Overpass API
 */
async function fetchFromOverpass(lat, lng, radiusMeters = 10000) {
  const query = `[out:json][timeout:15];
    node["amenity"="hospital"](around:${radiusMeters},${lat},${lng});
    out body;`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Overpass ${res.status}`);
    const data = await res.json();
    return (data.elements || []).map(el => ({
      name: el.tags?.name || el.tags?.['name:en'] || 'Hospital',
      latitude: el.lat,
      longitude: el.lon,
      address: el.tags?.['addr:full'] || el.tags?.['addr:street'] || null,
      phone: el.tags?.phone || el.tags?.['contact:phone'] || null,
      website: el.tags?.website || el.tags?.['contact:website'] || null,
      emergencyDepartment: el.tags?.emergency === 'yes' || !el.tags?.emergency,
      countryCode: (el.tags?.['addr:country'] || '').toUpperCase()
    }));
  } catch (err) {
    clearTimeout(timeout);
    logger.error(`[Hospitals] Overpass fetch failed: ${err.message}`);
    return [];
  }
}

/**
 * Upsert hospitals from Overpass into the database
 */
async function upsertHospitals(city, country, countryCode, hospitals) {
  const code = (countryCode || '').toUpperCase();
  const isEnglish = ENGLISH_SPEAKING_COUNTRIES.has(code);
  const now = new Date().toISOString();

  for (const h of hospitals) {
    try {
      await db.run(`
        INSERT INTO hospitals (name, city, country, country_code, latitude, longitude, address, phone, website, english_speaking, emergency_department, source, last_refreshed_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'overpass',$12,$12)
        ON CONFLICT DO NOTHING
      `,
        h.name, city, country, code || null,
        h.latitude, h.longitude, h.address, h.phone, h.website,
        isEnglish || false, h.emergencyDepartment,
        now
      );
    } catch (err) {
      logger.warn(`[Hospitals] Upsert failed for ${h.name}: ${err.message}`);
    }
  }
}

/**
 * Search hospitals near a location
 */
export async function searchNearby(lat, lng, radiusKm = 10, options = {}) {
  const { englishOnly = false } = options;

  // Try DB first
  let conditions = 'WHERE latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4';
  const latDelta = radiusKm / 111.0;
  const lngDelta = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));
  const params = [lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta];

  if (englishOnly) {
    conditions += ' AND english_speaking = true';
  }

  const cached = await db.all(`
    SELECT id, name, city, country, country_code, latitude, longitude, address, phone, website,
           english_speaking, emergency_department, rating, last_refreshed_at
    FROM hospitals ${conditions}
    ORDER BY ABS(latitude - ${lat}) + ABS(longitude - ${lng})
    LIMIT 20
  `, ...params);

  if (cached.length > 0) return cached;

  // Cache miss → fetch from Overpass
  const fresh = await fetchFromOverpass(lat, lng, radiusKm * 1000);
  if (fresh.length > 0) {
    await upsertHospitals('', '', fresh[0]?.countryCode || '', fresh);
  }
  return fresh.map((h, i) => ({ id: -(i + 1), ...h, english_speaking: ENGLISH_SPEAKING_COUNTRIES.has(h.countryCode) }));
}

/**
 * Refresh all hospitals that haven't been updated in 7+ days
 */
export async function refreshStaleHospitals() {
  logger.info('[Hospitals] Starting stale-data refresh…');
  try {
    const stale = await db.all(`
      SELECT DISTINCT city, country, country_code,
             AVG(latitude) as lat, AVG(longitude) as lng
      FROM hospitals
      WHERE last_refreshed_at < NOW() - INTERVAL '7 days'
      GROUP BY city, country, country_code
      LIMIT 10
    `);

    for (const row of stale) {
      const fresh = await fetchFromOverpass(row.lat, row.lng, 15000);
      if (fresh.length > 0) {
        await upsertHospitals(row.city, row.country, row.country_code, fresh);
      }
    }
    logger.info(`[Hospitals] Refresh complete — processed ${stale.length} regions`);
  } catch (err) {
    logger.error(`[Hospitals] Refresh failed: ${err.message}`);
  }
}

/**
 * Start daily refresh scheduler
 */
export function startHospitalRefreshScheduler() {
  if (refreshTimer) return;
  refreshTimer = setInterval(() => {
    refreshStaleHospitals().catch(e => logger.error(`[Hospitals] Scheduler error: ${e.message}`));
  }, REFRESH_INTERVAL_MS);
  logger.info('[Hospitals] Refresh scheduler started (24h interval)');
}

export function stopHospitalRefreshScheduler() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

export default { searchNearby, refreshStaleHospitals, startHospitalRefreshScheduler, stopHospitalRefreshScheduler };
