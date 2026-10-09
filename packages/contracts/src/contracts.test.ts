import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';
import {
  AcceptCoachInviteRequest,
  ageBand,
  ageOn,
  CardFace,
  CardWithContact,
  CreateAnnouncementRequest,
  CreateCardRequest,
  CreateChildProfileRequest,
  CreateCompanyRequest,
  CreateEventRequest,
  CreateGroupRequest,
  CreateJoinRequest,
  CreateListRequest,
  CreateOpportunityRequest,
  CreatePostRequest,
  CreateReportRequest,
  CreateTeamRequest,
  emailOnDomain,
  FindAlumniQuery,
  hasBaseballCard,
  LinkedInUrl,
  MergeCollegeRequest,
  type MyCard,
  PageQuery,
  Phone,
  Post,
  RecruiterSignupRequest,
  SaveCollegeRequest,
  SignupRequest,
  StaffUpdateTeamRequest,
  TeamQrCodeHistoryEntry,
  UpdateAlumniProfileRequest,
  UpdateCardVisibilityRequest,
  UpdateChildProfileRequest,
  UpdateListRequest,
  UpdateTeamRequest,
} from './index';

const ID = '7f1d6a2e-3b4c-4d5e-8f60-123456789abc';
const NOW = '2026-10-08T12:00:00.000Z';
const TOKEN = 'x'.repeat(32);
const coach = { id: ID, firstName: 'Coach', lastName: 'Rivera', role: 'coach', avatarUrl: null };

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

const accepts = (schema: ZodType, value: unknown) => schema.safeParse(value).success;

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
    expect(accepts(SignupRequest, { ...adultSignup, password: 'short' })).toBe(false);
  });

  it('never creates an account for a child under 13', () => {
    const result = SignupRequest.safeParse({ ...adultSignup, birthDate: bornYearsAgo(12) });
    expect(issuePaths(result)).toContain('birthDate');
  });

  it('makes 13–17 year olds teens who confirm a parent agreed', () => {
    const teen = { ...adultSignup, birthDate: bornYearsAgo(15) };
    expect(issuePaths(SignupRequest.safeParse(teen))).toEqual(['role', 'parentAgreed']);
    expect(accepts(SignupRequest, { ...teen, role: 'teen', parentAgreed: true })).toBe(true);
  });

  it('keeps adults out of the teen role', () => {
    const result = SignupRequest.safeParse({ ...adultSignup, role: 'teen' });
    expect(issuePaths(result)).toEqual(['role']);
  });

  it('requires a work email from recruiters, but not a job title', () => {
    const recruiter = {
      email: 'sam.park@gmail.com',
      password: 'correct horse battery',
      firstName: 'Sam',
      lastName: 'Park',
      title: 'Campus Recruiter',
      acceptTerms: true,
    };
    expect(accepts(RecruiterSignupRequest, recruiter)).toBe(false);
    const work = { ...recruiter, email: 'sam.park@northbeam.com' };
    expect(accepts(RecruiterSignupRequest, work)).toBe(true);
    expect(accepts(RecruiterSignupRequest, { ...work, title: undefined })).toBe(true);
  });

  it('only accepts a coach invite with a real token, and checks a new coach’s password', () => {
    expect(accepts(AcceptCoachInviteRequest, { token: 'short' })).toBe(false);
    expect(accepts(AcceptCoachInviteRequest, { token: TOKEN })).toBe(true);
    const newAccount = {
      firstName: 'Ben',
      lastName: 'Lopez',
      password: 'short',
      acceptTerms: true,
    };
    expect(issuePaths(AcceptCoachInviteRequest.safeParse({ token: TOKEN, newAccount }))).toEqual([
      'newAccount.password',
    ]);
  });
});

describe('users', () => {
  const child = { firstName: 'Leo', age: 9, relationship: 'parent' };

  it('keeps a child profile to a first name and an age under 13', () => {
    expect(accepts(CreateChildProfileRequest, child)).toBe(true);
    const fullName = CreateChildProfileRequest.safeParse({ ...child, firstName: 'Leo Kim' });
    expect(issuePaths(fullName)).toEqual(['firstName']);
    expect(accepts(CreateChildProfileRequest, { ...child, age: 13 })).toBe(false);
    expect(accepts(CreateChildProfileRequest, { ...child, age: 2 })).toBe(false);
    expect(accepts(CreateChildProfileRequest, { ...child, age: 12 })).toBe(true);
  });

  it('lets a parent clear their child’s interests', () => {
    expect(UpdateChildProfileRequest.parse({ interests: null }).interests).toBeNull();
  });

  it('filters alumni by the mentoring and hiring flags only', () => {
    expect(accepts(FindAlumniQuery, { flag: 'hiring' })).toBe(true);
    expect(accepts(FindAlumniQuery, { flag: 'recruiting' })).toBe(false);
    expect(UpdateAlumniProfileRequest.parse({ employer: null }).employer).toBeNull();
  });
});

describe('contacts', () => {
  it('accepts common phone formats and nothing else', () => {
    expect(accepts(Phone, '(401) 555-0119')).toBe(true);
    expect(accepts(Phone, '+1 401 555 0119')).toBe(true);
    expect(accepts(Phone, 'call me')).toBe(false);
    expect(accepts(Phone, '12345')).toBe(false);
  });

  it('accepts LinkedIn profile links only, on LinkedIn itself', () => {
    expect(accepts(LinkedInUrl, 'linkedin.com/in/mayaokafor')).toBe(true);
    expect(accepts(LinkedInUrl, 'https://www.linkedin.com/in/maya-okafor/')).toBe(true);
    expect(accepts(LinkedInUrl, 'linkedin.com/company/northbeam')).toBe(false);
    expect(accepts(LinkedInUrl, 'https://linkedin.com.evil.com/in/maya')).toBe(false);
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
    expect(accepts(UpdateCardVisibilityRequest, { openToRecruiting: false })).toBe(true);
  });

  it('takes jersey numbers from 0 to 99 and requires a major', () => {
    const card = { firstName: 'Maya', lastName: 'Okafor', classYear: 2028, major: 'Economics' };
    expect(accepts(CreateCardRequest, card)).toBe(true);
    expect(accepts(CreateCardRequest, { ...card, jerseyNumber: '0' })).toBe(true);
    expect(accepts(CreateCardRequest, { ...card, jerseyNumber: '99' })).toBe(true);
    expect(accepts(CreateCardRequest, { ...card, jerseyNumber: '100' })).toBe(false);
    expect(accepts(CreateCardRequest, { ...card, jerseyNumber: '7a' })).toBe(false);
    expect(issuePaths(CreateCardRequest.safeParse({ ...card, major: ' ' }))).toEqual(['major']);
  });
});

describe('colleges', () => {
  it('trims college names and rejects blank ones', () => {
    expect(SaveCollegeRequest.parse({ name: '  Tufts University ' }).name).toBe('Tufts University');
    expect(accepts(SaveCollegeRequest, { name: '   ' })).toBe(false);
  });

  it('merges into a college by id', () => {
    expect(accepts(MergeCollegeRequest, { intoCollegeId: ID })).toBe(true);
    expect(accepts(MergeCollegeRequest, { intoCollegeId: 'tufts' })).toBe(false);
  });
});

describe('teams', () => {
  const team = {
    collegeId: ID,
    sport: 'Soccer',
    gender: 'women',
    name: 'Women’s Soccer',
    division: 'III',
    firstCoachEmail: 'Rivera@Tufts.edu',
  };

  it('creates a men’s or women’s team with a readable colour and the first coach’s email', () => {
    expect(CreateTeamRequest.parse(team).firstCoachEmail).toBe('rivera@tufts.edu');
    expect(accepts(CreateTeamRequest, { ...team, gender: 'coed' })).toBe(false);
    expect(accepts(CreateTeamRequest, { ...team, color: '#1E3F7B' })).toBe(true);
    expect(accepts(CreateTeamRequest, { ...team, color: 'red' })).toBe(false);
    expect(accepts(CreateTeamRequest, { ...team, color: '#FFF' })).toBe(false);
  });

  it('drops staff-only fields from a coach’s team edit', () => {
    const edit = { name: 'Jumbos', collegeId: ID, archived: true };
    expect(UpdateTeamRequest.parse(edit)).toEqual({ name: 'Jumbos' });
    expect(StaffUpdateTeamRequest.parse(edit)).toEqual(edit);
  });

  it('requires parents to bring a child', () => {
    expect(accepts(CreateJoinRequest, { role: 'parent', teamId: ID, childIds: [] })).toBe(false);
    expect(accepts(CreateJoinRequest, { role: 'parent', teamId: ID, childIds: [ID] })).toBe(true);
  });

  it('never gives staff a usable QR token', () => {
    const entry = TeamQrCodeHistoryEntry.parse({
      id: ID,
      teamId: ID,
      token: TOKEN,
      createdBy: coach,
      lifetime: 'week',
      expiresAt: NOW,
      revokedAt: null,
      joinCount: 9,
      createdAt: NOW,
    });
    expect(entry).not.toHaveProperty('token');
  });
});

describe('companies', () => {
  const company = { name: 'Kestrel Consulting', domains: ['Kestrel.co'] };

  it('normalises domains and rejects personal or repeated ones', () => {
    expect(CreateCompanyRequest.parse(company).domains).toEqual(['kestrel.co']);
    expect(accepts(CreateCompanyRequest, { ...company, domains: ['gmail.com'] })).toBe(false);
    const repeated = { ...company, domains: ['kestrel.co', 'KESTREL.CO'] };
    expect(accepts(CreateCompanyRequest, repeated)).toBe(false);
  });

  it('rejects malformed domains', () => {
    const withDomain = (domain: string) => ({ ...company, domains: [domain] });
    expect(accepts(CreateCompanyRequest, withDomain('jobs.northbeam.co.uk'))).toBe(true);
    for (const bad of ['northbeam', '-north.com', 'north beam.com', 'northbeam.com.']) {
      expect(accepts(CreateCompanyRequest, withDomain(bad)), bad).toBe(false);
    }
  });

  it('matches recruiter emails on a domain or its subdomains only', () => {
    expect(emailOnDomain('elena@nyc.kestrel.co', 'kestrel.co')).toBe(true);
    expect(emailOnDomain('elena@notkestrel.co', 'kestrel.co')).toBe(false);
  });
});

describe('posts', () => {
  const opportunity = {
    groupId: ID,
    title: 'Summer Analyst',
    details: 'Rising juniors in economics or finance.',
    link: 'https://northbeam.com/jobs/123',
  };

  it('only takes http(s) opportunity links', () => {
    expect(accepts(CreateOpportunityRequest, opportunity)).toBe(true);
    for (const link of ['javascript:alert(1)', 'ftp://northbeam.com/jobs', 'northbeam.com/jobs']) {
      expect(accepts(CreateOpportunityRequest, { ...opportunity, link }), link).toBe(false);
    }
  });

  it('posts an opportunity into a group', () => {
    const { groupId, ...noGroup } = opportunity;
    expect(groupId).toBe(ID);
    expect(issuePaths(CreateOpportunityRequest.safeParse(noGroup))).toEqual(['groupId']);
  });

  it('needs text, and a group id for group posts', () => {
    expect(accepts(CreatePostRequest, { audience: { scope: 'group' }, text: 'Hi' })).toBe(false);
    const groupPost = { audience: { scope: 'group', groupId: ID }, text: 'Hi' };
    expect(accepts(CreatePostRequest, groupPost)).toBe(true);
    expect(accepts(CreatePostRequest, { ...groupPost, text: '   ' })).toBe(false);
  });

  it('sends announcements to a team or everyone, never a group', () => {
    const announcement = {
      audience: { scope: 'network' },
      text: 'Family night is on Oct 19',
      sendPush: true,
    };
    expect(accepts(CreateAnnouncementRequest, announcement)).toBe(true);
    expect(accepts(CreateAnnouncementRequest, { ...announcement, text: 'Too short' })).toBe(false);
    const toGroup = { ...announcement, audience: { scope: 'group', groupId: ID } };
    expect(accepts(CreateAnnouncementRequest, toGroup)).toBe(false);
  });

  it('carries opportunity details only on opportunity posts', () => {
    const post = {
      id: ID,
      author: coach,
      audience: { scope: 'network' },
      text: 'Big win Saturday',
      official: false,
      likeCount: 0,
      commentCount: 0,
      likedByMe: false,
      moderation: 'approved',
      createdAt: NOW,
    };
    const details = {
      title: 'Summer Analyst',
      link: 'https://northbeam.com/jobs/123',
      closesOn: null,
      company: { id: ID, name: 'Northbeam Capital' },
    };
    expect(accepts(Post, { ...post, kind: 'opportunity' })).toBe(false);
    expect(accepts(Post, { ...post, kind: 'opportunity', opportunity: details })).toBe(true);
    expect(Post.parse({ ...post, kind: 'post', opportunity: details })).not.toHaveProperty(
      'opportunity',
    );
  });
});

describe('events', () => {
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

describe('groups', () => {
  it('needs a name of up to 60 characters and says what it’s for', () => {
    const result = CreateGroupRequest.safeParse({ name: 'First-gen athletes', about: '   ' });
    expect(result.error?.issues[0]?.message).toBe('Say what the group is for.');
    const longName = { name: 'x'.repeat(61), about: 'For first-gen athletes.' };
    expect(accepts(CreateGroupRequest, longName)).toBe(false);
  });
});

describe('lists', () => {
  it('needs a name of up to 60 characters and a hex colour', () => {
    const list = { name: 'Fall interns', color: '#D0213C' };
    expect(accepts(CreateListRequest, list)).toBe(true);
    expect(accepts(CreateListRequest, { ...list, name: ' ' })).toBe(false);
    expect(accepts(CreateListRequest, { ...list, name: 'x'.repeat(61) })).toBe(false);
    expect(accepts(CreateListRequest, { ...list, color: 'red' })).toBe(false);
  });

  it('lets the owner clear a list’s note', () => {
    expect(UpdateListRequest.parse({ note: null }).note).toBeNull();
  });
});

describe('moderation', () => {
  it('reports a known kind of item for a known reason', () => {
    const report = { target: { kind: 'post', id: ID }, reason: 'spam' };
    expect(accepts(CreateReportRequest, report)).toBe(true);
    expect(accepts(CreateReportRequest, { ...report, reason: 'rude' })).toBe(false);
    expect(accepts(CreateReportRequest, { ...report, target: { kind: 'group', id: ID } })).toBe(
      false,
    );
    expect(accepts(CreateReportRequest, { ...report, note: 'x'.repeat(501) })).toBe(false);
  });
});

describe('common', () => {
  it('coerces page size from the query string and caps it', () => {
    expect(PageQuery.parse({ limit: '50' }).limit).toBe(50);
    expect(PageQuery.parse({}).limit).toBe(20);
    expect(accepts(PageQuery, { limit: '500' })).toBe(false);
  });
});
