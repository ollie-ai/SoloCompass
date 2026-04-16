import express from 'express'; 
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

const router = express.Router();

const invoicesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// Public endpoint - no auth required
router.get('/plans', (req, res) => {
  try {
    const plans = [
      {
        id: 'explorer',
        name: 'Explorer',
        price: 0,
        currency: 'GBP',
        interval: 'month',
        features: ['Travel DNA quiz profile', 'Create trips (up to 2 active)', '1 AI itinerary per month', 'Edit itinerary activities', 'Manual safety check-ins + SOS', 'Official advisories (FCDO)'],
        featureList: ['Travel DNA quiz profile', 'Create trips (up to 2 active)', '1 AI itinerary per month', 'Edit itinerary activities', 'Manual safety check-ins + SOS', 'Official advisories (FCDO)'],
        isActive: true,
        order: 0,
      },
      {
        id: 'guardian',
        name: 'Guardian',
        price: 4.99,
        currency: 'GBP',
        interval: 'month',
        stripePriceId: process.env.STRIPE_PRICE_ID_GUARDIAN || null,
        features: ['Everything in Explorer', 'Unlimited trips & AI itineraries', 'Scheduled check-ins + missed alerts', 'Safe-Return Timer', 'Safe haven locator'],
        featureList: ['Everything in Explorer', 'Unlimited trips & AI itineraries', 'Scheduled check-ins + missed alerts', 'Safe-Return Timer', 'Safe haven locator'],
        isActive: true,
        order: 1,
      },
      {
        id: 'navigator',
        name: 'Navigator',
        price: 9.99,
        currency: 'GBP',
        interval: 'month',
        stripePriceId: process.env.STRIPE_PRICE_ID_NAVIGATOR || null,
        features: ['Everything in Guardian', 'AI destination chat + guide', 'AI safety advice', 'Travel Buddy matching'],
        featureList: ['Everything in Guardian', 'AI destination chat + guide', 'AI safety advice', 'Travel Buddy matching'],
        isActive: true,
        order: 2,
      },
    ];
    res.json({ success: true, data: plans });
  } catch (error) {
    logger.error(`[Billing] Failed to fetch plans: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

router.post('/create-checkout-session', requireAuth, async (req, res) => {
  try {
    const { planId, priceId } = req.body;
    const userId = req.userId;
    const user = await db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
    const email = user?.email;

    if (planId === 'explorer' || planId === 'free') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PLAN', message: 'Explorer plan does not require checkout' }
      });
    }

    const result = await createCheckoutSession(userId, email, planId, priceId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'CHECKOUT_ERROR', message: result.error }
      });
    }

    res.json({ success: true, data: { url: result.url } });
  } catch (error) {
    logger.error(`[Billing] Checkout failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'CHECKOUT_ERROR', message: 'Failed to create checkout session' }
    });
  }
});

router.post('/create-subscription-intent', requireAuth, async (req, res) => {
  try {
    const { planId, interval } = req.body;
    const userId = req.userId;
    const user = await db.prepare('SELECT email, stripe_customer_id FROM users WHERE id = ?').get(userId);

    const priceId = PLAN_PRICE_IDS[planId];
    if (!priceId) {
      return res.status(400).json({ success: false, error: 'Invalid plan' });
    }

    let customerId = user.stripe_customer_id;
    if (!customerId) {
        const customer = await stripe.customers.create({
            email: user.email,
            metadata: { userId }
        });
        customerId = customer.id;
        await db.run('UPDATE users SET stripe_customer_id = ? WHERE id = ?', customerId, userId.toString());
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: { userId: userId.toString(), planId }
    });

    res.json({
      success: true,
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret,
    });
  } catch (error) {
    logger.error(`[Billing] Subscription intent failed: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to create subscription intent' });
  }
});

router.post('/cancel-subscription', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(userId);
    const currentTier = user?.subscription_tier || 'explorer';
    
    const result = await cancelSubscription(userId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'CANCEL_ERROR', message: result.error }
      });
    }

    await createNotification(
      userId,
      'subscription_cancelled',
      'Subscription Cancelled',
      `Your ${currentTier} subscription has been cancelled. You can upgrade anytime.`,
      { tier: currentTier }
    );

    res.json({ success: true, data: { message: 'Subscription cancelled successfully' } });
  } catch (error) {
    logger.error(`[Billing] Cancel subscription failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'CANCEL_ERROR', message: 'Failed to cancel subscription' }
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

    // Only check Stripe if user has a customer ID
    let stripeStatus = { active: false, tier: user.subscription_tier || 'explorer' };
    if (user.stripe_customer_id && process.env.STRIPE_SECRET_KEY) {
      try {
        const statusResult = await getSubscriptionStatus(user.stripe_customer_id);
        stripeStatus = statusResult.data || statusResult;
      } catch (e) {
        // Stripe unavailable, use local data
        stripeStatus = { active: user.is_premium === 1 || user.is_premium === true, tier: user.subscription_tier || 'explorer' };
      }
    } else if (user.is_premium === 1 || user.is_premium === true) {
      stripeStatus = { active: true, tier: user.subscription_tier || 'explorer' };
    }

    res.json({
      success: true,
      data: {
        isPremium: !!user.is_premium,
        tier: user.subscription_tier || 'explorer',
        expiresAt: user.premium_expires_at,
        stripeStatus,
      }
    });
  } catch (error) {
    logger.error(`[Billing] Get subscription status failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: { code: 'STATUS_ERROR', message: 'Failed to get subscription status' }
    });
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
    const sig = req.headers['stripe-signature'];
    if (!sig) {
      return res.status(400).json({ success: false, error: 'Missing stripe-signature header' });
    }
    
    let rawBody;
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body;
    } else if (typeof req.body === 'string') {
      rawBody = req.body;
    } else {
      rawBody = JSON.stringify(req.body);
    }
    
    const result = await handleStripeWebhook(rawBody, sig);
    
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    
    res.json({ received: true });
  } catch (error) {
    logger.error(`[Billing] Webhook error: ${error.message}`);
    res.status(500).json({ success: false, error: 'Webhook handler failed' });
  }
});

export default router;
