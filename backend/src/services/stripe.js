import Stripe from 'stripe';
import db from '../db.js';
import logger from './logger.js';

let stripe;

function getStripe() {
  if (!stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      logger.warn('[Stripe] STRIPE_SECRET_KEY not set — Stripe calls will fail');
      return null;
    }
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
  }
  return stripe;
}

// ─── Plan & Price resolution ────────────────────────────────────────────────

export const PLAN_TIERS = { EXPLORER: 'explorer', GUARDIAN: 'guardian', NAVIGATOR: 'navigator' };

// Monthly and annual price IDs resolved from env at call-time
function getPriceId(planId, interval = 'month') {
  const isAnnual = interval === 'year';
  const map = {
    guardian: isAnnual
      ? process.env.STRIPE_PRICE_ID_GUARDIAN_ANNUAL
      : process.env.STRIPE_PRICE_ID_GUARDIAN,
    navigator: isAnnual
      ? process.env.STRIPE_PRICE_ID_NAVIGATOR_ANNUAL
      : process.env.STRIPE_PRICE_ID_NAVIGATOR,
  };
  return map[planId] || null;
}

function tierFromPriceId(priceId) {
  if (!priceId) return PLAN_TIERS.EXPLORER;
  const ids = {
    [process.env.STRIPE_PRICE_ID_GUARDIAN]: PLAN_TIERS.GUARDIAN,
    [process.env.STRIPE_PRICE_ID_GUARDIAN_ANNUAL]: PLAN_TIERS.GUARDIAN,
    [process.env.STRIPE_PRICE_ID_NAVIGATOR]: PLAN_TIERS.NAVIGATOR,
    [process.env.STRIPE_PRICE_ID_NAVIGATOR_ANNUAL]: PLAN_TIERS.NAVIGATOR,
  };
  return ids[priceId] || PLAN_TIERS.EXPLORER;
}

// ─── Checkout ───────────────────────────────────────────────────────────────

export const createCheckoutSession = async ({ userId, userEmail, planId, interval = 'month', trialDays = 0 }) => {
  const client = getStripe();
  if (!client) throw new Error('Stripe not configured');

  const priceId = getPriceId(planId, interval);
  if (!priceId) throw new Error(`No Stripe price ID configured for plan: ${planId} (${interval})`);

  // Retrieve or create Stripe customer
  const user = await db.prepare('SELECT stripe_customer_id FROM users WHERE id = ?').get(userId);
  let customerId = user?.stripe_customer_id;

  if (!customerId) {
    const customer = await client.customers.create({ email: userEmail, metadata: { userId: String(userId) } });
    customerId = customer.id;
    await db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customerId, userId);
  }

  const appUrl = process.env.FRONTEND_URL || 'http://localhost:5176';
  const params = {
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/payment/cancel`,
    metadata: { userId: String(userId), planId, interval },
    subscription_data: { metadata: { userId: String(userId), planId } },
    allow_promotion_codes: true,
  };

  if (trialDays > 0) {
    params.subscription_data.trial_period_days = trialDays;
  }

  const session = await client.checkout.sessions.create(params);
  return session;
};

// ─── Billing Portal ─────────────────────────────────────────────────────────

export const createPortalSession = async ({ userId }) => {
  const client = getStripe();
  if (!client) throw new Error('Stripe not configured');

  const user = await db.prepare('SELECT stripe_customer_id FROM users WHERE id = ?').get(userId);
  if (!user?.stripe_customer_id) throw new Error('No Stripe customer found');

  const appUrl = process.env.FRONTEND_URL || 'http://localhost:5176';
  const session = await client.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${appUrl}/settings?tab=billing`,
  });
  return session;
};

// ─── Subscription management ────────────────────────────────────────────────

export const cancelSubscriptionAtPeriodEnd = async ({ userId }) => {
  const client = getStripe();
  if (!client) throw new Error('Stripe not configured');

  const user = await db.prepare('SELECT stripe_subscription_id, stripe_customer_id FROM users WHERE id = ?').get(userId);

  let subscriptionId = user?.stripe_subscription_id;

  // Fallback: look up from Stripe customer's subscriptions
  if (!subscriptionId && user?.stripe_customer_id) {
    const subs = await client.subscriptions.list({ customer: user.stripe_customer_id, status: 'active', limit: 1 });
    if (subs.data.length > 0) subscriptionId = subs.data[0].id;
  }

  if (!subscriptionId) throw new Error('No active subscription found');

  const updated = await client.subscriptions.update(subscriptionId, { cancel_at_period_end: true });

  await db.prepare('UPDATE users SET subscription_cancel_at_period_end = true WHERE id = ?').run(userId);

  return updated;
};

export const resumeSubscription = async ({ userId }) => {
  const client = getStripe();
  if (!client) throw new Error('Stripe not configured');

  const user = await db.prepare('SELECT stripe_subscription_id, stripe_customer_id FROM users WHERE id = ?').get(userId);

  let subscriptionId = user?.stripe_subscription_id;

  if (!subscriptionId && user?.stripe_customer_id) {
    const subs = await client.subscriptions.list({ customer: user.stripe_customer_id, limit: 1 });
    if (subs.data.length > 0) subscriptionId = subs.data[0].id;
  }

  if (!subscriptionId) throw new Error('No subscription found');

  const updated = await client.subscriptions.update(subscriptionId, { cancel_at_period_end: false });

  await db.prepare('UPDATE users SET subscription_cancel_at_period_end = false WHERE id = ?').run(userId);

  return updated;
};

export const changePlan = async ({ userId, newPlanId, interval = 'month', proration = 'create_prorations' }) => {
  const client = getStripe();
  if (!client) throw new Error('Stripe not configured');

  const priceId = getPriceId(newPlanId, interval);
  if (!priceId) throw new Error(`No price ID for plan: ${newPlanId}`);

  const user = await db.prepare('SELECT stripe_subscription_id, stripe_customer_id FROM users WHERE id = ?').get(userId);

  let subscriptionId = user?.stripe_subscription_id;

  if (!subscriptionId && user?.stripe_customer_id) {
    const subs = await client.subscriptions.list({ customer: user.stripe_customer_id, status: 'active', limit: 1 });
    if (subs.data.length > 0) subscriptionId = subs.data[0].id;
  }

  if (!subscriptionId) throw new Error('No active subscription found');

  const subscription = await client.subscriptions.retrieve(subscriptionId);
  const itemId = subscription.items.data[0]?.id;
  if (!itemId) throw new Error('No subscription item found');

  const updated = await client.subscriptions.update(subscriptionId, {
    items: [{ id: itemId, price: priceId }],
    proration_behavior: proration,
  });

  const newTier = tierFromPriceId(priceId);
  await db.prepare('UPDATE users SET subscription_tier = ?, is_premium = true, subscription_interval = ? WHERE id = ?')
    .run(newTier, interval, userId);

  return { subscription: updated, newTier };
};

// ─── Invoices ───────────────────────────────────────────────────────────────

export const listInvoices = async ({ userId, limit = 10 }) => {
  const client = getStripe();
  if (!client) throw new Error('Stripe not configured');

  const user = await db.prepare('SELECT stripe_customer_id FROM users WHERE id = ?').get(userId);
  if (!user?.stripe_customer_id) return [];

  const invoices = await client.invoices.list({ customer: user.stripe_customer_id, limit });
  return invoices.data.map(inv => ({
    id: inv.id,
    amount: inv.amount_paid / 100,
    currency: inv.currency.toUpperCase(),
    status: inv.status,
    date: new Date(inv.created * 1000).toISOString(),
    pdfUrl: inv.invoice_pdf,
    hostedUrl: inv.hosted_invoice_url,
    periodStart: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
    periodEnd: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
    description: inv.lines?.data?.[0]?.description || null,
  }));
};

// ─── Promo / Coupon ─────────────────────────────────────────────────────────

export const validateAndApplyPromo = async ({ userId, code }) => {
  const client = getStripe();
  if (!client) throw new Error('Stripe not configured');

  // Validate coupon/promotion code
  let promoCode;
  try {
    const results = await client.promotionCodes.list({ code, active: true, limit: 1 });
    promoCode = results.data[0];
  } catch (e) {
    throw new Error('Invalid promo code');
  }

  if (!promoCode) throw new Error('Promo code not found or expired');
  const coupon = promoCode.coupon;

  // Apply to subscription if one exists
  const user = await db.prepare('SELECT stripe_subscription_id, stripe_customer_id FROM users WHERE id = ?').get(userId);

  let subscriptionId = user?.stripe_subscription_id;
  let applied = false;

  if (subscriptionId) {
    await client.subscriptions.update(subscriptionId, { discounts: [{ coupon: coupon.id }] });
    applied = true;
  } else if (user?.stripe_customer_id) {
    // Store on customer for next checkout
    await client.customers.update(user.stripe_customer_id, { coupon: coupon.id });
    applied = true;
  }

  return {
    valid: true,
    applied,
    discount: coupon.percent_off
      ? `${coupon.percent_off}% off`
      : coupon.amount_off
      ? `£${(coupon.amount_off / 100).toFixed(2)} off`
      : 'Discount applied',
    couponId: coupon.id,
    duration: coupon.duration,
  };
};

// ─── Subscription status ────────────────────────────────────────────────────

export const getSubscriptionStatus = async ({ userId }) => {
  const user = await db.prepare(
    'SELECT id, email, stripe_customer_id, stripe_subscription_id, subscription_tier, is_premium, premium_expires_at, subscription_status, subscription_period_end, subscription_cancel_at_period_end, subscription_interval FROM users WHERE id = ?'
  ).get(userId);

  if (!user) throw new Error('User not found');

  const tier = user.subscription_tier || 'explorer';
  const isPremium = tier !== 'explorer' && tier !== 'free';

  const result = {
    tier,
    isPremium,
    subscriptionStatus: user.subscription_status || (isPremium ? 'active' : 'inactive'),
    expiresAt: user.subscription_period_end || user.premium_expires_at,
    cancelAtPeriodEnd: Boolean(user.subscription_cancel_at_period_end),
    interval: user.subscription_interval || 'month',
    stripePortalUrl: null,
  };

  // Try to get live Stripe data and portal URL
  const client = getStripe();
  if (client && user.stripe_customer_id) {
    try {
      const appUrl = process.env.FRONTEND_URL || 'http://localhost:5176';
      const portal = await client.billingPortal.sessions.create({
        customer: user.stripe_customer_id,
        return_url: `${appUrl}/settings?tab=billing`,
      });
      result.stripePortalUrl = portal.url;
    } catch (e) {
      logger.warn('[Stripe] Could not generate portal URL:', e.message);
    }

    if (user.stripe_subscription_id) {
      try {
        const sub = await client.subscriptions.retrieve(user.stripe_subscription_id);
        result.subscriptionStatus = sub.status;
        result.cancelAtPeriodEnd = sub.cancel_at_period_end;
        result.expiresAt = new Date(sub.current_period_end * 1000).toISOString();
        result.interval = sub.items.data[0]?.price?.recurring?.interval || 'month';
      } catch (e) {
        logger.warn('[Stripe] Could not retrieve subscription:', e.message);
      }
    }
  }

  return result;
};

// ─── Webhook handling ───────────────────────────────────────────────────────
// IMPORTANT: params are (rawBody, sig) — rawBody is the raw Buffer from Express,
// sig is the Stripe-Signature header value.

export const handleStripeWebhook = async (rawBody, sig) => {
  const client = getStripe();
  if (!client) throw new Error('Stripe not configured');

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET not configured');

  let event;
  try {
    event = client.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    logger.error('[Stripe] Webhook signature verification failed:', err.message);
    throw new Error(`Webhook signature verification failed: ${err.message}`);
  }

  // Idempotency: skip already-processed events
  const existing = await db.prepare('SELECT id FROM stripe_processed_events WHERE stripe_event_id = ?').get(event.id);
  if (existing) {
    logger.info(`[Stripe] Event ${event.id} already processed, skipping`);
    return { processed: false, alreadyHandled: true, eventId: event.id };
  }

  logger.info(`[Stripe] Processing event: ${event.type} (${event.id})`);

  let handlerError = null;

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        // Reset AI daily usage counters on successful billing period renewal
        try {
          const paidInvoice = event.data.object;
          if (paidInvoice.billing_reason === 'subscription_cycle') {
            const renewedUser = await db.get('SELECT id FROM users WHERE stripe_customer_id = ?', paidInvoice.customer);
            if (renewedUser) {
              const { resetUserAICounters } = await import('./usageReset.js');
              await resetUserAICounters(renewedUser.id);
              logger.info(`[STRIPE] Reset AI usage counters for user ${renewedUser.id} on subscription renewal`);
            }
          }
        } catch (resetErr) {
          logger.warn(`[STRIPE] Usage reset on renewal failed: ${resetErr.message}`);
        }
        break;
        
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      default:
        logger.info(`[Stripe] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    logger.error(`[Stripe] Handler error for ${event.type}:`, err.message);
    handlerError = err.message;
  }

  // Mark as processed even if handler errored (to avoid infinite retries on bad data)
  try {
    await db.prepare('INSERT INTO stripe_processed_events (stripe_event_id, event_type) VALUES (?, ?)').run(event.id, event.type);
  } catch (insertErr) {
    logger.warn('[Stripe] Could not mark event as processed:', insertErr.message);
  }

  return { processed: true, eventId: event.id, type: event.type, error: handlerError };
};

async function getUserByCustomerId(customerId) {
  return db.prepare('SELECT id, email, name, subscription_tier FROM users WHERE stripe_customer_id = ?').get(customerId);
}

async function getUserBySubscriptionId(subscriptionId) {
  return db.prepare('SELECT id, email, subscription_tier FROM users WHERE stripe_subscription_id = ?').get(subscriptionId);
}

async function handleCheckoutCompleted(session) {
  const customerId = session.customer;
  const subscriptionId = session.subscription;
  const metadata = session.metadata || {};
  const userId = metadata.userId && /^\d+$/.test(metadata.userId) ? metadata.userId : null;

  let user = userId
    ? await db.prepare('SELECT id, email FROM users WHERE id = ?').get(parseInt(userId, 10))
    : await getUserByCustomerId(customerId);

  if (!user) {
    logger.warn('[Stripe] checkout.session.completed: no user found for customer', customerId);
    return;
  }

  // Resolve tier from subscription price
  const validTiers = ['guardian', 'navigator'];
  let tier = (metadata.planId && validTiers.includes(metadata.planId)) ? metadata.planId : 'guardian';
  let interval = 'month';
  let periodEnd = null;

  if (subscriptionId) {
    const client = getStripe();
    try {
      const sub = await client.subscriptions.retrieve(subscriptionId);
      const priceId = sub.items.data[0]?.price?.id;
      tier = tierFromPriceId(priceId) || tier;
      interval = sub.items.data[0]?.price?.recurring?.interval || 'month';
      periodEnd = new Date(sub.current_period_end * 1000).toISOString();
    } catch (e) {
      logger.warn('[Stripe] Could not retrieve subscription for tier:', e.message);
    }
  }

  await db.prepare(`
    UPDATE users SET
      subscription_tier = ?,
      is_premium = true,
      stripe_customer_id = ?,
      stripe_subscription_id = ?,
      subscription_status = 'active',
      subscription_period_end = ?,
      subscription_cancel_at_period_end = false,
      subscription_interval = ?,
      premium_expires_at = ?
    WHERE id = ?
  `).run(tier, customerId, subscriptionId, periodEnd, interval, periodEnd, user.id);

  logger.info(`[Stripe] checkout.session.completed: user ${user.id} upgraded to ${tier}`);
}

async function handleSubscriptionUpdated(subscription) {
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;

  let user = await getUserBySubscriptionId(subscriptionId);
  if (!user) user = await getUserByCustomerId(customerId);
  if (!user) {
    logger.warn('[Stripe] subscription.updated: no user found', { customerId, subscriptionId });
    return;
  }

  const priceId = subscription.items?.data?.[0]?.price?.id;
  const newTier = tierFromPriceId(priceId);
  const status = subscription.status;
  const cancelAtPeriodEnd = subscription.cancel_at_period_end;
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;
  const interval = subscription.items?.data?.[0]?.price?.recurring?.interval || 'month';

  // Map Stripe statuses to our DB values
  const isPremium = ['active', 'trialing'].includes(status);
  const dbTier = isPremium ? (newTier || user.subscription_tier) : 'explorer';

  await db.prepare(`
    UPDATE users SET
      subscription_tier = ?,
      is_premium = ?,
      subscription_status = ?,
      subscription_period_end = ?,
      subscription_cancel_at_period_end = ?,
      stripe_subscription_id = ?,
      subscription_interval = ?,
      premium_expires_at = ?
    WHERE id = ?
  `).run(dbTier, isPremium, status, periodEnd, cancelAtPeriodEnd, subscriptionId, interval, periodEnd, user.id);

  logger.info(`[Stripe] subscription.updated: user ${user.id} status=${status} tier=${dbTier} cancelAtEnd=${cancelAtPeriodEnd}`);
}

async function handleSubscriptionDeleted(subscription) {
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;

  let user = await getUserBySubscriptionId(subscriptionId);
  if (!user) user = await getUserByCustomerId(customerId);
  if (!user) {
    logger.warn('[Stripe] subscription.deleted: no user found', { customerId });
    return;
  }

  await db.prepare(`
    UPDATE users SET
      subscription_tier = 'explorer',
      is_premium = false,
      subscription_status = 'cancelled',
      subscription_cancel_at_period_end = false,
      stripe_subscription_id = NULL
    WHERE id = ?
  `).run(user.id);

  logger.info(`[Stripe] subscription.deleted: user ${user.id} reverted to explorer`);
}

async function handleInvoicePaymentFailed(invoice) {
  const customerId = invoice.customer;
  const user = await getUserByCustomerId(customerId);
  if (!user) return;

  // Update status to past_due
  await db.prepare(`UPDATE users SET subscription_status = 'past_due' WHERE id = ?`).run(user.id);

  // Send notification
  try {
    const { createNotification } = await import('./notificationService.js');
    const { sendPaymentFailedEmail } = await import('./email.js');

    await createNotification(user.id, 'payment_failed', 'Payment Failed',
      'Your recent payment failed. Please update your payment method to keep your subscription active.',
      { invoiceId: invoice.id, amount: invoice.amount_due / 100 });

    if (user.email) {
      await sendPaymentFailedEmail(user.email, {
        name: user.name || user.email,
        amount: `£${(invoice.amount_due / 100).toFixed(2)}`,
        failureReason: invoice.last_payment_error?.message || 'Payment declined',
        paymentUrl: `${process.env.FRONTEND_URL || 'http://localhost:5176'}/settings?tab=billing`,
      }).catch(e => logger.warn('[Stripe] Failed to send payment_failed email:', e.message));
    }
  } catch (e) {
    logger.warn('[Stripe] Notification error on payment_failed:', e.message);
  }

  logger.info(`[Stripe] invoice.payment_failed: user ${user.id} marked past_due`);
}

async function handleInvoicePaymentSucceeded(invoice) {
  const customerId = invoice.customer;
  const user = await getUserByCustomerId(customerId);
  if (!user) return;

  // Reset from past_due if payment succeeded
  const dbUser = await db.prepare('SELECT subscription_status FROM users WHERE id = ?').get(user.id);
  if (dbUser?.subscription_status === 'past_due' || dbUser?.subscription_status === 'incomplete') {
    await db.prepare(`UPDATE users SET subscription_status = 'active' WHERE id = ?`).run(user.id);
    logger.info(`[Stripe] invoice.payment_succeeded: user ${user.id} status reset to active`);
  }
}
