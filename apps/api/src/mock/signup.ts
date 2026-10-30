import {
  ageOn,
  type ConsentFlag,
  type CurrentTermsVersion,
  type NewChild,
  type PendingChild,
  type PendingRecruiter,
} from '@team-impact/contracts';

/**
 * Sign-up on the mock API: recruiters waiting on staff, the terms each account accepted, and the
 * children parents add to join requests. Team QR codes, coach invites, children and teams live on `MockWorld` and their rules
 * in `./team.ts`, shared with coach team management.
 */

export { INVITE_TOKENS, QR_TOKENS } from './team';

export interface MockPendingRecruiter extends Omit<PendingRecruiter, 'company'> {
  companyId: string;
  /** The terms they accepted when they asked; recorded against the account staff create. */
  termsVersion: CurrentTermsVersion;
}

/**
 * One acceptance, shaped like a `consent_records` row (append-only; the latest row per flag is
 * the current value). `termsVersion` is the legal text the user was shown (TI-107).
 */
export interface MockConsentRecord {
  userId: string;
  flag: ConsentFlag;
  value: boolean;
  termsVersion: string;
  createdAt: string;
}

/** Per-world state for this area. */
export const newSignupState = () => ({
  pendingRecruiters: [] as MockPendingRecruiter[],
  /** Acceptances made through the mock's sign-up routes. Fixture users' rows are in the seed. */
  consents: [] as MockConsentRecord[],
});

/** The terms acceptances recorded for `userId`, oldest first. */
export const consentsOf = (state: SignupState, userId: string) =>
  state.consents.filter((c) => c.userId === userId);
export type SignupState = ReturnType<typeof newSignupState>;

/** What the coach sees about each child: first name, last initial and age, never the date. */
export const pendingChildren = (children: NewChild[] | undefined): PendingChild[] =>
  (children ?? []).map((c) => ({
    firstName: c.firstName.trim(),
    lastInitial: c.lastInitial.trim().toUpperCase(),
    age: ageOn(c.birthDate),
  }));
