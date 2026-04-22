/**
 * Subscription plans table schema
 * Subscription tiers and pricing
 */

import { pgTable, uuid, varchar, timestamp, boolean, integer, pgEnum } from 'drizzle-orm/pg-core';

// Subscription tier enum
export const subscriptionTierEnum = pgEnum('subscription_tier', ['explorer', 'navigator', 'guardian']);

export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  tier: subscriptionTierEnum('tier').notNull(),
  description: varchar('description', { length: 500 }),
  priceMonthlyCents: integer('price_monthly_cents').notNull(),
  priceYearlyCents: integer('price_yearly_cents').notNull(),
  stripePriceIdMonthly: varchar('stripe_price_id_monthly', { length: 100 }),
  stripePriceIdYearly: varchar('stripe_price_id_yearly', { length: 100 }),
  features: varchar('features', { length: 2000 }), // JSON string of features
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;