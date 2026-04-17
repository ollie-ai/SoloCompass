import express from 'express';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { requireAuth } from '../middleware/auth.js';
import db from '../db.js';
import logger from '../services/logger.js';
import { handleBuddyReportCreated } from '../services/moderation.js';

const router = express.Router();

const buddyConnectionsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  keyGenerator: (req) => String(req.userId || req.ip),
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many buddy safety actions. Please try again shortly.' }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limit BEFORE authentication to guard against DoS on auth checks
router.use(buddyConnectionsLimiter);
router.use(requireAuth);

const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => String(req.userId || req.ip),
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many reports submitted. Please try again later.' }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors.array() }
    });
  }
  return next();
};

async function getConnectionForUser(connectionId, userId) {
  return db.prepare(`
    SELECT id, sender_id, receiver_id, status, archived_at
    FROM buddy_requests
    WHERE id = ?
      AND (sender_id = ? OR receiver_id = ?)
    LIMIT 1
  `).get(connectionId, userId, userId);
}

router.post(
  '/:id/report',
  reportLimiter,
  [
    body('reason').isString().trim().isLength({ min: 3, max: 500 }).withMessage('Reason must be between 3 and 500 characters'),
    body('details').optional().isString().trim().isLength({ max: 2000 }).withMessage('Details must not exceed 2000 characters'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const connectionId = parseInt(req.params.id, 10);
      const reporterId = req.userId;

      if (Number.isNaN(connectionId)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid connection id' }
        });
      }

      const connection = await getConnectionForUser(connectionId, reporterId);
      if (!connection || connection.archived_at || connection.status !== 'accepted') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Connection not found' }
        });
      }

      const reportedId = connection.sender_id === reporterId ? connection.receiver_id : connection.sender_id;
      const { reason, details } = req.body;

      const result = await db.prepare(`
        INSERT INTO buddy_reports (reporter_id, reported_id, reason, details)
        VALUES (?, ?, ?, ?)
      `).run(reporterId, reportedId, reason.trim(), details?.trim() || null);

      await handleBuddyReportCreated({ reportId: result.lastInsertRowid, reportedId });

      return res.status(201).json({
        success: true,
        data: { reportId: result.lastInsertRowid }
      });
    } catch (error) {
      logger.error(`[BuddyConnections] Failed to report user: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to submit report' }
      });
    }
  }
);

router.post('/:id/block', async (req, res) => {
  try {
    const connectionId = parseInt(req.params.id, 10);
    const blockerId = req.userId;

    if (Number.isNaN(connectionId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid connection id' }
      });
    }

    const connection = await getConnectionForUser(connectionId, blockerId);
    if (!connection || connection.archived_at) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Connection not found' }
      });
    }

    const blockedId = connection.sender_id === blockerId ? connection.receiver_id : connection.sender_id;

    await db.prepare(`
      INSERT INTO buddy_blocks (blocker_id, blocked_id, reason)
      VALUES (?, ?, 'Blocked via buddy connection')
      ON CONFLICT (blocker_id, blocked_id) DO NOTHING
    `).run(blockerId, blockedId);

    await db.prepare(`
      UPDATE buddy_requests
      SET status = 'blocked', archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(connectionId);

    return res.json({ success: true, data: { blockedUserId: blockedId } });
  } catch (error) {
    logger.error(`[BuddyConnections] Failed to block connection: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to block user' }
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const connectionId = parseInt(req.params.id, 10);
    const userId = req.userId;

    if (Number.isNaN(connectionId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid connection id' }
      });
    }

    const connection = await getConnectionForUser(connectionId, userId);
    if (!connection || connection.archived_at) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Connection not found' }
      });
    }

    await db.prepare(`
      UPDATE buddy_requests
      SET archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(connectionId);

    return res.json({ success: true, data: { archived: true } });
  } catch (error) {
    logger.error(`[BuddyConnections] Failed to archive connection: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to remove connection' }
    });
  }
});

export default router;
