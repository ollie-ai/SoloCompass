/**
 * Legal pages table schema
 * Terms of service, privacy policy, cookie policy
 */

import { pgTable, uuid, varchar, timestamp, boolean, text } from 'drizzle-orm/pg-core';

export const legalPages = pgTable('legal_pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 100 }).notNull().unique(), // e.g., 'terms', 'privacy', 'cookies'
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(), // HTML content
  version: varchar('version', { length: 50 }).notNull(),
  isPublished: boolean('is_published').notNull().default(false),
  effectiveAt: timestamp('effective_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type LegalPage = typeof legalPages.$inferSelect;
export type NewLegalPage = typeof legalPages.$inferInsert;