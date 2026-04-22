/**
 * Json API Response helpers
 */

import type { Response } from 'express';
import type { AppError } from './app-error';

interface ApiResponse<T = unknown> {
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

function response<T>(res: Response, statusCode: number, payload: ApiResponse<T>): Response {
  return res.status(statusCode).json(payload);
}

export const res = {
  ok<T>(res: Response, data: T, meta?: ApiResponse<T>['meta']) {
    return response(res, 200, { data, meta });
  },

  created<T>(res: Response, data: T) {
    return response(res, 201, { data });
  },

  noContent(res: Response) {
    return res.status(204).send();
  },

  error(res: Response, error: AppError | Error, statusCode?: number) {
    const code = (error as AppError).statusCode || statusCode || 500;
    const message = error.message;
    const errCode = (error as AppError).code;
    const details = (error as AppError).details;
    
    return response(res, code, {
      error: { message, code: errCode, details },
    });
  },

  notFound(res: Response, message = 'Resource not found') {
    return response(res, 404, { error: { message } });
  },

  unauthorized(res: Response, message = 'Unauthorized') {
    return response(res, 401, { error: { message } });
  },

  forbidden(res: Response, message = 'Forbidden') {
    return response(res, 403, { error: { message } });
  },

  badRequest(res: Response, message: string, details?: unknown) {
    return response(res, 400, { error: { message, details } });
  },

  rateLimited(res: Response, message = 'Too many requests') {
    return response(res, 429, { error: { message } });
  },

  paginated<T>(
    res: Response,
    data: T[],
    page: number,
    limit: number,
    total: number
  ) {
    const totalPages = Math.ceil(total / limit);
    return response(res, 200, {
      data,
      meta: { page, limit, total, totalPages },
    });
  },
};