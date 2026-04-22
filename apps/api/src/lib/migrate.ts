/**
 * Database migration runner
 * Uses advisory lock to ensure single concurrent migrator
 */

import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema/index';

const connectionString = process.env['DATABASE_URL'] || '';

if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client, { schema });

async function runMigrations() {
  console.log('🔄 Running migrations...');

  // Acquire advisory lock to prevent concurrent migrations
  const lockResult = await client`SELECT pg_try_advisory_lock(1387138932) as acquired`;

  if (!lockResult[0]?.['acquired']) {
    console.error('❌ Could not acquire migration lock. Another migrator may be running.');
    process.exit(1);
  }

  console.log('🔒 Migration lock acquired');

  try {
    // Run pending migrations
    await migrate(db, { migrationsFolder: '../../db/migrations' });
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Release advisory lock
    await client`SELECT pg_advisory_unlock(1387138932)`;
    console.log('🔓 Migration lock released');
    await client.end();
  }
}

runMigrations();
