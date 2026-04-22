/**
 * App Error class for standardized errors
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    this.details = details;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error factories
export const Errors = {
  badRequest: (message: string, code?: string) => 
    new AppError(message, 400, code),
  
  unauthorized: (message: string = 'Unauthorized', code?: string) => 
    new AppError(message, 401, code),
  
  forbidden: (message: string = 'Forbidden', code?: string) => 
    new AppError(message, 403, code),
  
  notFound: (message: string = 'Not found', code?: string) => 
    new AppError(message, 404, code),
  
  conflict: (message: string, code?: string) => 
    new AppError(message, 409, code),
  
  rateLimited: (message: string = 'Too many requests', code?: string) => 
    new AppError(message, 429, code),
  
  internal: (message: string = 'Internal server error', code?: string) => 
    new AppError(message, 500, code),
} as const;
