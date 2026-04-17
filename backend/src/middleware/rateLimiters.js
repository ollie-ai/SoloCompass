/**
 * Shared rate limiters for SoloCompass API routes.
 *
 * Each limiter is keyed by authenticated user-id (falling back to IP) so that
 * a single bad actor cannot exhaust quota for other users.
 */

import rateLimit from 'express-rate-limit';

const userKeyGenerator = (req) => String(req.userId || req.ip);

/**
 * General API limiter — 300 req / 15 min per user.
 * Apply to typical authenticated data endpoints.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  keyGenerator: userKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'SC-ERR-429', message: 'Too many requests. Please slow down.' },
  },
  skip: (req) => process.env.NODE_ENV === 'test',
});

/**
 * Search limiter — 60 req / 1 min per user.
 * Protects full-text search queries.
 */
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: userKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'SC-ERR-429', message: 'Too many search requests. Please slow down.' },
  },
  skip: (req) => process.env.NODE_ENV === 'test',
});

/**
 * Atlas AI limiter — 30 req / 1 min per user.
 * Secondary guard on top of the plan-level checkAILimits middleware.
 */
export const atlasLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: userKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'SC-ERR-429', message: 'Too many Atlas requests. Please slow down.' },
  },
  skip: (req) => process.env.NODE_ENV === 'test',
});
