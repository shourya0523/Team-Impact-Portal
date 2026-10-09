import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { at, createdAt, id } from './columns';
import {
  groupKind,
  groupVisibility,
  joinRequestStatus,
  membershipRole,
  membershipSource,
  teamGender,
  teamStatus,
} from './enums';
import { orgs } from './employer';
import { users } from './identity';

/** Managed list (PRD v2.1, TI-148): staff rename and merge colleges; teams never use free text. */
export const colleges = pgTable('colleges', {
  id: id(),
  name: text('name').notNull().unique(),
  region: text('region'),
  createdAt: createdAt(),
});

export const teams = pgTable(
  'teams',
  {
    id: id(),
    collegeId: uuid('college_id')
      .notNull()
      .references(() => colleges.id),
    sport: text('sport').notNull(),
    gender: teamGender('gender').notNull(),
    division: text('division'),
    displayName: text('display_name').notNull(),
    // Optional; clients fall back to brand navy (ui-tokens resolveTeamColor).
    color: text('color'),
    logoStorageKey: text('logo_storage_key'),
    status: teamStatus('status').notNull().default('live'),
    createdAt: createdAt(),
  },
  (t) => [
    unique('teams_college_sport_gender_key').on(t.collegeId, t.sport, t.gender),
    check('teams_color_hex', sql`${t.color} ~ '^#[0-9A-Fa-f]{6}$'`),
  ],
);

/** Staff invite a coach onto a team (TI-149). Only the token's hash is stored. */
export const coachInvites = pgTable(
  'coach_invites',
  {
    id: id(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    expiresAt: at('expires_at').notNull(),
    acceptedAt: at('accepted_at'),
    revokedAt: at('revoked_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('coach_invites_team_id_idx').on(t.teamId),
    index('coach_invites_invited_by_idx').on(t.invitedBy),
    uniqueIndex('coach_invites_one_open_per_email')
      .on(t.teamId, t.email)
      .where(sql`${t.acceptedAt} is null and ${t.revokedAt} is null`),
  ],
);

/**
 * Anything people post into. Team groups are backed by one team; `platform` is the single org-wide
 * announcements group. Only staff set `official`, and only on affinity groups.
 */
export const groups = pgTable(
  'groups',
  {
    id: id(),
    kind: groupKind('kind').notNull(),
    name: text('name').notNull(),
    visibility: groupVisibility('visibility').notNull().default('members'),
    teamId: uuid('team_id')
      .unique()
      .references(() => teams.id, { onDelete: 'cascade' }),
    collegeId: uuid('college_id').references(() => colleges.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id').references(() => orgs.id, { onDelete: 'cascade' }),
    official: boolean('official').notNull().default(false),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    index('groups_college_id_idx').on(t.collegeId),
    index('groups_org_id_idx').on(t.orgId),
    index('groups_created_by_idx').on(t.createdBy),
    check('groups_official_affinity_only', sql`not ${t.official} or ${t.kind} = 'affinity'`),
  ],
);

/** Confirmed members only: pending requests live in join_requests. */
export const memberships = pgTable(
  'memberships',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    role: membershipRole('role').notNull().default('member'),
    // e.g. '2025-26'. Lets roster dedupe (TI-36) resolve one athlete across years.
    season: text('season'),
    joinedAt: at('joined_at').notNull().defaultNow(),
    source: membershipSource('source').notNull(),
    // Per-member opt-in to the flagged official-affinity recruiter filter.
    searchable: boolean('searchable').notNull().default(false),
    joinCodeId: uuid('join_code_id').references(() => joinCodes.id, { onDelete: 'set null' }),
    // Set when a coach adds another coach directly.
    addedBy: uuid('added_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [
    unique('memberships_user_group_season_key')
      .on(t.userId, t.groupId, t.season)
      .nullsNotDistinct(),
    index('memberships_group_id_idx').on(t.groupId),
    index('memberships_join_code_id_idx').on(t.joinCodeId),
    index('memberships_added_by_idx').on(t.addedBy),
  ],
);

/** Team QR codes: one week by default, coaches can shorten or revoke. */
export const joinCodes = pgTable(
  'join_codes',
  {
    id: id(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    code: text('code').notNull().unique(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    expiresAt: at('expires_at')
      .notNull()
      .default(sql`now() + interval '7 days'`),
    revokedAt: at('revoked_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('join_codes_team_id_idx').on(t.teamId),
    index('join_codes_created_by_idx').on(t.createdBy),
  ],
);

export const joinRequests = pgTable(
  'join_requests',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    status: joinRequestStatus('status').notNull().default('pending'),
    requestedAt: at('requested_at').notNull().defaultNow(),
    decidedBy: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
    decidedAt: at('decided_at'),
  },
  (t) => [
    index('join_requests_user_id_idx').on(t.userId),
    index('join_requests_team_status_idx').on(t.teamId, t.status),
    index('join_requests_decided_by_idx').on(t.decidedBy),
    uniqueIndex('join_requests_one_pending')
      .on(t.userId, t.teamId)
      .where(sql`${t.status} = 'pending'`),
  ],
);
