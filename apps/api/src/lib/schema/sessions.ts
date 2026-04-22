/**
 * Sessions table schema
 * JWT and session tokens for authentication
 */

import { pgTable, uuid, timestamp, pgEnum, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

// Session type enum
export const sessionTypeEnum = pgEnum('session_type', ['access', 'refresh', 'unsubscribe']);

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: sessionTypeEnum('type').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 500 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;