import {
  ageOn,
  type NewChild,
  type PendingChild,
  type PendingRecruiter,
} from '@team-impact/contracts';

/**
 * Sign-up on the mock API: recruiters waiting on staff, and the children parents add to join
 * requests. Team QR codes, coach invites, children and teams live on `MockWorld` and their rules
 * in `./team.ts`, shared with coach team management.
 */

export { INVITE_TOKENS, QR_TOKENS } from './team';

export interface MockPendingRecruiter extends Omit<PendingRecruiter, 'company'> {
  companyId: string;
}

/** Per-world state for this area. */
export const newSignupState = () => ({
  pendingRecruiters: [] as MockPendingRecruiter[],
});
export type SignupState = ReturnType<typeof newSignupState>;

/** What the coach sees about each child: first name, last initial and age, never the date. */
export const pendingChildren = (children: NewChild[] | undefined): PendingChild[] =>
  (children ?? []).map((c) => ({
    firstName: c.firstName.trim(),
    lastInitial: c.lastInitial.trim().toUpperCase(),
    age: ageOn(c.birthDate),
  }));
