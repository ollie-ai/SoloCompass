import express from 'express';
import { body, validationResult } from 'express-validator';
import db from '../db.js';
import logger from '../services/logger.js';

const router = express.Router();

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
 * Returns in-app help centre article summaries
 */
router.get('/articles', (req, res) => {
  logger.http(`[Help] GET /articles - Request ID: ${req.id}`);
  res.json({
    success: true,
    data: HELP_ARTICLES,
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

export default router;
