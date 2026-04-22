/**
 * Validation helpers using Zod
 */

import { z, type ZodError, type ZodIssue } from 'zod';

export { z };
export type { ZodError, ZodIssue };

/**
 * Parse and validate body, query, or params with a Zod schema
 */
export function validate<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  field = 'body'
): { success: true; data: T } | { success: false; errors: ZodIssue[] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { 
    success: false, 
    errors: result.error.issues.map(issue => ({
      ...issue,
      path: [field, ...issue.path],
    })) 
  };
}

/**
 * Common validators
 */
export const validators = {
  uuid: z.string().uuid(),
  email: z.string().email(),
  url: z.string().url(),
  
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
  
  dates: z.object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  }),
} as const;

/**
 * Create a paginated query schema
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function paginatedQuery(_schema: z.ZodObject<any>) {
  return z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
  });
}