/**
 * Error codes table schema
 * Catalog of application error codes for standardized error handling
 */

import { pgTable, varchar, timestamp, boolean, text } from 'drizzle-orm/pg-core';

export const errorCodes = pgTable('error_codes', {
  code: varchar('code', { length: 50 }).primaryKey(),
  message: varchar('message', { length: 500 }).notNull(),
  description: text('description'),
  httpStatusCode: varchar('http_status_code', { length: 10 }),
  isRetryable: boolean('is_retryable').default(false),
  isPublic: boolean('is_public').default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type ErrorCode = typeof errorCodes.$inferSelect;
export type NewErrorCode = typeof errorCodes.$inferInsert;