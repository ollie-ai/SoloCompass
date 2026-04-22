/**
 * Tier 1 Seed: Legal Pages
 * Terms of service, privacy policy, cookie policy
 */

import { db } from '../db.js';
import { legalPages } from '../schema/legal-pages.js';

export const tier1LegalPages = [
  {
    slug: 'terms-of-service',
    title: 'Terms of Service',
    version: '1.0.0',
    isPublished: true,
    effectiveAt: new Date('2024-01-01'),
    content: `<h1>Terms of Service</h1>
<p>Last updated: January 1, 2024</p>

<h2>1. Acceptance of Terms</h2>
<p>By accessing and using SoloCompass, you accept and agree to be bound by the terms and provision of this agreement.</p>

<h2>2. Description of Service</h2>
<p>SoloCompass provides solo travelers with destination safety information, trip planning tools, and related services.</p>

<h2>3. User Responsibilities</h2>
<p>You agree to:</p>
<ul>
<li>Provide accurate information</li>
<li>Maintain the security of your account</li>
<li>Not use the service for unlawful purposes</li>
<li>Not attempt to gain unauthorized access to any part of the service</li>
</ul>

<h2>4. Limitation of Liability</h2>
<p>SoloCompass provides information for planning purposes only. Users are responsible for verifying all safety information and making their own decisions about travel.</p>

<h2>5. Contact</h2>
<p>For questions about these terms, contact us at legal@solocompass.app</p>`,
  },
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    version: '1.0.0',
    isPublished: true,
    effectiveAt: new Date('2024-01-01'),
    content: `<h1>Privacy Policy</h1>
<p>Last updated: January 1, 2024</p>

<h2>1. Information We Collect</h2>
<p>We collect information you provide directly to us, including:</p>
<ul>
<li>Account information (name, email)</li>
<li>Profile information</li>
<li>Trip data and preferences</li>
<li>Payment information (processed by Stripe)</li>
</ul>

<h2>2. How We Use Information</h2>
<p>We use the information we collect to:</p>
<ul>
<li>Provide and maintain our services</li>
<li>Improve and personalize your experience</li>
<li>Send you important updates</li>
<li>Process payments</li>
<li>Comply with legal obligations</li>
</ul>

<h2>3. Data Protection</h2>
<p>We implement appropriate security measures to protect your personal information.</p>

<h2>4. Contact</h2>
<p>For questions about this policy, contact us at privacy@solocompass.app</p>`,
  },
  {
    slug: 'cookie-policy',
    title: 'Cookie Policy',
    version: '1.0.0',
    isPublished: true,
    effectiveAt: new Date('2024-01-01'),
    content: `<h1>Cookie Policy</h1>
<p>Last updated: January 1, 2024</p>

<h2>1. What Are Cookies</h2>
<p>Cookies are small text files stored on your device when you visit websites.</p>

<h2>2. How We Use Cookies</h2>
<p>We use cookies to:</p>
<ul>
<li>Keep you signed in</li>
<li>Understand how you use our service</li>
<li>Improve our services</li>
<li>Personalize content and ads</li>
</ul>

<h2>3. Managing Cookies</h2>
<p>You can control or delete cookies through your browser settings. Note that some features may not work properly without cookies.</p>

<h2>3rd Party Services</h2>
<p>We use third-party services that may set cookies:</p>
<ul>
<li>Stripe (payment processing)</li>
<li>Analytics services</li>
</ul>`,
  },
];

export async function seedLegalPages() {
  console.log('Seeding legal pages...');

  for (const page of tier1LegalPages) {
    await db.insert(legalPages)
      .values(page)
      .onConflictDoUpdate({
        target: legalPages.slug,
        set: { ...page, updatedAt: new Date() },
      })
      .catch((err) => {
        console.error(`Failed to seed legal page ${page.slug}:`, err);
      });
  }

  console.log(`Seeded ${tier1LegalPages.length} legal pages`);
}
