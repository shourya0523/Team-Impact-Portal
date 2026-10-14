import { type AnyPgColumn, index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { at, createdAt, id } from './columns';
import { moderationAction, reportSeverity, reportState, targetType } from './enums';
import { users } from './identity';

export const reports = pgTable(
  'reports',
  {
    id: id(),
    reporterId: uuid('reporter_id').references(() => users.id, { onDelete: 'set null' }),
    targetType: targetType('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    reason: text('reason').notNull(),
    state: reportState('state').notNull().default('open'),
    severity: reportSeverity('severity'),
    createdAt: createdAt(),
  },
  (t) => [
    index('reports_reporter_id_idx').on(t.reporterId),
    index('reports_target_idx').on(t.targetType, t.targetId),
    index('reports_queue_idx').on(t.state, t.severity),
  ],
);

/**
 * Append-only moderation history; appeals and their outcomes chain through parent_action_id. A null
 * actor is the automated classifier.
 */
export const moderationActions = pgTable(
  'moderation_actions',
  {
    id: id(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    targetType: targetType('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    action: moderationAction('action').notNull(),
    parentActionId: uuid('parent_action_id').references((): AnyPgColumn => moderationActions.id),
    reason: text('reason'),
    contentSnapshot: jsonb('content_snapshot'),
    createdAt: createdAt(),
  },
  (t) => [
    index('moderation_actions_actor_id_idx').on(t.actorId),
    index('moderation_actions_parent_id_idx').on(t.parentActionId),
    index('moderation_actions_target_idx').on(t.targetType, t.targetId),
  ],
);

/** Product analytics and audit trail, including team/coach changes and identity searches. */
export const eventsLog = pgTable(
  'events_log',
  {
    id: id(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    event: text('event').notNull(),
    properties: jsonb('properties').notNull().default({}),
    occurredAt: at('occurred_at').notNull().defaultNow(),
  },
  (t) => [
    index('events_log_user_id_idx').on(t.userId),
    index('events_log_event_occurred_idx').on(t.event, t.occurredAt),
  ],
);
