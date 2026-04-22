/**
 * Database seed orchestrator
 * Runs all seed scripts in dependency order
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema/index.js';

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
 * Runs all tier 1 seeds (essential data)
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
    // Tier 1: Essential data
    await seedAdminUser();
    await seedTaxonomies();
    await seedSubscriptionPlans();
    await seedFeatureFlags();
    await seedErrorCodes();
    await seedEmailTemplates();
    await seedLegalPages();

    // Tier 2: Demo data (staging/preview only)
    if (tier >= 2 && process.env['NODE_ENV'] !== 'production') {
      await seedDemoDestinations();
      await seedDemoUsers();
    }

    // Tier 3: Load test data (explicit flag only)
    if (tier >= 3) {
      await seedLoadTestData();
    }

    console.log('✅ Seed completed successfully');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Seed functions (placeholder implementations)
async function seedAdminUser() {
  console.log('  → Seeding admin user...');
  // TODO: Implement admin user seed
}

async function seedTaxonomies() {
  console.log('  → Seeding taxonomies...');
  // TODO: Implement taxonomy seeds
}

async function seedSubscriptionPlans() {
  console.log('  → Seeding subscription plans...');
  // TODO: Implement subscription plan seeds
}

async function seedFeatureFlags() {
  console.log('  → Seeding feature flags...');
  // TODO: Implement feature flag seeds
}

async function seedErrorCodes() {
  console.log('  → Seeding error codes...');
  // TODO: Implement error code seeds
}

async function seedEmailTemplates() {
  console.log('  → Seeding email templates...');
  // TODO: Implement email template seeds
}

async function seedLegalPages() {
  console.log('  → Seeding legal pages...');
  // TODO: Implement legal page seeds
}

async function seedDemoDestinations() {
  console.log('  → Seeding demo destinations (tier 2)...');
  // TODO: Implement destination seeds
}

async function seedDemoUsers() {
  console.log('  → Seeding demo users (tier 2)...');
  // TODO: Implement demo user seeds
}

async function seedLoadTestData() {
  console.log('  → Seeding load test data (tier 3)...');
  // TODO: Implement load test seed
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: SeedOptions = {
  forceProd: args.includes('--force-prod'),
  tier: args.includes('--tier=3') ? 3 : args.includes('--tier=2') ? 2 : 1,
};

seed(options);
