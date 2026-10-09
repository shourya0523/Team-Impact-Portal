import { z } from 'zod';
import { Id, PersonName, Timestamp } from './common';
import { SharedContact } from './contacts';
import { Role } from './roles';

/** Enough to show who someone is next to a post, comment, request or note. */
export const UserSummary = z.object({
  id: Id,
  firstName: z.string(),
  lastName: z.string(),
  role: Role,
  avatarUrl: z.url().nullable(),
});
export type UserSummary = z.infer<typeof UserSummary>;

/** Push and email digests. Exact triggers are settled during build. */
export const NotificationPrefs = z.object({
  /** Join requests waiting on a coach, or the result of your own request. */
  approvals: z.boolean(),
  replies: z.boolean(),
  /** Events you RSVP'd to. */
  events: z.boolean(),
  announcements: z.boolean(),
  emailDigest: z.boolean(),
});
export type NotificationPrefs = z.infer<typeof NotificationPrefs>;

/** The signed-in account. Birth date is collected only to check age and is never returned. */
export const Me = UserSummary.extend({
  email: z.string(),
  teamIds: z.array(Id),
  notificationPrefs: NotificationPrefs,
  createdAt: Timestamp,
});
export type Me = z.infer<typeof Me>;

export const UpdateMeRequest = z.object({
  firstName: PersonName.optional(),
  lastName: PersonName.optional(),
  notificationPrefs: NotificationPrefs.partial().optional(),
});
export type UpdateMeRequest = z.infer<typeof UpdateMeRequest>;

export const PARENT_RELATIONSHIPS = ['parent', 'guardian'] as const;
export const ParentRelationship = z.enum(PARENT_RELATIONSHIPS);
export type ParentRelationship = z.infer<typeof ParentRelationship>;

/**
 * A child under 13. Children never log in: a parent or guardian runs the profile, and only the
 * child's team and family can see it. First name, age, interests and a photo are all there is,
 * by design: no health or diagnosis data, ever (both hard product rules).
 */
export const ChildProfile = z.object({
  id: Id,
  firstName: z.string(),
  age: z.number().int(),
  interests: z.string().nullable(),
  photoUrl: z.url().nullable(),
  teamId: Id.nullable(),
  parent: UserSummary,
  relationship: ParentRelationship,
});
export type ChildProfile = z.infer<typeof ChildProfile>;

const ChildFirstName = z.string().trim().min(1).max(40).regex(/^\S+$/, 'First name only, please.');

export const CreateChildProfileRequest = z.object({
  firstName: ChildFirstName,
  /** Kids 13 and up join with their own teen account instead. */
  age: z.number().int().min(3, 'Enter an age from 3 to 12.').max(12, 'Enter an age from 3 to 12.'),
  interests: z.string().trim().max(500).nullish(),
  relationship: ParentRelationship,
});
export type CreateChildProfileRequest = z.infer<typeof CreateChildProfileRequest>;

export const UpdateChildProfileRequest = CreateChildProfileRequest.partial();
export type UpdateChildProfileRequest = z.infer<typeof UpdateChildProfileRequest>;

/**
 * Former athletes, and former Team Impact kids back as mentors. Athletes find alumni; alumni never
 * browse athletes. Turning on mentoring or hiring makes the profile and contact details visible to
 * athletes. Alumni athletes also have a Baseball Card.
 */
export const AlumniProfile = z.object({
  user: UserSummary,
  /** Free text: alumni went to colleges well beyond the managed list. */
  college: z.string(),
  employer: z.string().nullable(),
  mentoring: z.boolean(),
  /** "Recruiting" in the PRD; named apart from athletes' open-to-recruiting. */
  hiring: z.boolean(),
  contact: SharedContact,
});
export type AlumniProfile = z.infer<typeof AlumniProfile>;

export const UpdateAlumniProfileRequest = z.object({
  college: z.string().trim().min(1).max(120).optional(),
  employer: z.string().trim().max(120).nullable().optional(),
  mentoring: z.boolean().optional(),
  hiring: z.boolean().optional(),
});
export type UpdateAlumniProfileRequest = z.infer<typeof UpdateAlumniProfileRequest>;

/** Athletes browse alumni who are mentoring or hiring, by college, employer and flag. */
export const FindAlumniQuery = z.object({
  college: z.string().trim().min(1).optional(),
  employer: z.string().trim().min(1).optional(),
  flag: z.enum(['mentoring', 'hiring']).optional(),
});
export type FindAlumniQuery = z.infer<typeof FindAlumniQuery>;
