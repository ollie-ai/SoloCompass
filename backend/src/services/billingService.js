import db from '../db.js';
import logger from './logger.js';
import { stripe, PLAN_PRICE_IDS } from './stripe.js';
import { createNotification } from './notificationService.js';

// Plan limits per tier (-1 means unlimited)
const PLAN_LIMITS = {
  explorer: { ai_itineraries: 1, trips: 2, checkins: 10, ai_chats: 5 },
  guardian: { ai_itineraries: -1, trips: -1, checkins: -1, ai_chats: 20 },
  navigator: { ai_itineraries: -1, trips: -1, checkins: -1, ai_chats: -1 },
};

// Free trial support (7-day)
export async function startFreeTrial(userId) {
  const user = await db.get('SELECT trial_used, subscription_tier FROM users WHERE id = ?', userId);
  if (user?.trial_used) return { success: false, error: 'Trial already used' };
  if (user?.subscription_tier !== 'explorer' && user?.subscription_tier !== 'free') {
    return { success: false, error: 'Already on a paid plan' };
  }

  const now = new Date();
  const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await db.run(
    'UPDATE users SET trial_starts_at = ?, trial_ends_at = ?, trial_used = true, subscription_tier = ?, is_premium = true WHERE id = ?',
    now.toISOString(), trialEnd.toISOString(), 'guardian', userId
  );

  await createNotification(userId, 'subscription_upgraded', 'Free Trial Started', 'Your 7-day Guardian trial is now active! Enjoy unlimited trips and AI itineraries.', { tier: 'guardian', trial: true, trialEnd: trialEnd.toISOString() });

  return { success: true, data: { trialEnd: trialEnd.toISOString() } };
}

export async function checkTrialExpiry(userId) {
  const user = await db.get('SELECT trial_ends_at, subscription_tier, stripe_customer_id FROM users WHERE id = ?', userId);
  if (!user?.trial_ends_at) return { expired: false };

  if (new Date(user.trial_ends_at) < new Date() && !user.stripe_customer_id) {
    await db.run('UPDATE users SET subscription_tier = ?, is_premium = false WHERE id = ?', 'explorer', userId);
    return { expired: true };
  }
  return { expired: false, trialEnd: user.trial_ends_at };
}

// Proration for mid-cycle plan changes
export async function changePlan(userId, newPlanId) {
  const user = await db.get('SELECT stripe_customer_id, subscription_tier FROM users WHERE id = ?', userId);
  if (!user?.stripe_customer_id) return { success: false, error: 'No active subscription' };
  if (!stripe) return { success: false, error: 'Stripe not configured' };

  const newPriceId = PLAN_PRICE_IDS[newPlanId];
  if (!newPriceId) return { success: false, error: 'Invalid plan' };

  try {
    const subscriptions = await stripe.subscriptions.list({ customer: user.stripe_customer_id, status: 'active', limit: 1 });
    if (subscriptions.data.length === 0) return { success: false, error: 'No active subscription found' };

    const sub = subscriptions.data[0];
    const updated = await stripe.subscriptions.update(sub.id, {
      items: [{ id: sub.items.data[0].id, price: newPriceId }],
      proration_behavior: 'create_prorations',
    });

    await db.run('UPDATE users SET subscription_tier = ? WHERE id = ?', newPlanId, userId);
    await createNotification(userId, 'subscription_upgraded', 'Plan Changed', `Your plan has been changed to ${newPlanId}. Proration has been applied.`, { tier: newPlanId, prorated: true });

    return { success: true, data: { subscription: updated.id, tier: newPlanId } };
  } catch (err) {
    logger.error('[Billing] Plan change failed:', err.message);
    return { success: false, error: err.message };
  }
}

// Dunning emails - retry sequence (1, 3, 5, 7 days)
const RETRY_SCHEDULE_DAYS = [1, 3, 5, 7];

export async function handlePaymentFailure(userId, invoiceId) {
  try {
    const existing = await db.get('SELECT * FROM payment_retry_log WHERE user_id = ? AND stripe_invoice_id = ? ORDER BY attempt_number DESC LIMIT 1', userId, invoiceId);
    const attemptNumber = existing ? existing.attempt_number + 1 : 1;

    if (attemptNumber > RETRY_SCHEDULE_DAYS.length) {
      await db.run('UPDATE users SET subscription_tier = ?, is_premium = false WHERE id = ?', 'explorer', userId);
      await createNotification(userId, 'subscription_cancelled', 'Subscription Cancelled', 'Your subscription has been cancelled due to repeated payment failures. Please update your payment method to resubscribe.');
      return { success: true, action: 'cancelled' };
    }

    const nextRetryDays = RETRY_SCHEDULE_DAYS[attemptNumber - 1];
    const nextRetry = new Date(Date.now() + nextRetryDays * 24 * 60 * 60 * 1000);

    await db.run(
      'INSERT INTO payment_retry_log (user_id, stripe_invoice_id, attempt_number, status, next_retry_at) VALUES (?, ?, ?, ?, ?)',
      userId, invoiceId, attemptNumber, 'pending', nextRetry.toISOString()
    );

    const messages = [
      'Your payment failed. We\'ll retry in 1 day. Please update your payment method.',
      'Second payment attempt failed. We\'ll try again in 3 days.',
      'Payment still failing. Please update your payment method within 5 days to keep your subscription.',
      'Final notice: Your subscription will be cancelled if payment is not received within 7 days.',
    ];

    await createNotification(userId, 'payment_failed', 'Payment Failed', messages[attemptNumber - 1], {
      invoiceId, attemptNumber, nextRetry: nextRetry.toISOString(), maxRetries: RETRY_SCHEDULE_DAYS.length
    });

    return { success: true, action: 'retry_scheduled', attemptNumber, nextRetry: nextRetry.toISOString() };
  } catch (err) {
    logger.error('[Billing] Payment failure handling error:', err.message);
    return { success: false, error: err.message };
  }
}

// Failed payment auto-retry
export async function retryFailedPayments() {
  try {
    if (!stripe) return { success: false, error: 'Stripe not configured' };
    const pendingRetries = await db.prepare('SELECT * FROM payment_retry_log WHERE status = ? AND next_retry_at <= CURRENT_TIMESTAMP').all('pending');

    const results = [];
    for (const retry of pendingRetries) {
      try {
        const invoice = await stripe.invoices.pay(retry.stripe_invoice_id);
        await db.run('UPDATE payment_retry_log SET status = ? WHERE id = ?', 'succeeded', retry.id);
        await createNotification(retry.user_id, 'payment_failed', 'Payment Successful', 'Your payment has been successfully processed!', { invoiceId: retry.stripe_invoice_id });
        results.push({ id: retry.id, status: 'succeeded' });
      } catch (err) {
        await db.run('UPDATE payment_retry_log SET status = ?, error_message = ? WHERE id = ?', 'failed', err.message, retry.id);
        await handlePaymentFailure(retry.user_id, retry.stripe_invoice_id);
        results.push({ id: retry.id, status: 'failed', error: err.message });
      }
    }
    return { success: true, data: results };
  } catch (err) {
    logger.error('[Billing] Retry failed payments error:', err.message);
    return { success: false, error: err.message };
  }
}

// Usage tracking per billing period
export async function trackUsage(userId, metric) {
  try {
    const user = await db.get('SELECT subscription_tier, premium_expires_at FROM users WHERE id = ?', userId);
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    let usage = await db.get(
      'SELECT * FROM billing_usage WHERE user_id = ? AND billing_period_start <= ? AND billing_period_end >= ?',
      userId, now.toISOString(), now.toISOString()
    );

    if (!usage) {
      await db.run(
        'INSERT INTO billing_usage (user_id, billing_period_start, billing_period_end) VALUES (?, ?, ?)',
        userId, periodStart.toISOString(), periodEnd.toISOString()
      );
      usage = await db.get('SELECT * FROM billing_usage WHERE user_id = ? AND billing_period_start = ?', userId, periodStart.toISOString());
    }

    const column = `${metric}_used`;
    const validMetrics = ['ai_itineraries', 'checkins', 'buddy_requests', 'ai_chats'];
    if (!validMetrics.includes(metric)) return { success: false, error: 'Invalid metric' };

    await db.run(`UPDATE billing_usage SET ${column} = ${column} + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, usage.id);

    // Check limits and send warnings at 80% and 90%
    const tier = user?.subscription_tier || 'explorer';
    const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.explorer;
    const limit = limits[metric];

    if (limit > 0) {
      const newCount = (usage[column] || 0) + 1;
      const pct = (newCount / limit) * 100;

      if (pct >= 90 && pct - (100/limit) < 90) {
        await createNotification(userId, 'budget_alert', 'Usage Warning', `You've used 90% of your ${metric.replace('_', ' ')} limit. Consider upgrading your plan.`, { metric, used: newCount, limit, percentage: 90 });
      } else if (pct >= 80 && pct - (100/limit) < 80) {
        await createNotification(userId, 'budget_alert', 'Usage Warning', `You've used 80% of your ${metric.replace('_', ' ')} limit.`, { metric, used: newCount, limit, percentage: 80 });
      }
    }

    return { success: true };
  } catch (err) {
    logger.error('[Billing] Track usage error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function getUsage(userId) {
  try {
    const now = new Date();
    const user = await db.get('SELECT subscription_tier FROM users WHERE id = ?', userId);
    const tier = user?.subscription_tier || 'explorer';
    const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.explorer;

    let usage = await db.get(
      'SELECT * FROM billing_usage WHERE user_id = ? AND billing_period_start <= ? AND billing_period_end >= ?',
      userId, now.toISOString(), now.toISOString()
    );

    if (!usage) {
      usage = { ai_itineraries_used: 0, checkins_used: 0, buddy_requests_used: 0, ai_chats_used: 0 };
    }

    return {
      success: true,
      data: {
        tier,
        limits,
        usage: {
          ai_itineraries: usage.ai_itineraries_used || 0,
          checkins: usage.checkins_used || 0,
          buddy_requests: usage.buddy_requests_used || 0,
          ai_chats: usage.ai_chats_used || 0,
        }
      }
    };
  } catch (err) {
    logger.error('[Billing] Get usage error:', err.message);
    return { success: false, error: err.message };
  }
}

export { PLAN_LIMITS };
