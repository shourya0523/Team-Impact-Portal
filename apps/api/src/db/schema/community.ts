import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { at, createdAt, id } from './columns';
import { moderationStatus, postType, postVisibility, reactionKind, rsvpState } from './enums';
import { users } from './identity';
import { groups } from './teams';

export const posts = pgTable(
  'posts',
  {
    id: id(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    type: postType('type').notNull().default('text'),
    payload: jsonb('payload').notNull(),
    visibility: postVisibility('visibility').notNull().default('group'),
    status: moderationStatus('status').notNull().default('pending'),
    createdAt: createdAt(),
  },
  (t) => [
    index('posts_group_created_idx').on(t.groupId, t.createdAt),
    index('posts_author_id_idx').on(t.authorId),
    index('posts_network_feed_idx')
      .on(t.createdAt)
      .where(sql`${t.status} = 'approved' and ${t.visibility} = 'network'`),
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
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    hostId: uuid('host_id').references(() => users.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    startsAt: at('starts_at').notNull(),
    location: text('location'),
    status: moderationStatus('status').notNull().default('pending'),
    createdAt: createdAt(),
  },
  (t) => [
    index('events_group_starts_idx').on(t.groupId, t.startsAt),
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
