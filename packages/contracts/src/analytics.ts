import { z } from 'zod';
import { Id } from './common';
import { ContactSharing } from './contacts';
import { RsvpStatus } from './events';
import type { Post } from './posts';
import { Role } from './roles';
import { AthleteSearchQuery } from './search';
import { FindTeamsQuery, StaffUpdateTeamRequest } from './teams';
import { FindAlumniQuery } from './users';

/**
 * Product analytics and the audit trail, kept in the `events_log` table in our own Postgres rather
 * than an analytics vendor, so they're backed up, access-controlled and deleted like everything
 * else. Every event name and property shape is defined here; callers pick from this list and
 * can't invent one. Names are `object.action`, as in docs/data-model.md.
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
 * Nothing here records which communities someone posts in or joins: a medical community's
 * membership must not leak beyond the community (PRD §5). Check-in and interest events were
 * dropped with those features in PRD v2.
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

/** Recruiters search athletes; athletes search alumni; joiners search teams. */
export const SEARCH_SURFACES = ['athletes', 'alumni', 'teams'] as const;

/** Which query keys a search set, never their values. The identity filter is its own event. */
const SearchFilter = z.enum([
  ...new Set([
    ...AthleteSearchQuery.omit({ cursor: true, limit: true, communityId: true }).keyof().options,
    ...FindTeamsQuery.keyof().options,
    ...FindAlumniQuery.keyof().options,
  ]),
]);
export type SearchFilter = z.infer<typeof SearchFilter>;

/** The filters a parsed search query set, for `search.run` and `search.identity_filter`. */
export const searchFilters = (query: Record<string, unknown>): SearchFilter[] =>
  Object.keys(query).filter(
    (key): key is SearchFilter =>
      SearchFilter.safeParse(key).success && query[key] !== undefined && query[key] !== '',
  );

const count = z.number().int().nonnegative();

export const TRACKED_EVENTS = {
  /** A new account, from any sign-up path (open, coach invite, recruiter). */
  'user.signed_up': {
    source: 'api',
    subject: false,
    properties: z.strictObject({ role: Role }),
  },
  /** Staff created a team. */
  'team.created': {
    source: 'api',
    subject: false,
    properties: z.strictObject({ teamId: Id }),
  },
  /** Which settings changed, not what to. */
  'team.updated': {
    source: 'api',
    subject: false,
    properties: z.strictObject({
      teamId: Id,
      fields: z.array(StaffUpdateTeamRequest.keyof()).min(1),
    }),
  },
  /** The invite row holds the address; the log doesn't. */
  'coach.invited': {
    source: 'api',
    subject: false,
    properties: z.strictObject({ teamId: Id, inviteId: Id }),
  },
  /** The subject is the new coach: through an accepted invite, or added by another coach. */
  'coach.added': {
    source: 'api',
    subject: true,
    properties: z.strictObject({ teamId: Id, via: z.enum(['invite', 'coach']) }),
  },
  /** Staff made an interest community a recruiter filter. */
  'community.marked_official': {
    source: 'api',
    subject: false,
    properties: z.strictObject({ communityId: Id }),
  },
  /** The slow lane: a request is waiting on a coach. */
  'join_request.created': {
    source: 'api',
    subject: false,
    properties: z.strictObject({
      joinRequestId: Id,
      teamId: Id,
      role: Role.extract(['athlete', 'parent', 'teen']),
    }),
  },
  /** The fast lane: a team code was redeemed and the user is on the team. */
  'qr_code.redeemed': {
    source: 'api',
    subject: false,
    properties: z.strictObject({ teamId: Id, qrCodeId: Id }),
  },
  /** Each publish, which saves a new version. An athlete's first one is their first card. */
  'card.published': {
    source: 'api',
    subject: false,
    properties: z.strictObject({ cardId: Id }),
  },
  /** Posts, announcements and sponsor opportunities, when submitted (before moderation). */
  'post.created': {
    source: 'api',
    subject: false,
    properties: z.strictObject({ postId: Id, kind: z.enum(POST_KINDS) }),
  },
  'rsvp.set': {
    source: 'api',
    subject: false,
    properties: z.strictObject({ calendarEventId: Id, status: RsvpStatus }),
  },
  /** Any search without the identity filter. `searchId` ties it to its result rows. */
  'search.run': {
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
   * A recruiter search filtered by an official community, logged instead of `search.run`. Every
   * one is logged (the staff and counsel log reads these): if the write fails, the search fails.
   */
  'search.identity_filter': {
    source: 'api',
    subject: false,
    properties: z.strictObject({
      searchId: Id,
      communityId: Id,
      companyId: Id,
      filters: z.array(SearchFilter),
      resultCount: count,
    }),
  },
  /**
   * One row per person on the page of results a search returned, with the searcher as user and
   * them as subject. `position` is their place on that page.
   */
  'search.result_shown': {
    source: 'api',
    subject: true,
    properties: z.strictObject({ searchId: Id, position: count }),
  },
  /** A card opened full-screen, wherever it came from. The subject is the card's athlete. */
  'card.viewed': {
    source: 'client',
    subject: true,
    properties: z.strictObject({ cardId: Id }),
  },
  /** A shared contact detail revealed, copied or tapped. The subject is its owner. */
  'contact.viewed': {
    source: 'client',
    subject: true,
    properties: z.strictObject({ channel: ContactSharing.keyof() }),
  },
  /** A recruiter added an athlete to a list. */
  'list.athlete_saved': {
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
  clientEvent('card.viewed'),
  clientEvent('contact.viewed'),
]);
export type TrackEventRequest = z.input<typeof TrackEventRequest>;
