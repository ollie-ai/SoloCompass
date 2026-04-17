import express from 'express';
import { authenticate } from '../middleware/auth.js';
import db from '../db.js';
import logger from '../services/logger.js';
import { geocodeAddress } from '../services/placesService.js';
import { apiLimiter } from '../middleware/rateLimiters.js';

const router = express.Router();

// GET /api/v1/maps/geocode
router.get('/geocode', authenticate, apiLimiter, async (req, res) => {
  try {
    const { address, q } = req.query;
    const query = address || q;
    if (!query) return res.status(400).json({ success: false, error: { code: 'SC-ERR-400', message: 'Address or q query parameter is required' } });

    const result = await geocodeAddress(query);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error(`[Maps] Geocode error: ${err.message}`);
    res.status(500).json({ success: false, error: { code: 'SC-ERR-500', message: 'Geocoding failed' } });
  }
});

// GET /api/v1/maps/safety-overlay
router.get('/safety-overlay', authenticate, apiLimiter, async (req, res) => {
  try {
    const { lat, lng, radius = 50, country } = req.query;

    let destinations;
    if (country) {
      destinations = await db.all(
        `SELECT name, latitude, longitude, safety_rating, solo_friendly_rating,
                internal_safety_tier, internal_confidence_score
         FROM destinations
         WHERE country ILIKE $1 AND latitude IS NOT NULL AND longitude IS NOT NULL
         LIMIT 100`,
        `%${country}%`
      );
    } else if (lat && lng) {
      const latF = parseFloat(lat);
      const lngF = parseFloat(lng);
      const radDeg = parseFloat(radius) / 111;
      destinations = await db.all(
        `SELECT name, latitude, longitude, safety_rating, solo_friendly_rating,
                internal_safety_tier, internal_confidence_score
         FROM destinations
         WHERE latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4
           AND latitude IS NOT NULL AND longitude IS NOT NULL
         LIMIT 100`,
        latF - radDeg, latF + radDeg, lngF - radDeg, lngF + radDeg
      );
    } else {
      destinations = await db.all(
        `SELECT name, latitude, longitude, safety_rating, solo_friendly_rating,
                internal_safety_tier, internal_confidence_score
         FROM destinations WHERE latitude IS NOT NULL AND longitude IS NOT NULL LIMIT 200`
      );
    }

    const heatmapPoints = destinations
      .filter(d => d.latitude && d.longitude)
      .map(d => {
        const safetyScore = d.solo_friendly_rating || 5;
        const intensity = Math.max(0, Math.min(1, 1 - (safetyScore / 10)));
        return {
          lat: d.latitude,
          lng: d.longitude,
          intensity,
          name: d.name,
          safetyRating: d.safety_rating,
          soloFriendlyRating: d.solo_friendly_rating,
          tier: d.internal_safety_tier || 'unknown',
        };
      });

    res.json({
      success: true,
      data: {
        points: heatmapPoints,
        legend: [
          { color: '#22c55e', label: 'Low risk', range: '0.0-0.3' },
          { color: '#f59e0b', label: 'Moderate risk', range: '0.3-0.6' },
          { color: '#ef4444', label: 'Higher risk', range: '0.6-1.0' },
        ],
      },
    });
  } catch (err) {
    logger.error(`[Maps] Safety overlay error: ${err.message}`);
    res.status(500).json({ success: false, error: { code: 'SC-ERR-500', message: 'Failed to get safety overlay data' } });
  }
});

// GET /api/v1/maps/tiles
router.get('/tiles', (req, res) => {
  const { provider = 'osm' } = req.query;
  const providers = {
    osm: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors' },
    carto: { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attribution: '© CartoDB' },
  };

  const tileConfig = providers[provider] || providers.osm;
  res.json({ success: true, data: tileConfig });
});

export default router;
