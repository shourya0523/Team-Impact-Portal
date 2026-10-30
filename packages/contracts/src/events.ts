import { z } from 'zod';
import { Id, Timestamp } from './common';
import { type Community, CommunitySummary } from './communities';
import { ModerationStatus } from './moderation';
import type { Role } from './roles';
import { UserSummary } from './users';

export const RSVP_STATUSES = ['going', 'maybe', 'not_going'] as const;
export const RsvpStatus = z.enum(RSVP_STATUSES);
export type RsvpStatus = z.infer<typeof RsvpStatus>;

/**
 * An event is a post with a title, time, place and description, in one community: its members see
 * it and can RSVP, so team events stay inside the team. Every event shows who made it and their
 * role, so families can tell a coach's event from an unknown alumnus's. No tickets or check-in.
 * Named to stay clear of the DOM's global `Event`.
 */
export const CalendarEvent = z.object({
  id: Id,
  title: z.string(),
  details: z.string().nullable(),
  startsAt: Timestamp,
  endsAt: Timestamp.nullable(),
  location: z.string(),
  host: UserSummary,
  community: CommunitySummary,
  goingCount: z.number().int().nonnegative(),
  /** The viewer's answer; null if they haven't replied. */
  myRsvp: RsvpStatus.nullable(),
  moderation: ModerationStatus,
  createdAt: Timestamp,
});
export type CalendarEvent = z.infer<typeof CalendarEvent>;

const eventFields = z.object({
  title: z.string().trim().min(1).max(120),
  details: z.string().trim().max(2000).optional(),
  startsAt: Timestamp,
  endsAt: Timestamp.optional(),
  location: z.string().trim().min(1, 'Where is it?').max(200),
});

const endsAfterStart = (e: { startsAt: string; endsAt?: string | undefined }) =>
  !e.endsAt || Date.parse(e.endsAt) > Date.parse(e.startsAt);
const endsAfterStartIssue = { path: ['endsAt'], message: 'End after it starts.' };

/** Parents and teens can't create events; everyone else can. The host is RSVP'd going. */
export const CreateEventRequest = eventFields
  .extend({ communityId: Id })
  .refine(endsAfterStart, endsAfterStartIssue);
export type CreateEventRequest = z.infer<typeof CreateEventRequest>;

/** Body of `POST /communities/:id/events`: the community is in the path. */
export const NewEventRequest = eventFields.refine(endsAfterStart, endsAfterStartIssue);
export type NewEventRequest = z.infer<typeof NewEventRequest>;

/**
 * Whether `role` may create an event in a community it sees (PRD §5): never parents or teens;
 * members otherwise, staff included. Recruiters belong to no community, so they host only in
 * official interest communities, the one place sponsors reach athletes.
 */
export const canCreateEventIn = (role: Role, community: Community) => {
  if (role === 'parent' || role === 'teen') return false;
  if (role === 'recruiter') return community.kind === 'interest' && community.official;
  return community.myMembership !== null;
};

export const RsvpRequest = z.object({ status: RsvpStatus });
export type RsvpRequest = z.infer<typeof RsvpRequest>;

/** The RSVP list, for the organizer. */
export const EventAttendee = z.object({
  user: UserSummary,
  status: RsvpStatus,
  respondedAt: Timestamp,
});
export type EventAttendee = z.infer<typeof EventAttendee>;
