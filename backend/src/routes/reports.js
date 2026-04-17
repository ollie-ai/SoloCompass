import express from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import logger from '../services/logger.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many reports submitted. Please try again later.' }
});

const VALID_ENTITY_TYPES = ['user', 'trip', 'destination', 'review', 'content'];
const VALID_REASONS = ['spam', 'harassment', 'inappropriate_content', 'false_information', 'safety_concern', 'copyright', 'other'];

/**
 * POST /api/reports
 * Submit a content / safety report
 */
router.post('/', reportLimiter, requireAuth, [
  body('reportedEntityType').isIn(VALID_ENTITY_TYPES).withMessage('Invalid entity type'),
  body('entityId').isInt({ min: 1 }).withMessage('Entity ID must be a positive integer'),
  body('reason').isIn(VALID_REASONS).withMessage('Invalid reason'),
  body('details').optional().isLength({ max: 2000 }).withMessage('Details must be under 2000 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { reportedEntityType, entityId, reason, details = '', metadata = {} } = req.body;

    // Check for duplicate report from same user
    const existing = await db.get(
      'SELECT id FROM reports WHERE reporter_id = ? AND reported_entity_type = ? AND entity_id = ? AND status = ?',
      req.userId, reportedEntityType, entityId, 'pending'
    );

    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_REPORT', message: 'You have already submitted a report for this item.' }
      });
    }

    const result = await db.run(
      `INSERT INTO reports (reporter_id, reported_entity_type, entity_id, reason, details, metadata)
       VALUES (?, ?, ?, ?, ?, ?::jsonb)`,
      req.userId, reportedEntityType, entityId, reason, details, JSON.stringify(metadata)
    );

    await db.run(
      'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
      req.userId,
      'content_reported',
      JSON.stringify({ entityType: reportedEntityType, entityId, reason })
    );

    logger.info(`[Reports] User ${req.userId} reported ${reportedEntityType}#${entityId}: ${reason}`);

    res.status(201).json({
      success: true,
      data: { reportId: result.lastInsertRowid, message: 'Report submitted. Our team will review it within 24 hours.' }
    });
  } catch (error) {
    logger.error(`[Reports] Failed to create report: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to submit report' });
  }
});

/**
 * GET /api/reports/reasons
 * List valid report reasons
 */
router.get('/reasons', (req, res) => {
  res.json({
    success: true,
    data: {
      entityTypes: VALID_ENTITY_TYPES,
      reasons: VALID_REASONS.map((r) => ({
        value: r,
        label: r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      }))
    }
  });
});

export default router;
