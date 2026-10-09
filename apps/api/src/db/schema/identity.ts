import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { at, createdAt, id } from './columns';
import {
  channelPreference,
  contactChannel,
  contactScope,
  devicePlatform,
  userStatus,
  userType,
} from './enums';
import { orgs } from './employer';
import { colleges, teams } from './teams';

/**
 * Everyone who logs in. Minor status is derived from `dob`, never stored. Type-specific columns are
 * nullable: athletes use college/major/grad_year, alumni add current_employer and the hiring /
 * mentoring flags, recruiters use org_id.
 */
export const users = pgTable(
  'users',
  {
    id: id(),
    userType: userType('user_type').notNull(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    dob: date('dob', { mode: 'string' }).notNull(),
    emailVerifiedAt: at('email_verified_at'),
    status: userStatus('status').notNull().default('active'),
    // Requires a published card; enforced in the access layer.
    openToRecruiting: boolean('open_to_recruiting').notNull().default(false),
    channelPreference: channelPreference('channel_preference').notNull().default('both'),
    createdAt: createdAt(),
    // Account deletion: hidden as soon as this is set, hard-deleted with cascade after 30 days (TI-79).
    deletedAt: at('deleted_at'),

    collegeId: uuid('college_id').references(() => colleges.id, { onDelete: 'set null' }),
    hometown: text('hometown'),
    major: text('major'),
    gradYear: integer('grad_year'),
    industry: text('industry'),
    jobTitle: text('job_title'),
    hiring: boolean('hiring'),
    mentoring: boolean('mentoring'),
    // A verified recruiting org. Where an alumnus works now is current_employer, not this.
    orgId: uuid('org_id').references(() => orgs.id, { onDelete: 'set null' }),
    currentEmployer: text('current_employer'),
    phone: text('phone'),
    linkedinUrl: text('linkedin_url'),
  },
  (t) => [
    index('users_college_id_idx').on(t.collegeId),
    index('users_org_id_idx').on(t.orgId),
    index('users_pending_erasure_idx')
      .on(t.deletedAt)
      .where(sql`${t.deletedAt} is not null`),
  ],
);

/** Append-only consent history. The current value of a flag is its latest row. */
export const consentRecords = pgTable(
  'consent_records',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    flag: text('flag').notNull(),
    value: boolean('value').notNull(),
    termsVersion: text('terms_version'),
    createdAt: createdAt(),
  },
  (t) => [index('consent_records_user_flag_idx').on(t.userId, t.flag, t.createdAt)],
);

/** Under-13 profile run by a parent. No login and no birthdate: only an age. */
export const children = pgTable(
  'children',
  {
    id: id(),
    parentUserId: uuid('parent_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Copied from the parent's membership at join time.
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
    firstName: text('first_name').notNull(),
    photoStorageKey: text('photo_storage_key'),
    age: smallint('age').notNull(),
    bio: text('bio'),
    createdAt: createdAt(),
  },
  (t) => [
    index('children_parent_user_id_idx').on(t.parentUserId),
    index('children_team_id_idx').on(t.teamId),
    check('children_age_under_13', sql`${t.age} between 0 and 12`),
  ],
);

export const blocks = pgTable(
  'blocks',
  {
    id: id(),
    blockerId: uuid('blocker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedId: uuid('blocked_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    unique('blocks_blocker_blocked_key').on(t.blockerId, t.blockedId),
    index('blocks_blocked_id_idx').on(t.blockedId),
    check('blocks_not_self', sql`${t.blockerId} <> ${t.blockedId}`),
  ],
);

/** Which contact channels each audience sees. The values themselves live on users. */
export const contactVisibility = pgTable(
  'contact_visibility',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scope: contactScope('scope').notNull(),
    channel: contactChannel('channel').notNull(),
    visible: boolean('visible').notNull().default(false),
  },
  (t) => [unique('contact_visibility_user_scope_channel_key').on(t.userId, t.scope, t.channel)],
);

export const deviceTokens = pgTable(
  'device_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: devicePlatform('platform').notNull(),
    token: text('token').notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [index('device_tokens_user_id_idx').on(t.userId)],
);
