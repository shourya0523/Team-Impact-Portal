// The age gate and account-type rules (PRD §2, §3), on their own. auth.test.ts checks they run on
// every real sign-up.
import { describe, expect, it } from 'vitest';
import { checkSelfSignup, domainCandidates, type SignupInput } from './signup-rules';

const TODAY = new Date('2026-10-23T12:00:00Z');
/** A birth date `years` years before TODAY, a few days earlier so the birthday has passed. */
const bornYearsAgo = (years: number) => `${2026 - years}-10-20`;

const adult: SignupInput = {
  accountType: 'athlete',
  birthDate: bornYearsAgo(20),
  email: 'maya@tufts.edu',
  acceptTerms: true,
  parentAgreed: undefined,
};
const check = (overrides: Partial<SignupInput>) =>
  checkSelfSignup({ ...adult, ...overrides }, TODAY);

describe('sign-up rules: age gate', () => {
  it('lets adults sign up as athlete, parent, alumni or recruiter', () => {
    for (const accountType of ['athlete', 'parent', 'alumni', 'recruiter']) {
      expect(check({ accountType, email: 'sam@northbeam.com' }), accountType).toBeNull();
    }
  });

  it('refuses anyone under 13', () => {
    expect(check({ birthDate: bornYearsAgo(12) })).toMatchObject({ field: 'birthDate' });
    expect(
      check({ birthDate: bornYearsAgo(5), accountType: 'teen', parentAgreed: true }),
    ).toMatchObject({
      field: 'birthDate',
    });
  });

  it('turns 13 on the birthday, not the day before', () => {
    const teen = { accountType: 'teen', parentAgreed: true };
    expect(check({ ...teen, birthDate: '2013-10-23' })).toBeNull();
    expect(check({ ...teen, birthDate: '2013-10-24' })).toMatchObject({ field: 'birthDate' });
  });

  it('makes 13 to 17 year olds teens, who must confirm a parent agreed', () => {
    const fifteen = bornYearsAgo(15);
    expect(check({ birthDate: fifteen, accountType: 'athlete' })).toMatchObject({
      field: 'accountType',
    });
    expect(check({ birthDate: fifteen, accountType: 'teen' })).toMatchObject({
      field: 'parentAgreed',
    });
    expect(check({ birthDate: fifteen, accountType: 'teen', parentAgreed: 'yes' })).toMatchObject({
      field: 'parentAgreed',
    });
    expect(check({ birthDate: fifteen, accountType: 'teen', parentAgreed: true })).toBeNull();
    // 17-year-old college freshmen are teens too (confirmed with the team).
    expect(
      check({ birthDate: bornYearsAgo(17), accountType: 'teen', parentAgreed: true }),
    ).toBeNull();
  });

  it('keeps adults out of the teen account', () => {
    expect(check({ accountType: 'teen', parentAgreed: true })).toMatchObject({
      field: 'accountType',
    });
  });

  it('refuses a missing, malformed or impossible birth date', () => {
    for (const birthDate of [undefined, '', '14/03/2004', '2004-02-30', bornYearsAgo(121)]) {
      expect(check({ birthDate }), String(birthDate)).toMatchObject({ field: 'birthDate' });
    }
    expect(check({ birthDate: '2030-01-01' })).toMatchObject({ field: 'birthDate' });
  });
});

describe('sign-up rules: account types and terms', () => {
  it('never lets anyone sign themselves up as staff or a coach', () => {
    for (const accountType of ['staff', 'coach', 'admin', '', undefined]) {
      expect(check({ accountType }), String(accountType)).toMatchObject({ field: 'accountType' });
    }
  });

  it('requires accepting the terms, as exactly true', () => {
    for (const acceptTerms of [false, undefined, 'true', 1]) {
      expect(check({ acceptTerms }), String(acceptTerms)).toMatchObject({ field: 'acceptTerms' });
    }
  });

  it('refuses personal email addresses for recruiters', () => {
    for (const email of ['sam@gmail.com', 'sam@OUTLOOK.com', 'sam@icloud.com']) {
      expect(check({ accountType: 'recruiter', email }), email).toMatchObject({ field: 'email' });
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
