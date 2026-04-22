/**
 * Feature flags table schema
 * Feature toggles for gradual rollouts
 */

import { pgTable, uuid, varchar, timestamp, boolean, integer } from 'drizzle-orm/pg-core';

export const featureFlags = pgTable('feature_flags', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  description: varchar('description', { length: 500 }),
  enabled: boolean('enabled').notNull().default(false),
  rolloutPercent: integer('rollout_percent').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type NewFeatureFlag = typeof featureFlags.$inferInsert;