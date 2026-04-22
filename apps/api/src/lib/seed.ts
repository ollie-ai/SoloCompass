/**
 * Database seed orchestrator
 * Runs all seed scripts in dependency order
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema/index';

const connectionString = process.env['DATABASE_URL'] || '';

if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const client = postgres(connectionString);
export const db = drizzle(client, { schema });

interface SeedOptions {
  forceProd?: boolean;
  tier?: 1 | 2 | 3;
}

/**
 * Main seed orchestrator
 * Runs all tier seeds (essential data)
 */
async function seed(options: SeedOptions = {}) {
  const { forceProd = false, tier = 1 } = options;

  // Refuse prod seeding unless explicitly forced
  if (process.env['NODE_ENV'] === 'production' && !forceProd) {
    console.error('❌ Seeding production is not allowed without --force-prod flag');
    process.exit(1);
  }

  console.log(`🌱 Starting seed (tier ${tier}, forceProd: ${forceProd})`);

  try {
    // Tier 1: Essential data (feature flags, error codes, email templates, legal pages)
    if (tier >= 1) {
      await seedFeatureFlags();
      await seedErrorCodes();
      await seedEmailTemplates();
      await seedLegalPages();
    }

    // Tier 2: Configuration (subscription plans, taxonomy)
    if (tier >= 2) {
      await seedSubscriptionPlans();
      await seedTaxonomyTerms();
    }

    // Tier 3: Demo data (staging/preview only)
    if (tier >= 3 && process.env['NODE_ENV'] !== 'production') {
      await seedDemoUser();
    }

    console.log('✅ Seed completed successfully');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Import seed functions from the new seed module
// Re-export them here for backward compatibility
async function seedFeatureFlags() {
  console.log('  → Seeding feature flags...');
  const { seedFeatureFlags: fn } = await import('./seed/index');
  await fn();
}

async function seedErrorCodes() {
  console.log('  → Seeding error codes...');
  const { seedErrorCodes: fn } = await import('./seed/index');
  await fn();
}

async function seedEmailTemplates() {
  console.log('  → Seeding email templates...');
  const { seedEmailTemplates: fn } = await import('./seed/index');
  await fn();
}

async function seedLegalPages() {
  console.log('  → Seeding legal pages...');
  const { seedLegalPages: fn } = await import('./seed/index');
  await fn();
}

async function seedSubscriptionPlans() {
  console.log('  → Seeding subscription plans...');
  const { seedSubscriptionPlans: fn } = await import('./seed/index');
  await fn();
}

async function seedTaxonomyTerms() {
  console.log('  → Seeding taxonomy terms...');
  const { seedTaxonomyTerms: fn } = await import('./seed/index');
  await fn();
}

async function seedDemoUser() {
  console.log('  → Seeding demo user...');
  const { seedDemoUser: fn } = await import('./seed/index');
  await fn();
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: SeedOptions = {
  forceProd: args.includes('--force-prod'),
  tier: args.includes('--tier=3') ? 3 : args.includes('--tier=2') ? 2 : 1,
};

seed(options);