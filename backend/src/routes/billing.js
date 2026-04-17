import express from 'express'; 
import rateLimit from 'express-rate-limit';
import { 
    stripe,
    createCheckoutSession, 
    handleStripeWebhook, 
    cancelSubscription, 
    getSubscriptionStatus,
    PLAN_PRICE_IDS 
} from '../services/stripe.js';
import { requireAuth } from '../middleware/auth.js';
import { createNotification, getNotificationPreferences } from '../services/notificationService.js';
import { getChannelsForType, CHANNEL } from '../services/notificationRegistry.js';
import * as pushService from '../services/pushService.js';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import logger from '../services/logger.js';
import { startFreeTrial, changePlan, getUsage, checkTrialExpiry } from '../services/billingService.js';

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

const billingWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many billing requests, please try again later' },
});

// Public endpoint - no auth required
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

    await dispatchNotification(userId, 'subscription_cancelled', {
      title: 'Subscription Cancelled',
      message: `Your ${currentTier} subscription has been cancelled. You can upgrade anytime.`,
      tier: currentTier,
    });

    res.json({ success: true, data: { message: 'Subscription cancelled successfully' } });
  } catch (error) {
    logger.error(`[Billing] Cancel subscription failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'CANCEL_ERROR', message: 'Failed to cancel subscription' }
    });

    res.json({ success: true, newTier: result.newTier, message: `Plan changed to ${result.newTier}` });
  } catch (error) {
    logger.error('[Billing] Change plan error:', error.message);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

/**
 * POST /api/billing/change-plan
 * Schedule a plan change (upgrade or downgrade).
 * - Upgrades are applied immediately with proration.
 * - Downgrades are scheduled at the end of the current billing period
 *   so the user retains access until they have paid for.
 */
router.post('/change-plan', billingWriteLimiter, requireAuth, async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.userId;

    if (!planId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PLAN', message: 'planId is required' }
      });
    }

    const newPriceId = PLAN_PRICE_IDS[planId];
    if (planId !== 'explorer' && !newPriceId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PLAN', message: `Unknown or unconfigured plan: ${planId}` }
      });
    }

    if (!stripe) {
      return res.status(503).json({
        success: false,
        error: { code: 'STRIPE_UNAVAILABLE', message: 'Payment service not configured' }
      });
    }

    const user = await db.prepare(
      'SELECT stripe_customer_id, subscription_tier FROM users WHERE id = ?'
    ).get(userId);

    if (!user?.stripe_customer_id) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_SUBSCRIPTION', message: 'No active Stripe subscription found' }
      });
    }

    // Retrieve the active subscription for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripe_customer_id,
      status: 'active',
      limit: 1,
    });

    const subscription = subscriptions.data[0];
    if (!subscription) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_ACTIVE_SUBSCRIPTION', message: 'No active subscription to change' }
      });
    }

    const currentItem = subscription.items.data[0];
    const PLAN_ORDER = ['explorer', 'guardian', 'navigator'];
    const currentIdx = PLAN_ORDER.indexOf(user.subscription_tier || 'explorer');
    const newIdx = PLAN_ORDER.indexOf(planId);

    if (newIdx === -1) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PLAN', message: `Unknown plan "${planId}". Valid plans: ${PLAN_ORDER.join(', ')}` }
      });
    }

    const isDowngrade = currentIdx !== -1 && newIdx < currentIdx;

    if (planId === 'explorer') {
      // Downgrade to free — cancel at period end
      await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true,
      });
      await createNotification(
        userId,
        'subscription_downgrade_scheduled',
        'Plan Change Scheduled',
        `Your plan will change to Explorer at the end of your current billing period.`,
        { planId }
      );
      return res.json({
        success: true,
        data: { scheduled: true, effectiveDate: new Date(subscription.current_period_end * 1000).toISOString() }
      });
    }

    // Paid-to-paid change
    const updateParams = {
      items: [{ id: currentItem.id, price: newPriceId }],
    };

    if (isDowngrade) {
      // Schedule downgrade at period end — no proration, no immediate charge
      updateParams.proration_behavior = 'none';
      updateParams.billing_cycle_anchor = 'unchanged';
    } else {
      // Upgrade immediately with proration
      updateParams.proration_behavior = 'create_prorations';
    }

    await stripe.subscriptions.update(subscription.id, updateParams);

    const notifTitle = isDowngrade ? 'Plan Downgrade Scheduled' : 'Plan Upgraded';
    const notifMsg = isDowngrade
      ? `Your plan will change to ${planId} at the end of your current billing period.`
      : `Your plan has been upgraded to ${planId}.`;

    await createNotification(userId, 'subscription_changed', notifTitle, notifMsg, { planId });

    res.json({
      success: true,
      data: {
        planId,
        immediate: !isDowngrade,
        scheduled: isDowngrade,
        effectiveDate: isDowngrade
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : new Date().toISOString(),
      }
    });
  } catch (error) {
    logger.error(`[Billing] Change plan failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'CHANGE_PLAN_ERROR', message: 'Failed to change plan' }
    });
  }
});

router.get('/subscription-status', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    
    const user = await db.prepare('SELECT stripe_customer_id, subscription_tier, is_premium, premium_expires_at FROM users WHERE id = ?').get(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

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

/**
 * GET /api/billing/invoices
 * Retrieve billing history (invoices) from Stripe
 */
router.get('/invoices', invoicesLimiter, requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await db.prepare('SELECT stripe_customer_id, subscription_tier, is_premium FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (!user.stripe_customer_id || !process.env.STRIPE_SECRET_KEY) {
      return res.json({
        success: true,
        data: {
          invoices: [],
          message: 'No billing history available.'
        }
      });
    }

    const invoiceList = await stripe.invoices.list({
      customer: user.stripe_customer_id,
      limit: 24,
      status: 'paid',
    });

    const invoices = (invoiceList.data || []).map((inv) => ({
      id: inv.id,
      number: inv.number,
      amount: inv.amount_paid,
      currency: inv.currency,
      status: inv.status,
      pdfUrl: inv.invoice_pdf,
      hostedUrl: inv.hosted_invoice_url,
      periodStart: inv.period_start,
      periodEnd: inv.period_end,
      createdAt: inv.created,
    }));

    res.json({ success: true, data: { invoices } });
  } catch (error) {
    logger.error(`[Billing] Get invoices failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to retrieve billing history' });
  }
});

router.post('/webhook', async (req, res) => {
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

// Free trial endpoint
router.post('/start-trial', requireAuth, async (req, res) => {
  try {
    const result = await startFreeTrial(req.userId);
    if (!result.success) {
      return res.status(400).json({ success: false, error: { code: 'TRIAL_ERROR', message: result.error } });
    }
    res.json({ success: true, data: result.data });
  } catch (error) {
    logger.error(`[Billing] Start trial failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'TRIAL_ERROR', message: 'Failed to start trial' } });
  }
});

// Change plan with proration
router.post('/change-plan', requireAuth, async (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ success: false, error: 'Plan ID required' });
    const result = await changePlan(req.userId, planId);
    if (!result.success) {
      return res.status(400).json({ success: false, error: { code: 'PLAN_CHANGE_ERROR', message: result.error } });
    }
    res.json({ success: true, data: result.data });
  } catch (error) {
    logger.error(`[Billing] Plan change failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'PLAN_CHANGE_ERROR', message: 'Failed to change plan' } });
  }
});

// Get usage for current billing period
router.get('/usage', requireAuth, async (req, res) => {
  try {
    const result = await getUsage(req.userId);
    res.json(result);
  } catch (error) {
    logger.error(`[Billing] Get usage failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'USAGE_ERROR', message: 'Failed to get usage data' } });
  }
});

// Check trial status
router.get('/trial-status', requireAuth, async (req, res) => {
  try {
    const result = await checkTrialExpiry(req.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`[Billing] Trial status check failed: ${error.message}`);
    res.status(500).json({ success: false, error: { code: 'TRIAL_ERROR', message: 'Failed to check trial status' } });
  }
});

export default router;
