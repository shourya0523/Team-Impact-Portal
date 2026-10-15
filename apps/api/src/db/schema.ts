import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { ROLES } from '@team-impact/contracts';

// Starter table so migrations have something to run. TI-14 owns the full v2 data model.
export const roleEnum = pgEnum('role', ROLES);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

/**
 * Product events (`TRACKED_EVENTS` in contracts), written only through `track()` in
 * src/events-log.ts. Both user columns cascade, so hard-deleting a user (TI-79) removes what they
 * did and what was shown about them; setting `deleted_at` alone doesn't. Rows older than
 * `EVENTS_LOG_RETENTION_DAYS` are pruned daily.
 */
export const eventsLog = pgTable(
  'events_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    /** Who did it. */
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Who it's about, for events that have a subject. */
    subjectId: uuid('subject_id').references(() => users.id, { onDelete: 'cascade' }),
    properties: jsonb('properties').$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('events_log_name_occurred_at_idx').on(table.name, table.occurredAt),
    index('events_log_occurred_at_idx').on(table.occurredAt),
    index('events_log_user_id_idx').on(table.userId),
    index('events_log_subject_id_idx').on(table.subjectId),
  ],
);
