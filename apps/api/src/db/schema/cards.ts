import { sql } from 'drizzle-orm';
import {
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
import { cardStatus, ingestedStatus, mediaPurpose, mediaStatus, parseStatus } from './enums';
import { children, users } from './identity';
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
    ...(['sport', 'gradYear', 'major', 'region', 'city', 'division'] as const).map((col) =>
      index(`cards_published_${t[col].name}_idx`)
        .on(t[col])
        .where(sql`${t.status} = 'published'`),
    ),
  ],
);

/**
 * Every stored file, uploaded through one signed-URL path (TI-111). The bucket is private: files are
 * read only through GET /media/:id, which checks who may see them.
 */
export const media = pgTable(
  'media',
  {
    id: id(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: mediaPurpose('purpose').notNull(),
    status: mediaStatus('status').notNull().default('pending'),
    // Set for child photos; the access layer shows them only to the child's team and family.
    childId: uuid('child_id').references(() => children.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull().unique(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    // When the uploader affirmed they have the right to share it. Required on every photo.
    rightsAffirmedAt: at('rights_affirmed_at'),
    takenDownAt: at('taken_down_at'),
    width: integer('width'),
    height: integer('height'),
    parseStatus: parseStatus('parse_status'),
    parsedPayload: jsonb('parsed_payload'),
    createdAt: createdAt(),
  },
  (t) => [
    index('media_owner_user_id_idx').on(t.ownerUserId),
    index('media_child_id_idx').on(t.childId),
  ],
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
