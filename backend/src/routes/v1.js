import express from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/auth.js';
import db from '../db.js';
import logger from '../services/logger.js';
import { searchPlaces, getPlaceDetails } from '../services/placesService.js';
import { getDirections } from '../services/directionsService.js';
import { fetchFCDOAdvisories } from '../services/fcdoService.js';
import { searchNearby } from '../services/hospitalsService.js';
import {
  createFunnel, trackFunnelStep, getFunnelStats,
  createExperiment, startExperiment, pauseExperiment, completeExperiment,
  getAssignment, recordExposure, getExperimentResults,
  getEngagementMetrics
} from '../services/experimentService.js';

const router = express.Router();

const CULTURAL_NORMS = {
  japan: {
    greeting: 'Bow politely; avoid loud conversation on public transport.',
    dining: 'Do not tip; say "itadakimasu" before eating when appropriate.',
    safety: 'Low violent crime, but watch for scam bars in nightlife districts.'
  },
  thailand: {
    greeting: 'Use the wai greeting respectfully.',
    dining: 'Remove shoes where requested; avoid touching heads.',
    safety: 'Tourist scams occur in busy zones; verify transport fares first.'
  }
};

const OFFLINE_FAQ = new Map();
const OFFLINE_PHRASES = new Map();

router.get('/maps/places/search', authenticate, async (req, res) => {
  try {
    const { q, query, lat, lng, radius, type } = req.query;
    const searchQuery = q || query;
    if (!searchQuery) return res.status(400).json({ success: false, error: 'Missing query' });
    const data = await searchPlaces(searchQuery, {
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      radius: radius ? parseInt(radius, 10) : 5000,
      type
    });
    res.json({ success: true, data, count: data.length });
  } catch (error) {
    logger.error(`[v1] place search failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Place search failed' });
  }
});

router.get('/maps/places/:id', authenticate, async (req, res) => {
  try {
    const data = await getPlaceDetails(req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    logger.error(`[v1] place detail failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Place detail failed' });
  }
});

router.get('/maps/directions', authenticate, async (req, res) => {
  try {
    const { origin, destination, mode, alternatives } = req.query;
    if (!origin || !destination) return res.status(400).json({ success: false, error: 'Missing origin/destination' });
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return res.status(503).json({ success: false, error: 'GOOGLE_MAPS_API_KEY not configured' });
    const data = await getDirections(origin, destination, apiKey, {
      mode: mode || 'transit',
      alternatives: alternatives === 'true'
    });
    res.json({ success: true, data });
  } catch (error) {
    logger.error(`[v1] directions failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Directions failed' });
  }
});

router.get('/content/cultural-norms/:country', optionalAuth, async (req, res) => {
  const country = (req.params.country || '').toLowerCase();
  const norms = CULTURAL_NORMS[country] || {
    greeting: 'Respect local customs and personal space.',
    dining: 'Follow venue etiquette and local norms.',
    safety: 'Use official advisories and local emergency guidance.'
  };
  res.json({
    success: true,
    data: {
      country,
      version: 'v1',
      sections: [
        { type: 'greeting', guidance: norms.greeting },
        { type: 'dining', guidance: norms.dining },
        { type: 'safety', guidance: norms.safety }
      ]
    }
  });
});

router.get('/safety/advisories', authenticate, async (_req, res) => {
  try {
    const advisories = await fetchFCDOAdvisories();
    const mapped = advisories.map((a) => {
      const text = `${a.title || ''} ${a.summary || ''}`.toLowerCase();
      let level = 1;
      if (text.includes('all travel')) level = 4;
      else if (text.includes('against travel')) level = 3;
      else if (text.includes('caution')) level = 2;
      return { ...a, level };
    });
    res.json({ success: true, count: mapped.length, data: mapped });
  } catch (error) {
    logger.error(`[v1] advisories feed failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to fetch advisories' });
  }
});

router.get('/destinations/recommended', authenticate, async (req, res) => {
  try {
    const profile = await db.prepare(`
      SELECT budget_level, preferred_climate, travel_style
      FROM profiles WHERE user_id = ?
    `).get(req.userId);
    let query = `
      SELECT id, name, country, city, image_url, solo_friendly_rating, budget_level, climate
      FROM destinations
      WHERE (publication_status = 'live' OR status = 'live')
    `;
    const params = [];
    if (profile?.budget_level) {
      query += ' AND budget_level = ?';
      params.push(profile.budget_level);
    }
    if (profile?.preferred_climate) {
      query += ' AND climate = ?';
      params.push(profile.preferred_climate);
    }
    if (profile?.travel_style) {
      query += ' AND travel_styles ILIKE ?';
      params.push(`%${profile.travel_style}%`);
    }
    query += ' ORDER BY solo_friendly_rating DESC NULLS LAST LIMIT 10';
    const data = await db.prepare(query).all(...params);
    res.json({ success: true, count: data.length, data });
  } catch (error) {
    logger.error(`[v1] recommended destinations failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to fetch recommended destinations' });
  }
});

router.get('/offline/faq/:destination', optionalAuth, async (req, res) => {
  const key = (req.params.destination || '').toLowerCase();
  const data = OFFLINE_FAQ.get(key) || [];
  res.json({ success: true, data, count: data.length });
});

router.post('/offline/faq/:destination', authenticate, async (req, res) => {
  const key = (req.params.destination || '').toLowerCase();
  const faq = Array.isArray(req.body?.faq) ? req.body.faq.slice(0, 20) : [];
  OFFLINE_FAQ.set(key, faq);
  res.json({ success: true, data: faq, count: faq.length });
});

router.get('/offline/phrases/:destination', optionalAuth, async (req, res) => {
  const key = (req.params.destination || '').toLowerCase();
  const locale = String(req.query.locale || 'en').toLowerCase();
  const data = OFFLINE_PHRASES.get(`${key}:${locale}`) || [];
  res.json({ success: true, data, count: data.length, locale });
});

router.post('/offline/phrases/:destination', authenticate, async (req, res) => {
  const key = (req.params.destination || '').toLowerCase();
  const locale = String(req.body?.locale || 'en').toLowerCase();
  const phrases = Array.isArray(req.body?.phrases) ? req.body.phrases : [];
  OFFLINE_PHRASES.set(`${key}:${locale}`, phrases);
  res.json({ success: true, data: phrases, count: phrases.length, locale });
});

// ── Hospitals ────────────────────────────────────────────────────

router.get('/hospitals/nearby', authenticate, async (req, res) => {
  try {
    const { lat, lng, radius, english_only } = req.query;
    if (!lat || !lng) return res.status(400).json({ success: false, error: 'lat and lng are required' });

    const results = await searchNearby(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseFloat(radius) : 10,
      { englishOnly: english_only === 'true' }
    );
    res.json({ success: true, data: results, count: results.length });
  } catch (error) {
    logger.error(`[v1] Hospital search failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Hospital search failed' });
  }
});

// ── Review Votes (idempotent upsert) ─────────────────────────────

router.post('/reviews/:id/vote', authenticate, async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id, 10);
    const { vote_type } = req.body;
    if (!['helpful', 'unhelpful', 'flag'].includes(vote_type)) {
      return res.status(400).json({ success: false, error: 'vote_type must be helpful, unhelpful, or flag' });
    }

    const review = await db.get('SELECT id FROM reviews WHERE id = $1', reviewId);
    if (!review) return res.status(404).json({ success: false, error: 'Review not found' });

    // Idempotent upsert
    await db.run(`
      INSERT INTO review_votes (review_id, user_id, vote_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (review_id, user_id, vote_type) DO NOTHING
    `, reviewId, req.userId, vote_type);

    // Update helpful_count on the reviews table
    if (vote_type === 'helpful') {
      const count = await db.get('SELECT COUNT(*) as cnt FROM review_votes WHERE review_id = $1 AND vote_type = $2', reviewId, 'helpful');
      await db.run('UPDATE reviews SET helpful_count = $1 WHERE id = $2', count?.cnt || 0, reviewId);
    }

    res.json({ success: true, message: 'Vote recorded' });
  } catch (error) {
    logger.error(`[v1] Review vote failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Vote failed' });
  }
});

router.delete('/reviews/:id/vote', authenticate, async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id, 10);
    const { vote_type } = req.body;
    if (!['helpful', 'unhelpful', 'flag'].includes(vote_type)) {
      return res.status(400).json({ success: false, error: 'vote_type must be helpful, unhelpful, or flag' });
    }

    await db.run(
      'DELETE FROM review_votes WHERE review_id = $1 AND user_id = $2 AND vote_type = $3',
      reviewId, req.userId, vote_type
    );

    if (vote_type === 'helpful') {
      const count = await db.get('SELECT COUNT(*) as cnt FROM review_votes WHERE review_id = $1 AND vote_type = $2', reviewId, 'helpful');
      await db.run('UPDATE reviews SET helpful_count = $1 WHERE id = $2', count?.cnt || 0, reviewId);
    }

    res.json({ success: true, message: 'Vote removed' });
  } catch (error) {
    logger.error(`[v1] Vote removal failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Vote removal failed' });
  }
});

// ── Analytics Funnels ────────────────────────────────────────────

router.post('/analytics/funnel', requireAdmin, async (req, res) => {
  try {
    const { name, steps } = req.body;
    if (!name || !Array.isArray(steps)) return res.status(400).json({ success: false, error: 'name and steps[] required' });
    const funnel = await createFunnel(name, steps);
    res.status(201).json({ success: true, data: funnel });
  } catch (error) {
    logger.error(`[v1] Create funnel failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Create funnel failed' });
  }
});

router.post('/analytics/funnel/:name/track', authenticate, async (req, res) => {
  try {
    const { step, sessionId, metadata } = req.body;
    if (!step) return res.status(400).json({ success: false, error: 'step is required' });
    const result = await trackFunnelStep(req.params.name, req.userId, step, sessionId, metadata);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`[v1] Track funnel step failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Track funnel failed' });
  }
});

router.get('/analytics/funnel/:name', requireAdmin, async (req, res) => {
  try {
    const stats = await getFunnelStats(req.params.name, req.query.since);
    if (!stats) return res.status(404).json({ success: false, error: 'Funnel not found' });
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error(`[v1] Funnel stats failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Funnel stats failed' });
  }
});

router.get('/analytics/engagement', requireAdmin, async (req, res) => {
  try {
    const metrics = await getEngagementMetrics(req.query.period);
    if (!metrics) return res.status(500).json({ success: false, error: 'Failed to compute metrics' });
    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error(`[v1] Engagement metrics failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Engagement metrics failed' });
  }
});

// ── A/B Experiments ──────────────────────────────────────────────

router.post('/experiments', requireAdmin, async (req, res) => {
  try {
    const { name, description, variants, trafficPct } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });
    const exp = await createExperiment(name, description, variants, trafficPct);
    res.status(201).json({ success: true, data: exp });
  } catch (error) {
    logger.error(`[v1] Create experiment failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Create experiment failed' });
  }
});

router.post('/experiments/:id/start', requireAdmin, async (req, res) => {
  try { await startExperiment(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/experiments/:id/pause', requireAdmin, async (req, res) => {
  try { await pauseExperiment(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/experiments/:id/complete', requireAdmin, async (req, res) => {
  try { await completeExperiment(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/experiments/:id/assign', authenticate, async (req, res) => {
  try {
    const variant = await getAssignment(parseInt(req.params.id, 10), req.userId);
    res.json({ success: true, data: { variant } });
  } catch (error) {
    logger.error(`[v1] Assignment failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Assignment failed' });
  }
});

router.post('/experiments/:id/expose', authenticate, async (req, res) => {
  try {
    const { eventName, metadata } = req.body;
    if (!eventName) return res.status(400).json({ success: false, error: 'eventName required' });
    const result = await recordExposure(parseInt(req.params.id, 10), req.userId, eventName, metadata);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`[v1] Exposure recording failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Exposure recording failed' });
  }
});

router.get('/experiments/:id/results', requireAdmin, async (req, res) => {
  try {
    const results = await getExperimentResults(parseInt(req.params.id, 10));
    if (!results) return res.status(404).json({ success: false, error: 'Experiment not found' });
    res.json({ success: true, data: results });
  } catch (error) {
    logger.error(`[v1] Experiment results failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Experiment results failed' });
  }
});

export default router;
