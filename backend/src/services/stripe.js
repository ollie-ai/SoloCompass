import Stripe from 'stripe';
import db from '../db.js';
import logger from './logger.js';
import { dispatchNotification } from './notificationDispatcher.js';

let stripe;

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
} else {
  logger.warn('[Stripe] STRIPE_SECRET_KEY not set - Stripe functionality disabled');
}

export { stripe };

// Validate price IDs at startup
export const PLAN_PRICE_IDS = {
  'explorer': null,
  'guardian': process.env.STRIPE_PRICE_ID_GUARDIAN,
  'navigator': process.env.STRIPE_PRICE_ID_NAVIGATOR,
};

if (!process.env.STRIPE_PRICE_ID_GUARDIAN) {
  logger.warn('STRIPE_PRICE_ID_GUARDIAN not set - Guardian plan unavailable');
}
if (!process.env.STRIPE_PRICE_ID_NAVIGATOR) {
  logger.warn('STRIPE_PRICE_ID_NAVIGATOR not set - Navigator plan unavailable');
}

const PLAN_NAMES = {
  'explorer': 'explorer',
  'guardian': 'guardian',
  'navigator': 'navigator',
};

async function sendBillingNotification(userId, notificationType, title, message, data = null) {
  try {
    await dispatchNotification(userId, notificationType, { title, message, ...(data || {}) });
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
