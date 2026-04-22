/**
 * Tier 1 Seed: Error Codes
 * Standardized error catalog for the application
 */

import { db } from '../db.js';
import { errorCodes } from '../schema/error-codes.js';

export const tier1ErrorCodes = [
  // Authentication errors (AUTH_*)
  {
    code: 'AUTH_INVALID_CREDENTIALS',
    message: 'Invalid email or password',
    description: 'The provided credentials do not match our records',
    httpStatusCode: '401',
    isRetryable: false,
    isPublic: true,
  },
  {
    code: 'AUTH_TOKEN_EXPIRED',
    message: 'Your session has expired',
    description: 'Please log in again to continue',
    httpStatusCode: '401',
    isRetryable: false,
    isPublic: true,
  },
  {
    code: 'AUTH_TOKEN_INVALID',
    message: 'Invalid authentication token',
    description: 'The provided token is not valid',
    httpStatusCode: '401',
    isRetryable: false,
    isPublic: true,
  },
  {
    code: 'AUTH_EMAIL_NOT_VERIFIED',
    message: 'Email not verified',
    description: 'Please verify your email address to continue',
    httpStatusCode: '403',
    isRetryable: false,
    isPublic: true,
  },
  {
    code: 'AUTH_ACCOUNT_SUSPENDED',
    message: 'Account suspended',
    description: 'Your account has been suspended. Contact support.',
    httpStatusCode: '403',
    isRetryable: false,
    isPublic: true,
  },

  // User errors (USER_*)
  {
    code: 'USER_NOT_FOUND',
    message: 'User not found',
    description: 'The requested user does not exist',
    httpStatusCode: '404',
    isRetryable: false,
    isPublic: false,
  },
  {
    code: 'USER_EMAIL_EXISTS',
    message: 'Email already registered',
    description: 'An account with this email already exists',
    httpStatusCode: '409',
    isRetryable: false,
    isPublic: true,
  },

  // Subscription errors (SUB_*)
  {
    code: 'SUB_EXPIRED',
    message: 'Subscription expired',
    description: 'Please renew your subscription to continue',
    httpStatusCode: '403',
    isRetryable: false,
    isPublic: true,
  },
  {
    code: 'SUB_TIER_INSUFFICIENT',
    message: 'Upgrade required',
    description: 'This feature requires a higher subscription tier',
    httpStatusCode: '403',
    isRetryable: false,
    isPublic: true,
  },
  {
    code: 'SUB_PAYMENT_FAILED',
    message: 'Payment failed',
    description: 'Unable to process payment. Please check your payment method.',
    httpStatusCode: '402',
    isRetryable: true,
    isPublic: true,
  },

  // Trip errors (TRIP_*)
  {
    code: 'TRIP_NOT_FOUND',
    message: 'Trip not found',
    description: 'The requested trip does not exist',
    httpStatusCode: '404',
    isRetryable: false,
    isPublic: true,
  },
  {
    code: 'TRIP_ACCESS_DENIED',
    message: 'Access denied',
    description: 'You do not have access to this trip',
    httpStatusCode: '403',
    isRetryable: false,
    isPublic: true,
  },

  // API errors (API_*)
  {
    code: 'API_RATE_LIMITED',
    message: 'Rate limit exceeded',
    description: 'Too many requests. Please try again later.',
    httpStatusCode: '429',
    isRetryable: true,
    isPublic: true,
  },
  {
    code: 'API_INTERNAL_ERROR',
    message: 'Internal server error',
    description: 'Something went wrong. Please try again later.',
    httpStatusCode: '500',
    isRetryable: true,
    isPublic: true,
  },
  {
    code: 'API_BAD_REQUEST',
    message: 'Invalid request',
    description: 'The request format is invalid',
    httpStatusCode: '400',
    isRetryable: false,
    isPublic: true,
  },
];

export async function seedErrorCodes() {
  console.log('Seeding error codes...');

  for (const error of tier1ErrorCodes) {
    await db.insert(errorCodes)
      .values(error)
      .onConflictDoUpdate({
        target: errorCodes.code,
        set: { ...error, updatedAt: new Date() },
      })
      .catch((err) => {
        console.error(`Failed to seed error code ${error.code}:`, err);
      });
  }

  console.log(`Seeded ${tier1ErrorCodes.length} error codes`);
}
