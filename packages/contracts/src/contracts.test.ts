import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';
import {
  AcceptCoachInviteRequest,
  ageBand,
  ageOn,
  CardFace,
  canCreateCommunity,
  canJoinCommunity,
  CardWithContact,
  Community,
  CreateAnnouncementRequest,
  CreateCardRequest,
  CreateCompanyRequest,
  CreateEventRequest,
  CreateCommunityRequest,
  CreateJoinRequest,
  CreateListRequest,
  CreateOpportunityRequest,
  CreatePostRequest,
  CreateReportRequest,
  CreateTeamRequest,
  Email,
  ExperienceEntry,
  emailOnDomain,
  FindAlumniQuery,
  hasBaseballCard,
  LinkedInUrl,
  MergeCommunityRequest,
  MergeCollegeRequest,
  type MyCard,
  PageQuery,
  PersonName,
  searchFilters,
  Phone,
  Post,
  RecruiterSignupRequest,
  SaveCollegeRequest,
  SignupRequest,
  StaffUpdateTeamRequest,
  TeamQrCodeHistoryEntry,
  TRACKED_EVENT_NAMES,
  TRACKED_EVENTS,
  TrackEventRequest,
  UpdateAlumniProfileRequest,
  UpdateCardVisibilityRequest,
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

  it('never creates an account for anyone under 13', () => {
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
    experience: [{ role: 'Analyst intern', organization: 'Northbeam', period: 'Summer 2026' }],
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

  it('keeps experience to 3 role / organization / period entries and rejects empty ones', () => {
    const card = { firstName: 'Maya', lastName: 'Okafor', classYear: 2028, major: 'Economics' };
    const entry = { role: 'Treasurer', organization: 'Investment club', period: '2025 – Now' };
    expect(accepts(CreateCardRequest, { ...card, experience: [] })).toBe(true);
    expect(accepts(CreateCardRequest, { ...card, experience: [entry, entry, entry] })).toBe(true);
    expect(
      issuePaths(
        CreateCardRequest.safeParse({ ...card, experience: [entry, entry, entry, entry] }),
      ),
    ).toEqual(['experience']);
    // A row needs a role; organisation and period may be blank.
    expect(
      accepts(CreateCardRequest, {
        ...card,
        experience: [{ role: 'Captain', organization: '', period: '' }],
      }),
    ).toBe(true);
    expect(
      issuePaths(
        CreateCardRequest.safeParse({
          ...card,
          experience: [{ role: '  ', organization: '', period: '' }],
        }),
      ),
    ).toEqual(['experience.0.role']);
    expect(accepts(ExperienceEntry, { ...entry, role: 'x'.repeat(61) })).toBe(false);
    expect(accepts(ExperienceEntry, { ...entry, organization: 'x'.repeat(81) })).toBe(false);
    expect(accepts(ExperienceEntry, { ...entry, period: 'x'.repeat(31) })).toBe(false);
    // Free text from before TI-150 and unknown keys are rejected.
    expect(accepts(CreateCardRequest, { ...card, experience: 'Analyst intern' })).toBe(false);
    expect(accepts(ExperienceEntry, { ...entry, url: 'https://x.test' })).toBe(false);
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

  it('asks parents whether they’re a parent or guardian, and nothing about children', () => {
    const parent = { role: 'parent', teamId: ID, relationship: 'guardian' };
    expect(accepts(CreateJoinRequest, parent)).toBe(true);
    expect(accepts(CreateJoinRequest, { ...parent, relationship: undefined })).toBe(false);
    expect(accepts(CreateJoinRequest, { ...parent, relationship: 'aunt' })).toBe(false);
    expect(CreateJoinRequest.parse({ ...parent, childIds: [ID] })).not.toHaveProperty('childIds');
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
    communityId: ID,
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

  it('posts an opportunity into a community', () => {
    const { communityId, ...noCommunity } = opportunity;
    expect(communityId).toBe(ID);
    expect(issuePaths(CreateOpportunityRequest.safeParse(noCommunity))).toEqual(['communityId']);
  });

  it('needs text and a community', () => {
    expect(accepts(CreatePostRequest, { text: 'Hi' })).toBe(false);
    const post = { communityId: ID, text: 'Hi' };
    expect(accepts(CreatePostRequest, post)).toBe(true);
    expect(accepts(CreatePostRequest, { ...post, text: '   ' })).toBe(false);
  });

  it('sends announcements into a community', () => {
    const announcement = { communityId: ID, text: 'Family night is on Oct 19', sendPush: true };
    expect(accepts(CreateAnnouncementRequest, announcement)).toBe(true);
    expect(accepts(CreateAnnouncementRequest, { ...announcement, text: 'Too short' })).toBe(false);
  });

  it('carries opportunity details only on opportunity posts', () => {
    const post = {
      id: ID,
      author: coach,
      community: { id: ID, name: 'Team Impact', kind: 'team_impact' },
      text: 'Big win Saturday',
      imageUrl: null,
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
      communityId: ID,
    };
    expect(issuePaths(CreateEventRequest.safeParse(event))).toEqual(['endsAt']);
  });
});

describe('communities', () => {
  const base = {
    id: ID,
    name: 'First-gen athletes',
    about: 'For first-generation college athletes.',
    memberCount: 12,
    moderation: 'approved',
    createdAt: NOW,
  };

  it('needs a name of up to 60 characters and says what it’s for', () => {
    const create = { kind: 'interest', name: 'First-gen athletes', about: '   ' };
    const result = CreateCommunityRequest.safeParse(create);
    expect(result.error?.issues[0]?.message).toBe('Say what the community is for.');
    expect(accepts(CreateCommunityRequest, { ...create, about: 'Hi', name: 'x'.repeat(61) })).toBe(
      false,
    );
  });

  it('creates open communities unless asked to make them private', () => {
    const create = { kind: 'interest', name: 'Captains', about: 'Team captains only.' };
    expect(CreateCommunityRequest.parse(create).private).toBe(false);
    expect(CreateCommunityRequest.parse({ ...create, private: true }).private).toBe(true);
  });

  it('lets users create only interest and medical communities', () => {
    const create = { name: 'Cardiac families', about: 'Families of kids with heart conditions.' };
    expect(accepts(CreateCommunityRequest, { ...create, kind: 'medical' })).toBe(true);
    expect(accepts(CreateCommunityRequest, { ...create, kind: 'interest' })).toBe(true);
    expect(accepts(CreateCommunityRequest, { ...create, kind: 'team' })).toBe(false);
    expect(accepts(CreateCommunityRequest, { ...create, kind: 'team_impact' })).toBe(false);
  });

  it('carries the official flag and recruiter opt-in on interest communities only', () => {
    const interest = Community.parse({
      ...base,
      kind: 'interest',
      createdBy: coach,
      private: false,
      myJoinRequest: null,
      official: true,
      myMembership: { joinedAt: NOW, recruiterSearchOptIn: true },
    });
    expect(interest).toHaveProperty('official', true);

    for (const kind of ['team', 'team_impact', 'medical'] as const) {
      const other = Community.parse({
        ...base,
        kind,
        teamId: ID,
        createdBy: coach,
        private: false,
        myJoinRequest: null,
        official: true,
        myMembership: { joinedAt: NOW, recruiterSearchOptIn: true },
      });
      expect(other, kind).not.toHaveProperty('official');
      expect(other.myMembership, kind).not.toHaveProperty('recruiterSearchOptIn');
    }
  });

  it('needs an official flag on interest communities and a team on team communities', () => {
    const interest = {
      ...base,
      kind: 'interest',
      createdBy: coach,
      private: false,
      myJoinRequest: null,
      myMembership: null,
    };
    expect(issuePaths(Community.safeParse(interest))).toEqual(['official']);
    expect(issuePaths(Community.safeParse({ ...base, kind: 'team', myMembership: null }))).toEqual([
      'teamId',
    ]);
  });

  it('follows the PRD §5 table for who creates which kind', () => {
    for (const role of ['staff', 'coach', 'athlete', 'alumni_athlete', 'alumni_mentor'] as const) {
      expect(canCreateCommunity(role, 'interest'), role).toBe(true);
      expect(canCreateCommunity(role, 'medical'), role).toBe(true);
    }
    expect(canCreateCommunity('parent', 'medical')).toBe(true);
    expect(canCreateCommunity('parent', 'interest')).toBe(false);
    for (const role of ['teen', 'recruiter'] as const) {
      expect(canCreateCommunity(role, 'interest'), role).toBe(false);
      expect(canCreateCommunity(role, 'medical'), role).toBe(false);
    }
  });

  it('keeps teens and recruiters out of medical communities, and recruiters out of all', () => {
    expect(canJoinCommunity('teen', 'medical')).toBe(false);
    expect(canJoinCommunity('teen', 'interest')).toBe(true);
    expect(canJoinCommunity('parent', 'medical')).toBe(true);
    for (const kind of ['team_impact', 'medical', 'interest'] as const) {
      expect(canJoinCommunity('recruiter', kind), kind).toBe(false);
    }
    expect(canJoinCommunity('staff', 'team')).toBe(false);
  });

  it('merges into another community by id', () => {
    expect(accepts(MergeCommunityRequest, { intoId: ID })).toBe(true);
    expect(accepts(MergeCommunityRequest, {})).toBe(false);
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
    expect(accepts(CreateReportRequest, { ...report, target: { kind: 'community', id: ID } })).toBe(
      true,
    );
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

/** True when a schema only admits ids, enums, numbers and flags, so free text can't get in. */
const isStructured = (schema: ZodType): boolean => {
  const def = schema._zod.def as { type: string; format?: string };
  switch (def.type) {
    case 'string':
      return def.format === 'uuid';
    case 'enum':
    case 'literal':
    case 'number':
    case 'boolean':
      return true;
    case 'array':
      return isStructured((def as unknown as { element: ZodType }).element);
    case 'optional':
    case 'nullable':
      return isStructured((def as unknown as { innerType: ZodType }).innerType);
    default:
      return false;
  }
};

describe('tracked events', () => {
  it('carries ids, enums, counts and flags only, never names, emails or free text', () => {
    expect(isStructured(PersonName)).toBe(false);
    expect(isStructured(Email)).toBe(false);
    for (const name of TRACKED_EVENT_NAMES) {
      for (const [key, schema] of Object.entries(TRACKED_EVENTS[name].properties.shape)) {
        expect(isStructured(schema), `${name}.${key}`).toBe(true);
      }
    }
  });

  it('refuses properties an event doesn’t define', () => {
    const published = { cardId: ID };
    expect(accepts(TRACKED_EVENTS['card.published'].properties, published)).toBe(true);
    const withName = { ...published, firstName: 'Maya' };
    expect(accepts(TRACKED_EVENTS['card.published'].properties, withName)).toBe(false);
  });

  it('records which search filters were set, never their values', () => {
    const query = { sport: 'Soccer', major: '', classYear: 2027, limit: 20, cursor: '40' };
    expect(searchFilters({ ...query, communityId: ID, region: undefined })).toEqual([
      'sport',
      'classYear',
    ]);
  });

  it('lets clients send only client events, each about someone', () => {
    const view = { name: 'card.viewed', properties: { cardId: ID }, subjectId: ID };
    expect(accepts(TrackEventRequest, view)).toBe(true);
    expect(accepts(TrackEventRequest, { ...view, subjectId: undefined })).toBe(false);
    const search = {
      name: 'search.identity_filter',
      properties: { searchId: ID, communityId: ID, companyId: ID, filters: [], resultCount: 3 },
    };
    expect(accepts(TRACKED_EVENTS['search.identity_filter'].properties, search.properties)).toBe(
      true,
    );
    expect(accepts(TrackEventRequest, search)).toBe(false);

    // Written out, so marking another event `client` has to change this test too.
    const allowed = ['card.viewed', 'contact.viewed'];
    const requestNames = TrackEventRequest.options.map((option) => option.shape.name.value);
    expect([...requestNames].sort()).toEqual(allowed);
    const clientNames = TRACKED_EVENT_NAMES.filter(
      (name) => TRACKED_EVENTS[name].source === 'client',
    );
    expect([...clientNames].sort()).toEqual(allowed);
  });

  it('refuses well-formed API events from clients, even with a subject', () => {
    const forged = [
      { name: 'search.result_shown', properties: { searchId: ID, position: 0 } },
      {
        name: 'search.identity_filter',
        properties: { searchId: ID, communityId: ID, companyId: ID, filters: [], resultCount: 3 },
      },
      { name: 'list.athlete_saved', properties: { listId: ID } },
      { name: 'coach.added', properties: { teamId: ID, via: 'invite' } },
    ] as const;
    for (const event of forged) {
      expect(accepts(TRACKED_EVENTS[event.name].properties, event.properties), event.name).toBe(
        true,
      );
      expect(accepts(TrackEventRequest, { ...event, subjectId: ID }), event.name).toBe(false);
    }
  });

  it('leaves who and when to the server', () => {
    const view = { name: 'card.viewed', properties: { cardId: ID }, subjectId: ID };
    for (const forged of [{ userId: ID }, { occurredAt: NOW }]) {
      const parsed = TrackEventRequest.safeParse({ ...view, ...forged });
      // Refused, or parsed without the field: either way the client can't set it.
      const kept = parsed.success && Object.keys(forged).some((key) => key in parsed.data);
      expect(kept, Object.keys(forged)[0]).toBe(false);
    }
  });
});
