import type {
  CardFace,
  CardVisibility,
  College,
  Company,
  ContactDetails,
  JoinRequest,
  ModerationStatus,
  ModerationTicket,
  Opportunity,
  RecruiterNote,
  Role,
  Team,
} from '@team-impact/contracts';

/**
 * One small, hand-written world for the mock API: a Tufts team with a coach, athletes, two parents
 * with a child each and a teen; a recruiter company; alumni; one community of each kind. Names
 * follow the seed's style (`src/db/seed`) but are fixed, so screens and tests can point at them.
 *
 * Fixtures are typed with the contracts, so a contract change fails the typecheck here, and every
 * response is parsed through its contract again before it is sent (`src/zod.ts`).
 *
 * Hard rules hold in the data too: no health or diagnosis data anywhere, children have no account
 * and no card, and medical membership lives only in `memberships`, which no response exposes
 * except to the member themselves.
 */

/** Stable v4-shaped ids, grouped by hundreds: 1xx users, 2xx teams, 3xx communities, and so on. */
export const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const at = (day: number, hour = 12) =>
  `2026-10-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`;

export interface MockUser {
  id: string;
  firstName: string;
  lastName: string;
  role: Role;
  email: string;
  createdAt: string;
  /** Recruiters only. */
  companyId?: string;
  title?: string;
}

const user = (n: number, firstName: string, lastName: string, role: Role, email: string) => ({
  id: id(n),
  firstName,
  lastName,
  role,
  email,
  createdAt: at(1),
});

export const USERS = {
  staff: user(101, 'Maya', 'Chen', 'staff', 'maya.chen@teamimpact.org'),
  coach: user(102, 'Dana', 'Rivera', 'coach', 'dana.rivera@tufts.edu'),
  jordan: user(103, 'Jordan', 'Lee', 'athlete', 'jordan.lee@tufts.edu'),
  sam: user(104, 'Sam', 'Ortiz', 'athlete', 'sam.ortiz@tufts.edu'),
  riley: user(105, 'Riley', 'Park', 'athlete', 'riley.park@tufts.edu'),
  ava: user(106, 'Ava', 'Brooks', 'athlete', 'ava.brooks@tufts.edu'),
  lisa: user(107, 'Lisa', 'Gomez', 'parent', 'lisa.gomez@example.org'),
  mark: user(108, 'Mark', 'Hall', 'parent', 'mark.hall@example.org'),
  noah: user(109, 'Noah', 'Kim', 'teen', 'noah.kim@example.org'),
  elena: {
    ...user(110, 'Elena', 'Ward', 'recruiter', 'elena.ward@northbeam.com'),
    companyId: id(801),
    title: 'Campus Recruiting Lead',
  },
  tom: {
    ...user(111, 'Tom', 'Reyes', 'recruiter', 'tom.reyes@northbeam.com'),
    companyId: id(801),
    title: 'Analyst Recruiter',
  },
  priya: user(112, 'Priya', 'Shah', 'alumni_athlete', 'priya.shah@example.org'),
  chris: user(113, 'Chris', 'Doyle', 'alumni_mentor', 'chris.doyle@example.org'),
  /** Asked to join the team; not on it yet. */
  kai: user(114, 'Kai', 'Brooks', 'athlete', 'kai.brooks@tufts.edu'),
  /** Just signed up: no team and no request, for walking the join flow. */
  leo: user(115, 'Leo', 'Grant', 'athlete', 'leo.grant@tufts.edu'),
  /** A parent who just signed up, for the parent join flow. */
  rosa: user(116, 'Rosa', 'Diaz', 'parent', 'rosa.diaz@example.org'),
  /** A teen who just signed up. */
  eli: user(117, 'Eli', 'Ward', 'teen', 'eli.ward@example.org'),
} satisfies Record<string, MockUser>;

/** Who mock sign-in uses for each role. */
export const SIGN_IN_AS: Record<Role, MockUser> = {
  staff: USERS.staff,
  coach: USERS.coach,
  athlete: USERS.jordan,
  parent: USERS.lisa,
  teen: USERS.noah,
  recruiter: USERS.elena,
  alumni_athlete: USERS.priya,
  alumni_mentor: USERS.chris,
};

/** Who mock sign-in uses with `newcomer`: on no team yet. */
export const NEWCOMERS: Partial<Record<Role, MockUser>> = {
  athlete: USERS.leo,
  parent: USERS.rosa,
  teen: USERS.eli,
};

/** Profiles a parent runs. No login, no card; visible only to the team and family (PRD §2). */
export const CHILDREN = [
  { id: id(150), parentId: USERS.lisa.id, teamId: id(201), firstName: 'Mateo', age: 9 },
  { id: id(151), parentId: USERS.mark.id, teamId: id(201), firstName: 'Ella', age: 10 },
];

export const COLLEGES: College[] = [
  { id: id(701), name: 'Tufts University' },
  // No registered team: the join flow tells people to email appdev@teamimpact.org (P7).
  { id: id(702), name: 'Northeastern University' },
];

const tufts = COLLEGES[0]!;

export const TEAMS: Omit<Team, 'memberCount'>[] = [
  {
    id: id(201),
    name: "Women's Soccer",
    college: tufts,
    sport: 'Soccer',
    gender: 'women',
    division: 'III',
    color: '#1E3F7B',
    logoUrl: null,
    about: 'Jumbos women’s soccer, Team Impact partner since 2024.',
    status: 'live',
    createdAt: at(1),
  },
  {
    id: id(202),
    name: "Men's Lacrosse",
    college: tufts,
    sport: 'Lacrosse',
    gender: 'men',
    division: 'III',
    color: null,
    logoUrl: null,
    about: null,
    // Waiting on its first coach to accept the invite.
    status: 'invited',
    createdAt: at(10),
  },
];

const soccer = TEAMS[0]!;

export const TEAM_MEMBERS: {
  teamId: string;
  userId: string;
  joinedVia: 'coach_invite' | 'join_request' | 'qr_code';
  joinedAt: string;
}[] = [
  { teamId: soccer.id, userId: USERS.coach.id, joinedVia: 'coach_invite', joinedAt: at(1) },
  ...[USERS.jordan, USERS.sam, USERS.riley, USERS.ava].map((u) => ({
    teamId: soccer.id,
    userId: u.id,
    joinedVia: 'qr_code' as const,
    joinedAt: at(2),
  })),
  ...[USERS.lisa, USERS.mark, USERS.noah].map((u) => ({
    teamId: soccer.id,
    userId: u.id,
    joinedVia: 'join_request' as const,
    joinedAt: at(3),
  })),
];

export const JOIN_REQUESTS: JoinRequest[] = [
  {
    id: id(1101),
    teamId: soccer.id,
    requester: { ...summaryOf(USERS.kai) },
    role: 'athlete',
    classYear: 2029,
    status: 'pending',
    createdAt: at(12),
    decidedAt: null,
  },
];

export const COMPANIES: Omit<Company, 'recruiterCount'>[] = [
  {
    id: id(801),
    name: 'Northbeam Capital',
    domains: ['northbeam.com'],
    status: 'active',
    createdAt: at(1),
  },
  {
    id: id(802),
    name: 'Kestrel Partners',
    domains: ['kestrel.co'],
    status: 'suspended',
    createdAt: at(4),
  },
];

/**
 * `members` is everyone in the community and, for interest communities, whether they opted in to
 * being found through it by recruiters. Team communities take their members from the team, and
 * Team Impact's from every account but recruiters, so neither lists them here.
 */
export type MockCommunity = {
  id: string;
  name: string;
  about: string;
  moderation: ModerationStatus;
  createdAt: string;
  members: { userId: string; joinedAt: string; recruiterSearchOptIn?: boolean }[];
} & (
  | { kind: 'team'; teamId: string }
  | { kind: 'team_impact' }
  | ({ kind: 'medical' } & UserMade)
  | ({ kind: 'interest'; official: boolean } & UserMade)
);

/** Interest and medical communities: who made them, and whether they're private (PRD v2.3). */
interface UserMade {
  createdById: string;
  private: boolean;
  /** Waiting on the creator, for private communities. */
  requests: { userId: string; requestedAt: string }[];
}

const member = (u: MockUser, recruiterSearchOptIn?: boolean) => ({
  userId: u.id,
  joinedAt: at(5),
  recruiterSearchOptIn,
});

export const COMMUNITIES: MockCommunity[] = [
  {
    id: id(301),
    kind: 'team',
    teamId: soccer.id,
    name: "Tufts Women's Soccer",
    about: 'The team, its families and coaches.',
    moderation: 'approved',
    createdAt: at(1),
    members: [],
  },
  {
    id: id(302),
    kind: 'team_impact',
    name: 'Team Impact',
    about: 'Announcements and news from Team Impact.',
    moderation: 'approved',
    createdAt: at(1),
    members: [],
  },
  {
    id: id(303),
    kind: 'medical',
    createdById: USERS.lisa.id,
    private: true,
    requests: [],
    name: 'Heart warriors families',
    about: 'Families and friends supporting kids through long hospital stays.',
    moderation: 'approved',
    createdAt: at(4),
    members: [member(USERS.lisa), member(USERS.jordan)],
  },
  {
    id: id(304),
    kind: 'interest',
    createdById: USERS.jordan.id,
    official: true,
    private: false,
    requests: [],
    name: 'First-gen athletes',
    about: 'First-generation college athletes helping each other out.',
    moderation: 'approved',
    createdAt: at(3),
    members: [
      member(USERS.jordan, true),
      member(USERS.sam, false),
      member(USERS.priya, true),
      member(USERS.coach),
      member(USERS.noah),
    ],
  },
  {
    id: id(305),
    kind: 'interest',
    createdById: USERS.priya.id,
    official: false,
    private: false,
    requests: [],
    name: 'Athletes in Finance',
    about: 'Mock interviews, internships and careers in finance.',
    moderation: 'approved',
    createdAt: at(6),
    members: [member(USERS.priya, false), member(USERS.riley, false), member(USERS.sam, false)],
  },
  {
    id: id(306),
    kind: 'interest',
    createdById: USERS.chris.id,
    official: false,
    private: false,
    requests: [],
    name: 'Crypto riches fast',
    about: 'DM me to double your money.',
    // Reported and held: only staff and its creator see it.
    moderation: 'in_review',
    createdAt: at(11),
    members: [member(USERS.chris)],
  },
  {
    id: id(307),
    kind: 'interest',
    createdById: USERS.coach.id,
    official: false,
    // Private: findable by name, but posts and members are for members only.
    private: true,
    requests: [{ userId: USERS.sam.id, requestedAt: at(12) }],
    name: 'Team captains',
    about: 'Captains and coaches planning the season.',
    moderation: 'approved',
    createdAt: at(7),
    members: [member(USERS.coach), member(USERS.jordan)],
  },
];

export interface MockPost {
  id: string;
  kind: 'post' | 'announcement' | 'opportunity';
  authorId: string;
  communityId: string;
  text: string;
  imageUrl?: string | null;
  official: boolean;
  likeCount: number;
  commentCount: number;
  moderation: ModerationStatus;
  createdAt: string;
  opportunity?: Opportunity;
}

const post = (
  n: number,
  author: MockUser,
  communityN: number,
  day: number,
  text: string,
  extra: Partial<MockPost> = {},
): MockPost => ({
  id: id(n),
  kind: 'post',
  authorId: author.id,
  communityId: id(communityN),
  text,
  official: false,
  likeCount: 3,
  commentCount: 1,
  moderation: 'approved',
  createdAt: at(day),
  ...extra,
});

export const POSTS: MockPost[] = [
  post(401, USERS.coach, 301, 12, 'Practice moves to 7am Thursday. Families welcome Saturday!'),
  post(
    402,
    USERS.staff,
    302,
    11,
    'Family night at the Tufts home game, Oct 19. Details in Events.',
    {
      kind: 'announcement',
      official: true,
      likeCount: 48,
    },
  ),
  post(403, USERS.sam, 304, 10, 'Finished my Baseball Card. Happy to help with yours on Tuesdays.'),
  post(404, USERS.lisa, 303, 9, 'Thank you to everyone who sent meals this week. It means a lot.'),
  post(405, USERS.elena, 304, 8, 'Northbeam is hiring summer analysts. Apply through the link.', {
    kind: 'opportunity',
    opportunity: {
      title: 'Summer Analyst',
      link: 'https://northbeam.com/jobs/123',
      closesOn: '2026-11-30',
      company: { id: id(801), name: 'Northbeam Capital' },
    },
  }),
  post(406, USERS.noah, 301, 12, 'Can’t wait for Saturday, go Jumbos!'),
  post(408, USERS.coach, 307, 11, 'Captains: leadership meeting Wednesday after practice.'),
  post(407, USERS.chris, 302, 12, 'Make $5,000 a week from your dorm!!! DM me', {
    moderation: 'in_review',
    likeCount: 0,
    commentCount: 0,
  }),
];

export interface MockEvent {
  id: string;
  title: string;
  details: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string;
  hostId: string;
  communityId: string;
  goingCount: number;
  moderation: ModerationStatus;
  createdAt: string;
}

export const EVENTS: MockEvent[] = [
  {
    id: id(501),
    title: 'Home game vs Bates',
    details: 'Families sit behind the home bench.',
    startsAt: '2026-10-17T17:00:00.000Z',
    endsAt: '2026-10-17T19:00:00.000Z',
    location: 'Kraft Field, Medford',
    hostId: USERS.coach.id,
    communityId: id(301),
    goingCount: 14,
    moderation: 'approved',
    createdAt: at(8),
  },
  {
    id: id(502),
    title: 'Family night',
    details: 'Food trucks from 5pm, game at 6.',
    startsAt: '2026-10-19T21:00:00.000Z',
    endsAt: null,
    location: 'Kraft Field, Medford',
    hostId: USERS.staff.id,
    communityId: id(302),
    goingCount: 63,
    moderation: 'approved',
    createdAt: at(7),
  },
  {
    id: id(503),
    title: 'First-gen resume workshop',
    details: 'Bring a draft; we’ll turn it into your Baseball Card.',
    startsAt: '2026-10-22T23:00:00.000Z',
    endsAt: '2026-10-23T00:30:00.000Z',
    location: 'Tisch Library, Room 304',
    hostId: USERS.priya.id,
    communityId: id(304),
    goingCount: 9,
    moderation: 'approved',
    createdAt: at(9),
  },
];

export interface MockCard {
  face: Omit<CardFace, 'team'> & { teamId: string | null };
  contact: ContactDetails;
  visibility: CardVisibility;
}

const card = (
  n: number,
  athlete: MockUser,
  fields: Partial<MockCard['face']>,
  visibility: Partial<CardVisibility>,
): MockCard => ({
  face: {
    id: id(n),
    athleteId: athlete.id,
    season: 2026,
    teamId: soccer.id,
    photoUrl: null,
    firstName: athlete.firstName,
    lastName: athlete.lastName,
    jerseyNumber: null,
    position: null,
    classYear: 2027,
    major: 'Economics',
    hometown: null,
    city: 'Medford',
    region: 'northeast',
    experience: null,
    skills: [],
    lookingFor: null,
    ...fields,
  },
  contact: {
    email: athlete.email,
    phone: '+1 617 555 0100',
    linkedinUrl: `https://www.linkedin.com/in/${athlete.firstName.toLowerCase()}-${athlete.lastName.toLowerCase()}`,
  },
  visibility: {
    published: true,
    openToRecruiting: true,
    familiesSee: { email: true, phone: false, linkedin: false },
    recruitersSee: { email: true, phone: false, linkedin: true },
    ...visibility,
  },
});

export const CARDS: MockCard[] = [
  card(
    601,
    USERS.jordan,
    {
      jerseyNumber: '07',
      position: 'Midfielder',
      hometown: 'Lowell, MA',
      experience: 'Investment club treasurer; summer intern at a credit union.',
      skills: ['Excel', 'Financial modeling', 'Spanish'],
      lookingFor: 'Finance internship, summer 2027',
    },
    {},
  ),
  card(
    602,
    USERS.sam,
    {
      jerseyNumber: '11',
      position: 'Forward',
      classYear: 2028,
      major: 'Computer Science',
      experience: 'Teaching assistant for intro programming.',
      skills: ['Python', 'React'],
      lookingFor: 'Software engineering internship',
    },
    { recruitersSee: { email: true, phone: true, linkedin: true } },
  ),
  // Published for the team, but not open to recruiting: never on the employer portal.
  card(
    603,
    USERS.riley,
    { position: 'Defender', classYear: 2026, major: 'Biology' },
    {
      openToRecruiting: false,
    },
  ),
  // Not published yet: only Ava sees it.
  card(
    604,
    USERS.ava,
    { position: 'Goalkeeper', major: 'Psychology' },
    {
      published: false,
      openToRecruiting: false,
    },
  ),
  card(
    605,
    USERS.priya,
    {
      teamId: null,
      classYear: 2022,
      major: 'Economics',
      city: 'Boston',
      experience: 'Associate at a Boston asset manager.',
      skills: ['Equity research'],
    },
    {},
  ),
];

export const NOTES: RecruiterNote[] = [
  {
    id: id(1201),
    athleteId: USERS.jordan.id,
    author: summaryOf(USERS.elena),
    text: 'Strong fit for the analyst program. Follow up after midterms.',
    createdAt: at(9),
  },
];

export interface MockList {
  id: string;
  companyId: string;
  name: string;
  color: string;
  note: string | null;
  ownerId: string;
  sharedWithIds: string[];
  entries: { athleteId: string; addedById: string; addedAt: string }[];
  createdAt: string;
  updatedAt: string;
}

export const LISTS: MockList[] = [
  {
    id: id(901),
    companyId: id(801),
    name: 'Fall interns',
    color: '#D0213C',
    note: 'Summer 2027 analyst class',
    ownerId: USERS.elena.id,
    sharedWithIds: [USERS.tom.id],
    entries: [
      { athleteId: USERS.jordan.id, addedById: USERS.elena.id, addedAt: at(9) },
      // Riley turned recruiting off after being saved, so the entry is hidden until it's back on.
      { athleteId: USERS.riley.id, addedById: USERS.elena.id, addedAt: at(6) },
    ],
    createdAt: at(5),
    updatedAt: at(9),
  },
  {
    id: id(902),
    companyId: id(801),
    name: 'Tech pipeline',
    color: '#1E3F7B',
    note: null,
    ownerId: USERS.tom.id,
    sharedWithIds: [],
    entries: [{ athleteId: USERS.sam.id, addedById: USERS.tom.id, addedAt: at(10) }],
    createdAt: at(10),
    updatedAt: at(10),
  },
];

export const TICKETS: ModerationTicket[] = [
  {
    id: id(1001),
    target: { kind: 'post', id: id(407) },
    preview: 'Make $5,000 a week from your dorm!!! DM me',
    reasons: ['spam'],
    reportCount: 2,
    status: 'open',
    resolution: null,
    createdAt: at(12, 15),
  },
  {
    id: id(1002),
    target: { kind: 'community', id: id(306) },
    preview: 'Crypto riches fast',
    reasons: ['spam', 'other'],
    reportCount: 1,
    status: 'open',
    resolution: null,
    createdAt: at(11, 18),
  },
  {
    id: id(1003),
    target: { kind: 'profile', id: USERS.chris.id },
    preview: 'Chris Doyle',
    reasons: ['impersonation'],
    reportCount: 1,
    status: 'resolved',
    resolution: 'dismiss',
    createdAt: at(8),
  },
];

/** `UserSummary` for a fixture user. A function declaration, so fixtures above can use it. */
export function summaryOf(u: MockUser) {
  return { id: u.id, firstName: u.firstName, lastName: u.lastName, role: u.role, avatarUrl: null };
}

export const ALL_USERS: MockUser[] = Object.values(USERS);
