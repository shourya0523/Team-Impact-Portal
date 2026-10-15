import { z } from 'zod';
import { Id } from './common';
import { ContactSharing } from './contacts';
import { RsvpStatus } from './events';
import type { Post } from './posts';
import { Role } from './roles';
import { FindTeamsQuery } from './teams';
import { FindAlumniQuery } from './users';

/**
 * Product events, kept in the `events_log` table in our own Postgres rather than an analytics
 * vendor, so they're backed up, access-controlled and deleted like everything else. Every event
 * name and property shape is defined here; callers pick from this list and can't invent one.
 *
 * - **Properties** are ids, enums, counts and flags: never a name, an email or anything someone
 *   typed. The contract tests walk every schema to keep it that way. The user who did the thing
 *   is the row's user id, not a property.
 * - **Subject** is the person an event is about, for the PRD §12 log of what was shown to whom:
 *   the athlete in a recruiter's results, or whose card or contact details were opened. It's a
 *   column with a foreign key, so deleting either person deletes the row.
 * - **Source** `api` events are logged by the API where the action happens, in the same
 *   transaction when there is one; clients can't send them. `client` events are things only the
 *   app sees, sent through `POST /events`.
 *
 * Check-in and interest events were dropped with those features in PRD v2.
 */
interface EventDefinition {
  source: 'api' | 'client';
  subject: boolean;
  properties: z.ZodObject;
}

const POST_KINDS = [
  'post',
  'announcement',
  'opportunity',
] as const satisfies readonly Post['kind'][];
const AUDIENCE_SCOPES = [
  'team',
  'network',
  'group',
] as const satisfies readonly Post['audience']['scope'][];

/** Recruiters search athletes; athletes search alumni; joiners search teams. */
export const SEARCH_SURFACES = ['athletes', 'alumni', 'teams'] as const;

/**
 * Which query keys a search set, never their values. Add the recruiter athlete search's keys
 * when its query contract lands.
 */
const SearchFilter = z.enum([
  ...FindTeamsQuery.keyof().options,
  ...FindAlumniQuery.keyof().options,
]);

const count = z.number().int().nonnegative();

export const TRACKED_EVENTS = {
  /** A new account, from any sign-up path (open, coach invite, recruiter). */
  signed_up: {
    source: 'api',
    subject: false,
    properties: z.strictObject({ role: Role }),
  },
  /** The slow lane: a request is waiting on a coach. */
  join_requested: {
    source: 'api',
    subject: false,
    properties: z.strictObject({
      joinRequestId: Id,
      teamId: Id,
      role: Role.extract(['athlete', 'parent', 'teen']),
    }),
  },
  /** The fast lane: a team code was redeemed and the user is on the team. */
  qr_joined: {
    source: 'api',
    subject: false,
    properties: z.strictObject({ teamId: Id, qrCodeId: Id }),
  },
  /** A card went from unpublished to published. The first one per athlete is "first card". */
  card_published: {
    source: 'api',
    subject: false,
    properties: z.strictObject({ cardId: Id, season: z.number().int() }),
  },
  /** Posts, announcements and sponsor opportunities, when submitted (before moderation). */
  post_created: {
    source: 'api',
    subject: false,
    properties: z.strictObject({
      postId: Id,
      kind: z.enum(POST_KINDS),
      audience: z.enum(AUDIENCE_SCOPES),
    }),
  },
  rsvp_set: {
    source: 'api',
    subject: false,
    properties: z.strictObject({ calendarEventId: Id, status: RsvpStatus }),
  },
  /** Any search without an identity filter. `searchId` ties it to its `result_shown` rows. */
  search_run: {
    source: 'api',
    subject: false,
    properties: z.strictObject({
      searchId: Id,
      surface: z.enum(SEARCH_SURFACES),
      filters: z.array(SearchFilter),
      resultCount: count,
    }),
  },
  /**
   * A recruiter search filtered by official affinity groups, logged instead of `search_run`.
   * Every one is logged: if the write fails, the search fails.
   */
  identity_search_run: {
    source: 'api',
    subject: false,
    properties: z.strictObject({
      searchId: Id,
      groupIds: z.array(Id).min(1),
      filters: z.array(SearchFilter),
      resultCount: count,
    }),
  },
  /** One row per person returned by a search, with the searcher as user and them as subject. */
  result_shown: {
    source: 'api',
    subject: true,
    properties: z.strictObject({ searchId: Id, position: count }),
  },
  /** A card opened full-screen, wherever it came from. The subject is the card's athlete. */
  card_viewed: {
    source: 'client',
    subject: true,
    properties: z.strictObject({ cardId: Id }),
  },
  /** A shared contact detail revealed, copied or tapped. The subject is its owner. */
  contact_viewed: {
    source: 'client',
    subject: true,
    properties: z.strictObject({ channel: ContactSharing.keyof() }),
  },
  /** A recruiter added an athlete to a list. */
  saved_to_list: {
    source: 'api',
    subject: true,
    properties: z.strictObject({ listId: Id }),
  },
} as const satisfies Record<string, EventDefinition>;

export type TrackedEventName = keyof typeof TRACKED_EVENTS;
type Definition<N extends TrackedEventName> = (typeof TRACKED_EVENTS)[N];

export const TRACKED_EVENT_NAMES = Object.keys(TRACKED_EVENTS) as TrackedEventName[];

/** One event as `track()` takes it. `subjectId` is required exactly when the event has a subject. */
export type TrackedEvent<N extends TrackedEventName = TrackedEventName> = {
  [K in N]: {
    name: K;
    properties: z.input<Definition<K>['properties']>;
  } & (Definition<K>['subject'] extends true ? { subjectId: string } : { subjectId?: undefined });
}[N];

export type ClientEventName = {
  [K in TrackedEventName]: Definition<K>['source'] extends 'client' ? K : never;
}[TrackedEventName];

const clientEvent = <N extends ClientEventName>(name: N) =>
  z.strictObject({
    name: z.literal(name),
    // Without the cast TypeScript widens this to every client event's properties.
    properties: TRACKED_EVENTS[name].properties as Definition<N>['properties'],
    subjectId: Id,
  });

/**
 * `POST /events`: one client event. The user comes from the session, the time from the server.
 * The API also checks the subject is someone who still exists.
 */
export const TrackEventRequest = z.discriminatedUnion('name', [
  clientEvent('card_viewed'),
  clientEvent('contact_viewed'),
]);
export type TrackEventRequest = z.input<typeof TrackEventRequest>;
