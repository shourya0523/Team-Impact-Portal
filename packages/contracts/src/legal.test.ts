import { describe, expect, it } from 'vitest';
import {
  AcceptCoachInviteRequest,
  CONSENT_FLAGS,
  CURRENT_TERMS_VERSION,
  LEGAL_DOCUMENT_IDS,
  LEGAL_DOCUMENT_NAMES,
  LEGAL_DOCUMENTS,
  RecruiterSignupRequest,
  SignupRequest,
  TermsVersion,
} from './index';

const bornYearsAgo = (years: number) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

const adult = {
  email: 'casey@example.org',
  password: 'correct horse battery',
  firstName: 'Casey',
  lastName: 'New',
  birthDate: bornYearsAgo(20),
  role: 'athlete',
  acceptTerms: true,
  termsVersion: CURRENT_TERMS_VERSION,
};
const teen = { ...adult, birthDate: bornYearsAgo(15), role: 'teen', parentAgreed: true };
const recruiter = {
  email: 'sam.park@northbeam.com',
  password: 'correct horse battery',
  firstName: 'Sam',
  lastName: 'Park',
  acceptTerms: true,
  termsVersion: CURRENT_TERMS_VERSION,
};
const TOKEN = 'a'.repeat(43);
const newCoach = {
  firstName: 'Ben',
  lastName: 'Lopez',
  password: 'correct horse battery',
  acceptTerms: true,
  termsVersion: CURRENT_TERMS_VERSION,
};

const paths = (result: { error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.error?.issues.map((i) => i.path.join('.'));

/** `obj` without `key`, for requests that leave a field out. */
const without = <T extends object>(obj: T, key: keyof T) =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));

describe('legal documents (TI-107)', () => {
  it('versions the three documents together under one current version', () => {
    expect(LEGAL_DOCUMENT_IDS).toEqual(['terms', 'privacy', 'acceptable-use']);
    for (const id of LEGAL_DOCUMENT_IDS) {
      expect(LEGAL_DOCUMENTS[id].version).toBe(CURRENT_TERMS_VERSION);
      expect(LEGAL_DOCUMENTS[id].source).toBe(`docs/legal/${id}.md`);
    }
    expect(LEGAL_DOCUMENT_NAMES).toBe('Terms of Use, Privacy Policy and Acceptable Use Policy');
  });

  it('only accepts the current version', () => {
    expect(TermsVersion.safeParse(CURRENT_TERMS_VERSION).success).toBe(true);
    for (const old of ['v2.0', '2026-10-draft.1', '', undefined, null]) {
      expect(TermsVersion.safeParse(old).success, String(old)).toBe(false);
    }
    expect(TermsVersion.safeParse('v2.0').error?.issues[0]?.message).toMatch(/terms have changed/);
  });

  it('stores acceptances under the flags the consent_records seed uses', () => {
    expect(CONSENT_FLAGS).toEqual({ terms: 'terms', parentAgreed: 'parent_agreed' });
  });
});

describe('sign-up records which terms were accepted', () => {
  it('requires the current terms version on open sign-up', () => {
    expect(SignupRequest.safeParse(adult).success).toBe(true);
    expect(paths(SignupRequest.safeParse(without(adult, 'termsVersion')))).toEqual([
      'termsVersion',
    ]);
    expect(paths(SignupRequest.safeParse({ ...adult, termsVersion: 'v2.0' }))).toEqual([
      'termsVersion',
    ]);
  });

  it('requires a teen to confirm a parent or guardian agreed, as well as the terms', () => {
    expect(SignupRequest.safeParse(teen).success).toBe(true);
    expect(paths(SignupRequest.safeParse(without(teen, 'parentAgreed')))).toEqual(['parentAgreed']);
    expect(paths(SignupRequest.safeParse({ ...teen, parentAgreed: false }))).toEqual([
      'parentAgreed',
    ]);
    expect(paths(SignupRequest.safeParse(without(teen, 'termsVersion')))).toEqual(['termsVersion']);
  });

  it('requires the current terms version from recruiters', () => {
    expect(RecruiterSignupRequest.safeParse(recruiter).success).toBe(true);
    expect(paths(RecruiterSignupRequest.safeParse(without(recruiter, 'termsVersion')))).toEqual([
      'termsVersion',
    ]);
    expect(
      paths(RecruiterSignupRequest.safeParse({ ...recruiter, termsVersion: '2026-10-draft.1' })),
    ).toEqual(['termsVersion']);
  });

  it('requires it from a coach creating an account from an invite, not from a signed-in coach', () => {
    expect(AcceptCoachInviteRequest.safeParse({ token: TOKEN }).success).toBe(true);
    expect(AcceptCoachInviteRequest.safeParse({ token: TOKEN, newAccount: newCoach }).success).toBe(
      true,
    );
    expect(
      paths(
        AcceptCoachInviteRequest.safeParse({
          token: TOKEN,
          newAccount: without(newCoach, 'termsVersion'),
        }),
      ),
    ).toEqual(['newAccount.termsVersion']);
  });
});
