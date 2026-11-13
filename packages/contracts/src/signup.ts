import { z } from 'zod';
import { AcceptCoachInviteRequest } from './auth';
import { CalendarDate, Id, PersonName, Timestamp, Token } from './common';
import { QrShortCode } from './qr-codes';
import { ageBand, ageOn } from './roles';
import { TeamSummary } from './teams';
import { UserSummary } from './users';

/**
 * Sign-up and joining a team: the shapes `auth.ts`, `join-requests.ts`, `qr-codes.ts` and
 * `teams.ts` don't already cover.
 */

/** The most children one parent can add in a single join request. */
export const MAX_CHILDREN_PER_REQUEST = 6;

/**
 * A child a parent adds to a join request (PRD §2). Children never log in and never get an
 * account or email. The birth date only proves they are under 13: the API keeps their age and
 * first name with a last initial, never the date.
 */
export const NewChild = z
  .object({
    firstName: PersonName,
    lastInitial: z
      .string()
      .trim()
      .regex(/^[A-Za-z]$/, 'Just the first letter of their last name')
      .transform((value) => value.toUpperCase()),
    birthDate: CalendarDate,
  })
  .superRefine((child, ctx) => {
    const age = ageOn(child.birthDate);
    if (age < 0) {
      ctx.addIssue({ code: 'custom', path: ['birthDate'], message: 'That date is in the future.' });
    } else if (ageBand(age) !== 'child') {
      ctx.addIssue({
        code: 'custom',
        path: ['birthDate'],
        message: 'Children 13 and over sign up themselves as teammates.',
      });
    }
  });
export type NewChild = z.input<typeof NewChild>;

/** A child waiting on the coach with the parent's request: no birth date, no surname. */
export const PendingChild = z.object({
  firstName: z.string(),
  lastInitial: z.string(),
  age: z.number().int().min(0).max(12),
});
export type PendingChild = z.infer<typeof PendingChild>;

/** `/qr/:code`: the value a team QR code encodes. */
/** A scanned token, or the 8-character short code a coach reads out (`QrShortCode`). */
export const QrCodeParams = z.object({ code: z.union([Token, QrShortCode]) });
export type QrCodeParams = z.infer<typeof QrCodeParams>;

/**
 * The code inside a scanned QR or a pasted link. A coach's QR is a link to `/scan?code=XXXXXXXX`,
 * but a bare token or short code works too, typed any way (`abcd-2345`). Anything else, like a
 * website's QR, is null.
 */
const SCANNED_TOKEN = /^[A-Za-z0-9_-]+$/;

export const codeFromScan = (data: string): string | null => {
  const value = data.trim();
  const fromLink = /[?&]code=([^&#]+)/.exec(value)?.[1];
  if (fromLink === undefined && value.includes('://')) return null;
  let candidate = value;
  if (fromLink !== undefined) {
    try {
      candidate = decodeURIComponent(fromLink);
    } catch {
      return null; // a broken %-escape
    }
  }
  const short = QrShortCode.safeParse(candidate);
  if (short.success) return short.data;
  // Tokens are URL-safe base64. Other text (a Wi-Fi QR, a note) never reaches the API.
  return SCANNED_TOKEN.test(candidate) && Token.safeParse(candidate).success ? candidate : null;
};

/** Scanning a live code is the fast lane: the scanner is on the team straight away. */
export const QrJoinResult = z.object({
  team: TeamSummary,
  joinedAt: Timestamp,
});
export type QrJoinResult = z.infer<typeof QrJoinResult>;

/** `/invites/:token`: the value in a coach invite link. */
export const InviteParams = z.object({ token: Token });
export type InviteParams = z.infer<typeof InviteParams>;

/** What an invited coach sees before accepting. Only the invite link's holder can load it. */
export const CoachInvitePreview = z.object({
  team: TeamSummary,
  email: z.string(),
  invitedBy: UserSummary,
  expiresAt: Timestamp,
  /** True when the email already has an account: sign in, then accept with no new account. */
  hasAccount: z.boolean(),
});
export type CoachInvitePreview = z.infer<typeof CoachInvitePreview>;

/** `POST /invites/:token/accept`: the token travels in the path. */
export const AcceptCoachInviteBody = AcceptCoachInviteRequest.omit({ token: true });
export type AcceptCoachInviteBody = z.input<typeof AcceptCoachInviteBody>;

const CompanyRef = z.object({ id: Id, name: z.string() });

/**
 * A recruiter signs up with their work email; the domain names their partner company. They wait
 * in `pending`, with no session, until staff approve them.
 */
export const RecruiterSignupResult = z.object({
  status: z.literal('pending'),
  email: z.string(),
  company: CompanyRef,
});
export type RecruiterSignupResult = z.infer<typeof RecruiterSignupResult>;

/** Staff's queue of recruiter sign-ups. */
export const PendingRecruiter = z.object({
  id: Id,
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  title: z.string().nullable(),
  company: CompanyRef,
  requestedAt: Timestamp,
});
export type PendingRecruiter = z.infer<typeof PendingRecruiter>;
