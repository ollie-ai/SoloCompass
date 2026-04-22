/**
 * SoloCompass Shared Types & Zod Schemas
 * These types are consumed by all apps and packages
 */

import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

/** Unique identifier */
export const idSchema = z.string().uuid();
export type Id = z.infer<typeof idSchema>;

/** Timestamp */
export const timestampSchema = z.string().datetime();
export type Timestamp = z.infer<typeof timestampSchema>;

// ============================================================================
// User Types
// ============================================================================

/** User roles */
export const userRoleSchema = z.enum(['super_admin', 'admin', 'member', 'viewer']);
export type UserRole = z.infer<typeof userRoleSchema>;

/** User status */
export const userStatusSchema = z.enum(['active', 'suspended', 'deactivated']);
export type UserStatus = z.infer<typeof userStatusSchema>;

/** User schema */
export const userSchema = z.object({
  id: idSchema,
  email: z.string().email(),
  name: z.string().min(1).max(255),
  role: userRoleSchema,
  status: userStatusSchema,
  emailVerified: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type User = z.infer<typeof userSchema>;

/** Create user input */
export const createUserInputSchema = userSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type CreateUserInput = z.infer<typeof createUserInputSchema>;

// ============================================================================
// Session Types
// ============================================================================

/** Session type */
export const sessionTypeSchema = z.enum(['access', 'refresh', 'unsubscribe']);
export type SessionType = z.infer<typeof sessionTypeSchema>;

/** Session schema */
export const sessionSchema = z.object({
  id: idSchema,
  userId: idSchema,
  type: sessionTypeSchema,
  expiresAt: timestampSchema,
  createdAt: timestampSchema,
});
export type Session = z.infer<typeof sessionSchema>;

// ============================================================================
// Taxonomy Types
// ============================================================================

/** Taxonomy group */
export const taxonomyGroupSchema = z.enum([
  'travel_dna_archetype',
  'solo_vibe_tag',
  'best_for_tag',
  'caution_for_tag',
  'trip_style',
  'budget_band',
  'region',
  'advisory_stance',
  'source_label',
  'destination_palette',
]);
export type TaxonomyGroup = z.infer<typeof taxonomyGroupSchema>;

/** Taxonomy term */
export const taxonomyTermSchema = z.object({
  id: idSchema,
  group: taxonomyGroupSchema,
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: timestampSchema,
});
export type TaxonomyTerm = z.infer<typeof taxonomyTermSchema>;

// ============================================================================
// Feature Flag Types
// ============================================================================

/** Feature flag */
export const featureFlagSchema = z.object({
  id: idSchema,
  key: z.string().min(1).max(255),
  description: z.string().optional(),
  enabled: z.boolean(),
  rolloutPercent: z.number().min(0).max(100),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type FeatureFlag = z.infer<typeof featureFlagSchema>;

// ============================================================================
// Subscription Plan Types
// ============================================================================

/** Subscription tier */
export const subscriptionTierSchema = z.enum(['explorer', 'navigator', 'guardian']);
export type SubscriptionTier = z.infer<typeof subscriptionTierSchema>;

/** Subscription plan */
export const subscriptionPlanSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(255),
  tier: subscriptionTierSchema,
  description: z.string().optional(),
  priceMonthlyCents: z.number().min(0),
  priceYearlyCents: z.number().min(0),
  stripePriceIdMonthly: z.string().optional(),
  stripePriceIdYearly: z.string().optional(),
  active: z.boolean(),
  createdAt: timestampSchema,
});
export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;

// ============================================================================
// API Response Types
// ============================================================================

/** API error codes */
export const apiErrorCodeSchema = z.enum([
  'SC-UNKNOWN',
  'SC-VALIDATION_ERROR',
  'SC-UNAUTHORIZED',
  'SC-FORBIDDEN',
  'SC-NOT_FOUND',
  'SC-RATE_LIMITED',
  'SC-INTERNAL_ERROR',
]);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

/** API response */
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }).optional(),
});
export type ApiResponse<T = unknown> = z.infer<typeof apiResponseSchema> & { data?: T };

/** Paginated response */
export const paginatedResponseSchema = z.object({
  items: z.array(z.unknown()),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  hasMore: z.boolean(),
});
export type PaginatedResponse<T> = z.infer<typeof paginatedResponseSchema> & { items: T[] };

// ============================================================================
// HTTP Types
// ============================================================================

/** HTTP methods */
export const httpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
export type HttpMethod = z.infer<typeof httpMethodSchema>;

/** Request query params */
export const requestQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
});
export type RequestQuery = z.infer<typeof requestQuerySchema>;

// ============================================================================
// Export all types
// ============================================================================

export * from './index.js';