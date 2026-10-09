// `pnpm seed`: wipes every table and fills it with a fixed, Faker-generated dataset. The Faker seed
// and reference date are pinned, so every run produces the same rows (same ids) — safe to re-run.
//
// Fixed cast for manual testing (every seeded account's password is team-impact-dev):
//   staff@example.test, tufts.coach@example.test, tufts.athlete1..10@example.test,
//   tufts.parent1..2@example.test, tufts.teen@example.test, recruiter@northwind.example,
//   alumni@example.test
import { createHash } from 'node:crypto';
import { faker } from '@faker-js/faker';
import { getTableName, is, sql } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema';
import {
  AFFINITY_GROUPS,
  AWFUL_POSTS,
  COLLEGES,
  COMMENT_TEMPLATES,
  CURRENT_SEASON,
  INDUSTRIES,
  MAJORS,
  POST_TEMPLATES,
  SEASONS,
  SPORTS,
  TEAM_COLORS,
} from './data';

// argon2id hash of "team-impact-dev", the shared local password for every seeded account.
const DEV_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$kwOXDCSVp3jrLCRhtryvcw$3F8TXsfX3cZ6DhEoMEoYr1C1B20F0TTfGItSyp1tal4';

const REF = new Date('2026-10-01T12:00:00Z');
faker.seed(14);
faker.setDefaultRefDate(REF);

type Row<T extends PgTable> = T['$inferInsert'];
type UserType = (typeof schema.users.$inferSelect)['userType'];
type Season = (typeof SEASONS)[number];

// ---------------------------------------------------------------------------------------------
// Helpers

const uuid = () => faker.string.uuid();
const pick = <T>(items: readonly T[]) => faker.helpers.arrayElement(items);
const chance = (probability: number) => faker.datatype.boolean({ probability });
const int = (min: number, max: number) => faker.number.int({ min, max });
const daysAgo = (days: number) => new Date(REF.getTime() - days * 86_400_000);
const daysAhead = (days: number) => daysAgo(-days);
const recent = (maxDays: number) => faker.date.between({ from: daysAgo(maxDays), to: REF });
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');
const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? key);
const seasonForGradYear = (year: number) => `${year - 1}-${String(year).slice(2)}`;

const AGES: Record<UserType, [number, number]> = {
  athlete: [18, 23],
  teen: [13, 17],
  alumni: [24, 42],
  parent: [32, 56],
  coach: [27, 62],
  recruiter: [24, 55],
  staff: [24, 55],
};

let emailCounter = 0;
const rows = {
  colleges: [] as Row<typeof schema.colleges>[],
  orgs: [] as Row<typeof schema.orgs>[],
  orgDomains: [] as Row<typeof schema.orgDomains>[],
  users: [] as Row<typeof schema.users>[],
  teams: [] as Row<typeof schema.teams>[],
  coachInvites: [] as Row<typeof schema.coachInvites>[],
  groups: [] as (Row<typeof schema.groups> & { id: string })[],
  joinCodes: [] as Row<typeof schema.joinCodes>[],
  memberships: [] as Row<typeof schema.memberships>[],
  joinRequests: [] as Row<typeof schema.joinRequests>[],
  children: [] as Row<typeof schema.children>[],
  consentRecords: [] as Row<typeof schema.consentRecords>[],
  contactVisibility: [] as Row<typeof schema.contactVisibility>[],
  deviceTokens: [] as Row<typeof schema.deviceTokens>[],
  blocks: [] as Row<typeof schema.blocks>[],
  ingestedRecords: [] as Row<typeof schema.ingestedRecords>[],
  cards: [] as Row<typeof schema.cards>[],
  media: [] as Row<typeof schema.media>[],
  posts: [] as Row<typeof schema.posts>[],
  comments: [] as Row<typeof schema.comments>[],
  reactions: [] as Row<typeof schema.reactions>[],
  events: [] as Row<typeof schema.events>[],
  rsvps: [] as Row<typeof schema.rsvps>[],
  savedSearches: [] as Row<typeof schema.savedSearches>[],
  shortlists: [] as Row<typeof schema.shortlists>[],
  shortlistEntries: [] as Row<typeof schema.shortlistEntries>[],
  shortlistNotes: [] as Row<typeof schema.shortlistNotes>[],
  reports: [] as Row<typeof schema.reports>[],
  moderationActions: [] as Row<typeof schema.moderationActions>[],
  eventsLog: [] as Row<typeof schema.eventsLog>[],
};

type UserRow = Row<typeof schema.users> & { id: string };

const addUser = (
  userType: UserType,
  overrides: Partial<Row<typeof schema.users>> = {},
): UserRow => {
  const firstName = overrides.firstName ?? faker.person.firstName();
  const lastName = overrides.lastName ?? faker.person.lastName();
  const [min, max] = AGES[userType];
  const createdAt = recent(700);
  const user: UserRow = {
    id: uuid(),
    userType,
    email: `${slug(firstName)}.${slug(lastName)}.${++emailCounter}@example.test`,
    passwordHash: DEV_PASSWORD_HASH,
    firstName,
    lastName,
    dob: faker.date.birthdate({ mode: 'age', min, max }).toISOString().slice(0, 10),
    emailVerifiedAt: createdAt,
    createdAt,
    ...overrides,
  };
  rows.users.push(user);
  rows.consentRecords.push({
    id: uuid(),
    userId: user.id,
    flag: 'terms',
    value: true,
    termsVersion: 'v2.0',
    createdAt,
  });
  if (userType === 'teen') {
    rows.consentRecords.push({
      id: uuid(),
      userId: user.id,
      flag: 'parent_agreed',
      value: true,
      termsVersion: 'v2.0',
      createdAt,
    });
  }
  if (chance(0.4)) {
    rows.deviceTokens.push({
      id: uuid(),
      userId: user.id,
      platform: pick(['ios', 'android'] as const),
      token: `ExponentPushToken[${faker.string.alphanumeric(22)}]`,
      createdAt,
    });
  }
  return user;
};

const log = (userId: string | null, event: string, properties: object, occurredAt = recent(365)) =>
  rows.eventsLog.push({ id: uuid(), userId, event, properties, occurredAt });

/** Group members, for picking realistic authors, commenters and RSVPs. */
const groupMembers = new Map<string, string[]>();
const membershipKeys = new Set<string>();
const addMembership = (membership: Omit<Row<typeof schema.memberships>, 'id'>) => {
  const key = `${membership.userId}:${membership.groupId}:${membership.season ?? ''}`;
  if (membershipKeys.has(key)) return;
  membershipKeys.add(key);
  rows.memberships.push({ id: uuid(), joinedAt: recent(400), ...membership });
  const members = groupMembers.get(membership.groupId) ?? [];
  if (!members.includes(membership.userId)) members.push(membership.userId);
  groupMembers.set(membership.groupId, members);
};

const addGroup = (group: Omit<Row<typeof schema.groups>, 'id'>) => {
  const row = { id: uuid(), createdAt: daysAgo(720), ...group };
  rows.groups.push(row);
  return row;
};

// ---------------------------------------------------------------------------------------------
// Colleges, orgs, staff, platform group

const colleges = COLLEGES.map((college) => {
  const row = { id: uuid(), name: college.name, region: college.region, createdAt: daysAgo(720) };
  rows.colleges.push(row);
  return { ...college, id: row.id };
});
const tufts = colleges[0]!;

const staff = addUser('staff', { email: 'staff@example.test' });
const moreStaff = Array.from({ length: 3 }, () => addUser('staff'));
const platformGroup = addGroup({ kind: 'platform', name: 'Team Impact', visibility: 'open' });
for (const user of [staff, ...moreStaff]) {
  addMembership({ userId: user.id, groupId: platformGroup.id, role: 'admin', source: 'signup' });
}

const ORG_SPECS = [
  { name: 'Northwind Analytics', tier: 'standard' as const, domains: ['northwind.example'] },
  {
    name: 'Brightline Partners',
    tier: 'premium' as const,
    domains: ['brightline.example', 'brightlinepartners.example'],
  },
];
const orgs = ORG_SPECS.map((spec) => {
  const org = { id: uuid(), name: spec.name, tier: spec.tier, createdAt: daysAgo(400) };
  rows.orgs.push(org);
  for (const domain of spec.domains) rows.orgDomains.push({ id: uuid(), orgId: org.id, domain });
  const group = addGroup({ kind: 'org', name: spec.name, orgId: org.id });
  return { ...org, ...spec, group };
});

// ---------------------------------------------------------------------------------------------
// Teams, coaches, invites and QR codes

type TeamInfo = {
  id: string;
  groupId: string;
  sport: string;
  college: (typeof colleges)[number];
  coachId: string;
  joinCodeId: string;
};
const teams: TeamInfo[] = [];

const addTeam = (
  college: (typeof colleges)[number],
  sport: string,
  gender: 'men' | 'women' | 'coed',
  extra: { color?: string; coach?: UserRow } = {},
): TeamInfo => {
  const teamId = uuid();
  const label = gender === 'women' ? "Women's" : gender === 'men' ? "Men's" : 'Coed';
  const displayName = `${college.name} ${label} ${sport}`;
  const createdAt = daysAgo(int(380, 700));
  rows.teams.push({
    id: teamId,
    collegeId: college.id,
    sport,
    gender,
    division: college.division,
    displayName,
    color: extra.color ?? (chance(0.6) ? pick(TEAM_COLORS) : null),
    status: chance(0.03) ? 'archived' : 'live',
    createdAt,
  });
  log(staff.id, 'team.created', { teamId, displayName }, createdAt);
  const group = addGroup({ kind: 'team', name: displayName, teamId, createdAt });

  const coach = extra.coach ?? addUser('coach', { collegeId: college.id });
  rows.coachInvites.push({
    id: uuid(),
    teamId,
    email: coach.email,
    tokenHash: sha256(uuid()),
    invitedBy: staff.id,
    expiresAt: daysAgo(int(300, 370)),
    acceptedAt: daysAgo(int(371, 379)),
    createdAt,
  });
  for (const season of SEASONS) {
    addMembership({
      userId: coach.id,
      groupId: group.id,
      role: 'coach',
      season,
      source: 'coach_invite',
      joinedAt: createdAt,
    });
  }
  log(staff.id, 'coach.added', { teamId, coachId: coach.id, via: 'invite' }, createdAt);

  const joinCodeId = uuid();
  rows.joinCodes.push({
    id: joinCodeId,
    teamId,
    code: faker.string.alphanumeric({ length: 10, casing: 'upper' }),
    createdBy: coach.id,
    expiresAt: daysAhead(int(1, 7)),
    createdAt: daysAgo(int(0, 6)),
  });
  // An older code that has expired, so codes have history.
  rows.joinCodes.push({
    id: uuid(),
    teamId,
    code: faker.string.alphanumeric({ length: 10, casing: 'upper' }),
    createdBy: coach.id,
    expiresAt: daysAgo(int(20, 60)),
    createdAt: daysAgo(int(61, 90)),
  });

  if (chance(0.25)) {
    const assistant = addUser('coach', { collegeId: college.id });
    addMembership({
      userId: assistant.id,
      groupId: group.id,
      role: 'coach',
      season: CURRENT_SEASON,
      source: 'coach_added',
      addedBy: coach.id,
    });
    log(coach.id, 'coach.added', { teamId, coachId: assistant.id, via: 'coach' });
  }

  const team = { id: teamId, groupId: group.id, sport, college, coachId: coach.id, joinCodeId };
  teams.push(team);
  return team;
};

// ---------------------------------------------------------------------------------------------
// Athletes, cards, contacts, media

type AthleteInfo = { user: UserRow; team: TeamInfo; seasons: Season[] };
const athletes: AthleteInfo[] = [];

const COMPLETENESS = [15, 30, 45, 60, 75, 90, 100];

const addCards = (
  athlete: UserRow,
  team: TeamInfo,
  seasons: readonly string[],
  completenessBias?: number,
) => {
  seasons.forEach((season, seasonIndex) => {
    const isCurrent = seasonIndex === seasons.length - 1;
    const versions = isCurrent ? int(1, 3) : 1;
    const completeness = completenessBias ?? pick(COMPLETENESS);
    for (let version = 1; version <= versions; version++) {
      const latest = version === versions;
      const status = !latest
        ? 'archived'
        : completeness >= 60 || !isCurrent
          ? 'published'
          : 'draft';
      const filled = Math.round((completeness * version) / versions);
      rows.cards.push({
        id: uuid(),
        athleteId: athlete.id,
        season,
        version,
        status,
        completeness: filled,
        sport: team.sport,
        position: pick(SPORTS[team.sport]!),
        gradYear: athlete.gradYear ?? null,
        major: athlete.major ?? null,
        region: team.college.region,
        city: team.college.city,
        division: team.college.division,
        payload:
          filled >= 45
            ? {
                headline: `${team.sport} at ${team.college.name}`,
                bio: faker.lorem.sentences(2),
                hometown: athlete.hometown,
                experience: Array.from({ length: filled >= 75 ? 2 : 1 }, () => ({
                  role: faker.person.jobTitle(),
                  org: faker.company.name(),
                  years: `${int(2021, 2025)}`,
                })),
                interests: faker.helpers.arrayElements(INDUSTRIES, { min: 1, max: 3 }),
              }
            : { headline: `${team.sport} at ${team.college.name}` },
        createdAt: daysAgo(int(1, 600)),
      });
    }
  });
};

const addContactSettings = (userId: string) => {
  for (const scope of ['family', 'recruiter'] as const) {
    for (const channel of ['phone', 'email', 'linkedin'] as const) {
      rows.contactVisibility.push({
        id: uuid(),
        userId,
        scope,
        channel,
        visible: scope === 'family' ? chance(0.7) : chance(0.5),
      });
    }
  }
};

const addAthlete = (
  team: TeamInfo,
  seasons: Season[],
  overrides: Partial<Row<typeof schema.users>> = {},
  completeness?: number,
): AthleteInfo => {
  const firstName = overrides.firstName ?? faker.person.firstName();
  const lastName = overrides.lastName ?? faker.person.lastName();
  const user = addUser('athlete', {
    firstName,
    lastName,
    collegeId: team.college.id,
    hometown: `${faker.location.city()}, ${faker.location.state({ abbreviated: true })}`,
    major: pick(MAJORS),
    gradYear: int(2026, 2029),
    phone: faker.phone.number({ style: 'national' }),
    linkedinUrl: `https://www.linkedin.com/in/${slug(firstName)}-${slug(lastName)}-${int(100, 999)}`,
    ...overrides,
  });
  const source = pick(['join_code', 'join_request', 'roster_import', 'signup'] as const);
  for (const season of seasons) {
    addMembership({
      userId: user.id,
      groupId: team.groupId,
      season,
      source,
      joinCodeId: source === 'join_code' ? team.joinCodeId : null,
      joinedAt: daysAgo(int(30, 700)),
    });
  }
  if (source === 'join_request') {
    rows.joinRequests.push({
      id: uuid(),
      userId: user.id,
      teamId: team.id,
      status: 'approved',
      requestedAt: daysAgo(int(40, 700)),
      decidedBy: team.coachId,
      decidedAt: daysAgo(int(30, 39)),
    });
  }
  addCards(user, team, seasons, completeness);
  addContactSettings(user.id);
  rows.consentRecords.push({
    id: uuid(),
    userId: user.id,
    flag: 'recruiter_visible',
    value: true,
    termsVersion: 'v2.0',
    createdAt: daysAgo(int(200, 400)),
  });
  if (chance(0.15)) {
    // Changed their mind: the newer row wins, the history stays.
    rows.consentRecords.push({
      id: uuid(),
      userId: user.id,
      flag: 'recruiter_visible',
      value: false,
      termsVersion: 'v2.0',
      createdAt: daysAgo(int(1, 199)),
    });
  }
  if (chance(0.6)) {
    rows.media.push({
      id: uuid(),
      ownerUserId: user.id,
      kind: 'photo',
      storageKey: `seed/photos/${user.id}.jpg`,
      width: 1080,
      height: 1350,
      createdAt: daysAgo(int(1, 300)),
    });
  }
  if (chance(0.25)) {
    const parseStatus = pick(['confirmed', 'confirmed', 'parsed', 'failed'] as const);
    rows.media.push({
      id: uuid(),
      ownerUserId: user.id,
      kind: 'resume',
      storageKey: `seed/resumes/${user.id}.pdf`,
      parseStatus,
      parsedPayload:
        parseStatus === 'failed'
          ? null
          : { education: team.college.name, skills: faker.helpers.arrayElements(MAJORS, 2) },
      createdAt: daysAgo(int(1, 300)),
    });
  }
  const info = { user, team, seasons };
  athletes.push(info);
  return info;
};

const seasonsFrom = (start: number): Season[] => SEASONS.slice(start) as Season[];

// The fixed Tufts team: coach, 10 athletes, 2 parents with a child each, 1 teen, a team colour,
// and one pending coach invite.
const tuftsCoach = addUser('coach', { email: 'tufts.coach@example.test', collegeId: tufts.id });
const tuftsTeam = addTeam(tufts, 'Soccer', 'women', { color: '#3E8EDE', coach: tuftsCoach });
log(staff.id, 'team.updated', { teamId: tuftsTeam.id, changes: { color: '#3E8EDE' } });
rows.coachInvites.push({
  id: uuid(),
  teamId: tuftsTeam.id,
  email: 'tufts.assistant@example.test',
  tokenHash: sha256('seed-pending-coach-invite'),
  invitedBy: staff.id,
  expiresAt: daysAhead(6),
  createdAt: daysAgo(1),
});
log(staff.id, 'coach.invited', { teamId: tuftsTeam.id, email: 'tufts.assistant@example.test' });
rows.joinCodes.push({
  id: uuid(),
  teamId: tuftsTeam.id,
  code: 'TUFTSREVOKED',
  createdBy: tuftsCoach.id,
  expiresAt: daysAhead(3),
  revokedAt: daysAgo(2),
  createdAt: daysAgo(4),
});

for (let i = 1; i <= 10; i++) {
  // Completeness 15..100 across the ten; the ones with a published card are open to recruiting.
  const completeness = COMPLETENESS[(i - 1) % COMPLETENESS.length]!;
  addAthlete(
    tuftsTeam,
    seasonsFrom(i <= 4 ? 0 : i <= 7 ? 1 : 2),
    { email: `tufts.athlete${i}@example.test`, openToRecruiting: completeness >= 60 },
    completeness,
  );
}

const addFamily = (team: TeamInfo, email?: string, childCount = 1) => {
  const parent = addUser('parent', email ? { email } : {});
  addMembership({
    userId: parent.id,
    groupId: team.groupId,
    season: CURRENT_SEASON,
    source: pick(['join_code', 'join_request'] as const),
  });
  for (let c = 0; c < childCount; c++) {
    rows.children.push({
      id: uuid(),
      parentUserId: parent.id,
      teamId: team.id,
      firstName: faker.person.firstName(),
      age: int(5, 12),
      bio: chance(0.5) ? `Loves ${pick(Object.keys(SPORTS)).toLowerCase()} and pizza.` : null,
      photoStorageKey: chance(0.5) ? `seed/children/${uuid()}.jpg` : null,
      createdAt: daysAgo(int(1, 300)),
    });
  }
  return parent;
};

const addTeen = (team: TeamInfo, email?: string) => {
  const teen = addUser('teen', email ? { email } : {});
  addMembership({
    userId: teen.id,
    groupId: team.groupId,
    season: CURRENT_SEASON,
    source: pick(['join_code', 'join_request'] as const),
  });
  return teen;
};

addFamily(tuftsTeam, 'tufts.parent1@example.test');
addFamily(tuftsTeam, 'tufts.parent2@example.test');
addTeen(tuftsTeam, 'tufts.teen@example.test');

// Bulk teams: 2-3 per college (Tufts gets more too, but only the soccer team is the fixed cast).
for (const college of colleges) {
  const sports = faker.helpers.arrayElements(Object.keys(SPORTS), int(2, 3));
  for (const sport of sports) {
    const gender = pick(['men', 'women'] as const);
    if (college === tufts && sport === 'Soccer' && gender === 'women') continue;
    const team = addTeam(college, sport, gender);
    const rosterSize = int(16, 26);
    for (let i = 0; i < rosterSize; i++) addAthlete(team, seasonsFrom(int(0, 2)));
    for (let i = 0, n = int(0, 3); i < n; i++) addFamily(team, undefined, int(1, 2));
    for (let i = 0, n = int(0, 2); i < n; i++) addTeen(team);
  }
}

// Open-to-recruiting needs a published card; most published athletes opt in.
const publishedAthletes = new Set(
  rows.cards
    .filter((card) => card.status === 'published' && card.season === CURRENT_SEASON)
    .map((card) => card.athleteId),
);
for (const { user } of athletes) {
  if (user.email.startsWith('tufts.')) continue;
  user.openToRecruiting = publishedAthletes.has(user.id) && chance(0.7);
}

// The same athlete twice for roster dedupe (TI-36): two accounts, two emails, two seasons, one person.
const dupeTeam = teams.find((team) => team.college.name === 'Northeastern University') ?? teams[1]!;
const dupeShared = {
  firstName: 'Jordan',
  lastName: 'Avery',
  dob: '2005-03-14',
  hometown: 'Worcester, MA',
  major: 'Economics',
  gradYear: 2027,
};
addAthlete(dupeTeam, ['2023-24'], { ...dupeShared, email: 'jordan.avery.2005@example.test' }, 60);
addAthlete(dupeTeam, ['2024-25'], { ...dupeShared, email: 'javery.athletics@example.test' }, 75);

// Pending and declined join requests from people not yet on the team.
for (let i = 0; i < 40; i++) {
  const team = pick(teams);
  const requester = addUser(pick(['athlete', 'parent', 'teen'] as const));
  rows.joinRequests.push({
    id: uuid(),
    userId: requester.id,
    teamId: team.id,
    status: i < 30 ? 'pending' : 'declined',
    requestedAt: daysAgo(int(0, 20)),
    decidedBy: i < 30 ? null : team.coachId,
    decidedAt: i < 30 ? null : daysAgo(int(0, 5)),
  });
}

// ---------------------------------------------------------------------------------------------
// Alumni: claimed (have accounts) and unclaimed (pre-built cards waiting for a claim token)

const addIngested = (college: (typeof colleges)[number], gradYear: number, name: string) => {
  const record = {
    id: uuid(),
    source: pick(['athletics_roster', 'team_impact_csv']),
    sourceRef: `${slug(college.name)}-${gradYear}-${faker.string.alphanumeric(8)}`,
    fetchedAt: daysAgo(int(30, 200)),
    name,
    collegeId: college.id,
    years: `${gradYear - 4}-${gradYear}`,
    matchConfidence: faker.number.float({ min: 0.55, max: 0.99, fractionDigits: 2 }),
    status: 'invited' as const,
    claimTokenHash: sha256(uuid()),
  };
  rows.ingestedRecords.push(record);
  return record;
};

const addAlumnus = (college: (typeof colleges)[number], email?: string) => {
  const gradYear = int(2010, 2024);
  const sport = pick(Object.keys(SPORTS));
  const user = addUser('alumni', {
    ...(email ? { email } : {}),
    collegeId: college.id,
    major: pick(MAJORS),
    gradYear,
    industry: pick(INDUSTRIES),
    jobTitle: faker.person.jobTitle(),
    currentEmployer: faker.company.name(),
    mentoring: chance(0.6),
    hiring: chance(0.3),
    phone: faker.phone.number({ style: 'national' }),
  });
  const record = addIngested(college, gradYear, `${user.firstName} ${user.lastName}`);
  Object.assign(record, {
    status: 'claimed',
    claimedByUserId: user.id,
    claimedAt: daysAgo(int(1, 200)),
  });
  rows.cards.push({
    id: uuid(),
    athleteId: user.id,
    ingestedRecordId: record.id,
    season: seasonForGradYear(gradYear),
    status: 'published',
    completeness: pick(COMPLETENESS),
    sport,
    position: pick(SPORTS[sport]!),
    gradYear,
    major: user.major,
    region: college.region,
    city: college.city,
    division: college.division,
    payload: { headline: `${sport} at ${college.name}`, employer: user.currentEmployer },
    createdAt: daysAgo(int(1, 200)),
  });
  addContactSettings(user.id);
  addMembership({ userId: user.id, groupId: collegeGroups.get(college.id)!, source: 'signup' });
  return user;
};

const collegeGroups = new Map(
  colleges.map((college) => [
    college.id,
    addGroup({ kind: 'college', name: college.name, collegeId: college.id, visibility: 'open' }).id,
  ]),
);

const fixedAlumnus = addAlumnus(tufts, 'alumni@example.test');
const alumni = [fixedAlumnus, ...Array.from({ length: 200 }, () => addAlumnus(pick(colleges)))];

for (let i = 0; i < 200; i++) {
  const college = pick(colleges);
  const gradYear = int(2008, 2024);
  const sport = pick(Object.keys(SPORTS));
  const record = addIngested(college, gradYear, faker.person.fullName());
  if (i < 160) {
    rows.cards.push({
      id: uuid(),
      ingestedRecordId: record.id,
      season: seasonForGradYear(gradYear),
      status: 'unclaimed',
      completeness: pick([15, 30, 45]),
      sport,
      position: pick(SPORTS[sport]!),
      gradYear,
      region: college.region,
      city: college.city,
      division: college.division,
      payload: { headline: `${sport} at ${college.name}` },
      createdAt: daysAgo(int(30, 200)),
    });
  } else {
    Object.assign(record, { status: 'unmatched', claimTokenHash: null });
  }
}

// Athletes and alumni join their college group too.
for (const { user, team } of athletes) {
  if (chance(0.5)) {
    addMembership({
      userId: user.id,
      groupId: collegeGroups.get(team.college.id)!,
      source: 'signup',
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Affinity groups: one official (staff-marked), the rest user-created

const officialAffinity = addGroup({
  kind: 'affinity',
  name: 'First-Gen Athletes',
  visibility: 'open',
  official: true,
  createdBy: athletes[0]!.user.id,
});
const affinityGroups = [
  officialAffinity,
  ...AFFINITY_GROUPS.map((name) =>
    addGroup({ kind: 'affinity', name, visibility: 'open', createdBy: pick(athletes).user.id }),
  ),
];
log(staff.id, 'group.marked_official', { groupId: officialAffinity.id });
for (const group of affinityGroups) {
  const members = faker.helpers.arrayElements([...athletes.map((a) => a.user), ...alumni], {
    min: 40,
    max: 140,
  });
  for (const member of members) {
    addMembership({
      userId: member.id,
      groupId: group.id,
      source: 'signup',
      searchable: group.official ? chance(0.5) : false,
    });
  }
}
addMembership({
  userId: athletes[0]!.user.id,
  groupId: officialAffinity.id,
  role: 'admin',
  source: 'signup',
  searchable: true,
});

// ---------------------------------------------------------------------------------------------
// Recruiters, lists, notes, saved searches, identity-search audit trail

const recruitersByOrg = orgs.map((org, orgIndex) => {
  const recruiters = Array.from({ length: orgIndex === 0 ? 3 : 6 }, (_, i) => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email =
      orgIndex === 0 && i === 0
        ? 'recruiter@northwind.example'
        : `${slug(firstName)}.${slug(lastName)}.${++emailCounter}@${pick(org.domains)}`;
    return addUser('recruiter', {
      firstName,
      lastName,
      email,
      orgId: org.id,
      jobTitle: 'Campus Recruiter',
      status: orgIndex === 1 && i === 5 ? 'suspended' : 'active',
    });
  });
  for (const recruiter of recruiters) {
    addMembership({ userId: recruiter.id, groupId: org.group.id, source: 'signup' });
  }
  return { org, recruiters };
});

const recruitable = athletes.filter((a) => a.user.openToRecruiting).map((a) => a.user);
for (const { org, recruiters } of recruitersByOrg) {
  ['Saved', 'Spring interns', 'Analyst pipeline'].forEach((name, i) => {
    const shortlistId = uuid();
    rows.shortlists.push({
      id: shortlistId,
      orgId: org.id,
      name,
      createdBy: pick(recruiters).id,
      isDefault: i === 0,
    });
    for (const athlete of faker.helpers.arrayElements(recruitable, int(15, 35))) {
      const entryId = uuid();
      rows.shortlistEntries.push({
        id: entryId,
        shortlistId,
        athleteId: athlete.id,
        addedBy: pick(recruiters).id,
        addedAt: daysAgo(int(1, 120)),
      });
      if (chance(0.3)) {
        rows.shortlistNotes.push({
          id: uuid(),
          shortlistEntryId: entryId,
          authorId: pick(recruiters).id,
          body: pick([
            'Strong leadership signals, captain two years running.',
            'Follow up after finals.',
            'Great fit for the analytics rotation.',
            'Met at the career fair, very sharp.',
          ]),
          createdAt: daysAgo(int(1, 100)),
        });
      }
    }
    // An athlete who deleted their account: the entry stays as "profile withdrawn".
    rows.shortlistEntries.push({
      id: uuid(),
      shortlistId,
      athleteId: null,
      addedBy: pick(recruiters).id,
      addedAt: daysAgo(int(60, 200)),
      status: 'withdrawn',
    });
  });

  for (const name of ['Boston D1', 'Finance-minded seniors', 'Northeast D3 STEM']) {
    rows.savedSearches.push({
      id: uuid(),
      orgId: org.id,
      createdBy: pick(recruiters).id,
      name,
      filterJson: { region: 'New England', gradYear: [2026, 2027], major: pick(MAJORS) },
      lastRunAt: daysAgo(int(0, 14)),
      lastResultIds: faker.helpers.arrayElements(recruitable, 5).map((user) => user.id),
    });
  }

  if (org.tier === 'premium') {
    for (let i = 0; i < 12; i++) {
      const recruiter = pick(recruiters);
      log(recruiter.id, 'search.identity_filter', {
        recruiterId: recruiter.id,
        orgId: org.id,
        filter: { affinityGroupId: officialAffinity.id, sport: pick(Object.keys(SPORTS)) },
      });
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Community: posts, comments, reactions, events, RSVPs

const userTypes = new Map(rows.users.map((user) => [user.id, user.userType]));
const postableGroups = rows.groups.filter((group) => (groupMembers.get(group.id)?.length ?? 0) > 0);
const postIds: { id: string; groupId: string }[] = [];

for (let i = 0; i < 20_000; i++) {
  const group = pick(postableGroups);
  const authorId = pick(groupMembers.get(group.id)!);
  const authorType = userTypes.get(authorId);
  const isAnnouncement = group.kind === 'platform' || (authorType === 'coach' && chance(0.3));
  const id = uuid();
  rows.posts.push({
    id,
    authorId,
    groupId: group.id,
    type: isAnnouncement ? 'announcement' : chance(0.15) ? 'photo' : 'text',
    payload: {
      text: fill(pick(POST_TEMPLATES), {
        team: pick(teams).college.name,
        name: faker.person.firstName(),
        industry: pick(INDUSTRIES),
      }),
    },
    // Teens post only to their own team.
    visibility: authorType !== 'teen' && group.kind !== 'org' && chance(0.3) ? 'network' : 'group',
    status: faker.helpers.weightedArrayElement([
      { weight: 92, value: 'approved' as const },
      { weight: 5, value: 'pending' as const },
      { weight: 2, value: 'rejected' as const },
      { weight: 1, value: 'removed' as const },
    ]),
    createdAt: recent(365),
  });
  postIds.push({ id, groupId: group.id });
}

for (let i = 0; i < 50_000; i++) {
  const post = pick(postIds);
  rows.comments.push({
    id: uuid(),
    postId: post.id,
    authorId: pick(groupMembers.get(post.groupId)!),
    body: pick(COMMENT_TEMPLATES),
    status: chance(0.97) ? 'approved' : 'pending',
    createdAt: recent(365),
  });
}

const reactionKeys = new Set<string>();
for (let i = 0; i < 80_000; i++) {
  const post = pick(postIds);
  const userId = pick(groupMembers.get(post.groupId)!);
  const kind = pick(['like', 'cheer', 'fire'] as const);
  const key = `${post.id}:${userId}:${kind}`;
  if (reactionKeys.has(key)) continue;
  reactionKeys.add(key);
  rows.reactions.push({ id: uuid(), postId: post.id, userId, kind });
}

const eventGroups = rows.groups.filter(
  (group) => group.kind === 'team' || group.kind === 'affinity',
);
for (let i = 0; i < 400; i++) {
  const group = pick(eventGroups);
  const members = groupMembers.get(group.id) ?? [];
  if (members.length === 0) continue;
  const eventId = uuid();
  rows.events.push({
    id: eventId,
    groupId: group.id,
    hostId: pick(members),
    title: pick([
      'Team dinner',
      'Alumni networking night',
      'Youth clinic',
      'Resume workshop',
      'Watch party',
      'Community service day',
      'Senior night',
    ]),
    startsAt: faker.date.between({ from: daysAgo(120), to: daysAhead(90) }),
    location: `${faker.location.streetAddress()}, ${faker.location.city()}`,
    status: chance(0.95) ? 'approved' : 'pending',
    createdAt: daysAgo(int(1, 150)),
  });
  for (const userId of faker.helpers.arrayElements(members, Math.min(members.length, int(3, 15)))) {
    rows.rsvps.push({
      id: uuid(),
      eventId,
      userId,
      state: pick(['going', 'going', 'maybe', 'not_going'] as const),
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Safety: awful posts for TI-42, reports, moderation history, blocks

const awfulPostIds = AWFUL_POSTS.map((awful) => {
  const group = pick(rows.groups.filter((g) => g.kind === 'team'));
  const id = uuid();
  rows.posts.push({
    id,
    authorId: pick(groupMembers.get(group.id)!),
    groupId: group.id,
    type: 'text',
    payload: { text: awful.text, seedModerationCategory: awful.category },
    visibility: 'group',
    status: 'pending',
    createdAt: recent(14),
  });
  return { id, text: awful.text };
});
const imagePostAuthor = pick(athletes.slice(20));
rows.posts.push({
  id: uuid(),
  authorId: imagePostAuthor.user.id,
  groupId: imagePostAuthor.team.groupId,
  type: 'photo',
  payload: {
    text: 'lol look at this',
    storageKey: 'seed/moderation/graphic-image-placeholder.jpg',
    seedModerationCategory: 'graphic_image',
  },
  status: 'pending',
  createdAt: recent(7),
});

const reporters = athletes.slice(0, 50).map((a) => a.user.id);
awfulPostIds.slice(0, 6).forEach((post, i) => {
  rows.reports.push({
    id: uuid(),
    reporterId: pick(reporters),
    targetType: 'post',
    targetId: post.id,
    reason: pick(['harassment', 'spam', 'unsafe', 'other']),
    severity: pick(['low', 'medium', 'high'] as const),
    state: i < 4 ? 'open' : 'actioned',
    createdAt: recent(7),
  });
});

// One full chain: classifier removes, author appeals, staff upholds.
const removalId = uuid();
const appealId = uuid();
rows.moderationActions.push(
  {
    id: removalId,
    actorId: null,
    targetType: 'post',
    targetId: awfulPostIds[2]!.id,
    action: 'remove',
    reason: 'classifier: harassment',
    contentSnapshot: { text: awfulPostIds[2]!.text },
    createdAt: daysAgo(5),
  },
  {
    id: appealId,
    actorId: null,
    targetType: 'post',
    targetId: awfulPostIds[2]!.id,
    action: 'appeal',
    parentActionId: removalId,
    reason: 'author appealed',
    createdAt: daysAgo(4),
  },
  {
    id: uuid(),
    actorId: staff.id,
    targetType: 'post',
    targetId: awfulPostIds[2]!.id,
    action: 'uphold',
    parentActionId: appealId,
    reason: 'Clear harassment.',
    createdAt: daysAgo(3),
  },
);
for (const post of rows.posts.filter((p) => p.status === 'removed').slice(0, 30)) {
  rows.moderationActions.push({
    id: uuid(),
    actorId: pick([staff, ...moreStaff]).id,
    targetType: 'post',
    targetId: post.id!,
    action: 'remove',
    reason: 'Off-topic spam',
    contentSnapshot: post.payload,
    createdAt: post.createdAt!,
  });
}

const blockKeys = new Set<string>();
for (let i = 0; i < 60; i++) {
  const [a, b] = faker.helpers.arrayElements(athletes, 2).map((x) => x.user.id);
  if (!a || !b || blockKeys.has(`${a}:${b}`)) continue;
  blockKeys.add(`${a}:${b}`);
  rows.blocks.push({ id: uuid(), blockerId: a, blockedId: b, createdAt: recent(200) });
}

for (const user of rows.users.slice(0, 1500)) {
  log(user.id!, 'user.signed_up', { userType: user.userType }, user.createdAt as Date);
}
for (const card of rows.cards.filter((c) => c.status === 'published').slice(0, 1500)) {
  if (card.athleteId)
    log(card.athleteId, 'card.published', { cardId: card.id, season: card.season });
}

// ---------------------------------------------------------------------------------------------
// Write

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');
const target = new URL(databaseUrl);
const dbName = target.pathname.slice(1);
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
if (!isLocal && process.env.SEED_CONFIRM !== dbName) {
  throw new Error(
    `Seeding wipes every table. To seed ${target.hostname}, re-run with SEED_CONFIRM=${dbName}.`,
  );
}

const ORDER: [PgTable, object[]][] = [
  [schema.colleges, rows.colleges],
  [schema.orgs, rows.orgs],
  [schema.orgDomains, rows.orgDomains],
  [schema.users, rows.users],
  [schema.teams, rows.teams],
  [schema.coachInvites, rows.coachInvites],
  [schema.groups, rows.groups],
  [schema.joinCodes, rows.joinCodes],
  [schema.memberships, rows.memberships],
  [schema.joinRequests, rows.joinRequests],
  [schema.children, rows.children],
  [schema.consentRecords, rows.consentRecords],
  [schema.contactVisibility, rows.contactVisibility],
  [schema.deviceTokens, rows.deviceTokens],
  [schema.blocks, rows.blocks],
  [schema.ingestedRecords, rows.ingestedRecords],
  [schema.cards, rows.cards],
  [schema.media, rows.media],
  [schema.posts, rows.posts],
  [schema.comments, rows.comments],
  [schema.reactions, rows.reactions],
  [schema.events, rows.events],
  [schema.rsvps, rows.rsvps],
  [schema.savedSearches, rows.savedSearches],
  [schema.shortlists, rows.shortlists],
  [schema.shortlistEntries, rows.shortlistEntries],
  [schema.shortlistNotes, rows.shortlistNotes],
  [schema.reports, rows.reports],
  [schema.moderationActions, rows.moderationActions],
  [schema.eventsLog, rows.eventsLog],
];

const allTables = (Object.values(schema) as unknown[]).filter((value): value is PgTable =>
  is(value, PgTable),
);
const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
const db = drizzle(client);
const started = Date.now();
try {
  await db.transaction(async (tx) => {
    const names = allTables.map((table) => `"${getTableName(table)}"`).join(', ');
    await tx.execute(sql.raw(`truncate table ${names} restart identity cascade`));
    for (const [table, tableRows] of ORDER) {
      // Stay well under Postgres's 65,535 bind-parameter limit.
      for (let i = 0; i < tableRows.length; i += 1000) {
        await tx.insert(table).values(tableRows.slice(i, i + 1000) as never);
      }
    }
  });
  const counts = ORDER.map(([table, tableRows]) => `${getTableName(table)} ${tableRows.length}`);
  console.log(
    `Seeded ${target.hostname}/${dbName} in ${Date.now() - started} ms\n  ${counts.join('\n  ')}`,
  );
} finally {
  await client.end();
}
