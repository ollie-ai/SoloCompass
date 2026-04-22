/**
 * Taxonomy terms table schema
 * Hierarchical categorization data for destinations, tags, etc.
 */

import { pgTable, uuid, varchar, timestamp, pgEnum, integer, jsonb } from 'drizzle-orm/pg-core';

// Taxonomy group enum
export const taxonomyGroupEnum = pgEnum('taxonomy_group', [
  'travel_dna_archetype',
  'solo_vibe_tag',
  'best_for_tag',
  'caution_for_tag',
  'trip_style',
  'budget_band',
  'region',
  'advisory_stance',
  'source_label',
  'destination_palette',
]);

export const taxonomyTerms = pgTable('taxonomy_terms', {
  id: uuid('id').primaryKey().defaultRandom(),
  group: taxonomyGroupEnum('group').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  description: varchar('description', { length: 500 }),
  parentId: uuid('parent_id'), // For hierarchical taxonomies
  sortOrder: integer('sort_order').default(0),
  metadata: jsonb('metadata'), // Extended properties
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Unique constraint on group + slug
export const taxonomyTermsUnique = {
  groupSlug: { group: taxonomyTerms.group, slug: taxonomyTerms.slug },
} as const;

export type TaxonomyTerm = typeof taxonomyTerms.$inferSelect;
export type NewTaxonomyTerm = typeof taxonomyTerms.$inferInsert;