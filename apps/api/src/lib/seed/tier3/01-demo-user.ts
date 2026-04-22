/**
 * Tier 3 Seed: Demo User
 * Demo user for development and testing
 */

import { db } from '../../db';
import { users } from '../../schema/users';
import { sessions } from '../../schema/sessions';
import { subscriptionPlans } from '../../schema/subscription-plans';
import { eq } from 'drizzle-orm';

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
  type: 'access' as const,
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
        type: tier3DemoSession.type,
        expiresAt: tier3DemoSession.expiresAt,
        ipAddress: tier3DemoSession.ipAddress,
        userAgent: tier3DemoSession.userAgent,
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
      type: tier3DemoSession.type,
      expiresAt: tier3DemoSession.expiresAt,
      ipAddress: tier3DemoSession.ipAddress,
      userAgent: tier3DemoSession.userAgent,
    });

  console.log('Demo user seeded');
}
