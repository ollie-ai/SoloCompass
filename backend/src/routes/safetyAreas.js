import express from 'express';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { requireFeature, getUserPlan, FEATURES, PLAN_TIERS } from '../middleware/paywall.js';
import { getHospitals, getPoliceStations } from '../services/overpassService.js';
import logger from '../services/logger.js';

const router = express.Router();

const safetyReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please wait.' }
});

const safetyWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many safety reports. Please wait.' }
});

// GET /safety-areas/:destinationId - Get safety areas (Navigator+ only)
router.get('/:destinationId', authenticate, safetyReadLimiter, async (req, res) => {
  try {
    const { destinationId } = req.params;
    const plan = await getUserPlan(req.userId);
    if (plan === PLAN_TIERS.EXPLORER) {
      return res.status(403).json({
        success: false,
        error: { code: 'FEATURE_NOT_INCLUDED', message: 'Area safety mapping requires the Guardian or Navigator plan.', currentPlan: plan }
      });
    }

    const areas = await db.prepare(`
      SELECT id, destination_id, name, description, polygon, safety_level,
             day_safety, night_safety, notes, source, created_at
      FROM safety_areas
      WHERE destination_id = ?
      ORDER BY safety_level ASC, name ASC
    `).all(destinationId);

    res.json({ success: true, data: areas });
  } catch (error) {
    logger.error('[SafetyAreas] Error fetching areas:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch safety areas' });
  }
});

// GET /safety-areas/nearby?lat=X&lng=Y - Get nearby safety reports/areas
router.get('/nearby', authenticate, safetyReadLimiter, async (req, res) => {
  try {
    const { lat, lng, radius = 5 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ success: false, error: 'lat and lng are required' });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const radiusDeg = parseFloat(radius) / 111; // rough degrees per km

    const reports = await db.prepare(`
      SELECT id, report_type, description, severity, status,
             latitude, longitude, address, validated_count, created_at
      FROM safety_reports
      WHERE latitude BETWEEN ? AND ?
        AND longitude BETWEEN ? AND ?
        AND status != 'dismissed'
      ORDER BY created_at DESC
      LIMIT 50
    `).all(
      latNum - radiusDeg, latNum + radiusDeg,
      lngNum - radiusDeg, lngNum + radiusDeg
    );

    res.json({ success: true, data: reports });
  } catch (error) {
    logger.error('[SafetyAreas] Error fetching nearby areas:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch nearby safety data' });
  }
});

// POST /safety-areas/report - Submit a safety report
router.post('/report', authenticate, safetyWriteLimiter, async (req, res) => {
  try {
    const userId = req.userId;
    const { latitude, longitude, address, reportType, description, severity = 'medium' } = req.body;

    if (!reportType) {
      return res.status(400).json({ success: false, error: 'Report type is required' });
    }

    const validTypes = ['theft', 'harassment', 'unsafe_area', 'scam', 'other'];
    if (!validTypes.includes(reportType)) {
      return res.status(400).json({ success: false, error: 'Invalid report type' });
    }

    const result = await db.prepare(`
      INSERT INTO safety_reports (user_id, latitude, longitude, address, report_type, description, severity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, latitude || null, longitude || null, address || null, reportType, description || null, severity);

    const report = await db.prepare(`
      SELECT id, report_type, description, severity, status, latitude, longitude, address, created_at
      FROM safety_reports WHERE id = ?
    `).get(result.lastInsertRowid);

    logger.info(`[SafetyAreas] Safety report submitted by user ${userId}`);

    res.status(201).json({ success: true, data: report });
  } catch (error) {
    logger.error('[SafetyAreas] Error submitting report:', error);
    res.status(500).json({ success: false, error: 'Failed to submit safety report' });
  }
});

// GET /safety-areas/reports - Get recent safety reports
router.get('/reports', authenticate, safetyReadLimiter, async (req, res) => {
  try {
    const { limit = 50, status = 'validated' } = req.query;

    const reports = await db.prepare(`
      SELECT id, report_type, description, severity, status, latitude, longitude,
             address, validated_count, created_at
      FROM safety_reports
      WHERE status = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(status, parseInt(limit));

    res.json({ success: true, data: reports });
  } catch (error) {
    logger.error('[SafetyAreas] Error fetching reports:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch safety reports' });
  }
});

// POST /safety-areas/reports/:id/validate - Thumbs up/down on a safety report
router.post('/reports/:id/validate', authenticate, safetyWriteLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { vote } = req.body; // 'up' | 'down'

    if (!['up', 'down'].includes(vote)) {
      return res.status(400).json({ success: false, error: "vote must be 'up' or 'down'" });
    }

    const report = await db.prepare('SELECT id, validated_count FROM safety_reports WHERE id = ?').get(id);
    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    // Each user can vote once per report — use a soft check via JSON column if it exists,
    // or simply increment/decrement the counter
    const delta = vote === 'up' ? 1 : -1;
    await db.prepare(`
      UPDATE safety_reports
      SET validated_count = MAX(0, COALESCE(validated_count, 0) + ?),
          status = CASE WHEN COALESCE(validated_count, 0) + ? >= 3 THEN 'validated' ELSE status END
      WHERE id = ?
    `).run(delta, delta, id);

    const updated = await db.prepare('SELECT id, validated_count, status FROM safety_reports WHERE id = ?').get(id);
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('[SafetyAreas] Error validating report:', error);
    res.status(500).json({ success: false, error: 'Failed to validate report' });
  }
});

// GET /safety-areas/hospitals/nearby?lat=X&lng=Y&radius=5 - Nearby hospitals via Overpass
router.get('/hospitals/nearby', authenticate, safetyReadLimiter, async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ success: false, error: 'lat and lng are required' });
    }
    const radiusMetres = Math.min(parseFloat(radius) * 1000, 50000);
    const hospitals = await getHospitals(parseFloat(lat), parseFloat(lng), radiusMetres);
    res.json({ success: true, data: hospitals });
  } catch (error) {
    logger.error('[SafetyAreas] Error fetching hospitals:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch nearby hospitals' });
  }
});

// GET /safety-areas/emergency-services/nearby?lat=X&lng=Y&radius=5 - Police + hospitals
router.get('/emergency-services/nearby', authenticate, safetyReadLimiter, async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ success: false, error: 'lat and lng are required' });
    }
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const radiusMetres = Math.min(parseFloat(radius) * 1000, 50000);

    const [hospitals, police] = await Promise.all([
      getHospitals(latNum, lngNum, radiusMetres),
      getPoliceStations(latNum, lngNum, radiusMetres)
    ]);

    res.json({
      success: true,
      data: {
        hospitals,
        police,
        total: hospitals.length + police.length
      }
    });
  } catch (error) {
    logger.error('[SafetyAreas] Error fetching emergency services:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch emergency services' });
  }
});

export default router;
