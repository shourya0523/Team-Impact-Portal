import { sql } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { at, createdAt, id } from './columns';
import {
  moderationStatus,
  notificationKind,
  notificationTarget,
  postType,
  reactionKind,
  rsvpState,
} from './enums';
import { users } from './identity';
import { communities } from './teams';

export const posts = pgTable(
  'posts',
  {
    id: id(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    type: postType('type').notNull().default('text'),
    payload: jsonb('payload').notNull(),
    status: moderationStatus('status').notNull().default('pending'),
    createdAt: createdAt(),
  },
  (t) => [
    index('posts_community_created_idx').on(t.communityId, t.createdAt),
    index('posts_author_id_idx').on(t.authorId),
  ],
);

export const comments = pgTable(
  'comments',
  {
    id: id(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    status: moderationStatus('status').notNull().default('pending'),
    createdAt: createdAt(),
  },
  (t) => [
    index('comments_post_created_idx').on(t.postId, t.createdAt),
    index('comments_author_id_idx').on(t.authorId),
  ],
);

export const reactions = pgTable(
  'reactions',
  {
    id: id(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: reactionKind('kind').notNull(),
  },
  (t) => [
    unique('reactions_post_user_kind_key').on(t.postId, t.userId, t.kind),
    index('reactions_user_id_idx').on(t.userId),
  ],
);

export const events = pgTable(
  'events',
  {
    id: id(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    hostId: uuid('host_id').references(() => users.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    details: text('details'),
    startsAt: at('starts_at').notNull(),
    endsAt: at('ends_at'),
    location: text('location'),
    status: moderationStatus('status').notNull().default('pending'),
    createdAt: createdAt(),
  },
  (t) => [
    index('events_community_starts_idx').on(t.communityId, t.startsAt),
    index('events_host_id_idx').on(t.hostId),
  ],
);

export const rsvps = pgTable(
  'rsvps',
  {
    id: id(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    state: rsvpState('state').notNull(),
    // Check-in is descoped for the pilot (PRD v2 §5); the column stays unused for now.
    checkedInAt: at('checked_in_at'),
  },
  (t) => [
    unique('rsvps_event_user_key').on(t.eventId, t.userId),
    index('rsvps_user_id_idx').on(t.userId),
  ],
);

/**
 * In-app notifications (PRD §5). Rows are only written for approved content and only while the
 * reader's switch for that kind is on; warnings always are. `community_id` lets the list drop rows
 * about a community the reader can no longer see.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: notificationKind('kind').notNull(),
    // Null for announcements, which show as from Team Impact.
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    text: text('text').notNull(),
    targetKind: notificationTarget('target_kind').notNull(),
    targetId: uuid('target_id').notNull(),
    communityId: uuid('community_id').references(() => communities.id, { onDelete: 'cascade' }),
    read: boolean('read').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index('notifications_user_created_idx').on(t.userId, t.createdAt),
    index('notifications_unread_idx')
      .on(t.userId)
      .where(sql`not ${t.read}`),
    index('notifications_actor_id_idx').on(t.actorId),
    index('notifications_community_id_idx').on(t.communityId),
  ],
);
