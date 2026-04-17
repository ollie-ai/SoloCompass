import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import db from '../db.js';
import logger from '../services/logger.js';

const billingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many billing requests, please try again after 15 minutes' },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
import {
  createCheckoutSession,
  createPortalSession,
  handleStripeWebhook,
  cancelSubscriptionAtPeriodEnd,
  resumeSubscription,
  changePlan,
  listInvoices,
  validateAndApplyPromo,
  getSubscriptionStatus,
} from '../services/stripe.js';

const router = express.Router();

// Apply rate limiting to all billing routes
router.use(billingLimiter);

// ─── Plans definition ────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'explorer',
    name: 'Explorer',
    tier: 'explorer',
    monthlyPrice: 0,
    annualPrice: 0,
    currency: 'GBP',
    priceId: null,
    annualPriceId: null,
    features: [
      '2 active trips',
      '1 AI itinerary/month',
      '5 AI chat messages/month',
      '1 emergency contact',
      'Manual check-ins',
      'SOS button',
      'Advisories',
    ],
    limits: { trips: 2, aiItinerary: 1, aiChat: 5, emergencyContacts: 1 },
  },
  {
    id: 'guardian',
    name: 'Guardian',
    tier: 'guardian',
    monthlyPrice: 4.99,
    annualPrice: 3.99,
    currency: 'GBP',
    get priceId() { return process.env.STRIPE_PRICE_ID_GUARDIAN || null; },
    get annualPriceId() { return process.env.STRIPE_PRICE_ID_GUARDIAN_ANNUAL || null; },
    features: [
      'Unlimited trips',
      'Unlimited AI itineraries',
      'PDF export',
      'Scheduled check-ins',
      'Safe-Return Timer',
      'Safe Haven Locator',
      '3 emergency contacts',
    ],
    limits: { trips: null, aiItinerary: null, aiChat: null, emergencyContacts: 3 },
  },
  {
    id: 'navigator',
    name: 'Navigator',
    tier: 'navigator',
    monthlyPrice: 9.99,
    annualPrice: 7.99,
    currency: 'GBP',
    get priceId() { return process.env.STRIPE_PRICE_ID_NAVIGATOR || null; },
    get annualPriceId() { return process.env.STRIPE_PRICE_ID_NAVIGATOR_ANNUAL || null; },
    features: [
      'Everything in Guardian',
      'Unlimited AI chat',
      'AI safety advice',
      'AI destination guide',
      'Buddy matching & discovery',
      'Quick translator',
      'Unlimited emergency contacts',
    ],
    limits: { trips: null, aiItinerary: null, aiChat: null, emergencyContacts: null },
  },
];

// ─── GET /plans (legacy + v1) ────────────────────────────────────────────────

router.get('/plans', (req, res) => {
  const plans = PLANS.map(p => ({
    id: p.id,
    name: p.name,
    tier: p.tier,
    monthlyPrice: p.monthlyPrice,
    annualPrice: p.annualPrice,
    currency: p.currency,
    priceId: p.priceId,
    annualPriceId: p.annualPriceId,
    features: p.features,
    limits: p.limits,
  }));
  res.json({ success: true, data: plans });
});

// ─── POST /checkout  (legacy path kept + v1 alias) ───────────────────────────

async function handleCheckout(req, res) {
  try {
    const { planId, interval = 'month', trialDays } = req.body;

    if (!planId || planId === 'explorer') {
      return res.status(400).json({ success: false, error: 'Invalid plan. Choose guardian or navigator.' });
    }

    const plan = PLANS.find(p => p.id === planId || p.tier === planId.toLowerCase());
    if (!plan || plan.id === 'explorer') {
      return res.status(400).json({ success: false, error: `Unknown plan: ${planId}` });
    }

    const validInterval = ['month', 'year'].includes(interval) ? interval : 'month';
    const user = await db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const trial = typeof trialDays === 'number' ? trialDays : 7; // default 7-day free trial
    const session = await createCheckoutSession({
      userId: user.id,
      userEmail: user.email,
      planId: plan.id,
      interval: validInterval,
      trialDays: trial,
    });

    res.json({ success: true, url: session.url, sessionId: session.id });
  } catch (error) {
    logger.error('[Billing] Checkout error:', error.message);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
}

// Legacy
router.post('/create-checkout-session', authenticate, handleCheckout);
// v1 alias
router.post('/checkout', authenticate, handleCheckout);

// ─── POST /create-subscription-intent (used by /checkout page's Elements flow) ─

router.post('/create-subscription-intent', authenticate, async (req, res) => {
  try {
    const { planId, interval = 'month' } = req.body;
    if (!planId) return res.status(400).json({ success: false, error: 'planId required' });

    const plan = PLANS.find(p => p.id === planId || p.tier === planId.toLowerCase());
    if (!plan || plan.id === 'explorer') {
      return res.status(400).json({ success: false, error: `Unknown plan: ${planId}` });
    }

    const user = await db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const validInterval = ['month', 'year'].includes(interval) ? interval : 'month';

    const session = await createCheckoutSession({
      userId: user.id,
      userEmail: user.email,
      planId: plan.id,
      interval: validInterval,
      trialDays: 7,
    });

    // Return clientSecret for Elements flow OR url for redirect flow
    res.json({ success: true, url: session.url, sessionId: session.id, clientSecret: session.client_secret || null });
  } catch (error) {
    logger.error('[Billing] create-subscription-intent error:', error.message);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// ─── POST /portal  ───────────────────────────────────────────────────────────

async function handlePortal(req, res) {
  try {
    const session = await createPortalSession({ userId: req.userId });
    res.json({ success: true, url: session.url });
  } catch (error) {
    logger.error('[Billing] Portal error:', error.message);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
}

router.post('/portal', authenticate, handlePortal);

// ─── GET /subscription-status (legacy) + GET /status (v1) ───────────────────

async function handleSubscriptionStatus(req, res) {
  try {
    const status = await getSubscriptionStatus({ userId: req.userId });
    res.json({ success: true, data: status });
  } catch (error) {
    logger.error('[Billing] Status error:', error.message);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
}

router.get('/subscription-status', authenticate, handleSubscriptionStatus);
router.get('/status', authenticate, handleSubscriptionStatus);

// ─── POST /cancel-subscription (legacy) + POST /cancel (v1) ─────────────────

async function handleCancel(req, res) {
  try {
    const result = await cancelSubscriptionAtPeriodEnd({ userId: req.userId });
    res.json({
      success: true,
      message: 'Subscription will be cancelled at the end of the billing period.',
      cancelAtPeriodEnd: true,
      periodEnd: result.current_period_end
        ? new Date(result.current_period_end * 1000).toISOString()
        : null,
    });
  } catch (error) {
    logger.error('[Billing] Cancel error:', error.message);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
}

router.post('/cancel-subscription', authenticate, handleCancel);
router.post('/cancel', authenticate, handleCancel);

// ─── POST /resume ────────────────────────────────────────────────────────────

router.post('/resume', authenticate, async (req, res) => {
  try {
    await resumeSubscription({ userId: req.userId });
    res.json({ success: true, message: 'Subscription resumption scheduled.' });
  } catch (error) {
    logger.error('[Billing] Resume error:', error.message);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// ─── POST /change-plan ───────────────────────────────────────────────────────

router.post('/change-plan', authenticate, async (req, res) => {
  try {
    const { planId, interval = 'month', proration } = req.body;
    if (!planId) return res.status(400).json({ success: false, error: 'planId required' });

    const plan = PLANS.find(p => p.id === planId || p.tier === planId.toLowerCase());
    if (!plan) return res.status(400).json({ success: false, error: `Unknown plan: ${planId}` });

    const result = await changePlan({
      userId: req.userId,
      newPlanId: plan.id,
      interval: ['month', 'year'].includes(interval) ? interval : 'month',
      proration: proration || 'create_prorations',
    });

    res.json({ success: true, newTier: result.newTier, message: `Plan changed to ${result.newTier}` });
  } catch (error) {
    logger.error('[Billing] Change plan error:', error.message);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// ─── GET /invoices ───────────────────────────────────────────────────────────

router.get('/invoices', authenticate, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const invoices = await listInvoices({ userId: req.userId, limit });
    res.json({ success: true, data: invoices });
  } catch (error) {
    logger.error('[Billing] Invoices error:', error.message);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// ─── POST /promo ─────────────────────────────────────────────────────────────

router.post('/promo', authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, error: 'Promo code required' });
    const result = await validateAndApplyPromo({ userId: req.userId, code: code.trim().toUpperCase() });
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('[Billing] Promo error:', error.message);
    res.status(400).json({ success: false, error: { message: error.message } });
  }
});

// ─── GET /usage ───────────────────────────────────────────────────────────────

router.get('/usage', authenticate, async (req, res) => {
  try {
    const user = await db.prepare(
      'SELECT subscription_tier, is_premium FROM users WHERE id = ?'
    ).get(req.userId);

    const tier = user?.subscription_tier || 'explorer';
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Fetch usage counters from ai_usage (existing) and emergency_contacts
    const [aiUsage, contactsCount] = await Promise.all([
      db.prepare(
        'SELECT type, count FROM ai_usage WHERE user_id = ? AND month = ?'
      ).all(req.userId, currentMonth),
      db.prepare(
        'SELECT COUNT(*) as count FROM emergency_contacts WHERE user_id = ?'
      ).get(req.userId),
    ]);

    const aiChatCount = aiUsage.find(u => u.type === 'chat')?.count || 0;
    const aiItineraryCount = aiUsage.find(u => u.type === 'itinerary')?.count || 0;

    // Plan limits per tier
    const limits = {
      explorer: { aiChat: 5, aiItinerary: 1, emergencyContacts: 1 },
      guardian: { aiChat: null, aiItinerary: null, emergencyContacts: 3 },
      navigator: { aiChat: null, aiItinerary: null, emergencyContacts: null },
    };
    const tierLimits = limits[tier] || limits.explorer;

    res.json({
      success: true,
      data: {
        tier,
        period: currentMonth,
        usage: {
          aiChat: { used: aiChatCount, limit: tierLimits.aiChat },
          aiItinerary: { used: aiItineraryCount, limit: tierLimits.aiItinerary },
          emergencyContacts: { used: contactsCount?.count || 0, limit: tierLimits.emergencyContacts },
        },
      },
    });
  } catch (error) {
    logger.error('[Billing] Usage error:', error.message);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// ─── POST /webhook ───────────────────────────────────────────────────────────
// This route must NOT parse JSON — it needs raw body for Stripe signature.
// The route is registered in index.js with express.raw() middleware.

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).json({ error: 'Missing Stripe-Signature header' });

  try {
    const result = await handleStripeWebhook(req.body, sig);
    if (result.alreadyHandled) {
      return res.json({ received: true, status: 'already_processed' });
    }
    res.json({ received: true, status: 'processed', eventId: result.eventId });
  } catch (error) {
    logger.error('[Billing] Webhook error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

export default router;
