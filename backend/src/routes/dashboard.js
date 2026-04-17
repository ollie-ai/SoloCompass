import express from 'express';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import logger from '../services/logger.js';

const router = express.Router();
const dashboardReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many dashboard requests. Please slow down.' },
});

// GET /dashboard/activity - Paginated activity feed for current user
router.get('/activity', requireAuth, dashboardReadLimiter, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const typeFilter = String(req.query.type || '').trim().toLowerCase();

    const rows = await db.all(`
      SELECT * FROM (
        SELECT
          'notification' as source,
          id,
          COALESCE(type, 'notification') as activity_type,
          title,
          message as description,
          data as metadata,
          created_at as occurred_at
        FROM notifications
        WHERE user_id = ?

        UNION ALL

        SELECT
          'event' as source,
          id,
          COALESCE(event_name, 'event') as activity_type,
          COALESCE(event_name, 'event') as title,
          COALESCE(event_data, '') as description,
          event_data as metadata,
          timestamp as occurred_at
        FROM events
        WHERE user_id = ?
      ) activity_union
      ORDER BY occurred_at DESC
      LIMIT 500
    `, req.userId, req.userId);

    const normalized = (rows || []).map((row) => ({
      id: row.id,
      source: row.source,
      type: row.activity_type,
      title: row.title,
      description: row.description,
      metadata: row.metadata,
      occurredAt: row.occurred_at,
    }));

    const filtered = typeFilter
      ? normalized.filter((item) => String(item.type || '').toLowerCase().includes(typeFilter) || String(item.source || '').toLowerCase().includes(typeFilter))
      : normalized;

    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    res.json({
      success: true,
      data: {
        activity: paginated,
        pagination: {
          page,
          limit,
          total: filtered.length,
          totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
          hasMore: offset + paginated.length < filtered.length,
        },
      },
    });
  } catch (error) {
    logger.error(`[Dashboard] Activity feed failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to load activity feed' },
    });
  }
});

export default router;
