import { z } from 'zod';
import { Timestamp } from './common';
import type { ContactSharing } from './contacts';

/**
 * Consent history (PRD §6, §7). Every privacy choice is appended as a timestamped record and never
 * edited: a flag's current value is its newest record, and the older ones show what someone had
 * agreed to, and when. Mirrors the `consent_records` table (flag, value, created_at).
 *
 * Flag names are shared with the seed data (`terms`, `parent_agreed`, `recruiter_visible`), so the
 * mock and the real API write the same vocabulary.
 */
export const consentFlags = {
  terms: 'terms',
  /** Teens: the terms confirm a parent or guardian agreed. */
  parentAgreed: 'parent_agreed',
  /** Open to recruiting: the athlete's card and recruiter contacts appear on the employer portal. */
  openToRecruiting: 'recruiter_visible',
  /** One contact channel shown to approved parents on the athlete's team. */
  familiesSee: (channel: keyof ContactSharing) => `families_see:${channel}`,
  /** One contact channel shown to recruiters. */
  recruitersSee: (channel: keyof ContactSharing) => `recruiters_see:${channel}`,
  /** Findable by recruiters through one official community (the identity-search opt-in). */
  findableIn: (communityId: string) => `findable_in:${communityId}`,
} as const;

export const ConsentRecord = z.object({
  flag: z.string(),
  value: z.boolean(),
  recordedAt: Timestamp,
});
export type ConsentRecord = z.infer<typeof ConsentRecord>;

/** `GET /me/consent-history`: the signed-in user's own records, newest first. */
export const ConsentHistory = z.array(ConsentRecord);
export type ConsentHistory = z.infer<typeof ConsentHistory>;
