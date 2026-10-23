// =============================================================================================
// Who may create an account, and as what (PRD §2, §3). Pure functions over the sign-up data, so
// every rule is unit-tested on its own; auth.ts runs them inside Better Auth's "before a user is
// created" hook, which means no sign-up path (app, portal or a hand-made request) can skip them.
//
//   - under 13: refused. Children exist only as a profile their parent runs.
//   - 13 to 17: a teen account only, and the terms must confirm a parent or guardian agreed.
//   - 18 and over: any self-sign-up type except teen.
//   - recruiters: adults on a work email; the company check against org_domains is in auth.ts.
//   - coaches and staff: never self-sign-up. Coaches come in by invite, staff by script.
// =============================================================================================
import {
  ageBand,
  ageOn,
  CalendarDate,
  emailDomain,
  isPersonalEmailDomain,
} from '@team-impact/contracts';
import type { userType } from '../db/schema';

export type AccountType = (typeof userType.enumValues)[number];

/** Account types anyone can sign up as. Recruiters also need a registered company domain. */
export const SELF_SIGNUP_TYPES = [
  'athlete',
  'parent',
  'teen',
  'alumni',
  'recruiter',
] as const satisfies readonly AccountType[];

/** Oldest birth date accepted as real; anything older is almost certainly a typo. */
const MAX_AGE = 120;

export interface SignupInput {
  userType: unknown;
  /** `YYYY-MM-DD`. */
  dob: unknown;
  email: string;
  acceptTerms: unknown;
  /** Teens only: the terms confirm a parent or guardian agreed (PRD §3, T1). */
  parentAgreed: unknown;
}

/** Why a sign-up is refused, with the field a form should show it next to. */
export interface SignupRefusal {
  field: 'userType' | 'dob' | 'email' | 'acceptTerms' | 'parentAgreed';
  message: string;
}

const refuse = (field: SignupRefusal['field'], message: string): SignupRefusal => ({
  field,
  message,
});

/**
 * Checks a self-sign-up against the age and role rules. Returns the refusal, or null when the
 * account may be created as `input.userType`. `today` is injectable so tests pin birthdays.
 */
export const checkSelfSignup = (
  input: SignupInput,
  today: Date = new Date(),
): SignupRefusal | null => {
  if (input.acceptTerms !== true) {
    return refuse('acceptTerms', 'Agree to the Terms and Privacy Policy to continue.');
  }
  if (!SELF_SIGNUP_TYPES.includes(input.userType as (typeof SELF_SIGNUP_TYPES)[number])) {
    return refuse('userType', 'Choose who you are: athlete, parent, teen, alumni or recruiter.');
  }
  const dob = CalendarDate.safeParse(input.dob);
  if (!dob.success) return refuse('dob', 'Enter your birth date.');

  const age = ageOn(dob.data, today);
  const band = ageBand(age);
  if (band === 'child') {
    return refuse(
      'dob',
      'Kids under 13 join through a parent or guardian, who runs their profile.',
    );
  }
  if (age > MAX_AGE) return refuse('dob', 'Check your birth date.');

  if (band === 'teen') {
    if (input.userType !== 'teen') {
      return refuse('userType', 'Under 18s join as a teammate (teen account).');
    }
    if (input.parentAgreed !== true) {
      return refuse('parentAgreed', 'Confirm a parent or guardian agreed to you joining.');
    }
  } else if (input.userType === 'teen') {
    return refuse('userType', 'The teammate account is for 13 to 17 year olds.');
  }

  if (input.userType === 'recruiter' && isPersonalEmailDomain(emailDomain(input.email))) {
    return refuse('email', 'Personal email addresses can’t be used. Use your work email.');
  }
  return null;
};

/**
 * `host`, then each parent domain, most specific first: `jo@nyc.northbeam.com` →
 * [`nyc.northbeam.com`, `northbeam.com`]. Stops before the bare top-level domain.
 */
export const domainCandidates = (email: string): string[] => {
  const labels = emailDomain(email).split('.');
  return labels.slice(0, -1).map((_, i) => labels.slice(i).join('.'));
};
