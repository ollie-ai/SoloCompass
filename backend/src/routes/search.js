import express from 'express';
import { authenticate } from '../middleware/auth.js';
import db from '../db.js';
import logger from '../services/logger.js';
import { searchLimiter } from '../middleware/rateLimiters.js';

const router = express.Router();

const SCOPES = ['destinations', 'trips', 'safety', 'journal', 'buddies', 'help', 'all'];

/**
 * GET /api/search?q=query&scope=all
 * Federated search across multiple content types
 */
router.get('/', authenticate, searchLimiter, async (req, res) => {
  try {
    const { q, scope = 'all', limit = 5 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: { code: 'SC-ERR-400', message: 'Query must be at least 2 characters' }
      });
    }

    const term = `%${q.trim().toLowerCase()}%`;
    const maxPerScope = Math.min(parseInt(limit) || 5, 10);
    const results = {};

    if (scope === 'all' || scope === 'destinations') {
      const rows = await db.all(
        `SELECT id, name, country, description, image_url, slug
         FROM destinations
         WHERE LOWER(name) LIKE ? OR LOWER(country) LIKE ? OR LOWER(description) LIKE ?
         LIMIT ?`,
        term, term, term, maxPerScope
      );
      results.destinations = rows.map(r => ({
        id: r.id,
        type: 'destination',
        title: r.name,
        subtitle: r.country,
        description: r.description?.substring(0, 100),
        image: r.image_url,
        url: `/destinations/${r.id}`,
      }));
    }

    if (scope === 'all' || scope === 'trips') {
      const rows = await db.all(
        `SELECT id, title, destination, start_date, status
         FROM trips
         WHERE user_id = ? AND (LOWER(title) LIKE ? OR LOWER(destination) LIKE ?)
         LIMIT ?`,
        req.userId, term, term, maxPerScope
      );
      results.trips = rows.map(r => ({
        id: r.id,
        type: 'trip',
        title: r.title || r.destination,
        subtitle: r.destination,
        description: r.start_date ? `Starting ${new Date(r.start_date).toLocaleDateString()}` : null,
        url: `/trips/${r.id}`,
      }));
    }

    if (scope === 'all' || scope === 'safety') {
      const rows = await db.all(
        `SELECT id, name, country, safety_rating, fcdo_alert_status
         FROM destinations
         WHERE (LOWER(name) LIKE ? OR LOWER(country) LIKE ?) AND safety_rating IS NOT NULL
         LIMIT ?`,
        term, term, maxPerScope
      );
      results.safety = rows.map(r => ({
        id: r.id,
        type: 'safety',
        title: `${r.name} Safety`,
        subtitle: r.safety_rating,
        description: r.fcdo_alert_status,
        url: `/safety?destination=${encodeURIComponent(r.name)}`,
      }));
    }

    if (scope === 'all' || scope === 'buddies') {
      const rows = await db.all(
        `SELECT u.id, p.display_name, u.name, p.bio, p.home_city
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE u.id != ? AND (LOWER(u.name) LIKE ? OR LOWER(p.display_name) LIKE ?)
           AND p.visible = true
         LIMIT ?`,
        req.userId, term, term, maxPerScope
      );
      results.buddies = rows.map(r => ({
        id: r.id,
        type: 'buddy',
        title: r.display_name || r.name,
        subtitle: r.home_city,
        description: r.bio?.substring(0, 80),
        url: `/buddies`,
      }));
    }

    if (scope === 'all' || scope === 'help') {
      // Static help topics matched by keyword
      const helpTopics = [
        { id: 'safety', title: 'Safety Guide', description: 'Solo travel safety tips and emergency contacts', url: '/safety', keywords: ['safe', 'emergency', 'sos', 'help', 'danger', 'crime'] },
        { id: 'trips', title: 'Create a Trip', description: 'How to plan and manage your trips', url: '/trips/new', keywords: ['trip', 'plan', 'travel', 'itinerary', 'create'] },
        { id: 'buddies', title: 'Find Travel Buddies', description: 'Connect with other solo travellers', url: '/buddies', keywords: ['buddy', 'meet', 'connect', 'social', 'people'] },
        { id: 'atlas', title: 'Atlas AI Assistant', description: 'Get AI-powered travel advice', url: '/dashboard', keywords: ['ai', 'atlas', 'advice', 'assistant', 'chat'] },
        { id: 'billing', title: 'Plans & Billing', description: 'Upgrade your plan for more features', url: '/settings?tab=billing', keywords: ['plan', 'billing', 'upgrade', 'premium', 'guardian', 'navigator'] },
        { id: 'checkin', title: 'Safety Check-ins', description: 'Set up automatic safety check-ins', url: '/safety', keywords: ['checkin', 'check-in', 'schedule', 'guardian', 'location'] },
      ];
      const qLower = q.toLowerCase();
      results.help = helpTopics
        .filter(t => t.keywords.some(k => qLower.includes(k)) || t.title.toLowerCase().includes(qLower))
        .slice(0, maxPerScope)
        .map(t => ({
          id: t.id,
          type: 'help',
          title: t.title,
          subtitle: 'Help',
          description: t.description,
          url: t.url,
        }));
    }

    // Flatten for 'all' scope and add total count
    const totalCount = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

    // Persist the search query for the authenticated user (keep last 20 per user)
    try {
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO user_recent_searches (user_id, query, searched_at)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id, query) DO UPDATE SET searched_at = excluded.searched_at`,
        req.userId, q.trim(), now
      );
      // Trim to 20 most recent
      await db.run(
        `DELETE FROM user_recent_searches
         WHERE user_id = ? AND query NOT IN (
           SELECT query FROM user_recent_searches WHERE user_id = ?
           ORDER BY searched_at DESC LIMIT 20
         )`,
        req.userId, req.userId
      );
    } catch { /* non-fatal — search still returns results */ }

    res.json({
      success: true,
      data: {
        results,
        total: totalCount,
        query: q,
        scope,
      }
    });

  } catch (err) {
    logger.error(`[Search] Error: ${err.message}`);
    res.status(500).json({ success: false, error: { code: 'SC-ERR-500', message: 'Search failed' } });
  }
});

/**
 * GET /api/search/recent
 * Return the user's last 20 search queries
 */
router.get('/recent', authenticate, searchLimiter, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT query, searched_at FROM user_recent_searches
       WHERE user_id = ? ORDER BY searched_at DESC LIMIT 20`,
      req.userId
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    logger.error(`[Search] Recent error: ${err.message}`);
    res.status(500).json({ success: false, error: { code: 'SC-ERR-500', message: 'Failed to fetch recent searches' } });
  }
});

/**
 * DELETE /api/search/recent
 * Clear the user's recent searches
 */
router.delete('/recent', authenticate, searchLimiter, async (req, res) => {
  try {
    await db.run(`DELETE FROM user_recent_searches WHERE user_id = ?`, req.userId);
    res.json({ success: true });
  } catch (err) {
    logger.error(`[Search] Clear recent error: ${err.message}`);
    res.status(500).json({ success: false, error: { code: 'SC-ERR-500', message: 'Failed to clear recent searches' } });
  }
});

export default router;
