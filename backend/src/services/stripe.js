import Stripe from 'stripe';
import db from '../db.js';
import dotenv from 'dotenv';
import logger from './logger.js';
import { dispatchNotification } from './notificationDispatcher.js';

dotenv.config();

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
    logger.error(`[BillingNotification] Failed to send ${notificationType}:`, err.message);
  }
}

export const getPriceIdForPlan = (planName) => {
  return PLAN_PRICE_IDS[planName] || null;
};

export const getPlanTier = (planName) => {
  return PLAN_NAMES[planName] || 'free';
};

export const createCheckoutSession = async (userId, userEmail, planId, priceId) => {
  try {
    if (!stripe) {
      return { success: false, error: 'Stripe not configured' };
    }

    let finalPriceId = priceId;

    if (!finalPriceId && planId) {
      finalPriceId = PLAN_PRICE_IDS[planId];
    }

    if (!finalPriceId) {
      return { success: false, error: 'Invalid plan selected' };
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: finalPriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?payment=success`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?payment=cancel`,
      customer_email: userEmail,
      client_reference_id: userId,
      metadata: {
        planId,
        planTier: PLAN_NAMES[planId] || 'free',
      },
    });

    return { success: true, url: session.url };
  } catch (error) {
    logger.error('Stripe error:', error);
    return { success: false, error: error.message };
  }
};

export const handleStripeWebhook = async (sig, body) => {
  try {
    const event = stripe.webhooks.constructEvent(
      body, 
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET
    );

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        
        const planTier = session.metadata?.planTier || 'explorer';
        
        await db.run('UPDATE users SET is_premium = true, premium_expires_at = ?, stripe_customer_id = ?, subscription_tier = ? WHERE id = ?',
          expiryDate.toISOString(), session.customer, planTier, session.client_reference_id);
        logger.info(`[STRIPE] Payment successful for userId: ${session.client_reference_id}`);
        
        const user = await db.get('SELECT email, name FROM users WHERE id = ?', session.client_reference_id);
        if (user) {
          await sendBillingNotification(
            session.client_reference_id,
            'subscription_upgraded',
            'Subscription Upgraded',
            `Your ${planTier} subscription is now active!`,
            { tier: planTier, expiryDate: expiryDate.toISOString() }
          );
        }
        break;
        
      case 'customer.subscription.deleted':
        const subscription = event.data.object;
        logger.info(`[STRIPE] Subscription cancelled for customer: ${subscription.customer}`);
        
        const userToUpdate = await db.get('SELECT id FROM users WHERE stripe_customer_id = ?', subscription.customer);
        if (userToUpdate) {
          await db.run('UPDATE users SET is_premium = false, subscription_tier = ? WHERE stripe_customer_id = ?',
            'explorer', subscription.customer);
          
          await sendBillingNotification(
            userToUpdate.id,
            'subscription_cancelled',
            'Subscription Cancelled',
            'Your subscription has been cancelled. You can upgrade anytime.',
            { reason: 'subscription_deleted' }
          );
        }
        break;
        
      case 'customer.subscription.updated':
        const updatedSub = event.data.object;
        if (updatedSub.status === 'past_due') {
          logger.warn(`[STRIPE] Subscription past due for customer: ${updatedSub.customer}`);
          
          const pastDueUser = await db.get('SELECT id FROM users WHERE stripe_customer_id = ?', updatedSub.customer);
          if (pastDueUser) {
            await sendBillingNotification(
              pastDueUser.id,
              'payment_failed',
              'Payment Failed',
              'Your payment could not be processed. Please update your payment method.',
              { reason: 'past_due' }
            );
          }
        }
        break;
        
      case 'invoice.payment_failed':
        const failedInvoice = event.data.object;
        logger.warn(`[STRIPE] Payment failed for invoice: ${failedInvoice.id}`);
        
        const failedUser = await db.get('SELECT id FROM users WHERE stripe_customer_id = ?', failedInvoice.customer);
        if (failedUser) {
          await sendBillingNotification(
            failedUser.id,
            'payment_failed',
            'Payment Failed',
            'Your payment could not be processed. Please update your payment method.',
            { invoiceId: failedInvoice.id }
          );
        }
        break;
        
      default:
        logger.info(`Unhandled event type ${event.type}`);
    }

    return { success: true };
  } catch (err) {
    logger.error('Webhook error:', err);
    return { success: false, error: err.message };
  }
};

export const cancelSubscription = async (userId) => {
  try {
    const user = await db.get('SELECT stripe_customer_id FROM users WHERE id = ?', userId);
    
    if (!user?.stripe_customer_id) {
      return { success: false, error: 'No active subscription found' };
    }

    const customer = await stripe.customers.retrieve(user.stripe_customer_id);
    
    if (customer.deleted) {
      return { success: false, error: 'Customer not found' };
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripe_customer_id,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length > 0) {
      await stripe.subscriptions.cancel(subscriptions.data[0].id);
    }

    return { success: true };
  } catch (error) {
    logger.error('Cancel subscription error:', error);
    return { success: false, error: error.message };
  }
};

export const getSubscriptionStatus = async (stripeCustomerId) => {
  try {
    if (!stripeCustomerId) {
      return { success: true, data: { active: false, tier: 'free' } };
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length > 0) {
      const sub = subscriptions.data[0];
      return {
        success: true,
        data: {
          active: true,
          status: sub.status,
          currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        }
      };
    }

    return { success: true, data: { active: false, tier: 'free' } };
  } catch (error) {
    logger.error('Get subscription status error:', error);
    return { success: true, data: { active: false, tier: 'free' } };
  }
};
