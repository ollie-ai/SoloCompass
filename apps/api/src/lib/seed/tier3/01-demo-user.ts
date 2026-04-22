/**
 * Tier 3 Seed: Demo User
 * Demo user for development and testing
 */

import { db } from '../db.js';
import { users } from '../schema/users.js';
import { sessions } from '../schema/sessions.js';
import { subscriptionPlans } from '../schema/subscription-plans.js';
import { sql, eq } from 'drizzle-orm';

export const tier3DemoUser = {
  email: 'demo@solocompass.app',
  name: 'Demo User',
  passwordHash: '$2a$10$DEMO_USER_PLACEHOLDER_HASH_FOR_TESTING',
  role: 'member' as const,
  status: 'active' as const,
  emailVerified: true,
  avatarUrl: null,
};

export const tier3DemoSession = {
  userAgent: 'SoloCompass Demo',
  ipAddress: '127.0.0.1',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
};

export async function seedDemoUser() {
  console.log('Seeding demo user...');

  // Get the explorer plan ID
  const explorerPlan = await db.query.subscriptionPlans.findFirst({
    where: eq(subscriptionPlans.tier, 'explorer'),
  });

  if (!explorerPlan) {
    console.warn('Explorer subscription plan not found, skipping demo user seed');
    return;
  }

  // Check if demo user already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, tier3DemoUser.email),
  });

  if (existingUser) {
    console.log('Demo user already exists, updating...');
    // Update the demo user
    await db.update(users)
      .set({ ...tier3DemoUser, updatedAt: new Date() })
      .where(eq(users.id, existingUser.id));

    // Create a new session
    await db.insert(sessions)
      .values({
        userId: existingUser.id,
        ...tier3DemoSession,
      });

    console.log('Demo user updated');
    return;
  }

  // Create demo user
  const [newUser] = await db.insert(users)
    .values(tier3DemoUser)
    .returning();

  // Create session
  await db.insert(sessions)
    .values({
      userId: newUser.id,
      ...tier3DemoSession,
    });

  console.log('Demo user seeded');
}
