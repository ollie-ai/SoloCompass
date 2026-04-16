import express from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import logger from '../services/logger.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
const supportTicketLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false
});
const requireSupportLimiter = supportTicketLimiter;
const featureRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const emergencyKeywords = ['sos', 'emergency', 'urgent', 'unsafe', 'danger'];

const getEmergencyFlag = ({ subject = '', message = '', category = '' }) => {
  if (String(category).toLowerCase() === 'sos') return true;
  const text = `${subject} ${message}`.toLowerCase();
  return emergencyKeywords.some((keyword) => text.includes(keyword));
};

/**
 * GET /api/help/faqs
 * Returns FAQ data for the Help Center
 */
router.get('/faqs', (req, res) => {
  logger.http(`[Help] GET /faqs - Request ID: ${req.id}`);
  
  const faqs = [
    {
      category: 'Account',
      icon: 'User',
      questions: [
        {
          q: "How do I reset my password?",
          a: "Click 'Forgot Password' on the login page and enter your email. We'll send you a secure reset link within a few minutes."
        },
        {
          q: "How do I verify my email?",
          a: "After registration, check your inbox for a verification email. Click the link inside to activate your account. If you don't see it, check your spam folder."
        },
        {
          q: "Can I change my email address?",
          a: "Currently, email addresses cannot be changed once registered. Please create a new account with your preferred email."
        }
      ]
    },
    {
      category: 'Security',
      icon: 'Lock',
      questions: [
        {
          q: "Is my data secure?",
          a: "Yes. We use industry-standard encryption, secure cookies, and never store your password in plain text. Your data is protected with JWT authentication."
        },
        {
          q: "How do I delete my account?",
          a: "Go to Settings > Privacy > Delete Account. This removes all your data within 30 days. Your reviews and trip history will be anonymized."
        }
      ]
    },
    {
      category: 'Billing',
      icon: 'CreditCard',
      questions: [
        {
          q: "How do I cancel my subscription?",
          a: "Go to Settings > Subscription > Cancel Plan. Your premium features continue until the end of your billing period."
        },
        {
          q: "Do you offer refunds?",
          a: "Refunds are available within 7 days of purchase if you're not satisfied. Contact support with your order details."
        }
      ]
    },
    {
      category: 'Trips & Safety',
      icon: 'Shield',
      questions: [
        {
          q: "How accurate are the AI itineraries?",
          a: "AI-generated itineraries are based on available data but may not reflect real-time conditions. Always verify opening hours, prices, and safety information directly with providers."
        },
        {
          q: "What is the FCDO safety data?",
          a: "We integrate UK Foreign Office travel advisories. This is informational only - always check official government travel advice before and during trips."
        }
      ]
    }
  ];

  res.json({
    success: true,
    data: faqs
  });
});

/**
 * GET /api/help/contact
 * Returns contact information
 */
router.get('/contact', (req, res) => {
  logger.http(`[Help] GET /contact - Request ID: ${req.id}`);
  
  res.json({
    success: true,
    data: {
      email: 'support@solocompass.co.uk',
      phone: '+44 (0) 20 7946 0958',
      address: 'London, United Kingdom',
      supportHours: 'Mon-Fri, 9:00-17:00 GMT',
      emergencyEmail: 'emergency@solocompass.co.uk'
    }
  });
});

/**
 * POST /api/help/contact
 * Submit a contact form message
 */
router.post('/contact', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('subject').trim().notEmpty().withMessage('Subject is required'),
  body('message').trim().isLength({ min: 10 }).withMessage('Message must be at least 10 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, subject, message } = req.body;

    logger.info(`[Help] Contact form submission from ${name} (${email}): ${subject}`);

    if (process.env.RESEND_API_KEY) {
      try {
        const resend = await import('resend');
        const resendClient = new resend.Resend(process.env.RESEND_API_KEY);
        await resendClient.emails.send({
          from: 'SoloCompass <onboarding@resend.dev>',
          to: ['support@solocompass.co.uk'],
          subject: `Contact Form: ${subject}`,
          html: `
            <h2>New Contact Form Submission</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Message:</strong></p>
            <p>${message.replace(/\n/g, '<br>')}</p>
          `,
        });
      } catch (emailError) {
        logger.error(`[Help] Failed to send contact email: ${emailError.message}`);
      }
    }

    res.json({ success: true, message: 'Message received. We will respond within 24 hours.' });
  } catch (error) {
    logger.error(`[Help] Contact form error: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to submit contact form' });
  }
});

/**
 * POST /api/help/tickets
 * Create support ticket (emergency tickets are auto-prioritized)
 */
router.post('/tickets', supportTicketLimiter, requireAuth, [
  body('subject').trim().isLength({ min: 3 }).withMessage('Subject is required'),
  body('message').trim().isLength({ min: 10 }).withMessage('Message must be at least 10 characters'),
  body('category').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { subject, message, category = 'general', metadata = {} } = req.body;
    const isEmergency = getEmergencyFlag({ subject, message, category });
    const priority = isEmergency ? 'urgent' : 'normal';
    const status = isEmergency ? 'escalated' : 'open';
    const slaDueAt = new Date(Date.now() + (isEmergency ? 15 : 24 * 60) * 60 * 1000).toISOString();

    const ticketResult = await db.run(
      `INSERT INTO support_tickets (user_id, subject, message, category, status, priority, is_emergency, sla_due_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)`,
      req.userId,
      subject,
      message,
      category,
      status,
      priority,
      isEmergency,
      slaDueAt,
      JSON.stringify(metadata || {})
    );

    const ticket = await db.get('SELECT * FROM support_tickets WHERE id = ?', ticketResult.lastInsertRowid);
    await db.run(
      'INSERT INTO events (user_id, event_name, event_data) VALUES (?, ?, ?)',
      req.userId,
      isEmergency ? 'support_ticket_sos_escalated' : 'support_ticket_created',
      JSON.stringify({ ticketId: ticket?.id, priority, category, status })
    );

    res.status(201).json({
      success: true,
      data: {
        ticket,
        emergencyFastTrack: isEmergency
      }
    });
  } catch (error) {
    logger.error(`[Help] Failed to create support ticket: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to create support ticket' });
  }
});

/**
 * GET /api/help/tickets
 * List current user's tickets
 */
router.get('/tickets', supportTicketLimiter, requireAuth, async (req, res) => {
  try {
    const tickets = await db.all(
      `SELECT id, subject, category, status, priority, is_emergency, sla_due_at, created_at, updated_at, resolved_at
       FROM support_tickets WHERE user_id = ?
       ORDER BY is_emergency DESC, created_at DESC`,
      req.userId
    );
    res.json({ success: true, data: { tickets: tickets || [] } });
  } catch (error) {
    logger.error(`[Help] Failed to list tickets: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to fetch support tickets' });
  }
});

/**
 * POST /api/help/tickets/:id/rate
 * Rate support experience after ticket resolved
 */
router.post('/tickets/:id/rate', requireSupportLimiter, requireAuth, [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  body('comment').optional().isLength({ max: 500 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { rating, comment = '' } = req.body;

    const ticket = await db.get('SELECT id, user_id, status FROM support_tickets WHERE id = ?', id);
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }
    if (ticket.user_id !== req.userId) {
      return res.status(403).json({ success: false, error: 'You can only rate your own tickets' });
    }

    const existing = await db.get('SELECT id FROM ticket_ratings WHERE ticket_id = ?', id);
    if (existing) {
      return res.status(409).json({ success: false, error: 'You have already rated this ticket' });
    }

    await db.run(
      'INSERT INTO ticket_ratings (ticket_id, user_id, rating, comment) VALUES (?, ?, ?, ?)',
      id, req.userId, rating, comment
    );

    res.json({ success: true, data: { message: 'Thank you for your feedback!' } });
  } catch (error) {
    logger.error(`[Help] Failed to rate ticket: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to submit rating' });
  }
});

/**
 * GET /api/help/changelog
 * Public changelog entries
 */
router.get('/changelog', async (req, res) => {
  try {
    const entries = await db.all(
      `SELECT id, version, title, description, type, published_at, created_at
       FROM changelog_entries WHERE published = true
       ORDER BY published_at DESC LIMIT 50`
    );

    if (!entries || entries.length === 0) {
      return res.json({
        success: true,
        data: {
          entries: [
            { id: 1, version: '2.0.0', title: 'Emergency support priority lane', description: 'SOS tickets are now automatically fast-tracked to urgent status.', type: 'feature', published_at: new Date().toISOString() },
            { id: 2, version: '1.9.0', title: 'GDPR consent management', description: 'Detailed consent tracking for data processing and cookie preferences.', type: 'feature', published_at: new Date(Date.now() - 7 * 86400000).toISOString() },
            { id: 3, version: '1.8.0', title: 'Destination content blocks', description: 'AI-generated safety briefs, solo suitability scores and arrival checklists.', type: 'feature', published_at: new Date(Date.now() - 30 * 86400000).toISOString() },
          ]
        }
      });
    }

    res.json({ success: true, data: { entries } });
  } catch (error) {
    logger.error(`[Help] Failed to get changelog: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to get changelog' });
  }
});

/**
 * GET /api/help/articles
 * In-app help centre articles
 */
router.get('/articles', async (req, res) => {
  try {
    const articles = await db.all(
      `SELECT id, title, category, display_order FROM faq_articles WHERE active = true ORDER BY category, display_order`
    );

    const defaultArticles = [
      { id: 1, title: 'Getting started with SoloCompass', category: 'getting_started', display_order: 1 },
      { id: 2, title: 'Setting up safety check-ins', category: 'safety', display_order: 1 },
      { id: 3, title: 'Managing your subscription', category: 'billing', display_order: 1 },
    ];

    res.json({ success: true, data: { articles: articles?.length > 0 ? articles : defaultArticles } });
  } catch (error) {
    logger.error(`[Help] Failed to get articles: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to get help articles' });
  }
});

/**
 * POST /api/help/feature-requests
 * Submit a feature request (P3)
 */
router.post('/feature-requests', featureRequestLimiter, requireAuth, [
  body('title').trim().isLength({ min: 5, max: 200 }).withMessage('Title must be 5-200 characters'),
  body('description').optional().isLength({ max: 2000 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { title, description = '' } = req.body;
    const result = await db.run(
      'INSERT INTO feature_requests (user_id, title, description) VALUES (?, ?, ?)',
      req.userId, title, description
    );

    res.status(201).json({
      success: true,
      data: { id: result.lastInsertRowid, message: 'Feature request submitted. Thanks for the feedback!' }
    });
  } catch (error) {
    logger.error(`[Help] Failed to submit feature request: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to submit feature request' });
  }
});

/**
 * POST /api/help/waitlist
 * Join a waitlist for an upcoming feature (P3)
 */
router.post('/waitlist', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('feature').optional().isLength({ max: 100 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, feature = null } = req.body;
    const userId = req.userId || null;

    try {
      await db.run(
        'INSERT INTO waitlist_entries (email, feature, user_id) VALUES (?, ?, ?)',
        email, feature, userId
      );
    } catch (insertError) {
      if (insertError.message?.includes('unique') || insertError.message?.includes('duplicate')) {
        return res.json({ success: true, data: { message: "You're already on the waitlist!" } });
      }
      throw insertError;
    }

    res.status(201).json({ success: true, data: { message: "You're on the waitlist! We'll notify you when this feature launches." } });
  } catch (error) {
    logger.error(`[Help] Failed to join waitlist: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to join waitlist' });
  }
});

export default router;
