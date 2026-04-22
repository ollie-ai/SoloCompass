/**
 * Tier 2 Seed: Taxonomy Terms
 * Categorization data for destinations, tags, and archetypes
 */

import { db } from '../../db';
import { taxonomyTerms } from '../../schema/taxonomy';

// Travel DNA Archetypes
const travelArchetypes = [
  { name: 'The Pioneer', slug: 'pioneer', description: 'Seeking uncharted territories and first discoveries' },
  { name: 'The Cultural Immersionist', slug: 'cultural-immersionist', description: 'Deep diving into local traditions and customs' },
  { name: 'The Comfort Seeker', slug: 'comfort-seeker', description: 'Prefers established routes and quality amenities' },
  { name: 'The Budget Adventurer', slug: 'budget-adventurer', description: 'Maximizing experiences with minimal spending' },
  { name: 'The Thrill Chaser', slug: 'thrill-chaser', description: 'Seeking adrenaline and extreme experiences' },
  { name: 'The Tranquility Hunter', slug: 'tranquility-hunter', description: 'Searching for peace and relaxation' },
];

// Solo Vibe Tags
const soloVibeTags = [
  { name: 'Perfect for Solo', slug: 'perfect-for-solo', description: 'Highly solo-friendly destinations' },
  { name: 'Social Hub', slug: 'social-hub', description: 'Great for meeting fellow travelers' },
  { name: 'Self-Discovery', slug: 'self-discovery', description: 'Ideal for personal reflection' },
  { name: 'Digital Nomad Friendly', slug: 'digital-nomad-friendly', description: 'Good WiFi and coworking spaces' },
  { name: 'Adventure Solo', slug: 'adventure-solo', description: 'For the bold solo adventurer' },
  { name: 'Easy First Solo', slug: 'easy-first-solo', description: 'Beginner-friendly destination' },
];

// Best For Tags
const bestForTags = [
  { name: 'Beach & Relaxation', slug: 'beach-relaxation', description: 'Beach destinations and relaxation' },
  { name: 'City Exploration', slug: 'city-exploration', description: 'Urban adventures and culture' },
  { name: 'Mountain Trekking', slug: 'mountain-trekking', description: 'Hiking and mountain experiences' },
  { name: 'Wildlife & Nature', slug: 'wildlife-nature', description: 'Nature reserves and wildlife' },
  { name: 'Historical Sites', slug: 'historical-sites', description: 'Ancient ruins and history' },
  { name: 'Food & Culinary', slug: 'food-culinary', description: 'Culinary experiences and cuisine' },
  { name: 'Nightlife & Entertainment', slug: 'nightlife-entertainment', description: 'Vibrant nightlife scenes' },
  { name: 'Wellness & Spa', slug: 'wellness-spa', description: 'Spa and wellness retreats' },
];

// Caution For Tags
const cautionForTags = [
  { name: 'High Crime Area', slug: 'high-crime-area', description: 'Exercise increased caution' },
  { name: 'Political Unrest', slug: 'political-unrest', description: 'Potential civil unrest' },
  { name: 'Health Risks', slug: 'health-risks', description: 'Health advisories in effect' },
  { name: 'Natural Disasters', slug: 'natural-disasters', description: 'Prone to natural disasters' },
  { name: 'Scams Common', slug: 'scams-common', description: 'Targeted tourist scams' },
  { name: 'Solo Female Caution', slug: 'solo-female-caution', description: 'Extra precautions advised' },
  { name: 'LGBTQ+ Caution', slug: 'lgbtq-caution', description: 'Laws may restrict LGBTQ+ travelers' },
];

// Trip Styles
const tripStyles = [
  { name: 'Weekend Getaway', slug: 'weekend-getaway', description: 'Quick 2-3 day trips' },
  { name: 'Week-Long Adventure', slug: 'week-long', description: '7-10 day explorations' },
  { name: 'Extended Journey', slug: 'extended-journey', description: '2+ weeks of travel' },
  { name: 'Backpacking', slug: 'backpacking', description: 'Budget backpacker style' },
  { name: 'Luxury Escape', slug: 'luxury-escape', description: 'High-end travel experiences' },
  { name: 'Road Trip', slug: 'road-trip', description: 'Self-drive adventures' },
];

// Budget Bands
const budgetBands = [
  { name: 'Budget Backpacker', slug: 'budget-backpacker', description: 'Under $30/day' },
  { name: 'Mid-Range', slug: 'mid-range', description: '$30-100/day' },
  { name: 'Comfort Plus', slug: 'comfort-plus', description: '$100-200/day' },
  { name: 'Luxury', slug: 'luxury', description: '$200+/day' },
];

// Regions
const regions = [
  { name: 'North America', slug: 'north-america', description: 'USA, Canada, Mexico' },
  { name: 'South America', slug: 'south-america', description: 'Latin American destinations' },
  { name: 'Europe', slug: 'europe', description: 'European destinations' },
  { name: 'Middle East', slug: 'middle-east', description: 'Middle Eastern destinations' },
  { name: 'Africa', slug: 'africa', description: 'African destinations' },
  { name: 'South Asia', slug: 'south-asia', description: 'India, Sri Lanka, Nepal' },
  { name: 'Southeast Asia', slug: 'southeast-asia', description: 'Thailand, Vietnam, Indonesia' },
  { name: 'East Asia', slug: 'east-asia', description: 'Japan, Korea, China' },
  { name: 'Oceania', slug: 'oceania', description: 'Australia, New Zealand, Pacific' },
];

// Advisory Stances
const advisoryStances = [
  { name: 'Normal Precautions', slug: 'normal-precautions', description: 'Standard travel awareness' },
  { name: 'Increased Caution', slug: 'increased-caution', description: 'Exercise heightened awareness' },
  { name: 'Reconsider Travel', slug: 'reconsider-travel', description: 'Reconsider non-essential travel' },
  { name: 'Do Not Travel', slug: 'do-not-travel', description: 'Avoid all travel' },
];

function createTaxonomyEntries(
  group: 'travel_dna_archetype' | 'solo_vibe_tag' | 'best_for_tag' | 'caution_for_tag' | 'trip_style' | 'budget_band' | 'region' | 'advisory_stance',
  entries: Array<{ name: string; slug: string; description: string }>
) {
  return entries.map((entry, index) => ({
    group,
    name: entry.name,
    slug: entry.slug,
    description: entry.description,
    sortOrder: index,
  }));
}

export const tier2TaxonomyTerms = [
  ...createTaxonomyEntries('travel_dna_archetype', travelArchetypes),
  ...createTaxonomyEntries('solo_vibe_tag', soloVibeTags),
  ...createTaxonomyEntries('best_for_tag', bestForTags),
  ...createTaxonomyEntries('caution_for_tag', cautionForTags),
  ...createTaxonomyEntries('trip_style', tripStyles),
  ...createTaxonomyEntries('budget_band', budgetBands),
  ...createTaxonomyEntries('region', regions),
  ...createTaxonomyEntries('advisory_stance', advisoryStances),
];

export async function seedTaxonomyTerms() {
  console.log('Seeding taxonomy terms...');

  let seeded = 0;
  for (const term of tier2TaxonomyTerms) {
    await db.insert(taxonomyTerms)
      .values(term)
      .onConflictDoUpdate({
        target: [taxonomyTerms.group, taxonomyTerms.slug],
        set: { ...term, updatedAt: new Date() },
      })
      .then(() => { seeded++; })
      .catch((err) => {
        console.error(`Failed to seed taxonomy term ${term.group}/${term.slug}:`, err);
      });
  }

  console.log(`Seeded ${seeded} taxonomy terms`);
}
