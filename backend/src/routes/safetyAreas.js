import express from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';
import logger from '../services/logger.js';

const router = express.Router();

// GET /safety-areas/:destinationId - Get safety areas for a destination
router.get('/:destinationId', authenticate, async (req, res) => {
  try {
    const { destinationId } = req.params;

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
router.get('/nearby', authenticate, async (req, res) => {
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
router.post('/report', authenticate, async (req, res) => {
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
router.get('/reports', authenticate, async (req, res) => {
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

export default router;
