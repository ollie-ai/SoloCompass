import express from 'express';
import { previewEmail, sendCustomEmail, getEmailTemplates, sendTestEmail } from '../services/email.js';
import { requireAuth, requireAdmin, requireSuperAdmin, requireAdminSessionSecurity } from '../middleware/auth.js';
import db from '../db.js';
import logger from '../services/logger.js';
import researchService from '../services/researchService.js';
import axios from 'axios';
import { 
  getAllTemplates, 
  getTemplateById, 
  updateTemplate, 
  sendTestNotification, 
  getPreviewVariables,
  getAllNotificationTypes 
} from '../services/notificationTemplateService.js';

// Chain auth + admin check for all admin routes
const adminGuard = [requireAuth, requireAdmin, requireAdminSessionSecurity];

const router = express.Router();

router.get('/emails/templates', ...adminGuard, (req, res) => {
  try {
    const templates = getEmailTemplates();
    res.json(templates);
  } catch (error) {
    logger.error(`[Admin] Failed to get templates: ${error.message}`);
    res.status(500).json({ error: 'Failed to get email templates' });
  }
});

router.get('/emails/preview/:type', ...adminGuard, (req, res) => {
  try {
    const { type } = req.params;
    const format = req.query.format || 'html';
    
    const preview = previewEmail(type, format);
    res.json(preview);
  } catch (error) {
    logger.error(`[Admin] Failed to preview email: ${error.message}`);
    res.status(400).json({ error: 'Failed to preview email' });
  }
});

router.post('/emails/test', ...adminGuard, async (req, res) => {
  try {
    const { template, to } = req.body;
    
    if (!template || !to) {
      return res.status(400).json({ error: 'Template and "to" email are required' });
    }

    const previewVars = {
      welcome: { name: 'Test User', dashboardUrl: `${process.env.FRONTEND_URL}/dashboard` },
      emailVerification: { name: 'Test User', verifyUrl: `${process.env.FRONTEND_URL}/verify?token=test123` },
      passwordReset: { name: 'Test User', resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=test123` },
      tripConfirmation: { 
        name: 'Test User', 
        tripName: 'Tokyo Adventure',
        destination: 'Tokyo, Japan',
        startDate: 'April 15, 2026',
        endDate: 'April 22, 2026',
        tripUrl: `${process.env.FRONTEND_URL}/trips/123`,
        itinerary: 'Day 1: Arrival\nDay 2: Explore\nDay 3: Adventure'
      },
      safetyCheckIn: {
        travelerName: 'Test User',
        tripName: 'Tokyo Adventure',
        destination: 'Tokyo, Japan',
        checkInUrl: `${process.env.FRONTEND_URL}/safety-checkin`,
        emergencyContactName: 'Emergency Contact'
      },
      emergencyAlert: {
        travelerName: 'Test User',
        tripName: 'Tokyo Adventure',
        destination: 'Tokyo, Japan',
        emergencyContactName: 'Emergency Contact',
        contactPhone: '+1-555-0123',
        message: 'Test emergency message'
      },
      weeklyDigest: {
        name: 'Test User',
        upcomingTrips: [{ name: 'Tokyo', destination: 'Japan', dates: 'Apr 15-22' }],
        recentReviews: [{ destination: 'Paris', rating: 5, text: 'Great trip!' }],
        tripSuggestions: [{ name: 'Lisbon', description: 'Great city' }],
        dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`
      }
    };

    const vars = previewVars[template];
    if (!vars) {
      return res.status(400).json({ error: `Unknown template: ${template}` });
    }

    const result = await sendCustomEmail(to, template, vars);
    
    if (result.success) {
      res.json({ success: true, messageId: result.messageId });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    logger.error(`[Admin] Failed to send test email: ${error.message}`);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

router.get('/analytics/overview', ...adminGuard, async (req, res) => {
  try {
    const period = req.query.period || '30d';
    const days = parseInt(period) || 30;

    let totalUsers = { count: 0 };
    let activeTrips = { count: 0 };
    let totalTrips = { count: 0 };
    let subscriptionStats = [];
    let revenue = { total_revenue: 0, monthly_recurring: 0 };
    let popularDestinations = [];
    let usersLast30Days = { count: 0 };
    let usersLast60Days = { count: 0 };

    try {
      const totalUsersRes = await db.get('SELECT COUNT(*) as count FROM users');
      totalUsers = totalUsersRes || { count: 0 };
    } catch (e) { logger.warn('[Admin] Users count failed:', e.message); }

    try {
      const activeTripsRes = await db.get(`SELECT COUNT(*) as count FROM trips WHERE status = 'planning'`);
      activeTrips = activeTripsRes || { count: 0 };
    } catch (e) { logger.warn('[Admin] Active trips count failed:', e.message); }

    try {
      const totalTripsRes = await db.get('SELECT COUNT(*) as count FROM trips');
      totalTrips = totalTripsRes || { count: 0 };
    } catch (e) { logger.warn('[Admin] Total trips count failed:', e.message); }

    try {
      subscriptionStats = await db.all(`
        SELECT subscription_tier as plan_tier, COUNT(*) as count,
          SUM(CASE WHEN is_premium = true THEN 1 ELSE 0 END) as active_count
        FROM users WHERE subscription_tier IS NOT NULL GROUP BY subscription_tier
      `);
      if (!Array.isArray(subscriptionStats)) subscriptionStats = [];
      
      const revenueRes = await db.get(`
        SELECT COUNT(*) as total_revenue, SUM(CASE WHEN is_premium = true THEN 1 ELSE 0 END) as monthly_recurring
        FROM users WHERE is_premium = true
      `);
      revenue = revenueRes || { total_revenue: 0, monthly_recurring: 0 };
    } catch (e) { logger.warn('[Admin] Subscription stats failed:', e.message); subscriptionStats = []; }

    try {
      popularDestinations = await db.all(`
        SELECT destination as name, COUNT(*) as trip_count FROM trips
        GROUP BY destination ORDER BY trip_count DESC LIMIT 10
      `);
      if (!Array.isArray(popularDestinations)) popularDestinations = [];
    } catch (e) { logger.warn('[Admin] Popular destinations failed:', e.message); popularDestinations = []; }

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const u30 = await db.get('SELECT COUNT(*) as count FROM users WHERE created_at > ?', thirtyDaysAgo);
      const u60 = await db.get('SELECT COUNT(*) as count FROM users WHERE created_at > ?', sixtyDaysAgo);
      usersLast30Days = u30 || { count: 0 };
      usersLast60Days = u60 || { count: 0 };
    } catch (e) { logger.warn('[Admin] User growth stats failed:', e.message); }

    const churnRate = usersLast60Days.count > 0
      ? Math.max(0, ((usersLast60Days.count - usersLast30Days.count) / usersLast60Days.count) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        totalUsers: totalUsers.count || 0,
        activeTrips: activeTrips.count || 0,
        totalTrips: totalTrips.count || 0,
        subscriptionStats: Array.isArray(subscriptionStats) ? subscriptionStats.map(s => ({
          tier: s.plan_tier,
          total: s.count,
          active: s.active_count
        })) : [],
        revenue: {
          total: (revenue && revenue.total_revenue) || 0,
          monthlyRecurring: (revenue && revenue.monthly_recurring) || 0
        },
        popularDestinations: Array.isArray(popularDestinations) ? popularDestinations.map(d => ({
          name: d.name,
          tripCount: d.trip_count
        })) : [],
        churnRate: Math.round(churnRate * 10) / 10,
        period: `${days}d`
      }
    });
  } catch (error) {
    logger.error(`[Admin] Analytics overview failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to get analytics overview' });
  }
});

/**
 * GET /api/admin/user-activity/:userId
 * Fetch activity timeline for a specific user
 */
router.get('/user-activity/:userId', ...adminGuard, async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const eventType = req.query.type || '';
    const days = parseInt(req.query.days) || 90;
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Simple query - no dismissed columns
    let query = `
      SELECT e.id, e.user_id, e.event_name, e.event_data, e.timestamp
      FROM events e
      WHERE e.user_id = ? AND e.timestamp > ?
    `;
    const params = [userId, sinceDate];

    if (eventType) {
      if (eventType === 'login') {
        query += ' AND (e.event_name = ? OR e.event_name = ?)';
        params.push('user_login', 'user_logout');
      } else if (eventType === 'trip') {
        query += ' AND (e.event_name LIKE ?)';
        params.push('trip%');
      } else if (eventType === 'checkin') {
        query += ' AND (e.event_name LIKE ?)';
        params.push('checkin%');
      } else if (eventType === 'buddy') {
        query += ' AND (e.event_name LIKE ?)';
        params.push('buddy%');
      } else {
        query += ' AND e.event_name = ?';
        params.push(eventType);
      }
    }

    query += ' ORDER BY e.timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const logs = await db.all(query, ...params);

    // Count query
    let countQuery = 'SELECT COUNT(*) as count FROM events WHERE user_id = ? AND timestamp > ?';
    const countParams = [userId, sinceDate];
    if (eventType) {
      if (eventType === 'login') {
        countQuery += ' AND (event_name = ? OR event_name = ?)';
        countParams.push('user_login', 'user_logout');
      } else if (eventType === 'trip') {
        countQuery += ' AND (event_name LIKE ?)';
        countParams.push('trip%');
      } else if (eventType === 'checkin') {
        countQuery += ' AND (event_name LIKE ?)';
        countParams.push('checkin%');
      } else if (eventType === 'buddy') {
        countQuery += ' AND (event_name LIKE ?)';
        countParams.push('buddy%');
      } else {
        countQuery += ' AND event_name = ?';
        countParams.push(eventType);
      }
    }

    const countResult = await db.get(countQuery, ...countParams);

    // Also fetch trip-related activities from trips table
    const tripsQuery = `
      SELECT id, name, destination, status, created_at, updated_at
      FROM trips
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `;
    const trips = await db.all(tripsQuery, userId);

    // Fetch buddy requests
    const buddyQuery = `
      SELECT br.id, br.trip_id, br.status, br.message, br.created_at,
             CASE WHEN br.sender_id = ? THEN 'sent' ELSE 'received' END as direction,
             COALESCE(u.name, 'Unknown') as buddy_name
      FROM buddy_requests br
      LEFT JOIN users u ON (u.id = CASE WHEN br.sender_id = ? THEN br.receiver_id ELSE br.sender_id END)
      WHERE br.sender_id = ? OR br.receiver_id = ?
      ORDER BY br.created_at DESC
      LIMIT 20
    `;
    const buddyRequests = await db.all(buddyQuery, userId, userId, userId, userId);

    // Fetch safety check-ins
    const checkinsQuery = `
      SELECT id, trip_id, scheduled_time, completed_at, missed_at, is_active, status
      FROM scheduled_check_ins
      WHERE user_id = ?
      ORDER BY scheduled_time DESC
      LIMIT 20
    `;
    const checkins = await db.all(checkinsQuery, userId);

    res.json({
      success: true,
      data: {
        events: logs,
        trips,
        buddyRequests,
        checkins,
        total: countResult?.count || 0,
        limit,
        offset
      }
    });
  } catch (error) {
    logger.error(`[Admin] User activity failed: ${error.message}`);
    logger.error(`[Admin] User activity stack: ${error.stack}`);
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
});

/**
 * GET /api/admin/audit-logs
 * Fetch system events
 */
router.get('/audit-logs', ...adminGuard, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const eventType = req.query.type || '';
    const days = parseInt(req.query.days) || 30;
    const dismissed = req.query.dismissed === 'true';
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Check if dismissed columns exist
    let hasDismissColumns = false;
    let colCheck = [];
    try {
      colCheck = await db.all(`SELECT column_name FROM information_schema.columns WHERE table_name = 'events' AND column_name IN ('dismissed_at', 'dismissed_by')`);
      hasDismissColumns = colCheck.length >= 2;
    } catch (e) {
      hasDismissColumns = false;
    }

    // Build query with dismissed filtering
    let query = hasDismissColumns ? `
      SELECT e.id, e.user_id, e.event_name, e.event_data, e.timestamp, e.dismissed_at, e.dismissed_by, u.email as user_email
      FROM events e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.timestamp > ?
    ` : `
      SELECT e.id, e.user_id, e.event_name, e.event_data, e.timestamp, u.email as user_email
      FROM events e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.timestamp > ?
    `;
    const params = [sinceDate];

    if (eventType) {
      query += ' AND e.event_name = ?';
      params.push(eventType);
    }

    // Filter by dismissed status
    // dismissed=false -> show active (not dismissed)
    // dismissed=true -> show dismissed
    // not specified -> show all
    if (hasDismissColumns) {
      if (dismissed) {
        // Show only dismissed
        query += ' AND e.dismissed_at IS NOT NULL';
        countQuery += ' AND dismissed_at IS NOT NULL';
      } else if (req.query.dismissed === 'false') {
        // Show only active (not dismissed)
        query += ' AND e.dismissed_at IS NULL';
        countQuery += ' AND dismissed_at IS NULL';
      }
      // else: show all (no filter)
    }

    query += ' ORDER BY e.timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const logs = await db.all(query, ...params);

    // Count query
    let countQuery = 'SELECT COUNT(*) as count FROM events WHERE timestamp > ?';
    const countParams = [sinceDate];
    if (eventType) {
      countQuery += ' AND event_name = ?';
      countParams.push(eventType);
    }
    // Count uses same filter as main query
    if (hasDismissColumns) {
      if (dismissed) {
        countQuery += ' AND dismissed_at IS NOT NULL';
      } else if (req.query.dismissed === 'false') {
        countQuery += ' AND dismissed_at IS NULL';
      }
    }

    const countResult = await db.get(countQuery, ...countParams);

    // Also log admin viewed audit logs for compliance
    if (eventType) {
      try {
        await db.run('INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
          req.userId, 'admin_viewed_audit_logs', JSON.stringify({ type: eventType, dismissed }));
      } catch (e) {}
    }

    res.json({
      success: true,
      data: {
        logs,
        total: countResult?.count || 0,
        limit,
        offset
      }
    });
  } catch (error) {
    logger.error(`[Admin] Audit logs failed: ${error.message}`);
    logger.error(`[Admin] Audit logs stack: ${error.stack}`);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

/**
 * POST /api/admin/errors/:id/dismiss
 * Dismiss/clear an error (soft delete)
 */
router.post('/errors/:id/dismiss', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.userId;

    // Check if error exists
    const error = await db.get('SELECT id, event_name FROM events WHERE id = ?', id);
    if (!error) {
      return res.status(404).json({ error: 'Error not found' });
    }

    // Mark as dismissed if columns exist
    try {
      await db.run(
        'UPDATE events SET dismissed_at = CURRENT_TIMESTAMP, dismissed_by = ? WHERE id = ?',
        adminId,
        id
      );
    } catch (e) {
      logger.warn('[Admin] Dismiss columns not available:', e.message);
    }

    logger.info(`[Admin] Error ${id} (${error.event_name}) dismissed by admin ${adminId}`);

    res.json({ success: true, message: 'Error dismissed successfully' });
  } catch (error) {
    logger.error(`[Admin] Failed to dismiss error: ${error.message}`);
    res.status(500).json({ error: 'Failed to dismiss error' });
  }
});

/**
 * POST /api/admin/errors/:id/restore
 * Restore a dismissed error
 */
router.post('/errors/:id/restore', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;

    // Try to restore if columns exist
    try {
      await db.run('UPDATE events SET dismissed_at = NULL, dismissed_by = NULL WHERE id = ?', id);
    } catch (e) {
      logger.warn('[Admin] Restore columns not available:', e.message);
    }

    res.json({ success: true, message: 'Error restored successfully' });
  } catch (error) {
    logger.error(`[Admin] Failed to restore error: ${error.message}`);
    res.status(500).json({ error: 'Failed to restore error' });
  }
});

/**
 * POST /api/admin/errors/bulk-dismiss
 * Dismiss multiple errors at once
 */
router.post('/errors/bulk-dismiss', ...adminGuard, async (req, res) => {
  try {
    const { ids } = req.body;
    const adminId = req.userId;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Array of error IDs required' });
    }

    const safeIds = ids.map(id => parseInt(id, 10)).filter(id => Number.isInteger(id) && id > 0);
    if (safeIds.length === 0) {
      return res.status(400).json({ error: 'No valid integer IDs provided' });
    }

    // Try bulk update if columns exist
    let updated = 0;
    try {
      const placeholders = safeIds.map(() => '?').join(',');
      const result = await db.run(
        `UPDATE events SET dismissed_at = CURRENT_TIMESTAMP, dismissed_by = ? WHERE id IN (${placeholders})`,
        adminId, ...safeIds
      );
      updated = result.changes;
    } catch (e) {
      logger.warn('[Admin] Bulk dismiss failed:', e.message);
      // Fallback to individual updates
      for (const id of safeIds) {
        try {
          await db.run('UPDATE events SET dismissed_at = CURRENT_TIMESTAMP, dismissed_by = ? WHERE id = ?', adminId, id);
          updated++;
        } catch (err) {
          // skip individual failure
        }
      }
    }

    logger.info(`[Admin] Bulk dismissed ${updated} errors by admin ${adminId}`);
    res.json({ success: true, data: { dismissed: updated } });
  } catch (error) {
    logger.error(`[Admin] Bulk dismiss failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to dismiss errors' });
  }
});

/**
 * POST /api/admin/errors/bulk-restore
 * Restore multiple errors at once
 */
router.post('/errors/bulk-restore', ...adminGuard, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Array of error IDs required' });
    }

    const safeIds = ids.map(id => parseInt(id, 10)).filter(id => Number.isInteger(id) && id > 0);
    if (safeIds.length === 0) {
      return res.status(400).json({ error: 'No valid integer IDs provided' });
    }

    let restored = 0;
    try {
      const placeholders = safeIds.map(() => '?').join(',');
      const result = await db.run(
        `UPDATE events SET dismissed_at = NULL, dismissed_by = NULL WHERE id IN (${placeholders})`,
        ...safeIds
      );
      restored = result.changes;
    } catch (e) {
      // Fallback
      for (const id of safeIds) {
        try {
          await db.run('UPDATE events SET dismissed_at = NULL, dismissed_by = NULL WHERE id = ?', id);
          restored++;
        } catch (err) {}
      }
    }

    logger.info(`[Admin] Bulk restored ${restored} errors by admin ${req.userId}`);
    res.json({ success: true, data: { restored } });
  } catch (error) {
    logger.error(`[Admin] Bulk restore failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to restore errors' });
  }
});

/**
 * GET /api/admin/system-health
 * Check connectivity and status
 */
router.get('/system-health', ...adminGuard, async (req, res) => {
  try {
    const startTime = Date.now();
    const health = {
      database: { status: 'checking', responseTime: null },
      ai: { status: 'checking', responseTime: null, provider: null },
      stripe: { status: 'checking', responseTime: null },
      resend: { status: 'checking', responseTime: null },
      fcdo: { status: 'checking', responseTime: null },
      geoapify: { status: 'checking', responseTime: null },
      unsplash: { status: 'checking', responseTime: null },
      server: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
        pid: process.pid
      },
      timestamp: new Date().toISOString()
    };

    // DB Check with response time
    try {
      const dbStart = Date.now();
      await db.get('SELECT 1');
      health.database.status = 'connected';
      health.database.responseTime = Date.now() - dbStart;
    } catch (e) {
      health.database.status = 'error';
      health.database.error = e.message;
    }

    // AI/OpenAI Check
    try {
      const aiStart = Date.now();
      if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY) {
        health.ai.provider = 'azure';
        const azureRes = await axios.post(
          `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o'}/chat/completions?api-version=${process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview'}`,
          { messages: [{ role: 'user', content: 'test' }], max_tokens: 5 },
          { headers: { 'api-key': process.env.AZURE_OPENAI_API_KEY, 'Content-Type': 'application/json' }, timeout: 5000 }
        );
        health.ai.status = azureRes.status === 200 ? 'connected' : 'error';
      } else if (process.env.OPENAI_API_KEY) {
        health.ai.provider = 'openai';
        const openaiRes = await axios.post('https://api.openai.com/v1/chat/completions',
          { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'test' }], max_tokens: 5 },
          { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, timeout: 5000 }
        );
        health.ai.status = openaiRes.status === 200 ? 'connected' : 'error';
      } else {
        health.ai.status = 'not_configured';
      }
      health.ai.responseTime = Date.now() - aiStart;
    } catch (e) {
      health.ai.status = 'error';
      health.ai.error = e.message;
      health.ai.responseTime = Date.now() - aiStart;
    }

    // Stripe Check
    try {
      const stripeStart = Date.now();
      if (process.env.STRIPE_SECRET_KEY) {
        const stripeRes = await axios.get('https://api.stripe.com/v1/balance',
          { auth: { username: process.env.STRIPE_SECRET_KEY, password: '' }, timeout: 5000 }
        );
        health.stripe.status = stripeRes.status === 200 ? 'connected' : 'error';
      } else {
        health.stripe.status = 'not_configured';
      }
      health.stripe.responseTime = Date.now() - stripeStart;
    } catch (e) {
      health.stripe.status = 'error';
      health.stripe.error = e.message;
      health.stripe.responseTime = Date.now() - stripeStart;
    }

    // Resend Check
    let resendStart = Date.now();
    try {
      if (process.env.RESEND_API_KEY) {
        const resendRes = await axios.get('https://api.resend.com/audiences',
          { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, timeout: 5000 }
        );
        health.resend.status = resendRes.status === 200 ? 'connected' : 'error';
      } else {
        health.resend.status = 'not_configured';
      }
      health.resend.responseTime = Date.now() - resendStart;
    } catch (e) {
      health.resend.status = 'error';
      health.resend.error = e.message;
      health.resend.responseTime = Date.now() - resendStart;
    }

    // FCDO Feed Check
    try {
      const fcdoStart = Date.now();
      const fcdoRes = await axios.get('https://www.gov.uk/foreign-travel-advice.atom', { timeout: 5000 });
      health.fcdo.status = fcdoRes.status === 200 ? 'online' : 'error';
      health.fcdo.responseTime = Date.now() - fcdoStart;
    } catch (e) {
      health.fcdo.status = 'offline';
      health.fcdo.error = e.message;
      health.fcdo.responseTime = Date.now() - fcdoStart;
    }

    // Geoapify Check
    try {
      const geoStart = Date.now();
      if (process.env.GEOAPIFY_API_KEY) {
        const geoRes = await axios.get(`https://api.geoapify.com/v1/geocode/search?text=London&apiKey=${process.env.GEOAPIFY_API_KEY}`, { timeout: 5000 });
        health.geoapify.status = geoRes.status === 200 ? 'online' : 'error';
      } else {
        health.geoapify.status = 'not_configured';
      }
      health.geoapify.responseTime = Date.now() - geoStart;
    } catch (e) {
      health.geoapify.status = 'offline';
      health.geoapify.error = e.message;
      health.geoapify.responseTime = Date.now() - geoStart;
    }

    // Unsplash Check
    try {
      const unsplashStart = Date.now();
      if (process.env.UNSPLASH_ACCESS_KEY) {
        const unsplashRes = await axios.get(`https://api.unsplash.com/photos/random?client_id=${process.env.UNSPLASH_ACCESS_KEY}`, { timeout: 5000 });
        health.unsplash.status = unsplashRes.status === 200 ? 'online' : 'error';
      } else {
        health.unsplash.status = 'not_configured';
      }
      health.unsplash.responseTime = Date.now() - unsplashStart;
    } catch (e) {
      health.unsplash.status = 'offline';
      health.unsplash.error = e.message;
      health.unsplash.responseTime = Date.now() - unsplashStart;
    }

    health.server.totalResponseTime = Date.now() - startTime;
    
    res.json({ success: true, data: health });
  } catch (error) {
    logger.error(`[Admin] Health check failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to perform health check' });
  }
});

/**
 * AI RESEARCH & MODERATION
 */

router.post('/research/destination', ...adminGuard, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Destination name is required' });

  // Check AI is configured before attempting
  if (!process.env.AZURE_OPENAI_ENDPOINT || !process.env.AZURE_OPENAI_API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'AI service not configured. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY in your Infisical secrets.',
      code: 'AI_NOT_CONFIGURED'
    });
  }
  
  try {
    const result = await researchService.researchDestination(name);
    res.json(result);
  } catch (error) {
    logger.error(`[Admin] Research failed for ${name}: ${error.message}`);
    res.status(500).json({ success: false, error: 'An unexpected error occurred' });
  }
});

router.post('/research/seed-bulk', ...adminGuard, async (req, res) => {
  const TOP_DESTINATIONS = [
    'Tokyo, Japan', 'Rhodes, Greece', 'Chiang Mai, Thailand', 'Porto, Portugal',
    'Reykjavik, Iceland', 'Copenhagen, Denmark', 'Hanoi, Vietnam', 'Split, Croatia'
  ];
  
  try {
    const results = await researchService.seedModerationQueue(TOP_DESTINATIONS);
    res.json({ success: true, count: results.length, results });
  } catch (error) {
    res.status(500).json({ success: false, error: 'An unexpected error occurred' });
  }
});

router.get('/moderation/destinations', ...adminGuard, async (req, res) => {
  try {
    // Ensure status/source columns exist (safe to run repeatedly in PG)
    await db.run(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'live'`).catch(() => {});
    await db.run(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'`).catch(() => {});

    const pending = await db.all("SELECT * FROM destinations WHERE status = 'pending' ORDER BY created_at DESC");
    res.json({ success: true, data: pending });
  } catch (error) {
    logger.error(`[Admin] Moderation fetch failed: ${error.message}`);
    // Fallback: return all destinations if status column truly missing
    try {
      const all = await db.all('SELECT * FROM destinations ORDER BY created_at DESC LIMIT 50');
      res.json({ success: true, data: all, warning: 'status column missing — showing all destinations' });
    } catch (fallbackErr) {
      res.status(500).json({ success: false, error: 'An unexpected error occurred' });
    }
  }
});

router.post('/moderation/destinations/:id/approve', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    await db.run("UPDATE destinations SET status = 'live', updated_at = CURRENT_TIMESTAMP WHERE id = ?", id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'An unexpected error occurred' });
  }
});

router.post('/moderation/destinations/:id/reject', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    await db.run("UPDATE destinations SET status = 'flagged', updated_at = CURRENT_TIMESTAMP WHERE id = ?", id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'An unexpected error occurred' });
  }
});

// GET /admin/moderation/reviews - List reviews pending moderation
router.get('/moderation/reviews', ...adminGuard, async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const reviews = await db.all(`
      SELECT r.*, u.name as user_name, u.email as user_email
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.status = ?
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `, status, parseInt(limit), offset);

    const countResult = await db.get('SELECT COUNT(*) as count FROM reviews WHERE status = ?', status);

    res.json({ 
      success: true, 
      data: { 
        reviews, 
        total: countResult.count,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error(`[Admin] Failed to fetch reviews: ${error.message}`);
    res.status(500).json({ success: false, error: 'An unexpected error occurred' });
  }
});

// POST /admin/moderation/reviews/:id/approve - Approve a review
router.post('/moderation/reviews/:id/approve', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    await db.run("UPDATE reviews SET status = 'approved', is_verified = true, updated_at = CURRENT_TIMESTAMP WHERE id = ?", id);
    res.json({ success: true, message: 'Review approved' });
  } catch (error) {
    logger.error(`[Admin] Failed to approve review: ${error.message}`);
    res.status(500).json({ success: false, error: 'An unexpected error occurred' });
  }
});

// POST /admin/moderation/reviews/:id/reject - Reject a review
router.post('/moderation/reviews/:id/reject', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    await db.run("UPDATE reviews SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?", id);
    res.json({ success: true, message: 'Review rejected' });
  } catch (error) {
    logger.error(`[Admin] Failed to reject review: ${error.message}`);
    res.status(500).json({ success: false, error: 'An unexpected error occurred' });
  }
});

// GET /admin/destinations/export - Export destinations as CSV
router.get('/destinations/export', ...adminGuard, async (req, res) => {
  try {
    const { format = 'csv' } = req.query;
    
    const destinations = await db.all(`
      SELECT id, name, city, country, region, description, budget_level, 
             safety_rating, solo_friendly_rating, image_url, status, source, created_at
      FROM destinations 
      ORDER BY created_at DESC
    `);
    
    if (format === 'json') {
      return res.json({ success: true, data: destinations });
    }
    
    // CSV format
    const headers = ['ID', 'Name', 'City', 'Country', 'Region', 'Budget Level', 'Safety Rating', 'Solo Rating', 'Status', 'Source', 'Created'];
    const rows = destinations.map(d => [
      d.id, d.name, d.city, d.country, d.region, d.budget_level, 
      d.safety_rating, d.solo_friendly_rating, d.status, d.source, d.created_at
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v || ''}"`).join(','))].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=destinations.csv');
    res.send(csv);
  } catch (error) {
    logger.error(`[Admin] Destinations export failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to export destinations' });
  }
});

// === OPS ALERTS ===
router.get('/notifications/ops-alerts', ...adminGuard, async (req, res) => {
  try {
    const { limit = 50, offset = 0, severity } = req.query;
    const { getOpenAlerts, getAlertStats } = await import('../services/opsAlertService.js');
    
    const alerts = await getOpenAlerts({ 
      limit: parseInt(limit), 
      offset: parseInt(offset),
      severity 
    });
    const stats = await getAlertStats();
    
    res.json({ 
      success: true, 
      data: { 
        alerts: alerts.alerts, 
        total: alerts.total,
        stats 
      } 
    });
  } catch (error) {
    logger.error(`[Admin] Ops alerts fetch failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'An unexpected error occurred' });
  }
});

router.post('/notifications/ops-alerts/:id/resolve', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    const { resolveAlert } = await import('../services/opsAlertService.js');
    
    const result = await resolveAlert(parseInt(id));
    res.json(result);
  } catch (error) {
    logger.error(`[Admin] Resolve alert failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'An unexpected error occurred' });
  }
});

router.post('/notifications/ops-alerts/:id/acknowledge', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    const { acknowledgeAlert } = await import('../services/opsAlertService.js');
    
    const result = await acknowledgeAlert(parseInt(id));
    res.json(result);
  } catch (error) {
    logger.error(`[Admin] Acknowledge alert failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// Bulk operations for ops alerts
router.post('/notifications/ops-alerts/bulk-resolve', ...adminGuard, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Array of alert IDs required' });
    }
    
    const { resolveAlert } = await import('../services/opsAlertService.js');
    let resolved = 0;
    for (const id of ids) {
      const result = await resolveAlert(parseInt(id));
      if (result.success) resolved++;
    }
    
    logger.info(`[Admin] Bulk resolved ${resolved} ops alerts by admin ${req.userId}`);
    res.json({ success: true, data: { resolved } });
  } catch (error) {
    logger.error(`[Admin] Bulk resolve failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to resolve alerts' });
  }
});

router.post('/notifications/ops-alerts/bulk-acknowledge', ...adminGuard, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Array of alert IDs required' });
    }
    
    const { acknowledgeAlert } = await import('../services/opsAlertService.js');
    let acknowledged = 0;
    for (const id of ids) {
      const result = await acknowledgeAlert(parseInt(id));
      if (result.success) acknowledged++;
    }
    
    logger.info(`[Admin] Bulk acknowledged ${acknowledged} ops alerts by admin ${req.userId}`);
    res.json({ success: true, data: { acknowledged } });
  } catch (error) {
    logger.error(`[Admin] Bulk acknowledge failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to acknowledge alerts' });
  }
});

// POST /admin/bulk-action - Generic bulk operations endpoint
router.post('/bulk-action', ...adminGuard, async (req, res) => {
  try {
    const { ids, action, data } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Array of IDs required' });
    }
    
    if (!action) {
      return res.status(400).json({ error: 'Action required' });
    }

    const actionTypeMap = {
      'delete_users': 'bulk_delete_users',
      'delete_dests': 'delete_destination',
      'export_all': 'bulk_export'
    };
    const mappedAction = actionTypeMap[action] || action;

    if (requiresApproval(mappedAction)) {
      const approvalInfo = actionRequiresApproval(mappedAction);
      
      if (approvalInfo.requiresSuperAdmin && req.user?.admin_level !== 'super_admin') {
        return res.status(403).json({ 
          error: 'This action requires super_admin approval',
          requires_approval: true,
          action_type: mappedAction
        });
      }

      for (const targetId of ids) {
        const existingPending = await db.get(
          "SELECT id FROM pending_actions WHERE action_type = ? AND target_id = ? AND status = 'pending'",
          mappedAction, String(targetId)
        );
        if (existingPending) {
          return res.status(400).json({ 
            error: 'Action already pending approval',
            pending_id: existingPending.id
          });
        }

        await createPendingAction(mappedAction, req.userId, action === 'delete_dests' ? 'destination' : 'user', String(targetId), { 
          ...data,
          original_ids: ids 
        });
      }

      await db.run(
        'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
        req.userId, 'pending_action_created', JSON.stringify({
          action_type: mappedAction,
          target_count: ids.length,
          params: data
        })
      );

      logger.info(`[Admin] Pending ${mappedAction} for ${ids.length} targets created by admin ${req.userId}`);

      return res.json({ 
        success: true, 
        requires_approval: true,
        message: `Action requires approval. ${ids.length} pending action(s) created.`,
        pending_count: ids.length
      });
    }
    
    let results = { success: 0, failed: 0, errors: [] };
    
    switch (action) {
      case 'delete_users':
        for (const id of ids) {
          try {
            await db.run('UPDATE users SET deleted_at = CURRENT_TIMESTAMP, deleted_by = ? WHERE id = ?', req.userId, id);
            results.success++;
          } catch (e) {
            results.failed++;
            results.errors.push({ id, error: e.message });
          }
        }
        break;
        
      case 'delete_dests':
        for (const id of ids) {
          try {
            await db.run('DELETE FROM destinations WHERE id = ?', id);
            results.success++;
          } catch (e) {
            results.failed++;
            results.errors.push({ id, error: e.message });
          }
        }
        break;
        
      case 'update_role':
        const { role } = data || {};
        if (!role) return res.status(400).json({ error: 'Role required' });
        for (const id of ids) {
          try {
            await db.run('UPDATE users SET role = ? WHERE id = ?', role, id);
            results.success++;
          } catch (e) {
            results.failed++;
            results.errors.push({ id, error: e.message });
          }
        }
        break;
        
      case 'approve_dests':
        for (const id of ids) {
          try {
            await db.run("UPDATE destinations SET status = 'live', updated_at = CURRENT_TIMESTAMP WHERE id = ?", id);
            results.success++;
          } catch (e) {
            results.failed++;
            results.errors.push({ id, error: e.message });
          }
        }
        break;
        
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
    
    logger.info(`[Admin] Bulk ${action} by ${req.userId}: ${results.success} success, ${results.failed} failed`);
    
    res.json({ success: true, data: results });
  } catch (error) {
    logger.error(`[Admin] Bulk action failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to execute bulk action' });
  }
});

// === NOTIFICATION DELIVERY LOGS ===
router.get('/notifications/delivery-logs', ...adminGuard, async (req, res) => {
  try {
    const { limit = 100, offset = 0, status, channel, userId } = req.query;
    
    let query = `
      SELECT ndl.*, u.email as user_email, n.title as notification_title
      FROM notification_delivery_logs ndl
      LEFT JOIN users u ON ndl.user_id = u.id
      LEFT JOIN notifications n ON ndl.notification_id = n.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND ndl.status = ?';
      params.push(status);
    }
    if (channel) {
      query += ' AND ndl.channel = ?';
      params.push(channel);
    }
    if (userId) {
      query += ' AND ndl.user_id = ?';
      params.push(parseInt(userId));
    }

    query += ' ORDER BY ndl.attempted_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const logs = await db.prepare(query).all(...params);
    
    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error(`[Admin] Delivery logs fetch failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'An unexpected error occurred' });
  }
});

// === NOTIFICATION TYPES REGISTRY ===
router.get('/notifications/types', ...adminGuard, async (req, res) => {
  try {
    const { NOTIFICATION_TYPES, getPriorityLabel } = await import('../services/notificationRegistry.js');
    
    const types = Object.entries(NOTIFICATION_TYPES).map(([key, value]) => ({
      type: key,
      name: value.name,
      description: value.description,
      priority: value.priority,
      priorityLabel: getPriorityLabel(value.priority),
      channels: value.channels,
      controlLevel: value.controlLevel,
      canBeDisabled: value.controlLevel === 'user_controlled',
    }));

    res.json({ success: true, data: types });
  } catch (error) {
    logger.error(`[Admin] Notification types fetch failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'An unexpected error occurred' });
  }
});

// === NOTIFICATION TEMPLATES ===
router.get('/notifications/templates', ...adminGuard, async (req, res) => {
  try {
    const templates = await getAllTemplates();
    const types = await getAllNotificationTypes();
    res.json({ 
      success: true, 
      data: { templates, types } 
    });
  } catch (error) {
    logger.error(`[Admin] Failed to get notification templates: ${error.message}`);
    res.status(500).json({ success: false, error: 'An unexpected error occurred' });
  }
});

router.get('/notifications/templates/:id', ...adminGuard, async (req, res) => {
  try {
    const template = await getTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    const previewVars = getPreviewVariables(template.notification_type);
    res.json({ 
      success: true, 
      data: { template, previewVars } 
    });
  } catch (error) {
    logger.error(`[Admin] Failed to get notification template: ${error.message}`);
    res.status(500).json({ success: false, error: 'An unexpected error occurred' });
  }
});

router.put('/notifications/templates/:id', ...adminGuard, async (req, res) => {
  try {
    const { subject, body, variables, is_active } = req.body;
    const template = await updateTemplate(req.params.id, { subject, body, variables, is_active });
    res.json({ success: true, data: template });
  } catch (error) {
    logger.error(`[Admin] Failed to update notification template: ${error.message}`);
    res.status(500).json({ success: false, error: 'An unexpected error occurred' });
  }
});

router.post('/notifications/templates/test', ...adminGuard, async (req, res) => {
  try {
    const { templateId, recipient, testVars } = req.body;
    
    if (!templateId || !recipient) {
      return res.status(400).json({ success: false, error: 'templateId and recipient are required' });
    }

    const result = await sendTestNotification(templateId, recipient, testVars);
    res.json(result);
  } catch (error) {
    logger.error(`[Admin] Failed to send test notification: ${error.message}`);
    res.status(500).json({ success: false, error: 'An unexpected error occurred' });
  }
});

router.post('/notifications/test', ...adminGuard, async (req, res) => {
  try {
    const { userId, type, title, body } = req.body;
    
    if (!userId || !type) {
      return res.status(400).json({ success: false, error: 'userId and type are required' });
    }

    const { createNotification } = await import('../services/notificationService.js');
    const { sendPushNotification } = await import('../services/pushService.js');
    const { sendCustomEmail } = await import('../services/email.js');
    
    const user = await db.get('SELECT * FROM users WHERE id = ?', userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const results = {
      in_app: null,
      push: null,
      email: null,
    };

    const notif = await createNotification(userId, type, title || type, body || `Test notification of type: ${type}`);

    results.in_app = { success: !!notif, notificationId: notif?.lastInsertRowid };

    const pushResult = await sendPushNotification(userId, {
      title: title || `Test: ${type}`,
      body: body || 'This is a test notification from SoloCompass admin',
      data: { type, test: 'true' },
    });
    results.push = pushResult;

    if (user.email) {
      try {
        const emailResult = await sendCustomEmail(user.email, 'welcome', {
          name: user.name || 'Test User',
          dashboardUrl: process.env.FRONTEND_URL + '/dashboard',
        });
        results.email = emailResult;
      } catch (emailErr) {
        results.email = { success: false, error: emailErr.message };
      }
    }

    res.json({ success: true, data: results });
  } catch (error) {
    logger.error(`[Admin] Failed to send test notification: ${error.message}`);
    res.status(500).json({ success: false, error: 'An unexpected error occurred' });
  }
});

// === SESSION MANAGEMENT ===

router.get('/sessions', ...adminGuard, async (req, res) => {
  try {
    const { limit = 50, offset = 0, userId } = req.query;
    
    let query = `
      SELECT s.id, s.user_id, s.device_info, s.ip_address, s.user_agent, s.last_activity, s.expires_at, s.created_at,
             u.email as user_email, u.name as user_name
      FROM sessions s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.expires_at > CURRENT_TIMESTAMP
    `;
    const params = [];

    if (userId) {
      query += ' AND s.user_id = ?';
      params.push(parseInt(userId));
    }

    query += ' ORDER BY s.last_activity DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const sessions = await db.all(query, ...params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as count FROM sessions s
      WHERE s.expires_at > CURRENT_TIMESTAMP
    `;
    const countParams = [];
    if (userId) {
      countQuery += ' AND s.user_id = ?';
      countParams.push(parseInt(userId));
    }
    const countResult = await db.get(countQuery, ...countParams);

    // Get session stats by user
    const statsQuery = `
      SELECT s.user_id, u.email as user_email, COUNT(*) as session_count
      FROM sessions s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.expires_at > CURRENT_TIMESTAMP
      GROUP BY s.user_id, u.email
      ORDER BY session_count DESC
      LIMIT 20
    `;
    const userStats = await db.all(statsQuery);

    res.json({
      success: true,
      data: {
        sessions: sessions || [],
        total: countResult?.count || 0,
        userStats: userStats || []
      }
    });
  } catch (error) {
    logger.error(`[Admin] Sessions fetch failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to fetch sessions' });
  }
});

router.post('/sessions/:sessionId/terminate', ...adminGuard, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await db.get('SELECT * FROM sessions WHERE id = ?', sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    await db.run('DELETE FROM sessions WHERE id = ?', sessionId);
    
    // Log to events table
    try {
      await db.run(
        'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
        req.userId, 'admin_session_terminated', JSON.stringify({ session_id: sessionId, target_user_id: session.user_id, action: 'single' })
      );
    } catch (e) {
      logger.warn('[Admin] Failed to log session termination:', e.message);
    }
    
    logger.info(`[Admin] Session ${sessionId} terminated by admin ${req.userId}`);
    
    res.json({ success: true, message: 'Session terminated successfully' });
  } catch (error) {
    logger.error(`[Admin] Session terminate failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to terminate session' });
  }
});

router.post('/sessions/user/:userId/terminate-all', ...adminGuard, async (req, res) => {
  try {
    const { userId } = req.params;
    const adminUserId = req.userId;

    // Prevent admin from terminating their own sessions
    if (parseInt(userId) === adminUserId) {
      return res.status(400).json({ success: false, error: 'Cannot terminate your own sessions' });
    }

    const result = await db.run('DELETE FROM sessions WHERE user_id = ? AND expires_at > CURRENT_TIMESTAMP', userId);
    
    // Log to events table
    try {
      await db.run(
        'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
        adminUserId, 'admin_session_terminated', JSON.stringify({ target_user_id: userId, action: 'all', count: result.changes })
      );
    } catch (e) {
      logger.warn('[Admin] Failed to log session termination:', e.message);
    }
    
    logger.info(`[Admin] All sessions for user ${userId} terminated by admin ${adminUserId}`);
    
    res.json({ 
      success: true, 
      message: `Terminated ${result.changes || 0} sessions` 
    });
  } catch (error) {
    logger.error(`[Admin] Terminate all sessions failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to terminate user sessions' });
  }
});

/**
 * GDPR ENDPOINTS
 */

// GET /admin/gdpr/audit-log - Privacy audit log
router.get('/gdpr/audit-log', ...adminGuard, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const logs = await db.all(`
      SELECT e.id, e.event_name, e.event_data, e.timestamp, u.email as admin_email
      FROM events e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.event_name IN ('user_data_exported', 'user_anonymized', 'user_data_deleted', 'user_data_accessed')
      ORDER BY e.timestamp DESC
      LIMIT ? OFFSET ?
    `, limit, offset);

    res.json({ success: true, data: { logs, total: logs.length } });
  } catch (error) {
    logger.error(`[Admin] GDPR audit log failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch GDPR audit log' });
  }
});

// GET /admin/gdpr/retention - Get retention settings
router.get('/gdpr/retention', ...adminGuard, async (req, res) => {
  try {
    // For now, return default retention periods
    const settings = {
      user_data: 365, // days
      trip_data: 730,
      review_data: 547,
      checkin_data: 180,
      session_data: 30,
      last_cleanup: null
    };
    
    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error(`[Admin] Retention settings failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch retention settings' });
  }
});

// POST /admin/gdpr/retention - Update retention settings
router.post('/gdpr/retention', ...adminGuard, async (req, res) => {
  try {
    const { user_data, trip_data, review_data, checkin_data, session_data } = req.body;
    
    // Store in a simple key-value store or env (for now just acknowledge)
    logger.info(`[Admin] Retention settings updated by admin ${req.userId}:`, {
      user_data, trip_data, review_data, checkin_data, session_data
    });
    
    res.json({ success: true, message: 'Retention settings updated' });
  } catch (error) {
    logger.error(`[Admin] Retention settings update failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to update retention settings' });
  }
});

// POST /admin/users/:id/anonymize - Anonymize user data
router.post('/users/:id/anonymize', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    if (requiresApproval('anonymize_user')) {
      const existingPending = await db.get(
        "SELECT id FROM pending_actions WHERE action_type = 'anonymize_user' AND target_id = ? AND status = 'pending'",
        String(id)
      );
      if (existingPending) {
        return res.status(400).json({ 
          error: 'Anonymization request already pending approval',
          pending_id: existingPending.id
        });
      }

      await createPendingAction('anonymize_user', req.userId, 'user', String(id), { reason });

      await db.run(
        'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
        req.userId, 'pending_action_created', JSON.stringify({
          action_type: 'anonymize_user',
          target_id: id,
          reason
        })
      );

      logger.info(`[Admin] Pending anonymization for user ${id} created by admin ${req.userId}`);

      return res.json({ 
        success: true, 
        requires_approval: true,
        message: 'Anonymization request requires approval from a super admin.'
      });
    }
    
    await db.run(`
      UPDATE users SET 
        name = 'Anonymous User',
        phone = NULL,
        emergency_contact_name = NULL,
        emergency_contact_phone = NULL,
        emergency_contact_relationship = NULL,
        profile_photo = NULL
      WHERE id = ?
    `, id);
    
    await db.run(`
      INSERT INTO events (user_id, event_name, event_data) VALUES (?, 'user_anonymized', ?)
    `, req.userId, JSON.stringify({ target_user_id: id, reason: reason || 'GDPR anonymization request' }));
    
    logger.info(`[Admin] User ${id} anonymized by admin ${req.userId}`);
    
    res.json({ success: true, message: 'User data anonymized successfully' });
  } catch (error) {
    logger.error(`[Admin] Anonymize failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to anonymize user' });
  }
});

// POST /admin/check-ins/:id/override - Admin manually override check-in status
router.post('/check-ins/:id/override', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'completed', 'missed', 'skipped'
    
    // Get current check-in
    const checkin = await db.get('SELECT * FROM scheduled_check_ins WHERE id = ?', id);
    if (!checkin) {
      return res.status(404).json({ error: 'Check-in not found' });
    }
    
    // Update based on requested status
    if (status === 'completed') {
      await db.run('UPDATE scheduled_check_ins SET completed_at = CURRENT_TIMESTAMP, missed_at = NULL, status = ? WHERE id = ?', 'completed', id);
    } else if (status === 'missed') {
      await db.run('UPDATE scheduled_check_ins SET missed_at = CURRENT_TIMESTAMP, completed_at = NULL, status = ? WHERE id = ?', 'missed', id);
    } else if (status === 'skipped') {
      await db.run('UPDATE scheduled_check_ins SET completed_at = CURRENT_TIMESTAMP, status = ?, is_active = false WHERE id = ?', 'skipped', id);
    }
    
    // Log admin action
    await db.run('INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
      req.userId, 'admin_checkin_override', JSON.stringify({ checkin_id: id, status }));
    
    res.json({ success: true, message: `Check-in status updated to ${status}` });
  } catch (error) {
    logger.error(`[Admin] Check-in override failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to override check-in' });
  }
});

// PATCH /admin/users/:id/role - Update user admin role
router.patch('/users/:id/role', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_level } = req.body;
    
    // Validate role
    const validRoles = ['support', 'moderator', 'super_admin'];
    if (!admin_level || !validRoles.includes(admin_level)) {
      return res.status(400).json({ error: 'Invalid role. Must be: support, moderator, or super_admin' });
    }
    
    // Check if requester is super admin
    const requesterAdminLevel = req.user?.admin_level || 'support';
    if (requesterAdminLevel !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admins can modify admin roles' });
    }
    
    // Prevent self-demotion
    if (parseInt(id) === req.userId) {
      return res.status(400).json({ error: 'Cannot modify your own role' });
    }
    
    // Check if user exists
    const user = await db.get('SELECT id, email, role, admin_level FROM users WHERE id = ?', id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update the role
    await db.run('UPDATE users SET admin_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', admin_level, id);
    
    // Log the action
    await db.run(
      'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
      req.userId, 'admin_role_changed', JSON.stringify({ target_user_id: id, new_role: admin_level })
    );
    
    logger.info(`[Admin] User ${id} role changed to ${admin_level} by admin ${req.userId}`);
    
    res.json({ success: true, data: { user_id: id, admin_level } });
  } catch (error) {
    logger.error(`[Admin] Role update failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// === INCIDENT MANAGEMENT ===

const INCIDENT_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning', 
  DEGRADED: 'degraded',
  MAJOR: 'major',
  CRITICAL: 'critical'
};

const INCIDENT_STATUS = {
  ACTIVE: 'active',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved'
};

// Get incidents
router.get('/incidents', ...adminGuard, async (req, res) => {
  try {
    const { status, severity, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT i.*, u.name as created_by_name, u.email as created_by_email
      FROM incidents i
      LEFT JOIN users u ON i.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status && status !== 'all') {
      query += ' AND i.status = ?';
      params.push(status);
    }
    
    if (severity) {
      query += ' AND i.severity = ?';
      params.push(severity);
    }
    
    query += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const incidents = await db.all(query, ...params);
    
    const countQuery = `SELECT COUNT(*) as count FROM incidents WHERE 1=1 ${status && status !== 'all' ? 'AND status = ?' : ''} ${severity ? 'AND severity = ?' : ''}`;
    const countParams = [];
    if (status && status !== 'all') countParams.push(status);
    if (severity) countParams.push(severity);
    const count = await db.get(countQuery, ...countParams);
    
    res.json({ success: true, data: { incidents, total: count?.count || 0 } });
  } catch (error) {
    logger.error(`[Admin] Get incidents failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to get incidents' });
  }
});

// Create incident
router.post('/incidents', ...adminGuard, async (req, res) => {
  try {
    const { title, description, severity = INCIDENT_SEVERITY.INFO, type = 'operational' } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const result = await db.run(
      'INSERT INTO incidents (title, description, severity, type, status, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      title, description || '', severity, type, INCIDENT_STATUS.ACTIVE, req.userId
    );
    
    // Log incident creation
    await db.run(
      'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
      req.userId, 'incident_created', JSON.stringify({ incident_id: result.lastInsertRowid, title })
    );
    
    logger.info(`[Admin] Incident created: ${title} by admin ${req.userId}`);
    
    res.json({ success: true, data: { id: result.lastInsertRowid, title, severity, status: 'active' } });
  } catch (error) {
    logger.error(`[Admin] Create incident failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to create incident' });
  }
});

// Acknowledge incident
router.post('/incidents/:id/acknowledge', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    
    const incident = await db.get('SELECT * FROM incidents WHERE id = ?', id);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    await db.run(
      'UPDATE incidents SET status = ?, acknowledged_at = CURRENT_TIMESTAMP, acknowledged_by = ? WHERE id = ?',
      INCIDENT_STATUS.ACKNOWLEDGED, req.userId, id
    );
    
    await db.run(
      'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
      req.userId, 'incident_acknowledged', JSON.stringify({ incident_id: id })
    );
    
    res.json({ success: true, message: 'Incident acknowledged' });
  } catch (error) {
    logger.error(`[Admin] Acknowledge incident failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to acknowledge incident' });
  }
});

// Resolve incident
router.post('/incidents/:id/resolve', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution = '' } = req.body;
    
    const incident = await db.get('SELECT * FROM incidents WHERE id = ?', id);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    await db.run(
      'UPDATE incidents SET status = ?, resolved_at = CURRENT_TIMESTAMP, resolved_by = ?, resolution = ? WHERE id = ?',
      INCIDENT_STATUS.RESOLVED, req.userId, resolution, id
    );
    
    await db.run(
      'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
      req.userId, 'incident_resolved', JSON.stringify({ incident_id: id, resolution })
    );
    
    res.json({ success: true, message: 'Incident resolved' });
  } catch (error) {
    logger.error(`[Admin] Resolve incident failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to resolve incident' });
  }
});

// === JOB QUEUE STATE (In-memory simulation - replace with Redis/Bull in production) ===

global.jobQueue = global.jobQueue || {
  pending: [],
  processing: [],
  completed: [],
  failed: []
};

function initializeDemoJobs() {
  if (global.jobQueue.pending.length === 0 && global.jobQueue.processing.length === 0) {
    const now = Date.now();
    global.jobQueue.pending = [
      { id: 'job_001', type: 'email_sync', payload: { userId: 123 }, createdAt: new Date(now - 300000).toISOString() },
      { id: 'job_002', type: 'destination_import', payload: { source: 'csv' }, createdAt: new Date(now - 180000).toISOString() },
      { id: 'job_003', type: 'safety_check', payload: { tripId: 456 }, createdAt: new Date(now - 120000).toISOString() },
      { id: 'job_004', type: 'advisory_refresh', payload: {}, createdAt: new Date(now - 60000).toISOString() },
      { id: 'job_005', type: 'cleanup_logs', payload: { days: 30 }, createdAt: new Date(now - 30000).toISOString() },
    ];
    global.jobQueue.processing = [
      { id: 'job_006', type: 'ai_research', payload: { destination: 'Tokyo' }, startedAt: new Date(now - 45000).toISOString(), progress: 65 },
      { id: 'job_007', type: 'backup_db', payload: { full: false }, startedAt: new Date(now - 120000).toISOString(), progress: 90 },
    ];
    global.jobQueue.completed = [
      { id: 'job_008', type: 'email_notification', status: 'success', completedAt: new Date(now - 600000).toISOString(), duration: 2340 },
      { id: 'job_009', type: 'image_processing', status: 'success', completedAt: new Date(now - 900000).toISOString(), duration: 5670 },
      { id: 'job_010', type: 'data_sync', status: 'success', completedAt: new Date(now - 1200000).toISOString(), duration: 1200 },
      { id: 'job_011', type: 'report_generation', status: 'success', completedAt: new Date(now - 1800000).toISOString(), duration: 8900 },
      { id: 'job_012', type: 'cache_warmup', status: 'success', completedAt: new Date(now - 2400000).toISOString(), duration: 120 },
    ];
    global.jobQueue.failed = [
      { 
        id: 'job_013', 
        type: 'webhook_delivery', 
        status: 'failed', 
        createdAt: new Date(now - 3600000).toISOString(),
        completedAt: new Date(now - 3000000).toISOString(),
        error: 'Connection timeout - remote server unreachable',
        attempts: 3,
        maxAttempts: 5,
        lastAttemptAt: new Date(now - 3000000).toISOString(),
        nextRetryAt: new Date(now + 1800000).toISOString()
      },
      { 
        id: 'job_014', 
        type: 'payment_process', 
        status: 'failed', 
        createdAt: new Date(now - 7200000).toISOString(),
        completedAt: new Date(now - 6600000).toISOString(),
        error: 'Invalid payment token - card declined',
        attempts: 5,
        maxAttempts: 5,
        lastAttemptAt: new Date(now - 6600000).toISOString(),
        nextRetryAt: null
      },
      { 
        id: 'job_015', 
        type: 'ai_research', 
        status: 'failed', 
        createdAt: new Date(now - 1800000).toISOString(),
        completedAt: new Date(now - 1200000).toISOString(),
        error: 'Rate limit exceeded - Azure OpenAI quota depleted',
        attempts: 2,
        maxAttempts: 5,
        lastAttemptAt: new Date(now - 1200000).toISOString(),
        nextRetryAt: new Date(now + 300000).toISOString()
      },
    ];
  }
}

initializeDemoJobs();

router.get('/jobs/stats', ...adminGuard, (req, res) => {
  try {
    const queue = global.jobQueue;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    
    const successToday = queue.completed.filter(j => {
      const completedAt = new Date(j.completedAt).getTime();
      return completedAt >= todayMs && j.status === 'success';
    }).length;
    
    const failedToday = queue.completed.filter(j => {
      const completedAt = new Date(j.completedAt).getTime();
      return completedAt >= todayMs && j.status === 'failed';
    }).length;
    
    const stats = {
      pending: queue.pending.length,
      processing: queue.processing.length,
      failed: queue.failed.length,
      successToday,
      failedToday,
      successRate: queue.completed.length > 0 
        ? Math.round((queue.completed.filter(j => j.status === 'success').length / queue.completed.length) * 100)
        : 100,
      avgProcessingTime: queue.completed.length > 0 
        ? Math.round(queue.completed.reduce((sum, j) => sum + (j.duration || 0), 0) / queue.completed.filter(j => j.duration).length) || 0
        : 0,
      queueHealth: calculateQueueHealth(queue),
      lastUpdated: new Date().toISOString()
    };
    
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error(`[Admin] Job stats failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to get job stats' });
  }
});

function calculateQueueHealth(queue) {
  const total = queue.pending.length + queue.processing.length + queue.completed.length + queue.failed.length;
  if (total === 0) return 'healthy';
  
  const failRate = queue.failed.length / total;
  const pendingRatio = queue.pending.length / Math.max(1, queue.processing.length);
  
  if (failRate > 0.2 || pendingRatio > 10) return 'critical';
  if (failRate > 0.1 || pendingRatio > 5) return 'degraded';
  return 'healthy';
}

router.get('/jobs/active', ...adminGuard, (req, res) => {
  try {
    const queue = global.jobQueue;
    const { type } = req.query;
    
    let activeJobs = [
      ...queue.pending.map(j => ({ ...j, state: 'pending' })),
      ...queue.processing.map(j => ({ ...j, state: 'processing' }))
    ];
    
    if (type) {
      activeJobs = activeJobs.filter(j => j.type === type);
    }
    
    res.json({ 
      success: true, 
      data: { 
        jobs: activeJobs,
        pending: queue.pending.length,
        processing: queue.processing.length
      } 
    });
  } catch (error) {
    logger.error(`[Admin] Active jobs failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to get active jobs' });
  }
});

router.get('/jobs/history', ...adminGuard, (req, res) => {
  try {
    const queue = global.jobQueue;
    const { limit = 50, offset = 0, status } = req.query;
    
    let historyJobs = [...queue.completed, ...queue.failed];
    historyJobs.sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt));
    
    if (status && status !== 'all') {
      historyJobs = historyJobs.filter(j => j.status === status);
    }
    
    const paginatedJobs = historyJobs.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    
    const stats = {
      total: historyJobs.length,
      success: historyJobs.filter(j => j.status === 'success').length,
      failed: historyJobs.filter(j => j.status === 'failed').length,
      avgDuration: historyJobs.filter(j => j.duration).length > 0
        ? Math.round(historyJobs.filter(j => j.duration).reduce((sum, j) => sum + j.duration, 0) / historyJobs.filter(j => j.duration).length)
        : 0
    };
    
    res.json({ 
      success: true, 
      data: { 
        jobs: paginatedJobs,
        stats
      } 
    });
  } catch (error) {
    logger.error(`[Admin] Job history failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to get job history' });
  }
});

router.post('/jobs/:id/retry', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    const job = global.jobQueue.failed.find(j => j.id === id);
    
    if (!job) {
      return res.status(404).json({ success: false, error: 'Failed job not found' });
    }
    
    if (job.attempts >= job.maxAttempts) {
      return res.status(400).json({ success: false, error: 'Max retry attempts reached' });
    }
    
    job.attempts += 1;
    job.lastAttemptAt = new Date().toISOString();
    job.nextRetryAt = new Date(Date.now() + calculateBackoff(job.attempts)).toISOString();
    
    global.jobQueue.pending.push({
      id: `job_retry_${Date.now()}`,
      type: job.type,
      payload: job.payload,
      createdAt: new Date().toISOString(),
      retryOf: id
    });
    
    logger.info(`[Admin] Job ${id} retry scheduled by admin ${req.userId}`);
    
    res.json({ 
      success: true, 
      message: `Retry scheduled (attempt ${job.attempts}/${job.maxAttempts})`,
      data: { nextRetryAt: job.nextRetryAt }
    });
  } catch (error) {
    logger.error(`[Admin] Job retry failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to retry job' });
  }
});

router.post('/jobs/:id/cancel', ...adminGuard, (req, res) => {
  try {
    const { id } = req.params;
    const queue = global.jobQueue;
    
    let cancelled = false;
    
    const pendingIdx = queue.pending.findIndex(j => j.id === id);
    if (pendingIdx !== -1) {
      queue.pending.splice(pendingIdx, 1);
      cancelled = true;
    }
    
    const processingIdx = queue.processing.findIndex(j => j.id === id);
    if (processingIdx !== -1) {
      const job = queue.processing[processingIdx];
      job.status = 'cancelled';
      job.completedAt = new Date().toISOString();
      queue.completed.push(job);
      queue.processing.splice(processingIdx, 1);
      cancelled = true;
    }
    
    if (cancelled) {
      logger.info(`[Admin] Job ${id} cancelled by admin ${req.userId}`);
      res.json({ success: true, message: 'Job cancelled successfully' });
    } else {
      res.status(404).json({ success: false, error: 'Active job not found' });
    }
  } catch (error) {
    logger.error(`[Admin] Job cancel failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

router.post('/jobs/:id/fail', ...adminGuard, (req, res) => {
  try {
    const { id } = req.params;
    const { error } = req.body;
    const queue = global.jobQueue;
    
    const processingIdx = queue.processing.findIndex(j => j.id === id);
    if (processingIdx === -1) {
      return res.status(404).json({ success: false, error: 'Processing job not found' });
    }
    
    const job = queue.processing[processingIdx];
    job.status = 'failed';
    job.error = error || 'Unknown error';
    job.completedAt = new Date().toISOString();
    job.attempts = 1;
    job.maxAttempts = 5;
    job.lastAttemptAt = new Date().toISOString();
    job.nextRetryAt = new Date(Date.now() + calculateBackoff(1)).toISOString();
    
    queue.failed.push(job);
    queue.processing.splice(processingIdx, 1);
    
    logger.info(`[Admin] Job ${id} marked as failed by admin ${req.userId}: ${error}`);
    
    res.json({ success: true, message: 'Job marked as failed' });
  } catch (error) {
    logger.error(`[Admin] Job fail action failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to mark job as failed' });
  }
});

// === JOBS & QUEUES PANEL ===

// Get failed jobs queue
router.get('/jobs/failed', ...adminGuard, async (req, res) => {
  try {
    const { limit = 50, offset = 0, type } = req.query;
    
    // Try to get from job_events table if it exists, otherwise return empty
    let query = `
      SELECT j.*, u.name as user_name
      FROM job_events j
      LEFT JOIN users u ON j.user_id = u.id
      WHERE j.status = 'failed'
    `;
    const params = [];
    
    if (type) {
      query += ' AND j.job_type = ?';
      params.push(type);
    }
    
    query += ' ORDER BY j.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const jobs = await db.all(query, ...params);
    const count = await db.get('SELECT COUNT(*) as count FROM job_events WHERE status = ?', 'failed');
    
    res.json({ success: true, data: { jobs: jobs || [], total: count?.count || 0 } });
  } catch (error) {
    // If table doesn't exist, return empty array
    res.json({ success: true, data: { jobs: [], total: 0 } });
  }
});

// Exponential backoff calculation
// attempt 1: wait 1 min, 2: 5 min, 3: 30 min, 4: 2 hrs, 5: 24 hrs (final)
const BACKOFF_INTERVALS = [
  60 * 1000,           // 1 minute
  5 * 60 * 1000,      // 5 minutes
  30 * 60 * 1000,     // 30 minutes
  2 * 60 * 60 * 1000, // 2 hours
  24 * 60 * 60 * 1000 // 24 hours
];
const MAX_BACKOFF = 24 * 60 * 60 * 1000; // 24 hours max
const BASE_BACKOFF = 60 * 1000; // 1 minute base

function calculateBackoff(attempt, maxWait = MAX_BACKOFF) {
  if (attempt <= 0) return BASE_BACKOFF;
  if (attempt <= BACKOFF_INTERVALS.length) {
    return Math.min(BACKOFF_INTERVALS[attempt - 1], maxWait);
  }
  return Math.min(BASE_BACKOFF * Math.pow(2, attempt), maxWait);
}

function getBackoffSchedule() {
  return BACKOFF_INTERVALS.map((ms, i) => ({
    attempt: i + 1,
    waitMs: ms,
    waitFormatted: ms < 60000 ? `${ms / 1000}s` : ms < 3600000 ? `${ms / 60000}m` : `${ms / 3600000}h`
  }));
}

// Get webhook failures
router.get('/webhooks/failures', ...adminGuard, async (req, res) => {
  try {
    const { limit = 50, offset = 0, provider, status } = req.query;
    
    // Check if webhook_deliveries table exists
    let tableExists = false;
    try {
      const tableCheck = await db.get(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_name = 'webhook_deliveries'
      `);
      tableExists = !!tableCheck;
    } catch (e) {
      tableExists = false;
    }
    
    // If table exists, use it
    if (tableExists) {
      let query = `
        SELECT * FROM webhook_deliveries WHERE 1=1
      `;
      const params = [];
      
      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }
      if (provider) {
        query += ' AND webhook_id = ?';
        params.push(provider);
      }
      
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));
      
      const deliveries = await db.all(query, ...params);
      const count = await db.get('SELECT COUNT(*) as count FROM webhook_deliveries');
      
      return res.json({ 
        success: true, 
        data: { 
          failures: deliveries || [], 
          total: count?.count || 0,
          backoffSchedule: getBackoffSchedule()
        } 
      });
    }
    
    // Fallback to events table
    const query = `
      SELECT * FROM events 
      WHERE event_name LIKE 'webhook_%' AND event_name LIKE '%_failed'
    `;
    const params = [];
    
    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const failures = await db.all(query, ...params);
    const count = await db.get(`
      SELECT COUNT(*) as count FROM events 
      WHERE event_name LIKE 'webhook_%' AND event_name LIKE '%_failed'
    `);
    
    res.json({ 
      success: true, 
      data: { 
        failures: failures || [], 
        total: count?.count || 0,
        backoffSchedule: getBackoffSchedule()
      } 
    });
  } catch (error) {
    logger.error(`[Admin] Webhook failures fetch failed: ${error.message}`);
    res.json({ 
      success: true, 
      data: { 
        failures: [], 
        total: 0,
        backoffSchedule: getBackoffSchedule()
      } 
    });
  }
});

// Get single webhook delivery status
router.get('/webhooks/:id', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try webhook_deliveries table first
    let delivery = await db.get('SELECT * FROM webhook_deliveries WHERE id = ?', id);
    
    if (!delivery) {
      return res.status(404).json({ success: false, error: 'Webhook delivery not found' });
    }
    
    // Generate backoff info
    const backoffInfo = {
      currentAttempt: delivery.attempts || 0,
      maxAttempts: delivery.max_attempts || 5,
      nextRetryAt: delivery.next_retry_at,
      lastAttemptAt: delivery.last_attempt_at,
      calculatedNextRetry: calculateBackoff(delivery.attempts || 0),
      schedule: getBackoffSchedule()
    };
    
    res.json({ 
      success: true, 
      data: { 
        delivery,
        backoffInfo 
      } 
    });
  } catch (error) {
    logger.error(`[Admin] Webhook fetch failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch webhook delivery' });
  }
});

// Retry webhook with exponential backoff
router.post('/webhooks/:id/retry', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    const { immediate = false } = req.body;
    
    let delivery = await db.get('SELECT * FROM webhook_deliveries WHERE id = ?', id);
    
    if (!delivery) {
      return res.status(404).json({ success: false, error: 'Webhook delivery not found' });
    }
    
    if (delivery.status === 'success') {
      return res.status(400).json({ success: false, error: 'Webhook already succeeded' });
    }
    
    if (delivery.attempts >= delivery.max_attempts) {
      return res.status(400).json({ success: false, error: 'Max retry attempts reached' });
    }
    
    const now = new Date();
    let nextRetryAt = null;
    let waitTime = 0;
    
    if (immediate) {
      // Immediate retry - execute now
      logger.info(`[Admin] Immediate retry requested for webhook ${id} by admin ${req.userId}`);
    } else {
      // Calculate exponential backoff
      waitTime = calculateBackoff(delivery.attempts || 0);
      nextRetryAt = new Date(now.getTime() + waitTime);
      logger.info(`[Admin] Scheduled retry for webhook ${id} in ${waitTime}ms (attempt ${delivery.attempts + 1})`);
    }
    
    // Update delivery record
    await db.run(`
      UPDATE webhook_deliveries 
      SET attempts = attempts + 1,
          last_attempt_at = ?,
          next_retry_at = ?,
          status = 'pending',
          updated_at = ?
      WHERE id = ?
    `, now.toISOString(), nextRetryAt?.toISOString() || null, now.toISOString(), id);
    
    // Log retry event
    await db.run(
      'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
      req.userId, 'webhook_retry_scheduled', JSON.stringify({ 
        webhook_delivery_id: id, 
        immediate,
        waitTime,
        nextRetryAt: nextRetryAt?.toISOString()
      })
    );
    
    res.json({ 
      success: true, 
      message: immediate ? 'Immediate retry triggered' : `Retry scheduled in ${waitTime < 60000 ? `${waitTime / 1000}s` : waitTime < 3600000 ? `${waitTime / 60000}m` : `${waitTime / 3600000}h`}`,
      data: {
        deliveryId: id,
        nextRetryAt: nextRetryAt?.toISOString() || 'immediate',
        waitTime,
        immediate,
        attempt: delivery.attempts + 1,
        backoffSchedule: getBackoffSchedule()
      }
    });
  } catch (error) {
    logger.error(`[Admin] Webhook retry failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to retry webhook' });
  }
});

// Cancel webhook retry
router.post('/webhooks/:id/cancel', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    
    let delivery = await db.get('SELECT * FROM webhook_deliveries WHERE id = ?', id);
    
    if (!delivery) {
      return res.status(404).json({ success: false, error: 'Webhook delivery not found' });
    }
    
    if (delivery.status === 'success') {
      return res.status(400).json({ success: false, error: 'Webhook already succeeded' });
    }
    
    if (delivery.status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'Retry already cancelled' });
    }
    
    const now = new Date();
    
    // Cancel the retry schedule
    await db.run(`
      UPDATE webhook_deliveries 
      SET status = 'cancelled',
          next_retry_at = NULL,
          updated_at = ?
      WHERE id = ?
    `, now.toISOString(), id);
    
    // Log cancellation
    await db.run(
      'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
      req.userId, 'webhook_retry_cancelled', JSON.stringify({ 
        webhook_delivery_id: id,
        attempts: delivery.attempts
      })
    );
    
    logger.info(`[Admin] Webhook ${id} retry cancelled by admin ${req.userId}`);
    
    res.json({ 
      success: true, 
      message: 'Webhook retry cancelled',
      data: { deliveryId: id }
    });
  } catch (error) {
    logger.error(`[Admin] Webhook cancel failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to cancel webhook retry' });
  }
});

// Retry failed job
router.post('/jobs/:id/retry', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Log retry attempt
    await db.run(
      'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
      req.userId, 'job_retry_requested', JSON.stringify({ job_id: id })
    );
    
    // Note: Actual job retry logic would need to be implemented per job type
    // This is a placeholder for the UI
    logger.info(`[Admin] Job ${id} retry requested by admin ${req.userId}`);
    
    res.json({ success: true, message: 'Job retry requested. Check job status for updates.' });
  } catch (error) {
    logger.error(`[Admin] Job retry failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to retry job' });
  }
});

// === SAFETY OPERATIONS PANEL ===

// Get safety events (SOS, check-in escalations)
router.get('/safety/events', ...adminGuard, async (req, res) => {
  try {
    const { type, status, limit = 50, offset = 0 } = req.query;
    
    // Get events related to safety
    let query = `
      SELECT * FROM events 
      WHERE event_name IN ('safety_alert', 'checkin_missed', 'sos_triggered', 'guardian_alert')
    `;
    const params = [];
    
    if (type) {
      query += ' AND event_name = ?';
      params.push(type);
    }
    
    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const events = await db.all(query, ...params);
    const count = await db.get(`
      SELECT COUNT(*) as count FROM events 
      WHERE event_name IN ('safety_alert', 'checkin_missed', 'sos_triggered', 'guardian_alert')
    `);
    
    res.json({ success: true, data: { events: events || [], total: count?.count || 0 } });
  } catch (error) {
    logger.error(`[Admin] Get safety events failed: ${error.message}`);
    res.json({ success: true, data: { events: [], total: 0 } });
  }
});

// Get check-in escalations
router.get('/safety/escalations', ...adminGuard, async (req, res) => {
  try {
    const { status = 'pending', limit = 50, offset = 0 } = req.query;
    
    const query = `
      SELECT sc.*, u.name as traveler_name, u.email as traveler_email, t.name as trip_name
      FROM scheduled_check_ins sc
      LEFT JOIN users u ON sc.user_id = u.id
      LEFT JOIN trips t ON sc.trip_id = t.id
      WHERE sc.status = ?
      ORDER BY sc.scheduled_time ASC
      LIMIT ? OFFSET ?
    `;
    const params = [status, parseInt(limit), parseInt(offset)];
    const escalations = await db.all(query, ...params);
    const count = await db.get('SELECT COUNT(*) as count FROM scheduled_check_ins WHERE status = ?', status);
    
    res.json({ success: true, data: { escalations: escalations || [], total: count?.count || 0 } });
  } catch (error) {
    res.json({ success: true, data: { escalations: [], total: 0 } });
  }
});

// === BILLING PANEL ===

// Get failed payments
router.get('/billing/failures', ...adminGuard, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    // Get Stripe payment failures from events
    const query = `
      SELECT * FROM events 
      WHERE event_name LIKE '%payment_failed' OR event_name LIKE '%stripe_error'
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `;
    const failures = await db.all(query, parseInt(limit), parseInt(offset));
    const count = await db.get(`
      SELECT COUNT(*) as count FROM events 
      WHERE event_name LIKE '%payment_failed' OR event_name LIKE '%stripe_error'
    `);
    
    res.json({ success: true, data: { failures: failures || [], total: count?.count || 0 } });
  } catch (error) {
    res.json({ success: true, data: { failures: [], total: 0 } });
  }
});

// Get billing events/activity
router.get('/billing/activity', ...adminGuard, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const query = `
      SELECT * FROM events 
      WHERE event_name LIKE 'billing_%' OR event_name LIKE 'subscription_%'
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `;
    const activity = await db.all(query, parseInt(limit), parseInt(offset));
    const count = await db.get(`
      SELECT COUNT(*) as count FROM events 
      WHERE event_name LIKE 'billing_%' OR event_name LIKE 'subscription_%'
    `);
    
    res.json({ success: true, data: { activity: activity || [], total: count?.count || 0 } });
  } catch (error) {
    res.json({ success: true, data: { activity: [], total: 0 } });
  }
});

// === SUPPORT TICKETS ===

// Get support tickets
router.get('/support/tickets', ...adminGuard, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    
    // For now, use events to track support issues
    let query = `
      SELECT * FROM events 
      WHERE event_name LIKE 'support_%'
    `;
    const params = [];
    
    if (status && status !== 'all') {
      // Map status to event names
      const statusMap = {
        'open': 'support_ticket_created',
        'resolved': 'support_ticket_resolved'
      };
      if (statusMap[status]) {
        query += ' AND event_name = ?';
        params.push(statusMap[status]);
      }
    }
    
    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const tickets = await db.all(query, ...params);
    const count = await db.get('SELECT COUNT(*) as count FROM events WHERE event_name LIKE \'support_%\'');
    
    res.json({ success: true, data: { tickets: tickets || [], total: count?.count || 0 } });
  } catch (error) {
    res.json({ success: true, data: { tickets: [], total: 0 } });
  }
});

// === SUPPORT CANNED RESPONSES ===

// Get all canned responses
router.get('/support/canned-responses', ...adminGuard, async (req, res) => {
  try {
    const { category, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT cr.*, u.email as creator_email, u.name as creator_name
      FROM canned_responses cr
      LEFT JOIN users u ON cr.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (category && category !== 'all') {
      query += ' AND cr.category = ?';
      params.push(category);
    }
    
    query += ' ORDER BY cr.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const responses = await db.all(query, ...params);
    
    const countQuery = category && category !== 'all'
      ? 'SELECT COUNT(*) as count FROM canned_responses WHERE category = ?'
      : 'SELECT COUNT(*) as count FROM canned_responses';
    const countParams = category && category !== 'all' ? [category] : [];
    const count = await db.get(countQuery, ...countParams);
    
    res.json({ 
      success: true, 
      data: { 
        cannedResponses: responses || [], 
        total: count?.count || 0 
      } 
    });
  } catch (error) {
    logger.error(`[Admin] Canned responses fetch failed: ${error.message}`);
    res.json({ success: true, data: { cannedResponses: [], total: 0 } });
  }
});

// Create canned response (super_admin only)
router.post('/support/canned-responses', requireSuperAdmin, async (req, res) => {
  try {
    const { title, category, subject, body, variables } = req.body;
    
    if (!title || !category || !body) {
      return res.status(400).json({ 
        success: false, 
        error: 'Title, category, and body are required' 
      });
    }
    
    const validCategories = ['billing', 'technical', 'account', 'general'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}` 
      });
    }
    
    const result = await db.run(
      `INSERT INTO canned_responses (title, category, subject, body, variables, created_by) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      title, category, subject || '', body, variables || [], req.userId
    );
    
    const created = await db.get('SELECT * FROM canned_responses WHERE id = ?', result.lastInsertRowid);
    
    logger.info(`[Admin] Canned response ${created.id} created by admin ${req.userId}`);
    
    res.json({ success: true, data: created });
  } catch (error) {
    logger.error(`[Admin] Create canned response failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to create canned response' });
  }
});

// Update canned response
router.patch('/support/canned-responses/:id', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, subject, body, variables } = req.body;
    
    const existing = await db.get('SELECT * FROM canned_responses WHERE id = ?', id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Canned response not found' });
    }
    
    const updates = [];
    const params = [];
    
    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (category !== undefined) {
      const validCategories = ['billing', 'technical', 'account', 'general'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({ 
          success: false, 
          error: `Invalid category. Must be one of: ${validCategories.join(', ')}` 
        });
      }
      updates.push('category = ?');
      params.push(category);
    }
    if (subject !== undefined) {
      updates.push('subject = ?');
      params.push(subject);
    }
    if (body !== undefined) {
      updates.push('body = ?');
      params.push(body);
    }
    if (variables !== undefined) {
      updates.push('variables = ?');
      params.push(variables);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    
    await db.run(
      `UPDATE canned_responses SET ${updates.join(', ')} WHERE id = ?`,
      ...params
    );
    
    const updated = await db.get('SELECT * FROM canned_responses WHERE id = ?', id);
    
    logger.info(`[Admin] Canned response ${id} updated by admin ${req.userId}`);
    
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error(`[Admin] Update canned response failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to update canned response' });
  }
});

// Delete canned response (super_admin only)
router.delete('/support/canned-responses/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await db.get('SELECT * FROM canned_responses WHERE id = ?', id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Canned response not found' });
    }
    
    await db.run('DELETE FROM canned_responses WHERE id = ?', id);
    
    logger.info(`[Admin] Canned response ${id} deleted by admin ${req.userId}`);
    
    res.json({ success: true, message: 'Canned response deleted successfully' });
  } catch (error) {
    logger.error(`[Admin] Delete canned response failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to delete canned response' });
  }
});

// Send reply to support ticket
router.post('/support/reply', ...adminGuard, async (req, res) => {
  try {
    const { ticketId, subject, body, userId, email } = req.body;
    
    if (!body) {
      return res.status(400).json({ success: false, error: 'Reply body is required' });
    }
    
    let recipientEmail = email;
    let recipientUserId = userId;
    
    if (!recipientEmail && ticketId) {
      const ticket = await db.get('SELECT * FROM events WHERE id = ?', ticketId);
      if (ticket) {
        recipientEmail = ticket.event_data?.email;
        recipientUserId = ticket.user_id;
      }
    }
    
    if (!recipientEmail && !recipientUserId) {
      return res.status(400).json({ success: false, error: 'No recipient found' });
    }
    
    if (recipientUserId && !recipientEmail) {
      const user = await db.get('SELECT email FROM users WHERE id = ?', recipientUserId);
      if (user?.email) {
        recipientEmail = user.email;
      }
    }
    
    const { sendEmail } = await import('../services/resendClient.js');
    
    const emailResult = await sendEmail({
      to: recipientEmail,
      subject: subject || 'Re: Your Support Request',
      html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi,</p>
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
          ${body.replace(/\n/g, '<br>')}
        </div>
        <p style="color: #666; font-size: 14px;">
          Best regards,<br/>
          The SoloCompass Support Team
        </p>
      </div>`
    });
    
    if (!emailResult.success) {
      return res.status(500).json({ success: false, error: emailResult.error || 'Failed to send email' });
    }
    
    await db.run(
      'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
      req.userId, 'support_reply_sent', JSON.stringify({ 
        ticketId, 
        recipientEmail, 
        subject: subject || 'Re: Your Support Request'
      })
    );
    
    logger.info(`[Admin] Support reply sent to ${recipientEmail} by admin ${req.userId}`);
    
    res.json({ success: true, message: 'Reply sent successfully', data: { messageId: emailResult.messageId } });
  } catch (error) {
    logger.error(`[Admin] Send reply failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to send reply' });
  }
});

// GET /admin/users/:id/export - Export all user data
router.get('/users/:id/export', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get user data
    const user = await db.get('SELECT * FROM users WHERE id = ?', id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get user's trips
    const trips = await db.all('SELECT * FROM trips WHERE user_id = ?', id);
    
    // Get user's reviews
    const reviews = await db.all('SELECT * FROM reviews WHERE user_id = ?', id);
    
    // Get user's check-ins
    const checkins = await db.all('SELECT * FROM scheduled_checkins WHERE user_id = ?', id);
    
    // Log the export
    await db.run(`
      INSERT INTO events (user_id, event_name, event_data) VALUES (?, 'user_data_exported', ?)
    `, req.userId, JSON.stringify({ target_user_id: id, export_type: 'full' }));
    
    const exportData = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at
      },
      trips,
      reviews,
      checkins,
      exported_at: new Date().toISOString()
    };
    
    res.json({ success: true, data: exportData });
  } catch (error) {
    logger.error(`[Admin] Export failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to export user data' });
  }
});

// === ANNOUNCEMENTS ===

// GET /admin/announcements - List all announcements
router.get('/announcements', ...adminGuard, async (req, res) => {
  try {
    const { limit = 50, offset = 0, active } = req.query;
    
    let query = `
      SELECT a.*, u.name as created_by_name, u.email as created_by_email
      FROM announcements a
      LEFT JOIN users u ON a.created_by = u.id
    `;
    const params = [];
    
    if (active !== undefined) {
      query += ' WHERE a.active = ?';
      params.push(active === 'true');
    }
    
    query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const announcements = await db.all(query, ...params);
    
    const countQuery = `SELECT COUNT(*) as count FROM announcements ${active !== undefined ? 'WHERE active = ?' : ''}`;
    const countParams = active !== undefined ? [active === 'true'] : [];
    const count = await db.get(countQuery, ...countParams);
    
    res.json({ 
      success: true, 
      data: { 
        announcements: announcements || [], 
        total: count?.count || 0 
      } 
    });
  } catch (error) {
    logger.error(`[Admin] Get announcements failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to get announcements' });
  }
});

// GET /public/announcements - Public endpoint to get active announcements
router.get('/announcements/public', async (req, res) => {
  try {
    const now = new Date().toISOString();
    
    const announcements = await db.all(`
      SELECT id, title, message, type, start_date, end_date
      FROM announcements
      WHERE active = true 
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
      ORDER BY 
        CASE type 
          WHEN 'critical' THEN 1 
          WHEN 'warning' THEN 2 
          ELSE 3 
        END,
        created_at DESC
    `, now, now);
    
    res.json({ success: true, data: announcements || [] });
  } catch (error) {
    logger.error(`[Admin] Get public announcements failed: ${error.message}`);
    res.json({ success: true, data: [] });
  }
});

// POST /admin/announcements - Create announcement (super_admin only)
router.post('/announcements', ...[requireAuth, requireSuperAdmin], async (req, res) => {
  try {
    const { title, message, type = 'info', active = true, start_date, end_date } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }
    
    if (title.length > 100) {
      return res.status(400).json({ error: 'Title must be 100 characters or less' });
    }
    
    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message must be 2000 characters or less' });
    }
    
    if (!['info', 'warning', 'critical'].includes(type)) {
      return res.status(400).json({ error: 'Type must be: info, warning, or critical' });
    }
    
    const result = await db.run(
      `INSERT INTO announcements (title, message, type, active, start_date, end_date, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      title, message, type, active, start_date || null, end_date || null, req.userId
    );
    
    await db.run(
      'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
      req.userId, 'announcement_created', JSON.stringify({ announcement_id: result.lastInsertRowid, title, type })
    );
    
    logger.info(`[Admin] Announcement created: ${title} by admin ${req.userId}`);
    
    res.json({ 
      success: true, 
      data: { 
        id: result.lastInsertRowid, 
        title, 
        message, 
        type, 
        active, 
        start_date, 
        end_date 
      } 
    });
  } catch (error) {
    logger.error(`[Admin] Create announcement failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// PATCH /admin/announcements/:id - Update announcement
router.patch('/announcements/:id', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, message, type, active, start_date, end_date } = req.body;
    
    const announcement = await db.get('SELECT * FROM announcements WHERE id = ?', id);
    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    
    const updates = [];
    const params = [];
    
    if (title !== undefined) {
      if (title.length > 100) {
        return res.status(400).json({ error: 'Title must be 100 characters or less' });
      }
      updates.push('title = ?');
      params.push(title);
    }
    
    if (message !== undefined) {
      if (message.length > 2000) {
        return res.status(400).json({ error: 'Message must be 2000 characters or less' });
      }
      updates.push('message = ?');
      params.push(message);
    }
    
    if (type !== undefined) {
      if (!['info', 'warning', 'critical'].includes(type)) {
        return res.status(400).json({ error: 'Type must be: info, warning, or critical' });
      }
      updates.push('type = ?');
      params.push(type);
    }
    
    if (active !== undefined) {
      updates.push('active = ?');
      params.push(active);
    }
    
    if (start_date !== undefined) {
      updates.push('start_date = ?');
      params.push(start_date || null);
    }
    
    if (end_date !== undefined) {
      updates.push('end_date = ?');
      params.push(end_date || null);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    
    await db.run(`UPDATE announcements SET ${updates.join(', ')} WHERE id = ?`, ...params);
    
    await db.run(
      'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
      req.userId, 'announcement_updated', JSON.stringify({ announcement_id: id })
    );
    
    logger.info(`[Admin] Announcement ${id} updated by admin ${req.userId}`);
    
    const updated = await db.get('SELECT * FROM announcements WHERE id = ?', id);
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error(`[Admin] Update announcement failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
});

// DELETE /admin/announcements/:id - Delete announcement (super_admin only)
router.delete('/announcements/:id', ...[requireAuth, requireSuperAdmin], async (req, res) => {
  try {
    const { id } = req.params;
    
    const announcement = await db.get('SELECT * FROM announcements WHERE id = ?', id);
    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    
    await db.run('DELETE FROM announcements WHERE id = ?', id);
    
    await db.run(
      'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
      req.userId, 'announcement_deleted', JSON.stringify({ announcement_id: id, title: announcement.title })
    );
    
    logger.info(`[Admin] Announcement ${id} deleted by admin ${req.userId}`);
    
    res.json({ success: true, message: 'Announcement deleted successfully' });
  } catch (error) {
    logger.error(`[Admin] Delete announcement failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

// === METRICS & THRESHOLDS ===

const DEFAULT_THRESHOLDS = {
  error_rate: { warning: 1, critical: 5 },
  avg_response_time: { warning: 500, critical: 2000 },
  failed_logins: { warning: 10, critical: 50 },
  support_tickets: { warning: 20, critical: 100 },
  failed_payments: { warning: 5, critical: 20 },
  active_incidents: { warning: 3, critical: 10 }
};

let cachedThresholds = { ...DEFAULT_THRESHOLDS };

router.get('/metrics/thresholds', ...adminGuard, async (req, res) => {
  try {
    let thresholds = cachedThresholds;
    
    try {
      const stored = await db.get("SELECT config_value FROM system_config WHERE config_key = 'metrics_thresholds'");
      if (stored?.config_value) {
        thresholds = JSON.parse(stored.config_value);
      }
    } catch (e) {
      logger.warn('[Admin] Could not load thresholds from DB, using defaults');
    }
    
    res.json({ 
      success: true, 
      data: { 
        thresholds,
        defaults: DEFAULT_THRESHOLDS,
        lastUpdated: null
      } 
    });
  } catch (error) {
    logger.error(`[Admin] Get thresholds failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to get thresholds' });
  }
});

router.patch('/metrics/thresholds', ...[requireAuth, requireSuperAdmin], async (req, res) => {
  try {
    const { thresholds } = req.body;
    
    if (!thresholds || typeof thresholds !== 'object') {
      return res.status(400).json({ error: 'Thresholds object is required' });
    }
    
    const validated = {};
    for (const [key, value] of Object.entries(thresholds)) {
      if (!DEFAULT_THRESHOLDS[key]) {
        return res.status(400).json({ error: `Invalid threshold key: ${key}` });
      }
      if (typeof value?.warning !== 'number' || typeof value?.critical !== 'number') {
        return res.status(400).json({ error: `Invalid values for ${key}. Must have warning and critical numbers.` });
      }
      if (value.critical <= value.warning) {
        return res.status(400).json({ error: `Critical must be greater than warning for ${key}` });
      }
      validated[key] = { warning: value.warning, critical: value.critical };
    }
    
    cachedThresholds = { ...DEFAULT_THRESHOLDS, ...validated };
    
    try {
      await db.run(`
        INSERT INTO system_config (config_key, config_value, updated_at) 
        VALUES ('metrics_thresholds', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(config_key) DO UPDATE SET config_value = ?, updated_at = CURRENT_TIMESTAMP
      `, JSON.stringify(cachedThresholds), JSON.stringify(cachedThresholds));
    } catch (e) {
      logger.warn('[Admin] Could not persist thresholds to DB:', e.message);
    }
    
    await db.run(
      'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
      req.userId, 'metrics_thresholds_updated', JSON.stringify({ thresholds: validated })
    );
    
    logger.info(`[Admin] Metrics thresholds updated by super_admin ${req.userId}`);
    
    res.json({ success: true, data: { thresholds: cachedThresholds } });
  } catch (error) {
    logger.error(`[Admin] Update thresholds failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to update thresholds' });
  }
});

router.get('/metrics/violations', ...adminGuard, async (req, res) => {
  try {
    const thresholds = cachedThresholds;
    const violations = [];
    const metrics = {};
    const now = new Date();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    
    try {
      const errorEvents = await db.all(`
        SELECT event_name, COUNT(*) as count 
        FROM events 
        WHERE timestamp > ? AND event_name LIKE '%error%'
        GROUP BY event_name
      `, oneHourAgo.toISOString());
      const totalErrors = errorEvents.reduce((sum, e) => sum + (e.count || 0), 0);
      
      const totalRequests = await db.get(`
        SELECT COUNT(*) as count FROM events WHERE timestamp > ?
      `, oneHourAgo.toISOString());
      
      const errorRate = totalRequests?.count > 0 
        ? Math.round((totalErrors / totalRequests.count) * 100 * 100) / 100 
        : 0;
      
      metrics.error_rate = { value: errorRate, total: totalRequests?.count || 0 };
      
      if (errorRate >= thresholds.error_rate.critical) {
        violations.push({ metric: 'error_rate', value: errorRate, threshold: 'critical', thresholdValue: thresholds.error_rate.critical });
      } else if (errorRate >= thresholds.error_rate.warning) {
        violations.push({ metric: 'error_rate', value: errorRate, threshold: 'warning', thresholdValue: thresholds.error_rate.warning });
      }
    } catch (e) {
      logger.warn('[Admin] Error rate calculation failed:', e.message);
    }
    
    try {
      const loginAttempts = await db.all(`
        SELECT event_name, COUNT(*) as count 
        FROM events 
        WHERE timestamp > ? AND event_name IN ('login_failed', 'auth_failed', 'login_error')
        GROUP BY event_name
      `, oneHourAgo.toISOString());
      
      const failedLogins = loginAttempts.reduce((sum, e) => sum + (e.count || 0), 0);
      metrics.failed_logins = { value: failedLogins };
      
      if (failedLogins >= thresholds.failed_logins.critical) {
        violations.push({ metric: 'failed_logins', value: failedLogins, threshold: 'critical', thresholdValue: thresholds.failed_logins.critical });
      } else if (failedLogins >= thresholds.failed_logins.warning) {
        violations.push({ metric: 'failed_logins', value: failedLogins, threshold: 'warning', thresholdValue: thresholds.failed_logins.warning });
      }
    } catch (e) {
      logger.warn('[Admin] Failed logins calculation failed:', e.message);
    }
    
    try {
      const incidents = await db.all(`
        SELECT COUNT(*) as count FROM incidents 
        WHERE status != 'resolved' AND created_at > ?
      `, oneDayAgo.toISOString());
      
      const activeIncidents = incidents?.[0]?.count || 0;
      metrics.active_incidents = { value: activeIncidents };
      
      if (activeIncidents >= thresholds.active_incidents.critical) {
        violations.push({ metric: 'active_incidents', value: activeIncidents, threshold: 'critical', thresholdValue: thresholds.active_incidents.critical });
      } else if (activeIncidents >= thresholds.active_incidents.warning) {
        violations.push({ metric: 'active_incidents', value: activeIncidents, threshold: 'warning', thresholdValue: thresholds.active_incidents.warning });
      }
    } catch (e) {
      logger.warn('[Admin] Active incidents calculation failed:', e.message);
    }
    
    try {
      const tickets = await db.all(`
        SELECT COUNT(*) as count FROM support_tickets 
        WHERE created_at > ?
      `, oneDayAgo.toISOString());
      
      const supportTickets = tickets?.[0]?.count || 0;
      metrics.support_tickets = { value: supportTickets };
      
      if (supportTickets >= thresholds.support_tickets.critical) {
        violations.push({ metric: 'support_tickets', value: supportTickets, threshold: 'critical', thresholdValue: thresholds.support_tickets.critical });
      } else if (supportTickets >= thresholds.support_tickets.warning) {
        violations.push({ metric: 'support_tickets', value: supportTickets, threshold: 'warning', thresholdValue: thresholds.support_tickets.warning });
      }
    } catch (e) {
      logger.warn('[Admin] Support tickets calculation failed:', e.message);
    }
    
    try {
      const payments = await db.all(`
        SELECT COUNT(*) as count FROM payments 
        WHERE status = 'failed' AND created_at > ?
      `, oneDayAgo.toISOString());
      
      const failedPayments = payments?.[0]?.count || 0;
      metrics.failed_payments = { value: failedPayments };
      
      if (failedPayments >= thresholds.failed_payments.critical) {
        violations.push({ metric: 'failed_payments', value: failedPayments, threshold: 'critical', thresholdValue: thresholds.failed_payments.critical });
      } else if (failedPayments >= thresholds.failed_payments.warning) {
        violations.push({ metric: 'failed_payments', value: failedPayments, threshold: 'warning', thresholdValue: thresholds.failed_payments.warning });
      }
    } catch (e) {
      logger.warn('[Admin] Failed payments calculation failed:', e.message);
    }
    
    try {
      const healthRes = await db.get("SELECT config_value FROM system_config WHERE config_key = 'last_health_check'");
      if (healthRes?.config_value) {
        const healthData = JSON.parse(healthRes.config_value);
        const avgResponseTime = healthData.server?.totalResponseTime || 0;
        metrics.avg_response_time = { value: Math.round(avgResponseTime) };
        
        if (avgResponseTime >= thresholds.avg_response_time.critical) {
          violations.push({ metric: 'avg_response_time', value: Math.round(avgResponseTime), threshold: 'critical', thresholdValue: thresholds.avg_response_time.critical });
        } else if (avgResponseTime >= thresholds.avg_response_time.warning) {
          violations.push({ metric: 'avg_response_time', value: Math.round(avgResponseTime), threshold: 'warning', thresholdValue: thresholds.avg_response_time.warning });
        }
      }
    } catch (e) {
      logger.warn('[Admin] Response time calculation failed:', e.message);
    }
    
    const criticalCount = violations.filter(v => v.threshold === 'critical').length;
    const warningCount = violations.filter(v => v.threshold === 'warning').length;
    
    res.json({
      success: true,
      data: {
        violations,
        metrics,
        summary: {
          total: violations.length,
          critical: criticalCount,
          warning: warningCount,
          healthy: Object.keys(thresholds).length - violations.length
        },
        period: { since: oneHourAgo.toISOString(), until: now.toISOString() }
      }
    });
  } catch (error) {
    logger.error(`[Admin] Get violations failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to get violations' });
  }
});

// === STRIPE ENTITLEMENT RECONCILIATION ===

const mapStripeStatus = (stripeStatus) => {
  const mapping = {
    'active': 'active',
    'trialing': 'trialing',
    'past_due': 'past_due',
    'canceled': 'canceled',
    'unpaid': 'unpaid',
    'paused': 'paused',
    'incomplete': 'incomplete',
    'incomplete_expired': 'incomplete_expired'
  };
  return mapping[stripeStatus] || 'unknown';
};

const mapStripePlan = (priceId, productName = '') => {
  const plans = {
    'price_premium_monthly': 'premium_monthly',
    'price_premium_yearly': 'premium_yearly',
    'price_premium': 'premium',
    'price_basic_monthly': 'basic_monthly',
    'price_basic_yearly': 'basic_yearly',
    'price_basic': 'basic',
    'price_pro_monthly': 'pro_monthly',
    'price_pro_yearly': 'pro_yearly'
  };
  return plans[priceId] || productName || 'unknown';
};

const getDiscrepancySeverity = (type, localStatus, stripeStatus) => {
  if (type === 'missing_stripe') return 'high';
  if (type === 'missing_local') return 'medium';
  if (stripeStatus === 'canceled' && localStatus === 'active') return 'high';
  if (stripeStatus === 'past_due' && localStatus === 'active') return 'high';
  if (stripeStatus === 'active' && localStatus === 'canceled') return 'medium';
  return 'low';
};

router.get('/stripe/sync-status', ...adminGuard, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.json({
        success: true,
        data: {
          configured: false,
          lastSync: null,
          status: 'not_configured',
          message: 'Stripe is not configured. Add STRIPE_SECRET_KEY to enable reconciliation.'
        }
      });
    }

    const lastSyncEvent = await db.get(`
      SELECT event_data, timestamp FROM events 
      WHERE event_name = 'stripe_reconciliation_completed'
      ORDER BY timestamp DESC LIMIT 1
    `);

    const lastSync = lastSyncEvent ? {
      timestamp: lastSyncEvent.timestamp,
      details: lastSyncEvent.event_data ? JSON.parse(lastSyncEvent.event_data) : {}
    } : null;

    const recentCount = await db.get(`
      SELECT COUNT(*) as count FROM events 
      WHERE event_name = 'stripe_reconciliation_completed'
      AND timestamp > NOW() - INTERVAL '24 hours'
    `);

    res.json({
      success: true,
      data: {
        configured: true,
        lastSync: lastSync,
        status: lastSync ? 'synced' : 'never_synced',
        recentSyncCount: recentCount?.count || 0
      }
    });
  } catch (error) {
    logger.error(`[Admin] Stripe sync status failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

router.post('/stripe/sync', ...[requireAuth, requireSuperAdmin], async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ 
        success: false, 
        error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to enable reconciliation.' 
      });
    }

    logger.info(`[Admin] Starting Stripe reconciliation by admin ${req.userId}`);

    const discrepancies = [];
    let totalUsersChecked = 0;
    let totalSynced = 0;

    const usersWithStripe = await db.all(`
      SELECT id, email, name, subscription_tier, is_premium, stripe_customer_id, stripe_subscription_id
      FROM users WHERE stripe_customer_id IS NOT NULL
    `);

    totalUsersChecked = usersWithStripe.length;

    let stripeSubscriptions = [];
    try {
      const stripeRes = await axios.get(
        'https://api.stripe.com/v1/subscriptions?limit=100&status=all',
        { auth: { username: process.env.STRIPE_SECRET_KEY, password: '' } }
      );
      stripeSubscriptions = stripeRes.data.data || [];
    } catch (stripeErr) {
      logger.error(`[Admin] Stripe API error: ${stripeErr.message}`);
      return res.status(502).json({ 
        success: false, 
        error: `Stripe API error: ${stripeErr.message}` 
      });
    }

    const customerSubscriptions = {};
    for (const sub of stripeSubscriptions) {
      if (!customerSubscriptions[sub.customer]) {
        customerSubscriptions[sub.customer] = [];
      }
      customerSubscriptions[sub.customer].push(sub);
    }

    for (const user of usersWithStripe) {
      const userSubs = customerSubscriptions[user.stripe_customer_id] || [];
      const activeSub = userSubs.find(s => s.status === 'active') || userSubs[0];

      if (!activeSub && user.is_premium) {
        discrepancies.push({
          type: 'missing_stripe',
          user_id: user.id,
          local_status: user.is_premium ? 'active' : 'inactive',
          stripe_status: 'none',
          local_plan: user.subscription_tier || 'none',
          stripe_plan: 'none',
          severity: 'high',
          user_email: user.email,
          user_name: user.name
        });
      } else if (activeSub) {
        const stripeStatus = mapStripeStatus(activeSub.status);
        const stripePlan = mapStripePlan(
          activeSub.items?.data?.[0]?.price?.id,
          activeSub.items?.data?.[0]?.price?.product?.name
        );
        const localStatus = user.is_premium ? 'active' : 'inactive';

        if (stripeStatus !== 'active' && localStatus === 'active') {
          discrepancies.push({
            type: 'status_mismatch',
            user_id: user.id,
            local_status: localStatus,
            stripe_status: stripeStatus,
            local_plan: user.subscription_tier || 'none',
            stripe_plan: stripePlan,
            severity: getDiscrepancySeverity('status_mismatch', localStatus, stripeStatus),
            user_email: user.email,
            user_name: user.name
          });
        }

        if (user.subscription_tier && stripePlan !== 'unknown') {
          const localPlanNormalized = user.subscription_tier.toLowerCase().replace('_', '');
          const stripePlanNormalized = stripePlan.toLowerCase().replace('_', '');
          if (!localPlanNormalized.includes(stripePlanNormalized) && !stripePlanNormalized.includes(localPlanNormalized)) {
            discrepancies.push({
              type: 'plan_mismatch',
              user_id: user.id,
              local_status: localStatus,
              stripe_status: stripeStatus,
              local_plan: user.subscription_tier,
              stripe_plan: stripePlan,
              severity: 'medium',
              user_email: user.email,
              user_name: user.name
            });
          }
        }

        if (stripeStatus === 'active' && localStatus === 'active') {
          totalSynced++;
        }
      }
    }

    const localUserIds = new Set(usersWithStripe.map(u => u.id));
    for (const [customerId, subs] of Object.entries(customerSubscriptions)) {
      const activeSub = subs.find(s => s.status === 'active');
      if (activeSub) {
        let localUser = usersWithStripe.find(u => u.stripe_customer_id === customerId);
        
        if (!localUser && activeSub.customer_email) {
          localUser = usersWithStripe.find(u => u.email === activeSub.customer_email);
        }

        if (!localUser) {
          discrepancies.push({
            type: 'missing_local',
            user_id: null,
            local_status: 'not_found',
            stripe_status: 'active',
            local_plan: 'none',
            stripe_plan: mapStripePlan(
              activeSub.items?.data?.[0]?.price?.id,
              activeSub.items?.data?.[0]?.price?.product?.name
            ),
            severity: 'high',
            stripe_customer_id: customerId,
            stripe_email: activeSub.customer_email
          });
        }
      }
    }

    await db.run(
      'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
      req.userId, 'stripe_reconciliation_completed', JSON.stringify({
        total_users_checked: totalUsersChecked,
        total_synced: totalSynced,
        discrepancies_found: discrepancies.length,
        high_severity: discrepancies.filter(d => d.severity === 'high').length,
        medium_severity: discrepancies.filter(d => d.severity === 'medium').length,
        low_severity: discrepancies.filter(d => d.severity === 'low').length
      })
    );

    logger.info(`[Admin] Stripe reconciliation completed: ${totalUsersChecked} users, ${discrepancies.length} discrepancies`);

    res.json({
      success: true,
      data: {
        totalUsersChecked,
        totalSynced,
        discrepancies: discrepancies,
        summary: {
          total: discrepancies.length,
          high: discrepancies.filter(d => d.severity === 'high').length,
          medium: discrepancies.filter(d => d.severity === 'medium').length,
          low: discrepancies.filter(d => d.severity === 'low').length
        },
        syncedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error(`[Admin] Stripe sync failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to sync with Stripe' });
  }
});

router.get('/stripe/discrepancies', ...adminGuard, async (req, res) => {
  try {
    const { type, severity, limit = 50, offset = 0 } = req.query;

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ 
        success: false, 
        error: 'Stripe is not configured' 
      });
    }

    const discrepancies = [];
    
    const usersWithStripe = await db.all(`
      SELECT id, email, name, subscription_tier, is_premium, stripe_customer_id, stripe_subscription_id
      FROM users WHERE stripe_customer_id IS NOT NULL
    `);

    let stripeSubscriptions = [];
    try {
      const stripeRes = await axios.get(
        'https://api.stripe.com/v1/subscriptions?limit=100&status=all',
        { auth: { username: process.env.STRIPE_SECRET_KEY, password: '' } }
      );
      stripeSubscriptions = stripeRes.data.data || [];
    } catch (e) {
      return res.status(502).json({ error: 'Failed to fetch from Stripe' });
    }

    const customerSubscriptions = {};
    for (const sub of stripeSubscriptions) {
      if (!customerSubscriptions[sub.customer]) {
        customerSubscriptions[sub.customer] = [];
      }
      customerSubscriptions[sub.customer].push(sub);
    }

    for (const user of usersWithStripe) {
      const userSubs = customerSubscriptions[user.stripe_customer_id] || [];
      const activeSub = userSubs.find(s => s.status === 'active') || userSubs[0];

      if (!activeSub && user.is_premium) {
        discrepancies.push({
          type: 'missing_stripe',
          user_id: user.id,
          local_status: 'active',
          stripe_status: 'none',
          local_plan: user.subscription_tier || 'none',
          stripe_plan: 'none',
          severity: 'high',
          user_email: user.email,
          user_name: user.name
        });
      } else if (activeSub) {
        const stripeStatus = mapStripeStatus(activeSub.status);
        const stripePlan = mapStripePlan(
          activeSub.items?.data?.[0]?.price?.id,
          activeSub.items?.data?.[0]?.price?.product?.name
        );
        const localStatus = user.is_premium ? 'active' : 'inactive';

        if (stripeStatus !== 'active' && localStatus === 'active') {
          discrepancies.push({
            type: 'status_mismatch',
            user_id: user.id,
            local_status: localStatus,
            stripe_status: stripeStatus,
            local_plan: user.subscription_tier || 'none',
            stripe_plan: stripePlan,
            severity: getDiscrepancySeverity('status_mismatch', localStatus, stripeStatus),
            user_email: user.email,
            user_name: user.name
          });
        }
      }
    }

    let filtered = discrepancies;
    if (type) {
      filtered = filtered.filter(d => d.type === type);
    }
    if (severity) {
      filtered = filtered.filter(d => d.severity === severity);
    }

    const paginated = filtered.slice(offset, offset + parseInt(limit));

    res.json({
      success: true,
      data: {
        discrepancies: paginated,
        total: filtered.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    logger.error(`[Admin] Get discrepancies failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to get discrepancies' });
  }
});

router.post('/stripe/discrepancies/:userId/fix', ...[requireAuth, requireSuperAdmin], async (req, res) => {
  try {
    const { userId } = req.params;
    const { fixType = 'sync_to_local' } = req.body;

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: 'Stripe is not configured' });
    }

    const user = await db.get('SELECT * FROM users WHERE id = ?', userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let stripeSubscription = null;
    if (user.stripe_subscription_id) {
      try {
        const stripeRes = await axios.get(
          `https://api.stripe.com/v1/subscriptions/${user.stripe_subscription_id}`,
          { auth: { username: process.env.STRIPE_SECRET_KEY, password: '' } }
        );
        stripeSubscription = stripeRes.data;
      } catch (e) {
        logger.warn(`[Admin] Could not fetch Stripe subscription: ${e.message}`);
      }
    }

    if (fixType === 'sync_to_local') {
      if (stripeSubscription) {
        const stripeStatus = mapStripeStatus(stripeSubscription.status);
        const stripePlan = mapStripePlan(
          stripeSubscription.items?.data?.[0]?.price?.id,
          stripeSubscription.items?.data?.[0]?.price?.product?.name
        );
        const isPremium = stripeStatus === 'active';

        await db.run(
          `UPDATE users SET is_premium = ?, subscription_tier = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          isPremium, stripePlan, userId
        );

        await db.run(
          'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
          req.userId, 'stripe_discrepancy_fixed', JSON.stringify({
            user_id: userId,
            fix_type: 'sync_to_local',
            previous_local_plan: user.subscription_tier,
            new_local_plan: stripePlan,
            previous_local_status: user.is_premium ? 'active' : 'inactive',
            new_local_status: isPremium ? 'active' : 'inactive'
          })
        );

        logger.info(`[Admin] Fixed discrepancy for user ${userId}: synced to local (plan: ${stripePlan}, status: ${stripeStatus})`);

        return res.json({
          success: true,
          message: `User updated to match Stripe: ${stripePlan} (${stripeStatus})`,
          data: { new_plan: stripePlan, new_status: stripeStatus }
        });
      } else {
        await db.run(
          `UPDATE users SET is_premium = false, subscription_tier = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          userId
        );

        await db.run(
          'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
          req.userId, 'stripe_discrepancy_fixed', JSON.stringify({
            user_id: userId,
            fix_type: 'sync_to_local',
            action: 'deactivated',
            reason: 'no_active_stripe_subscription'
          })
        );

        return res.json({
          success: true,
          message: 'User deactivated (no active Stripe subscription)',
          data: { new_plan: null, new_status: 'inactive' }
        });
      }
    } else if (fixType === 'sync_to_stripe') {
      if (stripeSubscription && stripeSubscription.status === 'active') {
        try {
          await axios.post(
            'https://api.stripe.com/v1/subscriptions/cancel',
            { subscription: user.stripe_subscription_id },
            { auth: { username: process.env.STRIPE_SECRET_KEY, password: '' } }
          );

          await db.run(
            'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
            req.userId, 'stripe_discrepancy_fixed', JSON.stringify({
              user_id: userId,
              fix_type: 'sync_to_stripe',
              action: 'cancelled_stripe_subscription'
            })
          );

          logger.info(`[Admin] Fixed discrepancy for user ${userId}: cancelled Stripe subscription`);

          return res.json({
            success: true,
            message: 'Stripe subscription cancelled to match local deactivation'
          });
        } catch (e) {
          return res.status(500).json({ error: `Failed to cancel Stripe subscription: ${e.message}` });
        }
      }

      return res.status(400).json({ error: 'No active Stripe subscription to cancel' });
    }

    return res.status(400).json({ error: 'Invalid fix type' });
  } catch (error) {
    logger.error(`[Admin] Fix discrepancy failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to fix discrepancy' });
  }
});

router.get('/stripe/reconciliation-logs', ...adminGuard, async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const logs = await db.all(`
      SELECT e.id, e.event_name, e.event_data, e.timestamp, u.email as admin_email
      FROM events e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.event_name IN ('stripe_reconciliation_completed', 'stripe_discrepancy_fixed')
      ORDER BY e.timestamp DESC
      LIMIT ?
    `, parseInt(limit));

    res.json({
      success: true,
      data: {
        logs: logs || [],
        total: logs?.length || 0
      }
    });
  } catch (error) {
    logger.error(`[Admin] Reconciliation logs failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to get reconciliation logs' });
  }
});

// === ACTION APPROVAL WORKFLOW ===

const APPROVAL_REQUIRED_ACTIONS = [
  'delete_user',
  'bulk_delete_users',
  'anonymize_user',
  'delete_destination',
  'force_cancel_subscription',
  'modify_another_admin',
  'bulk_export',
];

const SUPER_ADMIN_ONLY_ACTIONS = [
  'delete_user',
  'bulk_delete_users',
  'anonymize_user',
  'force_cancel_subscription',
  'modify_another_admin',
];

function requiresApproval(actionType) {
  return APPROVAL_REQUIRED_ACTIONS.includes(actionType);
}

function requiresSuperAdmin(actionType) {
  return SUPER_ADMIN_ONLY_ACTIONS.includes(actionType);
}

function actionRequiresApproval(actionType) {
  return {
    requiresApproval: requiresApproval(actionType),
    requiresSuperAdmin: requiresSuperAdmin(actionType),
    actionType
  };
}

// GET /admin/actions/pending - List pending approval actions (super_admin only)
router.get('/actions/pending', requireSuperAdmin, async (req, res) => {
  try {
    const { limit = 50, offset = 0, action_type } = req.query;

    let query = `
      SELECT pa.*, 
             aa.name as actor_name, aa.email as actor_email, aa.admin_level as actor_level,
             au.name as approver_name, au.email as approver_email
      FROM pending_actions pa
      LEFT JOIN users aa ON pa.actor_admin_id = aa.id
      LEFT JOIN users au ON pa.approved_by = au.id
      WHERE pa.status = 'pending'
    `;
    const params = [];

    if (action_type) {
      query += ' AND pa.action_type = ?';
      params.push(action_type);
    }

    query += ' ORDER BY pa.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const actions = await db.all(query, ...params);
    const count = await db.get(
      'SELECT COUNT(*) as count FROM pending_actions WHERE status = ?',
      'pending'
    );

    res.json({
      success: true,
      data: {
        actions: actions || [],
        total: count?.count || 0,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    logger.error(`[Admin] Get pending actions failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to get pending actions' });
  }
});

// GET /admin/actions/history - List completed/approved/rejected actions
router.get('/actions/history', ...adminGuard, async (req, res) => {
  try {
    const { limit = 50, offset = 0, status, action_type } = req.query;

    let query = `
      SELECT pa.*, 
             aa.name as actor_name, aa.email as actor_email, aa.admin_level as actor_level,
             au.name as approver_name, au.email as approver_email
      FROM pending_actions pa
      LEFT JOIN users aa ON pa.actor_admin_id = aa.id
      LEFT JOIN users au ON pa.approved_by = au.id
      WHERE pa.status != 'pending'
    `;
    const params = [];

    if (status) {
      query += ' AND pa.status = ?';
      params.push(status);
    }

    if (action_type) {
      query += ' AND pa.action_type = ?';
      params.push(action_type);
    }

    query += ' ORDER BY pa.processed_at DESC, pa.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const actions = await db.all(query, ...params);
    const count = await db.get(
      'SELECT COUNT(*) as count FROM pending_actions WHERE status != ?',
      'pending'
    );

    res.json({
      success: true,
      data: {
        actions: actions || [],
        total: count?.count || 0,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    logger.error(`[Admin] Get actions history failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to get actions history' });
  }
});

// GET /admin/actions/stats - Get pending action counts
router.get('/actions/stats', requireSuperAdmin, async (req, res) => {
  try {
    const pending = await db.get(
      "SELECT COUNT(*) as count FROM pending_actions WHERE status = 'pending'"
    );
    const approved = await db.get(
      "SELECT COUNT(*) as count FROM pending_actions WHERE status = 'approved'"
    );
    const rejected = await db.get(
      "SELECT COUNT(*) as count FROM pending_actions WHERE status = 'rejected'"
    );

    const byType = await db.all(`
      SELECT action_type, COUNT(*) as count 
      FROM pending_actions 
      WHERE status = 'pending' 
      GROUP BY action_type
    `);

    res.json({
      success: true,
      data: {
        pending: pending?.count || 0,
        approved: approved?.count || 0,
        rejected: rejected?.count || 0,
        byType: byType || []
      }
    });
  } catch (error) {
    logger.error(`[Admin] Get actions stats failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to get actions stats' });
  }
});

// POST /admin/actions/:id/approve - Approve a pending action (super_admin only)
router.post('/actions/:id/approve', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const adminId = req.userId;

    const action = await db.get('SELECT * FROM pending_actions WHERE id = ?', id);
    if (!action) {
      return res.status(404).json({ error: 'Pending action not found' });
    }

    if (action.status !== 'pending') {
      return res.status(400).json({ error: `Action is already ${action.status}` });
    }

    if (action.actor_admin_id === adminId) {
      return res.status(400).json({ error: 'Cannot approve your own action' });
    }

    const actor = await db.get('SELECT admin_level FROM users WHERE id = ?', action.actor_admin_id);
    if (requiresSuperAdmin(action.action_type) && req.user?.admin_level !== 'super_admin') {
      return res.status(403).json({ error: 'This action requires super_admin approval' });
    }

    await db.run(
      `UPDATE pending_actions 
       SET status = 'approved', approved_by = ?, processed_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      adminId, id
    );

    const targetInfo = action.target_id;
    const actionType = action.action_type;

    let executionResult = { success: true, message: 'Action approved' };

    if (actionType === 'delete_user') {
      await db.run('UPDATE users SET deleted_at = CURRENT_TIMESTAMP, deleted_by = ? WHERE id = ?', adminId, action.target_id);
      executionResult = { success: true, message: 'User deleted successfully' };
    } else if (actionType === 'anonymize_user') {
      await db.run(`
        UPDATE users SET 
          name = 'Anonymous User',
          phone = NULL,
          emergency_contact_name = NULL,
          emergency_contact_phone = NULL,
          emergency_contact_relationship = NULL,
          profile_photo = NULL
        WHERE id = ?
      `, action.target_id);
      executionResult = { success: true, message: 'User data anonymized successfully' };
    } else if (actionType === 'delete_destination') {
      await db.run('DELETE FROM destinations WHERE id = ?', action.target_id);
      executionResult = { success: true, message: 'Destination deleted successfully' };
    } else if (actionType === 'bulk_delete_users') {
      const params = JSON.parse(action.params || '{}');
      const userIds = params.user_ids || [];
      for (const uid of userIds) {
        await db.run('UPDATE users SET deleted_at = CURRENT_TIMESTAMP, deleted_by = ? WHERE id = ?', adminId, uid);
      }
      executionResult = { success: true, message: `${userIds.length} users deleted successfully` };
    } else if (actionType === 'modify_another_admin') {
      const params = JSON.parse(action.params || '{}');
      if (params.new_admin_level) {
        await db.run('UPDATE users SET admin_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', params.new_admin_level, action.target_id);
      }
      executionResult = { success: true, message: 'Admin role modified successfully' };
    } else if (actionType === 'force_cancel_subscription') {
      await db.run('UPDATE users SET is_premium = false, subscription_tier = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', action.target_id);
      executionResult = { success: true, message: 'Subscription cancelled successfully' };
    } else if (actionType === 'bulk_export') {
      executionResult = { success: true, message: 'Bulk export approved - export will be generated' };
    }

    await db.run(
      'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
      adminId, 'pending_action_approved', JSON.stringify({
        action_id: id,
        action_type: actionType,
        target_type: action.target_type,
        target_id: action.target_id,
        note
      })
    );

    logger.info(`[Admin] Pending action ${id} (${actionType}) approved by admin ${adminId}`);

    res.json({
      success: true,
      message: `Action approved: ${executionResult.message}`,
      data: {
        action_id: id,
        status: 'approved',
        approved_by: adminId,
        executed: executionResult.success
      }
    });
  } catch (error) {
    logger.error(`[Admin] Approve action failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to approve action' });
  }
});

// POST /admin/actions/:id/reject - Reject a pending action (super_admin only)
router.post('/actions/:id/reject', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.userId;

    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const action = await db.get('SELECT * FROM pending_actions WHERE id = ?', id);
    if (!action) {
      return res.status(404).json({ error: 'Pending action not found' });
    }

    if (action.status !== 'pending') {
      return res.status(400).json({ error: `Action is already ${action.status}` });
    }

    if (action.actor_admin_id === adminId) {
      return res.status(400).json({ error: 'Cannot reject your own action' });
    }

    await db.run(
      `UPDATE pending_actions 
       SET status = 'rejected', approved_by = ?, rejection_reason = ?, processed_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      adminId, reason, id
    );

    await db.run(
      'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
      adminId, 'pending_action_rejected', JSON.stringify({
        action_id: id,
        action_type: action.action_type,
        target_type: action.target_type,
        target_id: action.target_id,
        reason
      })
    );

    logger.info(`[Admin] Pending action ${id} (${action.action_type}) rejected by admin ${adminId}: ${reason}`);

    res.json({
      success: true,
      message: 'Action rejected',
      data: {
        action_id: id,
        status: 'rejected',
        rejected_by: adminId,
        reason
      }
    });
  } catch (error) {
    logger.error(`[Admin] Reject action failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to reject action' });
  }
});

// POST /admin/actions/:id/cancel - Cancel own pending action request
router.post('/actions/:id/cancel', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.userId;

    const action = await db.get('SELECT * FROM pending_actions WHERE id = ?', id);
    if (!action) {
      return res.status(404).json({ error: 'Pending action not found' });
    }

    if (action.status !== 'pending') {
      return res.status(400).json({ error: `Action is already ${action.status}` });
    }

    if (action.actor_admin_id !== adminId) {
      return res.status(403).json({ error: 'Can only cancel your own action requests' });
    }

    await db.run(
      `UPDATE pending_actions 
       SET status = 'rejected', rejection_reason = 'Cancelled by requester', processed_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      id
    );

    await db.run(
      'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
      adminId, 'pending_action_cancelled', JSON.stringify({
        action_id: id,
        action_type: action.action_type,
        target_type: action.target_type,
        target_id: action.target_id
      })
    );

    logger.info(`[Admin] Pending action ${id} cancelled by requester ${adminId}`);

    res.json({
      success: true,
      message: 'Action request cancelled'
    });
  } catch (error) {
    logger.error(`[Admin] Cancel action failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to cancel action' });
  }
});

// Helper function to create pending action
async function createPendingAction(actionType, actorAdminId, targetType, targetId, params = {}) {
  const result = await db.run(
    `INSERT INTO pending_actions (action_type, actor_admin_id, target_type, target_id, params, status) 
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    actionType, actorAdminId, targetType, targetId, JSON.stringify(params)
  );
  return result.lastInsertRowid;
}

// Check if action requires approval middleware helper
router.post('/check-action-approval', ...adminGuard, async (req, res) => {
  try {
    const { action_type } = req.body;
    
    if (!action_type) {
      return res.status(400).json({ error: 'action_type is required' });
    }

    const result = actionRequiresApproval(action_type);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`[Admin] Check action approval failed: ${error.message}`);
    res.status(500).json({ error: 'Failed to check action requirements' });
  }
});

// GET /admin/reports - moderation queue for user/content reports
router.get('/reports', ...adminGuard, async (req, res) => {
  try {
    const status = req.query.status || 'open';
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const offset = parseInt(req.query.offset || '0', 10);

    const reports = await db.all(
      `SELECT r.*, reporter.email as reporter_email, reviewer.email as reviewer_email
       FROM reports r
       LEFT JOIN users reporter ON reporter.id = r.reporter_id
       LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
       WHERE (? = 'all' OR r.status = ?)
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      status, status, limit, offset
    );

    const totalRow = await db.get(
      `SELECT COUNT(*)::int as count FROM reports
       WHERE (? = 'all' OR status = ?)`,
      status, status
    );

    res.json({
      success: true,
      data: { reports: reports || [], total: totalRow?.count || 0, limit, offset, status }
    });
  } catch (error) {
    logger.error(`[Admin] Failed to list reports: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to fetch reports' });
  }
});

// PATCH /admin/reports/:id - update report moderation status
router.patch('/reports/:id', ...adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['open', 'under_review', 'actioned', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const updated = await db.run(
      'UPDATE reports SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      status, req.userId, id
    );

    if (!updated?.changes) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    await db.run(
      'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
      req.userId,
      'admin_report_moderated',
      JSON.stringify({ reportId: Number(id), status })
    );

    res.json({ success: true, data: { id: Number(id), status } });
  } catch (error) {
    logger.error(`[Admin] Failed to moderate report: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to moderate report' });
  }
});

export default router;
