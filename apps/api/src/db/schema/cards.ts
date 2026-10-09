import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  smallint,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { at, createdAt, id } from './columns';
import { cardStatus, ingestedStatus, mediaKind, parseStatus } from './enums';
import { users } from './identity';
import { colleges } from './teams';

/**
 * Baseball Cards, one per athlete per season, versioned. Recruiter filters (TI-34) are real indexed
 * columns; everything else lives in payload. An unclaimed alumni card has no athlete yet, only the
 * ingested record it was built from.
 */
export const cards = pgTable(
  'cards',
  {
    id: id(),
    athleteId: uuid('athlete_id').references(() => users.id, { onDelete: 'cascade' }),
    ingestedRecordId: uuid('ingested_record_id').references(() => ingestedRecords.id, {
      onDelete: 'set null',
    }),
    season: text('season').notNull(),
    version: integer('version').notNull().default(1),
    status: cardStatus('status').notNull().default('draft'),
    completeness: smallint('completeness').notNull().default(0),
    sport: text('sport'),
    position: text('position'),
    gradYear: integer('grad_year'),
    major: text('major'),
    region: text('region'),
    city: text('city'),
    division: text('division'),
    payload: jsonb('payload').notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    unique('cards_athlete_season_version_key').on(t.athleteId, t.season, t.version),
    index('cards_ingested_record_id_idx').on(t.ingestedRecordId),
    check('cards_has_owner', sql`${t.athleteId} is not null or ${t.ingestedRecordId} is not null`),
    check('cards_completeness_range', sql`${t.completeness} between 0 and 100`),
    ...(['sport', 'gradYear', 'major', 'region', 'city', 'division'] as const).map((col) =>
      index(`cards_published_${t[col].name}_idx`)
        .on(t[col])
        .where(sql`${t.status} = 'published'`),
    ),
  ],
);

export const media = pgTable(
  'media',
  {
    id: id(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: mediaKind('kind').notNull(),
    storageKey: text('storage_key').notNull().unique(),
    width: integer('width'),
    height: integer('height'),
    parseStatus: parseStatus('parse_status'),
    parsedPayload: jsonb('parsed_payload'),
    createdAt: createdAt(),
  },
  (t) => [index('media_owner_user_id_idx').on(t.ownerUserId)],
);

/** Alumni rosters pulled from outside sources, claimable with a single-use token. */
export const ingestedRecords = pgTable(
  'ingested_records',
  {
    id: id(),
    source: text('source').notNull(),
    sourceRef: text('source_ref').notNull(),
    fetchedAt: at('fetched_at').notNull(),
    name: text('name').notNull(),
    collegeId: uuid('college_id').references(() => colleges.id, { onDelete: 'set null' }),
    years: text('years'),
    matchConfidence: real('match_confidence'),
    status: ingestedStatus('status').notNull().default('unmatched'),
    claimedByUserId: uuid('claimed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    // TI-4's claim_proof: the hash of a single-use claim token, never the token itself.
    claimTokenHash: text('claim_token_hash').unique(),
    claimedAt: at('claimed_at'),
  },
  (t) => [
    unique('ingested_records_source_ref_key').on(t.source, t.sourceRef),
    index('ingested_records_college_id_idx').on(t.collegeId),
    index('ingested_records_claimed_by_idx').on(t.claimedByUserId),
  ],
);
