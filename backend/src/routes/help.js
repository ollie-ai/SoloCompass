import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../db.js';
import logger from '../services/logger.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

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
router.post('/tickets', requireAuth, [
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
router.get('/tickets', requireAuth, async (req, res) => {
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

export default router;
