import { describe, expect, it } from 'vitest';
import {
  ageBand,
  ageOn,
  CardFace,
  CardWithContact,
  CreateCompanyRequest,
  CreateEventRequest,
  CreateJoinRequest,
  emailOnDomain,
  hasBaseballCard,
  type MyCard,
  PageQuery,
  RecruiterSignupRequest,
  SignupRequest,
  TeamQrCodeHistoryEntry,
  UpdateCardVisibilityRequest,
} from './index';

const ID = '7f1d6a2e-3b4c-4d5e-8f60-123456789abc';
const NOW = '2026-10-08T12:00:00.000Z';

/** ISO birth date for someone who turned `years` old yesterday. */
const bornYearsAgo = (years: number) => {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

const adultSignup = {
  email: 'Jane@Example.com',
  password: 'correct horse battery',
  firstName: 'Jane',
  lastName: 'Doe',
  birthDate: bornYearsAgo(20),
  role: 'athlete',
  acceptTerms: true,
};

const issuePaths = (result: { error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.error?.issues.map((issue) => issue.path.join('.'));

describe('roles', () => {
  it('only athletes have a Baseball Card', () => {
    expect(hasBaseballCard('athlete')).toBe(true);
    expect(hasBaseballCard('alumni_athlete')).toBe(true);
    expect(hasBaseballCard('parent')).toBe(false);
    expect(hasBaseballCard('recruiter')).toBe(false);
  });

  it('turns 13 on the birthday, not the day before', () => {
    const today = new Date('2026-10-08T12:00:00Z');
    expect(ageOn('2013-10-08', today)).toBe(13);
    expect(ageOn('2013-10-09', today)).toBe(12);
    expect(ageBand(12)).toBe('child');
    expect(ageBand(13)).toBe('teen');
    expect(ageBand(18)).toBe('adult');
  });
});

describe('sign-up', () => {
  it('normalises email and rejects short passwords', () => {
    const ok = SignupRequest.parse(adultSignup);
    expect(ok.email).toBe('jane@example.com');
    expect(SignupRequest.safeParse({ ...adultSignup, password: 'short' }).success).toBe(false);
  });

  it('never creates an account for a child under 13', () => {
    const result = SignupRequest.safeParse({ ...adultSignup, birthDate: bornYearsAgo(12) });
    expect(issuePaths(result)).toContain('birthDate');
  });

  it('makes 13–17 year olds teens who confirm a parent agreed', () => {
    const teen = { ...adultSignup, birthDate: bornYearsAgo(15) };
    expect(issuePaths(SignupRequest.safeParse(teen))).toEqual(['role', 'parentAgreed']);
    const ok = { ...teen, role: 'teen', parentAgreed: true };
    expect(SignupRequest.safeParse(ok).success).toBe(true);
  });

  it('keeps adults out of the teen role', () => {
    const result = SignupRequest.safeParse({ ...adultSignup, role: 'teen' });
    expect(issuePaths(result)).toEqual(['role']);
  });

  it('requires a work email from recruiters', () => {
    const recruiter = {
      email: 'sam.park@gmail.com',
      password: 'correct horse battery',
      firstName: 'Sam',
      lastName: 'Park',
      title: 'Campus Recruiter',
      acceptTerms: true,
    };
    expect(RecruiterSignupRequest.safeParse(recruiter).success).toBe(false);
    const work = { ...recruiter, email: 'sam.park@northbeam.com' };
    expect(RecruiterSignupRequest.safeParse(work).success).toBe(true);
  });
});

describe('companies', () => {
  const company = { name: 'Kestrel Consulting', domains: ['Kestrel.co'] };

  it('normalises domains and rejects personal or repeated ones', () => {
    expect(CreateCompanyRequest.parse(company).domains).toEqual(['kestrel.co']);
    const personal = { ...company, domains: ['gmail.com'] };
    expect(CreateCompanyRequest.safeParse(personal).success).toBe(false);
    const repeated = { ...company, domains: ['kestrel.co', 'KESTREL.CO'] };
    expect(CreateCompanyRequest.safeParse(repeated).success).toBe(false);
  });

  it('matches recruiter emails on a domain or its subdomains only', () => {
    expect(emailOnDomain('elena@nyc.kestrel.co', 'kestrel.co')).toBe(true);
    expect(emailOnDomain('elena@notkestrel.co', 'kestrel.co')).toBe(false);
  });
});

describe('cards', () => {
  const myCard: MyCard = {
    id: ID,
    athleteId: ID,
    season: 2026,
    team: null,
    photoUrl: null,
    firstName: 'Maya',
    lastName: 'Okafor',
    jerseyNumber: '07',
    position: 'Midfielder',
    classYear: 2028,
    major: 'Economics',
    hometown: 'Providence, RI',
    city: 'Boston, MA',
    region: 'northeast',
    experience: 'Analyst intern',
    skills: ['Excel', 'SQL'],
    lookingFor: 'Finance internships',
    contact: { email: 'maya@tufts.edu', phone: '(401) 555-0119', linkedinUrl: null },
    visibility: {
      published: true,
      openToRecruiting: true,
      familiesSee: { email: true, phone: true, linkedin: false },
      recruitersSee: { email: true, phone: false, linkedin: true },
    },
    isCurrent: true,
    updatedAt: NOW,
  };

  it('strips contact details and settings from the card face teens get', () => {
    const face = CardFace.parse(myCard);
    expect(face).not.toHaveProperty('contact');
    expect(face).not.toHaveProperty('visibility');
    expect(face.jerseyNumber).toBe('07');
  });

  it('carries only shared contact channels', () => {
    const card = CardWithContact.parse({ ...myCard, contact: { email: 'maya@tufts.edu' } });
    expect(card.contact).toEqual({ email: 'maya@tufts.edu' });
    expect(card).not.toHaveProperty('visibility');
  });

  it('needs a published card before recruiting can be on', () => {
    const result = UpdateCardVisibilityRequest.safeParse({
      published: false,
      openToRecruiting: true,
    });
    expect(issuePaths(result)).toEqual(['openToRecruiting']);
    expect(UpdateCardVisibilityRequest.safeParse({ openToRecruiting: false }).success).toBe(true);
  });
});

describe('teams', () => {
  it('requires parents to bring a child', () => {
    expect(CreateJoinRequest.safeParse({ role: 'parent', teamId: ID, childIds: [] }).success).toBe(
      false,
    );
    expect(
      CreateJoinRequest.safeParse({ role: 'parent', teamId: ID, childIds: [ID] }).success,
    ).toBe(true);
  });

  it('never gives staff a usable QR token', () => {
    const entry = TeamQrCodeHistoryEntry.parse({
      id: ID,
      teamId: ID,
      token: 'x'.repeat(32),
      createdBy: { id: ID, firstName: 'Coach', lastName: 'Rivera', role: 'coach', avatarUrl: null },
      lifetime: 'week',
      expiresAt: NOW,
      revokedAt: null,
      joinCount: 9,
      createdAt: NOW,
    });
    expect(entry).not.toHaveProperty('token');
  });
});

describe('common', () => {
  it('coerces page size from the query string and caps it', () => {
    expect(PageQuery.parse({ limit: '50' }).limit).toBe(50);
    expect(PageQuery.parse({}).limit).toBe(20);
    expect(PageQuery.safeParse({ limit: '500' }).success).toBe(false);
  });

  it('rejects events that end before they start', () => {
    const event = {
      title: 'Family night',
      startsAt: '2026-10-19T13:00:00-04:00',
      endsAt: '2026-10-19T12:00:00-04:00',
      location: 'Kraft Field',
      audience: { scope: 'network' },
    };
    expect(issuePaths(CreateEventRequest.safeParse(event))).toEqual(['endsAt']);
  });
});
