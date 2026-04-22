/**
 * Seed Orchestrator
 * Main entry point for seeding the database
 */

import { seedFeatureFlags } from './tier1/01-feature-flags';
import { seedErrorCodes } from './tier1/02-error-codes';
import { seedEmailTemplates } from './tier1/03-email-templates';
import { seedLegalPages } from './tier1/04-legal-pages';
import { seedSubscriptionPlans } from './tier2/01-subscription-plans';
import { seedTaxonomyTerms } from './tier2/02-taxonomy';
import { seedDemoUser } from './tier3/01-demo-user';

export type SeedTier = 'tier1' | 'tier2' | 'tier3' | 'all';

export async function runSeed(tier: SeedTier = 'all') {
  console.log(`\n🟡 Starting database seed: ${tier}\n`);

  try {
    // Tier 1: Core infrastructure (feature flags, error codes, email templates, legal pages)
    if (tier === 'tier1' || tier === 'all') {
      await seedFeatureFlags();
      await seedErrorCodes();
      await seedEmailTemplates();
      await seedLegalPages();
    }

    // Tier 2: Configuration (subscription plans, taxonomy)
    if (tier === 'tier2' || tier === 'all') {
      await seedSubscriptionPlans();
      await seedTaxonomyTerms();
    }

    // Tier 3: Demo/development data
    if (tier === 'tier3' || tier === 'all') {
      await seedDemoUser();
    }

    console.log(`\n🟢 Seed completed: ${tier}\n`);
  } catch (error) {
    console.error(`\n🔴 Seed failed: ${tier}`, error);
    throw error;
  }
}

// Export individual seed functions for granular control
export {
  seedFeatureFlags,
  seedErrorCodes,
  seedEmailTemplates,
  seedLegalPages,
  seedSubscriptionPlans,
  seedTaxonomyTerms,
  seedDemoUser,
};