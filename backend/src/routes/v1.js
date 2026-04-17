import express from 'express';
import db from '../db.js';
import logger from '../services/logger.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { FEATURES, hasFeature } from '../middleware/paywall.js';

const router = express.Router();

const ONBOARDING_STEPS = ['profile_setup', 'first_trip', 'safety_setup', 'preferences', 'notifications'];

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : (forwarded?.split(',')[0] || req.ip || req.connection?.remoteAddress || '');
  return String(value).trim().replace('::ffff:', '');
};

const getUserPlan = async (userId) => {
  const user = await db.get('SELECT subscription_tier, is_premium FROM users WHERE id = ?', userId);
  if (!user) return 'explorer';
  if (user.subscription_tier) return user.subscription_tier;
  return user.is_premium ? 'guardian' : 'explorer';
};

// GDPR consent management
router.get('/consents', requireAuth, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT consent_type, granted, source, granted_at, revoked_at
       FROM user_consents
       WHERE user_id = ?
       ORDER BY granted_at DESC`,
      req.userId
    );
    const latest = {};
    for (const row of rows || []) {
      if (!(row.consent_type in latest)) latest[row.consent_type] = row;
    }
    res.json({ success: true, data: { consents: latest, history: rows || [] } });
  } catch (error) {
    logger.error(`[v1] Failed to get consents: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to fetch consent state' });
  }
});

router.post('/consents', requireAuth, async (req, res) => {
  try {
    const { consentType, granted, source = 'web' } = req.body;
    const validTypes = ['data_processing', 'cookie_analytics', 'cookie_marketing', 'marketing'];
    if (!validTypes.includes(consentType) || typeof granted !== 'boolean') {
      return res.status(400).json({ success: false, error: 'Invalid consent payload' });
    }

    await db.run(
      `INSERT INTO user_consents (user_id, consent_type, granted, source, ip_address, user_agent, granted_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
      req.userId,
      consentType,
      granted,
      source,
      getClientIp(req),
      req.headers['user-agent'] || null,
      granted ? null : new Date().toISOString()
    );

    await db.run(
      'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
      req.userId,
      'user_consent_updated',
      JSON.stringify({ consentType, granted, source })
    );

    res.json({ success: true, data: { consentType, granted } });
  } catch (error) {
    logger.error(`[v1] Failed to upsert consent: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to save consent' });
  }
});

// Onboarding flow engine (status + completion)
router.get('/onboarding/status', requireAuth, async (req, res) => {
  try {
    const steps = await db.all(
      `SELECT step_key, completed, metadata, completed_at
       FROM onboarding_progress
       WHERE user_id = ?
       ORDER BY step_key ASC`,
      req.userId
    );
    const completedCount = (steps || []).filter(s => s.completed).length;
    const percent = Math.round((completedCount / ONBOARDING_STEPS.length) * 100);
    res.json({
      success: true,
      data: {
        steps: ONBOARDING_STEPS.map(stepKey => steps.find(s => s.step_key === stepKey) || { step_key: stepKey, completed: false }),
        completedCount,
        totalSteps: ONBOARDING_STEPS.length,
        progressPercent: percent
      }
    });
  } catch (error) {
    logger.error(`[v1] Failed onboarding status: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to fetch onboarding status' });
  }
});

router.post('/onboarding/complete', requireAuth, async (req, res) => {
  try {
    const { step, metadata = {} } = req.body;
    if (!step || typeof step !== 'string') {
      return res.status(400).json({ success: false, error: 'step is required' });
    }

    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO onboarding_progress (user_id, step_key, completed, metadata, completed_at, updated_at)
       VALUES (?, ?, true, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, step_key) DO UPDATE SET
         completed = EXCLUDED.completed,
         metadata = EXCLUDED.metadata,
         completed_at = EXCLUDED.completed_at,
         updated_at = CURRENT_TIMESTAMP`,
      req.userId,
      step,
      JSON.stringify(metadata || {}),
      now
    );

    await db.run(
      'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
      req.userId,
      'onboarding_step_completed',
      JSON.stringify({ step, metadata })
    );

    res.json({ success: true, data: { step, completed: true, completedAt: now } });
  } catch (error) {
    logger.error(`[v1] Failed onboarding completion: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to complete onboarding step' });
  }
});

// Plan-based feature availability
router.get('/features', requireAuth, async (req, res) => {
  try {
    const plan = await getUserPlan(req.userId);
    const all = Object.values(FEATURES);
    const available = [];
    for (const feature of all) {
      // eslint-disable-next-line no-await-in-loop
      if (await hasFeature(req.userId, feature)) available.push(feature);
    }
    res.json({ success: true, data: { plan, available, all } });
  } catch (error) {
    logger.error(`[v1] Failed to list features: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to load features' });
  }
});

// Safety/content reports
router.post('/reports', requireAuth, async (req, res) => {
  try {
    const { reportedEntityType, entityId, reason, details } = req.body;
    if (!reportedEntityType || !entityId || !reason) {
      return res.status(400).json({ success: false, error: 'reportedEntityType, entityId, and reason are required' });
    }

    const result = await db.run(
      `INSERT INTO reports (reporter_id, reported_entity_type, entity_id, reason, details, status)
       VALUES (?, ?, ?, ?, ?, 'open')`,
      req.userId,
      reportedEntityType,
      String(entityId),
      reason,
      details || null
    );

    await db.run(
      'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
      req.userId,
      'report_submitted',
      JSON.stringify({ reportId: result?.lastInsertRowid, reportedEntityType, entityId, reason })
    );

    // auto-block if entity receives multiple recent reports
    const countRow = await db.get(
      `SELECT COUNT(*)::int as count
       FROM reports
       WHERE reported_entity_type = ? AND entity_id = ? AND created_at >= NOW() - INTERVAL '24 hours'`,
      reportedEntityType,
      String(entityId)
    );
    if ((countRow?.count || 0) >= 5) {
      await db.run(
        'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
        req.userId,
        'entity_auto_block_recommended',
        JSON.stringify({ reportedEntityType, entityId, reportCount: countRow.count })
      );
    }

    res.status(201).json({ success: true, data: { id: result?.lastInsertRowid, status: 'open' } });
  } catch (error) {
    logger.error(`[v1] Failed to submit report: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to submit report' });
  }
});

// Emergency support priority lane
router.post('/support/tickets', requireAuth, async (req, res) => {
  try {
    const { subject, message, category = 'general', emergency = false } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ success: false, error: 'subject and message are required' });
    }
    const isSos = emergency === true || ['sos', 'emergency', 'safety'].includes(String(category).toLowerCase());
    const priority = isSos ? 'critical' : 'normal';
    const slaDueAt = new Date(Date.now() + (isSos ? 15 : 24 * 60) * 60 * 1000).toISOString();

    const user = await db.get('SELECT email FROM users WHERE id = ?', req.userId);
    const result = await db.run(
      `INSERT INTO support_tickets (user_id, email, subject, message, category, priority, status, sla_due_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
      req.userId,
      user?.email || null,
      subject,
      message,
      category,
      priority,
      slaDueAt
    );

    await db.run(
      'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
      req.userId,
      isSos ? 'support_ticket_sos_created' : 'support_ticket_created',
      JSON.stringify({ ticketId: result?.lastInsertRowid, priority, category, emergency: isSos })
    );

    res.status(201).json({
      success: true,
      data: { id: result?.lastInsertRowid, priority, status: 'open', fastTracked: isSos, slaDueAt }
    });
  } catch (error) {
    logger.error(`[v1] Failed to create support ticket: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to create support ticket' });
  }
});

// GDPR portability/erasure aliases
router.get('/users/me/export', requireAuth, async (req, res) => {
  res.redirect(307, `/api/users/${req.userId}/export`);
});

router.delete('/users/me', requireAuth, async (req, res) => {
  const query = req.query.permanent === 'true' ? '?permanent=true' : '';
  res.redirect(307, `/api/users/${req.userId}${query}`);
});

// P3 lightweight endpoints
router.post('/feature-requests', requireAuth, async (req, res) => {
  const { title, details } = req.body || {};
  if (!title) return res.status(400).json({ success: false, error: 'title is required' });
  await db.run('INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)', req.userId, 'feature_request_submitted', JSON.stringify({ title, details }));
  return res.status(201).json({ success: true, data: { submitted: true } });
});

router.post('/waitlist', async (req, res) => {
  const { email, feature } = req.body || {};
  if (!email) return res.status(400).json({ success: false, error: 'email is required' });
  await db.run('INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)', null, 'waitlist_joined', JSON.stringify({ email, feature: feature || null }));
  return res.status(201).json({ success: true, data: { joined: true } });
});

// Simple placeholders for listed read endpoints
router.get('/changelog', (req, res) => {
  res.json({ success: true, data: [{ version: '0.1.0', date: new Date().toISOString().slice(0, 10), notes: 'Initial release notes placeholder' }] });
});

router.get('/help/articles', (req, res) => {
  res.json({ success: true, data: [{ id: 'getting-started', title: 'Getting Started', category: 'Basics', content: 'Help center placeholder article.' }] });
});

router.get('/support/faq', (req, res) => {
  res.json({ success: true, data: [{ id: 'faq-1', question: 'How do I contact support?', answer: 'Use /contact or submit a support ticket.' }] });
});

router.get('/dashboard/activity', requireAuth, async (req, res) => {
  const events = await db.all('SELECT id, event_name, event_data, timestamp FROM events WHERE user_id = ? ORDER BY timestamp DESC LIMIT 20', req.userId);
  res.json({ success: true, data: events || [] });
});

router.get('/subscriptions/invoices', requireAuth, async (req, res) => {
  res.json({ success: true, data: [] });
});

router.get('/admin/analytics', requireAuth, requireAdmin, async (req, res) => {
  const totals = await db.get('SELECT COUNT(*)::int as users FROM users');
  const reports = await db.get('SELECT COUNT(*)::int as reports FROM reports');
  const tickets = await db.get('SELECT COUNT(*)::int as tickets FROM support_tickets');
  res.json({ success: true, data: { users: totals?.users || 0, reports: reports?.reports || 0, supportTickets: tickets?.tickets || 0 } });
});

router.post('/admin/announcements', requireAuth, requireAdmin, async (req, res) => {
  const { title, message } = req.body || {};
  if (!title || !message) return res.status(400).json({ success: false, error: 'title and message are required' });
  await db.run('INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)', req.userId, 'admin_announcement_created', JSON.stringify({ title, message }));
  res.status(201).json({ success: true, data: { created: true } });
});

router.post('/support/tickets/:id/rate', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body || {};
  if (!rating || Number(rating) < 1 || Number(rating) > 5) return res.status(400).json({ success: false, error: 'rating must be 1-5' });
  await db.run('INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)', req.userId, 'support_ticket_rated', JSON.stringify({ ticketId: Number(id), rating: Number(rating), comment: comment || null }));
  res.json({ success: true, data: { ticketId: Number(id), rating: Number(rating) } });
});

export default router;
