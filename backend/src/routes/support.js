/**
 * support.js — Support ticket CRUD with search/filtering and email notifications.
 *
 * Routes (all auth-protected):
 *  GET    /api/support/tickets              list (filters: status, category, date_from, date_to, q)
 *  POST   /api/support/tickets              create new ticket
 *  GET    /api/support/tickets/:id          get ticket with replies
 *  POST   /api/support/tickets/:id/replies  add reply  → notifies user
 *  PATCH  /api/support/tickets/:id/status   update status → notifies user
 */
import express from 'express';
import rateLimit from 'express-rate-limit';
import { body, query, validationResult } from 'express-validator';
import { requireAuth, requireSupportAgent } from '../middleware/auth.js';
import { sanitizeAll } from '../middleware/validate.js';
import db from '../db.js';
import logger from '../services/logger.js';
import { sendTemplateEmail } from '../services/resendClient.js';

const router = express.Router();

// Rate limiter for ticket creation and replies to prevent abuse
const ticketRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later' },
});

const VALID_STATUSES = ['open', 'in_progress', 'waiting_on_user', 'resolved', 'closed'];
const VALID_CATEGORIES = [
  'account', 'billing', 'trip', 'safety', 'technical', 'feature_request', 'other'
];

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

/** Ensure the support_tickets and support_ticket_replies tables exist. */
async function ensureSchema() {
  await db.run(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      subject     TEXT    NOT NULL,
      description TEXT    NOT NULL,
      category    TEXT    NOT NULL DEFAULT 'other',
      status      TEXT    NOT NULL DEFAULT 'open',
      priority    TEXT    NOT NULL DEFAULT 'normal',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `).catch((e) => logger.warn(`[Support] support_tickets schema: ${e.message}`));

  await db.run(`
    CREATE TABLE IF NOT EXISTS support_ticket_replies (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id   INTEGER NOT NULL,
      author_id   INTEGER NOT NULL,
      author_role TEXT    NOT NULL DEFAULT 'user',
      content     TEXT    NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `).catch((e) => logger.warn(`[Support] support_ticket_replies schema: ${e.message}`));
}

ensureSchema();

const frontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';
const year = () => new Date().getFullYear().toString();

async function notifyTicketReply(ticket, reply, replierName) {
  try {
    const userRow = await db.prepare('SELECT email, name FROM users WHERE id = ?').get(ticket.user_id);
    if (!userRow?.email) return;
    await sendTemplateEmail(userRow.email, 'support_ticket_reply', {
      name: userRow.name || 'Traveller',
      ticketId: String(ticket.id),
      ticketSubject: ticket.subject,
      replierName,
      replyContent: reply.content,
      ticketUrl: `${frontendUrl()}/support/tickets/${ticket.id}`,
      year: year(),
    });
  } catch (err) {
    logger.warn(`[Support] Reply notification failed: ${err.message}`);
  }
}

async function notifyStatusChange(ticket, oldStatus, newStatus) {
  try {
    const userRow = await db.prepare('SELECT email, name FROM users WHERE id = ?').get(ticket.user_id);
    if (!userRow?.email) return;
    await sendTemplateEmail(userRow.email, 'support_ticket_status_change', {
      name: userRow.name || 'Traveller',
      ticketId: String(ticket.id),
      ticketSubject: ticket.subject,
      oldStatus,
      newStatus,
      ticketUrl: `${frontendUrl()}/support/tickets/${ticket.id}`,
      year: year(),
    });
  } catch (err) {
    logger.warn(`[Support] Status-change notification failed: ${err.message}`);
  }
}

/**
 * GET /api/support/tickets
 * Query params: status, category, date_from (ISO), date_to (ISO), q (full-text)
 */
router.get(
  '/tickets',
  ticketRateLimiter,
  requireAuth,
  [
    query('status').optional().isIn(VALID_STATUSES),
    query('category').optional().isIn(VALID_CATEGORIES),
    query('date_from').optional().isISO8601(),
    query('date_to').optional().isISO8601(),
    query('q').optional().isString().trim(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { status, category, date_from, date_to, q, limit = 50, offset = 0 } = req.query;
      const isAgent = req.userRole === 'admin' || req.userRole === 'support_agent';

      let sql = `
        SELECT t.*, u.name as user_name, u.email as user_email
        FROM support_tickets t
        LEFT JOIN users u ON t.user_id = u.id
        WHERE 1=1
      `;
      const params = [];

      // Regular users can only see their own tickets
      if (!isAgent) {
        sql += ' AND t.user_id = ?';
        params.push(req.userId);
      }

      if (status) { sql += ' AND t.status = ?'; params.push(status); }
      if (category) { sql += ' AND t.category = ?'; params.push(category); }
      if (date_from) { sql += ' AND t.created_at >= ?'; params.push(date_from); }
      if (date_to) { sql += ' AND t.created_at <= ?'; params.push(date_to); }
      if (q) {
        sql += ' AND (t.subject LIKE ? OR t.description LIKE ?)';
        params.push(`%${q}%`, `%${q}%`);
      }

      const countSql = sql.replace(
        'SELECT t.*, u.name as user_name, u.email as user_email',
        'SELECT COUNT(*) as count'
      );
      const [rows, countRow] = await Promise.all([
        db.all(sql + ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?', ...params, limit, offset),
        db.get(countSql, ...params),
      ]);

      res.json({ success: true, data: rows, total: countRow?.count ?? 0 });
    } catch (error) {
      logger.error(`[Support] List tickets failed: ${error.message}`);
      res.status(500).json({ success: false, error: 'Failed to list tickets' });
    }
  }
);

/**
 * POST /api/support/tickets
 * Create a new support ticket.
 */
router.post(
  '/tickets',
  ticketRateLimiter,
  requireAuth,
  sanitizeAll(['subject', 'description']),
  [
    body('subject').notEmpty().trim().isLength({ max: 200 }),
    body('description').notEmpty().trim().isLength({ max: 5000 }),
    body('category').optional().isIn(VALID_CATEGORIES),
    body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { subject, description, category = 'other', priority = 'normal' } = req.body;
      const result = await db.run(
        `INSERT INTO support_tickets (user_id, subject, description, category, priority)
         VALUES (?, ?, ?, ?, ?)`,
        req.userId, subject, description, category, priority
      );
      const ticket = await db.get('SELECT * FROM support_tickets WHERE id = ?', result.lastInsertRowid);
      res.status(201).json({ success: true, data: ticket });
    } catch (error) {
      logger.error(`[Support] Create ticket failed: ${error.message}`);
      res.status(500).json({ success: false, error: 'Failed to create ticket' });
    }
  }
);

/**
 * GET /api/support/tickets/:id
 */
router.get('/tickets/:id', ticketRateLimiter, requireAuth, async (req, res) => {
  try {
    const ticket = await db.get(
      'SELECT t.*, u.name as user_name FROM support_tickets t LEFT JOIN users u ON t.user_id = u.id WHERE t.id = ?',
      req.params.id
    );
    if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });

    const isAgent = req.userRole === 'admin' || req.userRole === 'support_agent';
    if (!isAgent && ticket.user_id !== req.userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const replies = await db.all(
      `SELECT r.*, u.name as author_name
       FROM support_ticket_replies r
       LEFT JOIN users u ON r.author_id = u.id
       WHERE r.ticket_id = ?
       ORDER BY r.created_at ASC`,
      ticket.id
    );

    res.json({ success: true, data: { ...ticket, replies } });
  } catch (error) {
    logger.error(`[Support] Get ticket failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to get ticket' });
  }
});

/**
 * POST /api/support/tickets/:id/replies
 * Add a reply; triggers email notification to the ticket owner.
 */
router.post(
  '/tickets/:id/replies',
  ticketRateLimiter,
  requireAuth,
  sanitizeAll(['content']),
  [body('content').notEmpty().trim().isLength({ max: 5000 })],
  handleValidation,
  async (req, res) => {
    try {
      const ticket = await db.get('SELECT * FROM support_tickets WHERE id = ?', req.params.id);
      if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });

      const isAgent = req.userRole === 'admin' || req.userRole === 'support_agent';
      if (!isAgent && ticket.user_id !== req.userId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      const authorRole = isAgent ? 'agent' : 'user';
      const result = await db.run(
        `INSERT INTO support_ticket_replies (ticket_id, author_id, author_role, content)
         VALUES (?, ?, ?, ?)`,
        ticket.id, req.userId, authorRole, req.body.content
      );

      // Move ticket to in_progress if it was open and an agent replied
      if (isAgent && ticket.status === 'open') {
        await db.run(
          `UPDATE support_tickets SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?`,
          ticket.id
        );
      }

      await db.run(`UPDATE support_tickets SET updated_at = datetime('now') WHERE id = ?`, ticket.id);

      const reply = await db.get('SELECT * FROM support_ticket_replies WHERE id = ?', result.lastInsertRowid);

      // Notify ticket owner if the reply was from an agent (not themselves)
      if (isAgent) {
        const replier = await db.get('SELECT name FROM users WHERE id = ?', req.userId);
        await notifyTicketReply(ticket, reply, replier?.name || 'SoloCompass Support');
      }

      res.status(201).json({ success: true, data: reply });
    } catch (error) {
      logger.error(`[Support] Add reply failed: ${error.message}`);
      res.status(500).json({ success: false, error: 'Failed to add reply' });
    }
  }
);

/**
 * PATCH /api/support/tickets/:id/status
 * Update ticket status; triggers email notification to ticket owner.
 */
router.patch(
  '/tickets/:id/status',
  ticketRateLimiter,
  requireSupportAgent,
  [body('status').notEmpty().isIn(VALID_STATUSES)],
  handleValidation,
  async (req, res) => {
    try {
      const ticket = await db.get('SELECT * FROM support_tickets WHERE id = ?', req.params.id);
      if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });

      const oldStatus = ticket.status;
      const newStatus = req.body.status;

      if (oldStatus === newStatus) {
        return res.json({ success: true, data: ticket, message: 'Status unchanged' });
      }

      await db.run(
        `UPDATE support_tickets SET status = ?, updated_at = datetime('now') WHERE id = ?`,
        newStatus, ticket.id
      );

      await notifyStatusChange({ ...ticket }, oldStatus, newStatus);

      const updated = await db.get('SELECT * FROM support_tickets WHERE id = ?', ticket.id);
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error(`[Support] Update ticket status failed: ${error.message}`);
      res.status(500).json({ success: false, error: 'Failed to update ticket status' });
    }
  }
);

export default router;
