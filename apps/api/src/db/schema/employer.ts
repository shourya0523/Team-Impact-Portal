import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { at, createdAt, id } from './columns';
import { orgStatus, orgTier, shortlistEntryStatus } from './enums';
import { users } from './identity';

/** Companies. Any verified email on one of their domains is admitted as a recruiter (no seats). */
export const orgs = pgTable('orgs', {
  id: id(),
  name: text('name').notNull(),
  tier: orgTier('tier').notNull().default('standard'),
  status: orgStatus('status').notNull().default('active'),
  createdAt: createdAt(),
});

export const orgDomains = pgTable(
  'org_domains',
  {
    id: id(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    domain: text('domain').notNull().unique(),
  },
  (t) => [index('org_domains_org_id_idx').on(t.orgId)],
);

export const savedSearches = pgTable(
  'saved_searches',
  {
    id: id(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    filterJson: jsonb('filter_json').notNull(),
    lastRunAt: at('last_run_at'),
    lastResultIds: jsonb('last_result_ids'),
  },
  (t) => [
    index('saved_searches_org_id_idx').on(t.orgId),
    index('saved_searches_created_by_idx').on(t.createdBy),
  ],
);

/** Lists shared across a company. `is_default` is where mobile quick-review swipes land. */
export const shortlists = pgTable(
  'shortlists',
  {
    id: id(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    isDefault: boolean('is_default').notNull().default(false),
  },
  (t) => [
    index('shortlists_org_id_idx').on(t.orgId),
    index('shortlists_created_by_idx').on(t.createdBy),
    uniqueIndex('shortlists_one_default_per_org')
      .on(t.orgId)
      .where(sql`${t.isDefault}`),
  ],
);

/**
 * athlete_id goes null when the athlete's account is erased, so the entry reads "profile withdrawn"
 * instead of breaking the list. The erasure job also sets status to withdrawn.
 */
export const shortlistEntries = pgTable(
  'shortlist_entries',
  {
    id: id(),
    shortlistId: uuid('shortlist_id')
      .notNull()
      .references(() => shortlists.id, { onDelete: 'cascade' }),
    athleteId: uuid('athlete_id').references(() => users.id, { onDelete: 'set null' }),
    addedBy: uuid('added_by').references(() => users.id, { onDelete: 'set null' }),
    addedAt: at('added_at').notNull().defaultNow(),
    status: shortlistEntryStatus('status').notNull().default('active'),
  },
  (t) => [
    unique('shortlist_entries_list_athlete_key').on(t.shortlistId, t.athleteId),
    index('shortlist_entries_athlete_id_idx').on(t.athleteId),
    index('shortlist_entries_added_by_idx').on(t.addedBy),
  ],
);

export const shortlistNotes = pgTable(
  'shortlist_notes',
  {
    id: id(),
    shortlistEntryId: uuid('shortlist_entry_id')
      .notNull()
      .references(() => shortlistEntries.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('shortlist_notes_entry_id_idx').on(t.shortlistEntryId),
    index('shortlist_notes_author_id_idx').on(t.authorId),
  ],
);
