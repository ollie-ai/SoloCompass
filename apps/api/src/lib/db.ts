/**
 * Database connection
 * Single postgres connection pool for the application
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

const connectionString = process.env['DATABASE_URL'] || '';

export const postgresClient = postgres(connectionString, {
  max: process.env['NODE_ENV'] === 'production' ? 10 : 2,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(postgresClient, { schema });

export type Database = typeof db;
