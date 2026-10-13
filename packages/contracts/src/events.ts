import { z } from 'zod';
import { Id, NetworkAudience, TeamAudience, Timestamp } from './common';
import { ModerationStatus } from './moderation';
import { UserSummary } from './users';

/** Who can see and RSVP: one team and its families, or everyone on Team IMPACT. */
export const EventAudience = z.discriminatedUnion('scope', [TeamAudience, NetworkAudience]);
export type EventAudience = z.infer<typeof EventAudience>;

export const RSVP_STATUSES = ['going', 'not_going'] as const;
export const RsvpStatus = z.enum(RSVP_STATUSES);
export type RsvpStatus = z.infer<typeof RsvpStatus>;

/**
 * An event is a post with a title, time, place, description and visibility. Every event shows who
 * made it and their role, so families can tell a coach's event from an unknown alumnus's. No
 * tickets or check-in. Named to stay clear of the DOM's global `Event`.
 */
export const CalendarEvent = z.object({
  id: Id,
  title: z.string(),
  details: z.string().nullable(),
  startsAt: Timestamp,
  endsAt: Timestamp.nullable(),
  location: z.string(),
  host: UserSummary,
  audience: EventAudience,
  goingCount: z.number().int().nonnegative(),
  /** The viewer's answer; null if they haven't replied. */
  myRsvp: RsvpStatus.nullable(),
  moderation: ModerationStatus,
  createdAt: Timestamp,
});
export type CalendarEvent = z.infer<typeof CalendarEvent>;

/** Parents and teens can't create events; everyone else can. The host is RSVP'd going. */
export const CreateEventRequest = z
  .object({
    title: z.string().trim().min(1).max(120),
    details: z.string().trim().max(2000).optional(),
    startsAt: Timestamp,
    endsAt: Timestamp.optional(),
    location: z.string().trim().min(1, 'Where is it?').max(200),
    audience: EventAudience,
  })
  .refine((e) => !e.endsAt || Date.parse(e.endsAt) > Date.parse(e.startsAt), {
    path: ['endsAt'],
    message: 'End after it starts.',
  });
export type CreateEventRequest = z.infer<typeof CreateEventRequest>;

export const RsvpRequest = z.object({ status: RsvpStatus });
export type RsvpRequest = z.infer<typeof RsvpRequest>;

/** The RSVP list, for the organizer. */
export const EventAttendee = z.object({
  user: UserSummary,
  status: RsvpStatus,
  respondedAt: Timestamp,
});
export type EventAttendee = z.infer<typeof EventAttendee>;
