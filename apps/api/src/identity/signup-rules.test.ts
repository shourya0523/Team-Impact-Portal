// The age gate and account-type rules (PRD §2, §3), on their own. auth.test.ts checks they run on
// every real sign-up.
import { describe, expect, it } from 'vitest';
import { checkSelfSignup, domainCandidates, type SignupInput } from './signup-rules';

const TODAY = new Date('2026-10-23T12:00:00Z');
/** A birth date `years` years before TODAY, a few days earlier so the birthday has passed. */
const bornYearsAgo = (years: number) => `${2026 - years}-10-20`;

const adult: SignupInput = {
  userType: 'athlete',
  dob: bornYearsAgo(20),
  email: 'maya@tufts.edu',
  acceptTerms: true,
  parentAgreed: undefined,
};
const check = (overrides: Partial<SignupInput>) =>
  checkSelfSignup({ ...adult, ...overrides }, TODAY);

describe('sign-up rules: age gate', () => {
  it('lets adults sign up as athlete, parent, alumni or recruiter', () => {
    for (const userType of ['athlete', 'parent', 'alumni', 'recruiter']) {
      expect(check({ userType, email: 'sam@northbeam.com' }), userType).toBeNull();
    }
  });

  it('refuses anyone under 13', () => {
    expect(check({ dob: bornYearsAgo(12) })).toMatchObject({ field: 'dob' });
    expect(check({ dob: bornYearsAgo(5), userType: 'teen', parentAgreed: true })).toMatchObject({
      field: 'dob',
    });
  });

  it('turns 13 on the birthday, not the day before', () => {
    const teen = { userType: 'teen', parentAgreed: true };
    expect(check({ ...teen, dob: '2013-10-23' })).toBeNull();
    expect(check({ ...teen, dob: '2013-10-24' })).toMatchObject({ field: 'dob' });
  });

  it('makes 13 to 17 year olds teens, who must confirm a parent agreed', () => {
    const fifteen = bornYearsAgo(15);
    expect(check({ dob: fifteen, userType: 'athlete' })).toMatchObject({ field: 'userType' });
    expect(check({ dob: fifteen, userType: 'teen' })).toMatchObject({ field: 'parentAgreed' });
    expect(check({ dob: fifteen, userType: 'teen', parentAgreed: 'yes' })).toMatchObject({
      field: 'parentAgreed',
    });
    expect(check({ dob: fifteen, userType: 'teen', parentAgreed: true })).toBeNull();
    // 17-year-old college freshmen are teens too (confirmed with the team).
    expect(check({ dob: bornYearsAgo(17), userType: 'teen', parentAgreed: true })).toBeNull();
  });

  it('keeps adults out of the teen account', () => {
    expect(check({ userType: 'teen', parentAgreed: true })).toMatchObject({ field: 'userType' });
  });

  it('refuses a missing, malformed or impossible birth date', () => {
    for (const dob of [undefined, '', '14/03/2004', '2004-02-30', bornYearsAgo(121)]) {
      expect(check({ dob }), String(dob)).toMatchObject({ field: 'dob' });
    }
    expect(check({ dob: '2030-01-01' })).toMatchObject({ field: 'dob' });
  });
});

describe('sign-up rules: account types and terms', () => {
  it('never lets anyone sign themselves up as staff or a coach', () => {
    for (const userType of ['staff', 'coach', 'admin', '', undefined]) {
      expect(check({ userType }), String(userType)).toMatchObject({ field: 'userType' });
    }
  });

  it('requires accepting the terms, as exactly true', () => {
    for (const acceptTerms of [false, undefined, 'true', 1]) {
      expect(check({ acceptTerms }), String(acceptTerms)).toMatchObject({ field: 'acceptTerms' });
    }
  });

  it('refuses personal email addresses for recruiters', () => {
    for (const email of ['sam@gmail.com', 'sam@OUTLOOK.com', 'sam@icloud.com']) {
      expect(check({ userType: 'recruiter', email }), email).toMatchObject({ field: 'email' });
    }
    // Other account types may use any address.
    expect(check({ email: 'maya@gmail.com' })).toBeNull();
  });
});

describe('sign-up rules: company domains', () => {
  it('lists the email’s domain and each parent domain, most specific first', () => {
    expect(domainCandidates('jo@nyc.ops.northbeam.com')).toEqual([
      'nyc.ops.northbeam.com',
      'ops.northbeam.com',
      'northbeam.com',
    ]);
    expect(domainCandidates('sam@Northbeam.COM')).toEqual(['northbeam.com']);
  });
});
