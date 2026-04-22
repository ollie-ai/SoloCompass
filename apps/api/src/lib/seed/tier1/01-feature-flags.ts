/**
 * Tier 1 Seed: Feature Flags
 * Core feature toggles for the application
 */

import { db } from '../../db';
import { featureFlags } from '../../schema/feature-flags';

export const tier1FeatureFlags = [
  {
    key: 'new_dashboard',
    description: 'Enable the new dashboard experience',
    enabled: true,
    rolloutPercent: 100,
  },
  {
    key: 'beta_search',
    description: 'Enable beta search functionality',
    enabled: false,
    rolloutPercent: 0,
  },
  {
    key: 'social_features',
    description: 'Enable social sharing and connections',
    enabled: true,
    rolloutPercent: 50,
  },
  {
    key: 'premium_support',
    description: 'Enable premium support chat',
    enabled: false,
    rolloutPercent: 0,
  },
  {
    key: 'trip_collaboration',
    description: 'Enable collaborative trip planning',
    enabled: true,
    rolloutPercent: 25,
  },
  {
    key: 'offline_mode',
    description: 'Enable offline trip access',
    enabled: false,
    rolloutPercent: 0,
  },
  {
    key: 'ai_itinerary',
    description: 'Enable AI-powered itinerary generation',
    enabled: true,
    rolloutPercent: 10,
  },
];

export async function seedFeatureFlags() {
  console.log('Seeding feature flags...');

  for (const flag of tier1FeatureFlags) {
    await db.insert(featureFlags)
      .values(flag)
      .onConflictDoUpdate({
        target: featureFlags.key,
        set: { ...flag, updatedAt: new Date() },
      })
      .catch((err) => {
        console.error(`Failed to seed feature flag ${flag.key}:`, err);
      });
  }

  console.log(`Seeded ${tier1FeatureFlags.length} feature flags`);
}
