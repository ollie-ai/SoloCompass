/**
 * Shared configuration utilities
 * Exports for consumption by other packages
 */

export const appConfig = {
  name: 'solocompass',
  version: '1.0.0',
  apiPrefix: '/api/v1',
} as const;

export const dbConfig = {
  /** Pool connection config for Prisma/Drizzle */
  pool: {
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
} as const;

export const authConfig = {
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  unsubscribeTokenExpiry: '30d',
  cookieSecure: process.env.NODE_ENV === 'production',
  cookieSameSite: 'lax' as const,
} as const;

export const corsConfig = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
} as const;

export const loggerConfig = {
  level: process.env.LOG_LEVEL || 'info',
  service: 'solocompass',
} as const;

export default {
  app: appConfig,
  database: dbConfig,
  auth: authConfig,
  cors: corsConfig,
  logger: loggerConfig,
};