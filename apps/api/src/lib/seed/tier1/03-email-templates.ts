/**
 * Tier 1 Seed: Email Templates
 * Transactional email templates
 */

import { db } from '../../db';
import { emailTemplates } from '../../schema/email-templates';

export const tier1EmailTemplates = [
  {
    slug: 'welcome',
    name: 'Welcome Email',
    subject: 'Welcome to SoloCompass - Your Solo Travel Journey Begins!',
    htmlBody: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Welcome</title></head>
<body>
  <h1>Welcome to SoloCompass, {{name}}!</h1>
  <p>Your solo travel journey is about to begin. We're excited to have you join our community of brave explorers.</p>
  <p>With SoloCompass, you can:</p>
  <ul>
    <li>Discover safe destinations curated for solo travelers</li>
    <li>Plan your adventures with AI-powered itineraries</li>
    <li>Stay informed with real-time safety updates</li>
  </ul>
  <p>Ready to start exploring?</p>
  <a href="{{appUrl}}">Get Started</a>
</body>
</html>`,
    textBody: `Welcome to SoloCompass, {{name}}!

Your solo travel journey is about to begin. We're excited to have you join our community of brave explorers.

With SoloCompass, you can:
- Discover safe destinations curated for solo travelers
- Plan your adventures with AI-powered itineraries
- Stay informed with real-time safety updates

Ready to start exploring?
Visit {{appUrl}}`,
    senderName: 'SoloCompass Team',
    senderEmail: 'hello@solocompass.app',
    category: 'onboarding',
    isActive: true,
  },
  {
    slug: 'verify-email',
    name: 'Verify Email',
    subject: 'Verify your SoloCompass email',
    htmlBody: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Verify Email</title></head>
<body>
  <h1>Verify your email</h1>
  <p>Hi {{name}},</p>
  <p>Please verify your email address by clicking the button below:</p>
  <a href="{{verifyUrl}}">Verify Email</a>
  <p>This link expires in 24 hours.</p>
  <p>If you didn't create an account, please ignore this email.</p>
</body>
</html>`,
    textBody: `Hi {{name}},

Please verify your email address by clicking the link below:
{{verifyUrl}}

This link expires in 24 hours.

If you didn't create an account, please ignore this email.`,
    senderName: 'SoloCompass',
    senderEmail: 'noreply@solocompass.app',
    category: 'auth',
    isActive: true,
  },
  {
    slug: 'password-reset',
    name: 'Password Reset',
    subject: 'Reset your SoloCompass password',
    htmlBody: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Password Reset</title></head>
<body>
  <h1>Reset your password</h1>
  <p>Hi {{name}},</p>
  <p>You requested to reset your password. Click the button below:</p>
  <a href="{{resetUrl}}">Reset Password</a>
  <p>This link expires in 1 hour.</p>
  <p>If you didn't request a password reset, please ignore this email or contact support.</p>
</body>
</html>`,
    textBody: `Hi {{name}},

You requested to reset your password. Click the link below:
{{resetUrl}}

This link expires in 1 hour.

If you didn't request a password reset, please ignore this email.`,
    senderName: 'SoloCompass',
    senderEmail: 'noreply@solocompass.app',
    category: 'auth',
    isActive: true,
  },
  {
    slug: 'subscription-confirmation',
    name: 'Subscription Confirmation',
    subject: 'Your SoloCompass subscription is confirmed',
    htmlBody: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Subscription Confirmed</title></head>
<body>
  <h1>Subscription Confirmed!</h1>
  <p>Hi {{name}},</p>
  <p>Thank you for subscribing to <strong>{{planName}}</strong>!</p>
  <p>Your subscription details:</p>
  <ul>
    <li>Plan: {{planName}}</li>
    <li>Amount: {{amount}}</li>
    <li>Billing: {{billingPeriod}}</li>
  </ul>
  <p>You now have access to all {{planName}} features.</p>
  <a href="{{dashboardUrl}}">Go to Dashboard</a>
</body>
</html>`,
    textBody: `Subscription Confirmed!

Hi {{name}},

Thank you for subscribing to {{planName}}!

Your subscription details:
- Plan: {{planName}}
- Amount: {{amount}}
- Billing: {{billingPeriod}}

You now have access to all {{planName}} features.
Visit {{dashboardUrl}}`,
    senderName: 'SoloCompass',
    senderEmail: 'billing@solocompass.app',
    category: 'billing',
    isActive: true,
  },
];

export async function seedEmailTemplates() {
  console.log('Seeding email templates...');

  for (const template of tier1EmailTemplates) {
    await db.insert(emailTemplates)
      .values(template)
      .onConflictDoUpdate({
        target: emailTemplates.slug,
        set: { ...template, updatedAt: new Date() },
      })
      .catch((err) => {
        console.error(`Failed to seed email template ${template.slug}:`, err);
      });
  }

  console.log(`Seeded ${tier1EmailTemplates.length} email templates`);
}
