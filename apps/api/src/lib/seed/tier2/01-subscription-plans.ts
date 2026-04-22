/**
 * Tier 2 Seed: Subscription Plans
 * Subscription tiers and pricing
 */

import { db } from '../../db';
import { subscriptionPlans } from '../../schema/subscription-plans';

export const tier2SubscriptionPlans = [
  {
    name: 'Explorer',
    tier: 'explorer' as const,
    description: 'Perfect for solo travelers just getting started',
    priceMonthlyCents: 0,
    priceYearlyCents: 0,
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    active: true,
    features: JSON.stringify([
      'Up to 3 trips',
      'Basic destination safety scores',
      'Community forums access',
      'Email support',
    ]),
  },
  {
    name: 'Navigator',
    tier: 'navigator' as const,
    description: 'For serious solo travelers who want more',
    priceMonthlyCents: 999,
    priceYearlyCents: 9999,
    stripePriceIdMonthly: 'price_navigator_monthly',
    stripePriceIdYearly: 'price_navigator_yearly',
    active: true,
    features: JSON.stringify([
      'Unlimited trips',
      'Advanced safety analytics',
      'AI itinerary generation',
      'Offline trip access',
      'Priority email support',
      'No ads',
    ]),
  },
  {
    name: 'Guardian',
    tier: 'guardian' as const,
    description: 'Complete protection for every journey',
    priceMonthlyCents: 1999,
    priceYearlyCents: 19999,
    stripePriceIdMonthly: 'price_guardian_monthly',
    stripePriceIdYearly: 'price_guardian_yearly',
    active: true,
    features: JSON.stringify([
      'Everything in Navigator',
      '24/7 emergency assistance',
      'Real-time safety alerts',
      'Concierge booking help',
      'Travel insurance integration',
      'Phone support',
      'Exclusive guardian events',
    ]),
  },
];

export async function seedSubscriptionPlans() {
  console.log('Seeding subscription plans...');

  for (const plan of tier2SubscriptionPlans) {
    await db.insert(subscriptionPlans)
      .values(plan)
      .onConflictDoUpdate({
        target: subscriptionPlans.tier,
        set: { ...plan, updatedAt: new Date() },
      })
      .catch((err) => {
        console.error(`Failed to seed subscription plan ${plan.tier}:`, err);
      });
  }

  console.log(`Seeded ${tier2SubscriptionPlans.length} subscription plans`);
}
