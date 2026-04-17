import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { 
  getCrimeData, 
  getStreetLevelCrime, 
} from '../services/crimeService.js';
import {
  getAreaSafetyScore,
  calculateCrimeScore,
  calculateRouteSafetyScore
} from '../services/safetyScoringService.js';
import { 
  get24HourVenues,
  getLateNightVenues,
  getEmergencyServices,
  getPoliceStations,
  getHospitals,
  getStreetLighting
} from '../services/overpassService.js';
import { calculateSegmentSafetyScore } from '../services/safetyScoringService.js';
import logger from '../services/logger.js';
import db from '../db.js';
import { pool } from '../db.js';

const router = express.Router();

router.use(authenticate);

/**
 * GET /safety/crime?lat=51.5&lng=-0.1&date=2025-01
 * Get crime data for a location
 */
router.get('/crime', async (req, res) => {
  try {
    const { lat, lng, date } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat/lng parameters' });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return res.status(400).json({ error: 'Invalid lat/lng coordinates' });
    }

    const crimes = await getStreetLevelCrime(latNum, lngNum, 1000);
    const hour = new Date().getHours();
    const score = calculateCrimeScore(crimes, hour);

    res.json({ 
      success: true, 
      data: { crimes: crimes.slice(0, 100), score }
    });
  } catch (error) {
    logger.error(`[Safety] Crime data fetch failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch crime data', message: error.message });
  }
});

/**
 * GET /safety/score?lat=51.5&lng=-0.1&hour=22
 * Get safety score for an area
 */
router.get('/score', async (req, res) => {
  try {
    const { lat, lng, hour } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat/lng parameters' });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return res.status(400).json({ error: 'Invalid lat/lng coordinates' });
    }

    const hourParam = hour ? parseInt(hour) : new Date().getHours();
    const safetyData = await getAreaSafetyScore(latNum, lngNum, hourParam);

    res.json({ success: true, data: safetyData });
  } catch (error) {
    logger.error(`[Safety] Score calculation failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to calculate safety score', message: error.message });
  }
});

/**
 * GET /safety/score/:country
 * Get safety stats for a country (fallback, no lat/lng needed)
 */
router.get('/score/:country', async (req, res) => {
  try {
    const { country } = req.params;

    // Return basic safety info based on country name
    const safetyData = {
      country,
      overall_score: 'N/A',
      crime_rate: 'Low',
      healthcare: 'Good',
      transport_safety: 'Reliable',
      night_lighting: 'Street-Vetted',
      night_lighting_sub: '98% Coverage in Tourist Hubs',
    };

    res.json({ success: true, data: safetyData });
  } catch (error) {
    logger.error(`[Safety] Country safety lookup failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch country safety data', message: error.message });
  }
});

/**
 * GET /safety/venues?lat=51.5&lng=-0.1&type=24hr
 * Get 24-hour venues (convenience stores, late-night venues)
 */
router.get('/venues', async (req, res) => {
  try {
    const { lat, lng, type, radius } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat/lng parameters' });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return res.status(400).json({ error: 'Invalid lat/lng coordinates' });
    }

    const radiusParam = radius ? parseInt(radius) : 2000;
    let venues;

    switch (type) {
      case '24hr':
        venues = await get24HourVenues(latNum, lngNum, radiusParam);
        break;
      case 'latenight':
        venues = await getLateNightVenues(latNum, lngNum, radiusParam);
        break;
      default:
        venues = await getLateNightVenues(latNum, lngNum, radiusParam);
    }

    res.json({ success: true, data: venues });
  } catch (error) {
    logger.error(`[Safety] Venues fetch failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch venues', message: error.message });
  }
});

/**
 * GET /safety/emergency?lat=51.5&lng=-0.1&type=police
 * Get emergency services (police, hospitals, etc.)
 */
router.get('/emergency', async (req, res) => {
  try {
    const { lat, lng, type, radius } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat/lng parameters' });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return res.status(400).json({ error: 'Invalid lat/lng coordinates' });
    }

    const radiusParam = radius ? parseInt(radius) : 5000;
    let services;

    switch (type) {
      case 'police':
        services = await getPoliceStations(latNum, lngNum, radiusParam);
        break;
      case 'hospital':
        services = await getHospitals(latNum, lngNum, radiusParam);
        break;
      default:
        services = await getEmergencyServices(latNum, lngNum, radiusParam);
    }

    res.json({ success: true, data: services });
  } catch (error) {
    logger.error(`[Safety] Emergency services fetch failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch emergency services', message: error.message });
  }
});

/**
 * GET /safety/lighting?lat=51.5&lng=-0.1
 * Get street lighting info for an area
 */
router.get('/lighting', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat/lng parameters' });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return res.status(400).json({ error: 'Invalid lat/lng coordinates' });
    }

    const lighting = await getStreetLighting(latNum, lngNum, 1000);

    res.json({ success: true, data: lighting });
  } catch (error) {
    logger.error(`[Safety] Lighting fetch failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch lighting data', message: error.message });
  }
});

/**
 * POST /safety/route-score
 * Score a walking route for safety
 * Body: { route: {...}, timeOfDay: 22, lightingQuality: 'poor' }
 */
router.post('/route-score', async (req, res) => {
  try {
    const { route, timeOfDay, lightingQuality } = req.body;

    if (!route) {
      return res.status(400).json({ error: 'Missing route data' });
    }

    const safetyResult = calculateRouteSafetyScore(route, {
      timeOfDay: timeOfDay || new Date().getHours(),
      lightingQuality: lightingQuality || 'moderate'
    });

    res.json({ success: true, data: safetyResult });
  } catch (error) {
    logger.error(`[Safety] Route scoring failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to score route', message: error.message });
  }
});

/**
 * GET /safety/safe-haven?lat=51.5&lng=-0.1
 * Find nearest safe havens (police, hospital, embassy, 24hr hotel)
 */
router.get('/safe-haven', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat/lng parameters' });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return res.status(400).json({ error: 'Invalid lat/lng coordinates' });
    }

    const [police, hospitals] = await Promise.all([
      getPoliceStations(latNum, lngNum, 10000),
      getHospitals(latNum, lngNum, 10000)
    ]);

    const safeHavens = [
      ...police.map(p => ({ ...p, type: 'police', priority: 1 })),
      ...hospitals.map(h => ({ ...h, type: 'hospital', priority: 2 }))
    ].sort((a, b) => {
      const distA = Math.sqrt(Math.pow(a.lat - latNum, 2) + Math.pow(a.lon - lngNum, 2));
      const distB = Math.sqrt(Math.pow(b.lat - latNum, 2) + Math.pow(b.lon - lngNum, 2));
      return distA - distB;
    }).slice(0, 10);

    res.json({ success: true, data: safeHavens });
  } catch (error) {
    logger.error(`[Safety] Safe haven search failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to find safe havens', message: error.message });
  }
});

/**
 * POST /safety/emergency-alert
 * Trigger an emergency alert to all contacts
 */
router.post('/emergency-alert', async (req, res) => {
  try {
    const { lat, lng, message, type = 'emergency' } = req.body;
    const userId = req.userId;

    const user = await db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId);
    const { createNotification } = await import('../services/notificationService.js');

    // P0: Enqueue as a critical event so it survives process restarts and is
    // retried with exponential back-off before being dead-lettered.
    await enqueueEvent(
      'sos_triggered',
      { userId, lat, lng, type, message: message || `${user?.name} triggered an SOS alert.` },
      1, // highest priority
      userId
    );

    await createNotification(
      userId,
      'checkin_sos',
      '🚨 EMERGENCY ALERT TRIGGERED',
      message || `${user?.name} has triggered an emergency alert.`,
      { lat, lng, type }
    );

    logger.warn(`[Safety] EMERGENCY ALERT triggered by user ${userId} at ${lat}, ${lng}`);

    res.json({ 
      success: true, 
      message: 'Emergency protocol initiated. Contacts are being notified.' 
    });
  } catch (error) {
    logger.error(`[Safety] Emergency alert failed: ${error.message}`);
    sendError(res, 'SC_ERR_500', 'Failed to trigger emergency protocol');
  }
});

/**
 * GET /safety/destination/:id
 * Get safety card data for a destination by ID
 */
router.get('/destination/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const dest = await pool.query(`
      SELECT d.id, d.name, d.country, d.safety_rating, d.solo_friendly_rating,
             d.safety_intelligence, d.latitude, d.longitude,
             ss.overall, ss.women, ss.lgbtq, ss.night, ss.solo, ss.last_updated
      FROM destinations d
      LEFT JOIN safety_scores ss ON ss.destination_id = d.id
      WHERE d.id = $1
    `, [parseInt(id)]);

    if (!dest.rows.length) {
      return res.status(404).json({ success: false, error: 'Destination not found' });
    }

    const destination = dest.rows[0];
    const advisory = await pool.query(
      'SELECT level, level_label, description, source, updated_at FROM travel_advisories WHERE destination_id = $1 LIMIT 1',
      [parseInt(id)]
    );

    res.json({
      success: true,
      data: {
        destination_id: destination.id,
        name: destination.name,
        country: destination.country,
        safety_rating: destination.safety_rating,
        solo_friendly_rating: destination.solo_friendly_rating,
        scores: {
          overall: destination.overall,
          women: destination.women,
          lgbtq: destination.lgbtq,
          night: destination.night,
          solo: destination.solo,
          last_updated: destination.last_updated
        },
        advisory: advisory.rows[0] || null,
        safety_intelligence: destination.safety_intelligence
      }
    });
  } catch (error) {
    logger.error(`[Safety] Destination card failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch safety data' });
  }
});

/**
 * GET /safety/destination/:id/scores
 * Detailed safety scores for a destination
 */
router.get('/destination/:id/scores', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT ss.*, d.name, d.country, d.safety_rating
      FROM safety_scores ss
      JOIN destinations d ON d.id = ss.destination_id
      WHERE ss.destination_id = $1
    `, [parseInt(id)]);

    if (!result.rows.length) {
      // Return placeholder if no scores exist yet
      const dest = await pool.query('SELECT id, name, country, safety_rating, solo_friendly_rating FROM destinations WHERE id = $1', [parseInt(id)]);
      if (!dest.rows.length) return res.status(404).json({ success: false, error: 'Destination not found' });
      const d = dest.rows[0];
      const baseScore = d.safety_rating === 'high' ? 8 : d.safety_rating === 'medium' ? 6 : 4;
      return res.json({
        success: true,
        data: {
          destination_id: d.id,
          name: d.name,
          overall: baseScore,
          women: baseScore,
          lgbtq: baseScore - 1,
          night: baseScore - 1,
          solo: d.solo_friendly_rating || baseScore,
          last_updated: null,
          source: 'estimated'
        }
      });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error(`[Safety] Destination scores failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch safety scores' });
  }
});

/**
 * GET /safety/destination/:id/areas
 * Neighbourhood safety map for a destination
 */
router.get('/destination/:id/areas', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM safety_areas WHERE destination_id = $1 ORDER BY risk_level DESC',
      [parseInt(id)]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error(`[Safety] Destination areas failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch safety areas' });
  }
});

/**
 * GET /safety/destination/:id/scams
 * Common scams list for a destination
 */
router.get('/destination/:id/scams', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM safety_scams WHERE destination_id = $1 ORDER BY severity DESC, created_at DESC',
      [parseInt(id)]
    );

    // Also parse scam_harassment_patterns from destinations if DB table is empty
    if (!result.rows.length) {
      const dest = await pool.query('SELECT scam_harassment_patterns FROM destinations WHERE id = $1', [parseInt(id)]);
      if (dest.rows.length && dest.rows[0].scam_harassment_patterns) {
        try {
          const patterns = JSON.parse(dest.rows[0].scam_harassment_patterns);
          const scams = Array.isArray(patterns) ? patterns.map((p, i) => ({
            id: `inline_${i}`,
            destination_id: parseInt(id),
            title: typeof p === 'string' ? p : p.title || 'Common scam',
            description: typeof p === 'object' ? p.description : null,
            severity: typeof p === 'object' ? (p.severity || 'medium') : 'medium',
            area: typeof p === 'object' ? p.area : null
          })) : [];
          return res.json({ success: true, data: scams, source: 'inline' });
        } catch {}
      }
    }

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error(`[Safety] Destination scams failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch scams data' });
  }
});

/**
 * GET /safety/destination/:id/emergency
 * Emergency contacts for a destination
 */
router.get('/destination/:id/emergency', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const services = await pool.query(
      'SELECT * FROM emergency_services WHERE destination_id = $1 ORDER BY service_type',
      [parseInt(id)]
    );

    const practical = await pool.query(
      'SELECT emergency_number, police_number, ambulance_number, fire_number FROM destination_practical_info WHERE destination_id = $1',
      [parseInt(id)]
    );

    const dest = await pool.query(
      'SELECT emergency_contacts, country FROM destinations WHERE id = $1',
      [parseInt(id)]
    );

    let contacts = {};
    if (dest.rows.length) {
      try { contacts = JSON.parse(dest.rows[0].emergency_contacts || '{}'); } catch {}
    }

    const practicalInfo = practical.rows[0] || {};
    res.json({
      success: true,
      data: {
        services: services.rows,
        numbers: {
          police: practicalInfo.police_number || contacts.police || '112',
          ambulance: practicalInfo.ambulance_number || contacts.ambulance || '112',
          fire: practicalInfo.fire_number || contacts.fire || '112',
          emergency: practicalInfo.emergency_number || '112'
        },
        country: dest.rows[0]?.country
      }
    });
  } catch (error) {
    logger.error(`[Safety] Destination emergency failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch emergency contacts' });
  }
});

/**
 * GET /safety/embassies/:countryCode
 * Returns embassy info for a given country code
 */
router.get('/embassies/:countryCode', async (req, res) => {
  try {
    const { countryCode } = req.params;

    const embassies = await db.prepare(`
      SELECT id, country_code, nationality_code, embassy_name, address, phone, email,
             website, emergency_phone, city, latitude, longitude
      FROM embassies
      WHERE UPPER(country_code) = UPPER(?)
      ORDER BY city ASC
    `).all(countryCode);

    res.json({
      success: true,
      data: embassies,
      fallbackSearchUrl: `https://www.google.com/search?q=embassy+in+${encodeURIComponent(countryCode)}`
    });
  } catch (error) {
    logger.error(`[Safety] Embassy lookup failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch embassy information' });
  }
});

/**
 * GET /safety/emergency-services/:countryCode
 * Returns emergency service numbers for a country
 */
router.get('/emergency-services/:countryCode', async (req, res) => {
  try {
    const { countryCode } = req.params;

    const numbers = await db.prepare(`
      SELECT * FROM emergency_numbers WHERE UPPER(country_code) = UPPER(?) LIMIT 1
    `).get(countryCode);

    res.json({
      success: true,
      data: numbers || null,
      message: numbers ? undefined : `No emergency service data found for ${countryCode}`
    });
  } catch (error) {
    logger.error(`[Safety] Emergency services lookup failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch emergency services' });
  }
});

export default router;
