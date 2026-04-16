/**
 * Analytics Funnel & A/B Experiment Framework
 */

import db from '../db.js';
import logger from './logger.js';
import crypto from 'crypto';

// ── Funnel Tracking ──────────────────────────────────────────────

export async function createFunnel(name, steps) {
  const result = await db.run(
    'INSERT INTO analytics_funnels (name, steps) VALUES ($1, $2) ON CONFLICT(name) DO UPDATE SET steps = $2',
    name, JSON.stringify(steps)
  );
  return { id: result.lastInsertRowid, name, steps };
}

export async function trackFunnelStep(funnelName, userId, stepName, sessionId = null, metadata = {}) {
  const funnel = await db.get('SELECT id, steps FROM analytics_funnels WHERE name = $1', funnelName);
  if (!funnel) return null;

  const steps = JSON.parse(funnel.steps || '[]');
  const stepIndex = steps.indexOf(stepName);
  if (stepIndex === -1) return null;

  await db.run(
    'INSERT INTO analytics_funnel_events (funnel_id, user_id, step_index, step_name, session_id, metadata) VALUES ($1,$2,$3,$4,$5,$6)',
    funnel.id, userId, stepIndex, stepName, sessionId, JSON.stringify(metadata)
  );
  return { funnelId: funnel.id, stepIndex, stepName };
}

export async function getFunnelStats(funnelName, since = null) {
  const funnel = await db.get('SELECT id, steps FROM analytics_funnels WHERE name = $1', funnelName);
  if (!funnel) return null;

  const steps = JSON.parse(funnel.steps || '[]');
  const dateFilter = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const counts = await db.all(`
    SELECT step_index, step_name, COUNT(DISTINCT user_id) as unique_users, COUNT(*) as total_events
    FROM analytics_funnel_events
    WHERE funnel_id = $1 AND created_at >= $2
    GROUP BY step_index, step_name
    ORDER BY step_index
  `, funnel.id, dateFilter);

  const result = steps.map((name, idx) => {
    const row = counts.find(c => c.step_index === idx);
    return {
      step: idx,
      name,
      uniqueUsers: row?.unique_users || 0,
      totalEvents: row?.total_events || 0
    };
  });

  // Compute drop-off rates
  for (let i = 1; i < result.length; i++) {
    const prev = result[i - 1].uniqueUsers;
    result[i].conversionRate = prev > 0 ? Math.round((result[i].uniqueUsers / prev) * 10000) / 100 : 0;
    result[i].dropOff = prev - result[i].uniqueUsers;
  }
  if (result.length > 0) {
    result[0].conversionRate = 100;
    result[0].dropOff = 0;
  }

  return { funnel: funnelName, steps: result, period: { since: dateFilter } };
}

// ── A/B Experiment Framework ─────────────────────────────────────

export async function createExperiment(name, description, variants = ['control', 'treatment'], trafficPct = 100) {
  const result = await db.run(
    'INSERT INTO experiments (name, description, variants, traffic_pct) VALUES ($1,$2,$3,$4)',
    name, description, JSON.stringify(variants), trafficPct
  );
  return { id: result.lastInsertRowid, name, variants, trafficPct, status: 'draft' };
}

export async function startExperiment(experimentId) {
  await db.run("UPDATE experiments SET status = 'running', started_at = NOW() WHERE id = $1", experimentId);
}

export async function pauseExperiment(experimentId) {
  await db.run("UPDATE experiments SET status = 'paused' WHERE id = $1", experimentId);
}

export async function completeExperiment(experimentId) {
  await db.run("UPDATE experiments SET status = 'completed', ended_at = NOW() WHERE id = $1", experimentId);
}

/**
 * Deterministically assign a user to a variant based on user_id + experiment_id
 */
export async function getAssignment(experimentId, userId) {
  // Check existing assignment
  const existing = await db.get(
    'SELECT variant FROM experiment_assignments WHERE experiment_id = $1 AND user_id = $2',
    experimentId, userId
  );
  if (existing) return existing.variant;

  // Fetch experiment
  const exp = await db.get('SELECT variants, traffic_pct, status FROM experiments WHERE id = $1', experimentId);
  if (!exp || exp.status !== 'running') return null;

  // Deterministic hash → variant selection
  const variants = JSON.parse(exp.variants || '[]');
  if (variants.length === 0) return null;

  // Check traffic percentage
  const hash = crypto.createHash('sha256').update(`${experimentId}:${userId}`).digest();
  const pctBucket = (hash.readUInt16BE(0) % 10000) / 100;
  if (pctBucket > exp.traffic_pct) return null;

  const variantIndex = hash.readUInt16BE(2) % variants.length;
  const variant = variants[variantIndex];

  await db.run(
    'INSERT INTO experiment_assignments (experiment_id, user_id, variant) VALUES ($1,$2,$3) ON CONFLICT(experiment_id, user_id) DO NOTHING',
    experimentId, userId, variant
  );

  return variant;
}

/**
 * Record an exposure/conversion event for an experiment
 */
export async function recordExposure(experimentId, userId, eventName, metadata = {}) {
  const assignment = await db.get(
    'SELECT variant FROM experiment_assignments WHERE experiment_id = $1 AND user_id = $2',
    experimentId, userId
  );
  if (!assignment) return null;

  await db.run(
    'INSERT INTO experiment_exposures (experiment_id, user_id, variant, event_name, metadata) VALUES ($1,$2,$3,$4,$5)',
    experimentId, userId, assignment.variant, eventName, JSON.stringify(metadata)
  );
  return { variant: assignment.variant, eventName };
}

/**
 * Get experiment results with per-variant metrics
 */
export async function getExperimentResults(experimentId) {
  const exp = await db.get('SELECT * FROM experiments WHERE id = $1', experimentId);
  if (!exp) return null;

  const variants = JSON.parse(exp.variants || '[]');

  const assignments = await db.all(`
    SELECT variant, COUNT(*) as count
    FROM experiment_assignments WHERE experiment_id = $1
    GROUP BY variant
  `, experimentId);

  const exposures = await db.all(`
    SELECT variant, event_name, COUNT(*) as count, COUNT(DISTINCT user_id) as unique_users
    FROM experiment_exposures WHERE experiment_id = $1
    GROUP BY variant, event_name
  `, experimentId);

  const results = variants.map(v => {
    const assigned = assignments.find(a => a.variant === v)?.count || 0;
    const events = exposures.filter(e => e.variant === v);
    return { variant: v, assigned, events };
  });

  return { experiment: { id: exp.id, name: exp.name, status: exp.status }, results };
}

// ── Engagement metrics ───────────────────────────────────────────

export async function getEngagementMetrics(period = '7d') {
  const days = parseInt(period) || 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const dau = await db.all(`
      SELECT DATE(timestamp) as day, COUNT(DISTINCT user_id) as users
      FROM page_views WHERE user_id IS NOT NULL AND timestamp >= $1
      GROUP BY DATE(timestamp) ORDER BY day
    `, since);

    const topEvents = await db.all(`
      SELECT event_name, COUNT(*) as count
      FROM events WHERE timestamp >= $1
      GROUP BY event_name ORDER BY count DESC LIMIT 20
    `, since);

    const retention = await db.get(`
      SELECT COUNT(DISTINCT pv2.user_id) as returning_users, COUNT(DISTINCT pv1.user_id) as total_users
      FROM page_views pv1
      LEFT JOIN page_views pv2 ON pv1.user_id = pv2.user_id
        AND DATE(pv2.timestamp) > DATE(pv1.timestamp)
        AND pv2.timestamp >= $1
      WHERE pv1.user_id IS NOT NULL AND pv1.timestamp >= $1
    `, since);

    return {
      dailyActiveUsers: dau,
      topEvents,
      retention: {
        returningUsers: retention?.returning_users || 0,
        totalUsers: retention?.total_users || 0,
        rate: retention?.total_users > 0
          ? Math.round((retention.returning_users / retention.total_users) * 10000) / 100
          : 0
      },
      period: { days, since }
    };
  } catch (err) {
    logger.error(`[Analytics] Engagement metrics error: ${err.message}`);
    return null;
  }
}

export default {
  createFunnel, trackFunnelStep, getFunnelStats,
  createExperiment, startExperiment, pauseExperiment, completeExperiment,
  getAssignment, recordExposure, getExperimentResults,
  getEngagementMetrics
};
