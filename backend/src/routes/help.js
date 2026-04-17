import express from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import logger from '../services/logger.js';
import helpArticles from '../data/helpArticles.json' with { type: 'json' };

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

const HELP_ARTICLES = [
  {
    id: 'getting-started',
    title: 'Getting Started with SoloCompass',
    category: 'Getting Started',
    excerpt: 'Create your account, set up your profile, and plan your first solo trip.',
    updatedAt: '2026-01-15T00:00:00.000Z',
  },
  {
    id: 'safety-check-in-guide',
    title: 'How Safety Check-Ins Work',
    category: 'Safety',
    excerpt: 'Learn how automatic check-ins, SOS alerts, and emergency contacts protect your journey.',
    updatedAt: '2026-02-12T00:00:00.000Z',
  },
  {
    id: 'billing-and-subscriptions',
    title: 'Billing, Plans, and Subscription Management',
    category: 'Billing',
    excerpt: 'Understand available plans, renewals, invoices, and cancellation options.',
    updatedAt: '2026-03-03T00:00:00.000Z',
  },
];

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
 * GET /api/help/articles
 * Returns help center articles for in-app support center
 */
router.get('/articles', (req, res) => {
  logger.http(`[Help] GET /articles - Request ID: ${req.id}`);
  res.json({ success: true, data: helpArticles, count: helpArticles.length });
});

/**
 * GET /api/help/guides
 * Returns structured getting-started guides
 */
router.get('/guides', (req, res) => {
  const guides = [
    {
      id: 'guide-account-setup',
      title: 'Set up your account',
      category: 'Getting Started',
      duration: '5 min',
      steps: [
        'Create your account and verify email',
        'Complete your Travel DNA profile',
        'Enable notifications for safety updates',
      ],
    },
    {
      id: 'guide-first-trip',
      title: 'Create your first trip',
      category: 'Trip Planning',
      duration: '8 min',
      steps: [
        'Add destination and travel dates',
        'Generate your first AI itinerary',
        'Adjust activities, pace, and notes',
      ],
    },
    {
      id: 'guide-safety-basics',
      title: 'Configure safety essentials',
      category: 'Safety',
      duration: '6 min',
      steps: [
        'Add emergency contacts',
        'Set check-in reminders',
        'Review SOS and escalation settings',
      ],
    },
  ];

  res.json({ success: true, data: guides });
});

/**
 * GET /api/help/tutorials
 * Returns video tutorial metadata
 */
router.get('/tutorials', (req, res) => {
  const tutorials = [
    { id: 'video-trip-setup', title: 'Trip setup walkthrough', duration: '3:24', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    { id: 'video-safety-checkins', title: 'Using safety check-ins', duration: '4:10', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    { id: 'video-itinerary-edits', title: 'Editing itinerary activities', duration: '2:52', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  ];

  res.json({ success: true, data: tutorials });
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
 * POST /api/help/feedback
 * Submit user feedback with rating/text and optional screenshot metadata
 */
router.post('/feedback', [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('message').trim().isLength({ min: 5 }).withMessage('Message must be at least 5 characters'),
  body('email').optional().isEmail().withMessage('Email must be valid'),
  body('screenshotName').optional().isString(),
  body('screenshotDataUrl').optional().isString(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { rating, message, email, screenshotName, screenshotDataUrl } = req.body;
    const metadata = {
      email: email || null,
      screenshotName: screenshotName || null,
      hasScreenshot: Boolean(screenshotDataUrl),
    };

    await db.run(
      `INSERT INTO events (user_id, event_name, event_data, timestamp) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      null,
      'support_feedback_submitted',
      JSON.stringify({ rating, message, ...metadata })
    );

    logger.info(`[Help] Feedback submitted (rating=${rating}, screenshot=${metadata.hasScreenshot})`);
    res.json({ success: true, message: 'Thanks for your feedback.' });
  } catch (error) {
    logger.error(`[Help] Feedback error: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to submit feedback' });
  }
});

export default router;
