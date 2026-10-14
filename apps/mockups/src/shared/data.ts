// Seed data shared by all three mockups. One "world" so actions in one surface
// show up in the others (e.g. an athlete turning off open-to-recruiting disappears
// from the recruiter portal; staff marking a group official adds a recruiter filter).

export type Athlete = {
  id: string;
  first: string;
  last: string;
  num: string;
  teamId: string;
  position: string;
  year: string;
  major: string;
  division: string;
  city: string;
  region: string;
  hometown: string;
  exp: string;
  skills: string;
  looking: string;
  email: string;
  linkedin: string;
  phone?: string;
  published: boolean;
  openToRecruiting: boolean;
  groups: string[];
  identityOptIn: boolean;
};
export type Team = {
  id: string;
  name: string;
  abbr: string;
  college: string;
  sport: string;
  division: string;
  color: string;
  coach: string;
  registered: boolean;
  members: number;
};
export type Company = {
  id: string;
  name: string;
  domains: string[];
  recruiters: number;
  status: 'active' | 'suspended' | 'pending';
  since: string;
};
export type List = {
  id: string;
  companyId: string;
  name: string;
  color: string;
  athleteIds: string[];
  sharedWith: string[];
  updated: string;
  note?: string;
};
export type Note = {
  id: string;
  athleteId: string;
  companyId: string;
  author: string;
  date: string;
  text: string;
};
export type Group = {
  id: string;
  name: string;
  createdBy: string;
  members: number;
  official: boolean;
  searchableOptIns: number;
  joined: boolean;
  about: string;
};
export type Post = {
  id: string;
  author: string;
  role: string;
  team?: string;
  time: string;
  text: string;
  scope: 'team' | 'community';
  likes: number;
  comments: { author: string; text: string }[];
  official?: boolean;
  hidden?: boolean;
};
export type EventItem = {
  id: string;
  title: string;
  date: string;
  time: string;
  place: string;
  host: string;
  hostRole: string;
  going: number;
  rsvp: boolean;
  scope: string;
};
export type Ticket = {
  id: string;
  kind: string;
  reason: string;
  target: string;
  author: string;
  where: string;
  reports: { by: string; note: string }[];
  status: 'open' | 'removed' | 'warned' | 'suspended' | 'dismissed';
  age: string;
};
export type JoinRequest = {
  id: string;
  teamId: string;
  name: string;
  role: 'athlete' | 'parent' | 'teen';
  detail: string;
  status: 'pending' | 'approved' | 'declined';
};
export type Alumni = {
  id: string;
  name: string;
  school: string;
  sport: string;
  year: string;
  work: string;
  city: string;
  mentoring: boolean;
  hiring: boolean;
  source: string;
  invite: 'claimed' | 'sent' | 'not sent';
};

export const teams: Team[] = [
  {
    id: 'ws',
    name: 'Women’s Soccer',
    abbr: 'WS',
    college: 'Tufts University',
    sport: 'Soccer',
    division: 'III',
    color: '#D0213C',
    coach: 'Coach Rivera',
    registered: true,
    members: 34,
  },
  {
    id: 'ml',
    name: 'Men’s Lacrosse',
    abbr: 'ML',
    college: 'Tufts University',
    sport: 'Lacrosse',
    division: 'III',
    color: '#1E3F7B',
    coach: 'Coach Daniels',
    registered: true,
    members: 41,
  },
  {
    id: 'sw',
    name: 'Women’s Swimming',
    abbr: 'SW',
    college: 'Tufts University',
    sport: 'Swimming',
    division: 'III',
    color: '#0F7B5F',
    coach: 'Coach Park',
    registered: true,
    members: 22,
  },
  {
    id: 'mb',
    name: 'Men’s Basketball',
    abbr: 'MB',
    college: 'Tufts University',
    sport: 'Basketball',
    division: 'III',
    color: '#4A4F57',
    coach: 'Coach Ellis',
    registered: true,
    members: 18,
  },
  {
    id: 'wv',
    name: 'Women’s Volleyball',
    abbr: 'WV',
    college: 'Tufts University',
    sport: 'Volleyball',
    division: 'III',
    color: '#7A1F2B',
    coach: 'Coach Nguyen',
    registered: true,
    members: 16,
  },
  {
    id: 'ms',
    name: 'Men’s Soccer',
    abbr: 'MS',
    college: 'Tufts University',
    sport: 'Soccer',
    division: 'III',
    color: '#4A4F57',
    coach: '—',
    registered: false,
    members: 0,
  },
];

export const athletes: Athlete[] = [
  {
    id: 'maya',
    first: 'Maya',
    last: 'Okafor',
    num: '07',
    teamId: 'ws',
    position: 'Midfielder',
    year: '2028',
    major: 'Economics',
    division: 'III',
    city: 'Boston, MA',
    region: 'Northeast',
    hometown: 'Providence, RI',
    exp: 'Analyst intern, State Street (Summer 2026)',
    skills: 'Excel, SQL, team captain',
    looking: 'Finance internships, Boston',
    email: 'maya.okafor@tufts.edu',
    linkedin: 'linkedin.com/in/mayaokafor',
    phone: '(401) 555-0119',
    published: true,
    openToRecruiting: true,
    groups: ['firstgen'],
    identityOptIn: true,
  },
  {
    id: 'jordan',
    first: 'Jordan',
    last: 'Alvarez',
    num: '14',
    teamId: 'ml',
    position: 'Attack',
    year: '2027',
    major: 'Finance',
    division: 'III',
    city: 'Hartford, CT',
    region: 'Northeast',
    hometown: 'Hartford, CT',
    exp: 'Summer analyst, regional bank',
    skills: 'Excel, SQL, financial modeling',
    looking: 'Investment banking, New York',
    email: 'jordan.alvarez@tufts.edu',
    linkedin: 'linkedin.com/in/jalvarez',
    published: true,
    openToRecruiting: true,
    groups: ['firstgen'],
    identityOptIn: false,
  },
  {
    id: 'grace',
    first: 'Grace',
    last: 'Liu',
    num: '03',
    teamId: 'ws',
    position: 'Goalkeeper',
    year: '2027',
    major: 'Economics',
    division: 'III',
    city: 'New York, NY',
    region: 'Northeast',
    hometown: 'Queens, NY',
    exp: 'Research assistant, economics department',
    skills: 'Stata, R, writing',
    looking: 'Economic consulting',
    email: 'grace.liu@tufts.edu',
    linkedin: 'linkedin.com/in/graceliu',
    published: true,
    openToRecruiting: true,
    groups: ['women-fin'],
    identityOptIn: true,
  },
  {
    id: 'devin',
    first: 'Devin',
    last: 'Shaw',
    num: '21',
    teamId: 'mb',
    position: 'Guard',
    year: '2028',
    major: 'Finance',
    division: 'III',
    city: 'Boston, MA',
    region: 'Northeast',
    hometown: 'Lowell, MA',
    exp: 'Treasurer, student investment club',
    skills: 'Python, valuation',
    looking: 'Asset management',
    email: 'devin.shaw@tufts.edu',
    linkedin: 'linkedin.com/in/devinshaw',
    published: true,
    openToRecruiting: true,
    groups: [],
    identityOptIn: false,
  },
  {
    id: 'ana',
    first: 'Ana',
    last: 'Ruiz',
    num: '11',
    teamId: 'wv',
    position: 'Setter',
    year: '2027',
    major: 'Computer Science',
    division: 'III',
    city: 'Somerville, MA',
    region: 'Northeast',
    hometown: 'San Antonio, TX',
    exp: 'Software intern, local startup',
    skills: 'Python, React, SQL',
    looking: 'Software engineering',
    email: 'ana.ruiz@tufts.edu',
    linkedin: 'linkedin.com/in/anaruiz',
    published: true,
    openToRecruiting: true,
    groups: ['tech', 'firstgen'],
    identityOptIn: true,
  },
  {
    id: 'kai',
    first: 'Kai',
    last: 'Brooks',
    num: '09',
    teamId: 'ml',
    position: 'Midfield',
    year: '2028',
    major: 'Psychology',
    division: 'III',
    city: 'Worcester, MA',
    region: 'Northeast',
    hometown: 'Worcester, MA',
    exp: 'Peer mentor, first-year program',
    skills: 'Research, public speaking',
    looking: 'People operations',
    email: 'kai.brooks@tufts.edu',
    linkedin: 'linkedin.com/in/kaibrooks',
    published: true,
    openToRecruiting: true,
    groups: [],
    identityOptIn: false,
  },
  {
    id: 'sofia',
    first: 'Sofia',
    last: 'Marino',
    num: '05',
    teamId: 'sw',
    position: 'Freestyle',
    year: '2029',
    major: 'Biology',
    division: 'III',
    city: 'Medford, MA',
    region: 'Northeast',
    hometown: 'Portland, ME',
    exp: 'Lab assistant',
    skills: 'Lab methods',
    looking: 'Research',
    email: 'sofia.marino@tufts.edu',
    linkedin: 'linkedin.com/in/sofiamarino',
    published: true,
    openToRecruiting: false,
    groups: [],
    identityOptIn: false,
  },
  {
    id: 'tom',
    first: 'Tomás',
    last: 'Reyes',
    num: '22',
    teamId: 'mb',
    position: 'Forward',
    year: '2027',
    major: 'Economics',
    division: 'III',
    city: 'Chicago, IL',
    region: 'Midwest',
    hometown: 'Chicago, IL',
    exp: 'Operations intern, logistics firm',
    skills: 'Excel, Tableau',
    looking: 'Consulting, Chicago',
    email: 'tomas.reyes@tufts.edu',
    linkedin: 'linkedin.com/in/tomasreyes',
    published: true,
    openToRecruiting: true,
    groups: ['firstgen'],
    identityOptIn: false,
  },
];

export const companies: Company[] = [
  {
    id: 'northbeam',
    name: 'Northbeam Capital',
    domains: ['northbeam.com'],
    recruiters: 4,
    status: 'active',
    since: 'Sep 2026',
  },
  {
    id: 'harbor',
    name: 'Harbor Health Partners',
    domains: ['harborhp.com'],
    recruiters: 2,
    status: 'active',
    since: 'Sep 2026',
  },
  {
    id: 'kestrel',
    name: 'Kestrel Consulting',
    domains: ['kestrel.co', 'kestrelconsulting.com'],
    recruiters: 3,
    status: 'active',
    since: 'Oct 2026',
  },
  {
    id: 'atlas',
    name: 'Atlas Logistics',
    domains: ['atlaslog.com'],
    recruiters: 0,
    status: 'pending',
    since: '—',
  },
];

export const lists: List[] = [
  {
    id: 'fall',
    companyId: 'northbeam',
    name: 'Fall interns',
    color: '#D0213C',
    athleteIds: ['grace', 'jordan'],
    sharedWith: ['Priya', 'Tom', 'Lee'],
    updated: 'Today',
  },
  {
    id: 'spring',
    companyId: 'northbeam',
    name: 'Spring analyst cohort',
    color: '#1E3F7B',
    athleteIds: ['devin'],
    sharedWith: ['Priya', 'Tom'],
    updated: 'Oct 4',
  },
  {
    id: 'saved',
    companyId: 'northbeam',
    name: 'Saved',
    color: '#4A4F57',
    athleteIds: [],
    sharedWith: [],
    updated: 'Oct 6',
  },
];

export const notes: Note[] = [
  {
    id: 'n1',
    athleteId: 'maya',
    companyId: 'northbeam',
    author: 'Priya Shah',
    date: 'Oct 6',
    text: 'Captain and an internship already. Worth a call before break.',
  },
  {
    id: 'n2',
    athleteId: 'jordan',
    companyId: 'northbeam',
    author: 'Tom Becker',
    date: 'Oct 5',
    text: 'Strong modeling skills. Ask about NYC availability.',
  },
];

export const groups: Group[] = [
  {
    id: 'firstgen',
    name: 'First-gen athletes',
    createdBy: 'Jordan Alvarez · Athlete',
    members: 212,
    official: true,
    searchableOptIns: 88,
    joined: true,
    about: 'For athletes who are the first in their family to go to college.',
  },
  {
    id: 'women-fin',
    name: 'Women in finance',
    createdBy: 'Priya Shah · Alumni',
    members: 96,
    official: true,
    searchableOptIns: 41,
    joined: false,
    about: 'Mentoring, mock interviews and job leads for women heading into finance.',
  },
  {
    id: 'tech',
    name: 'Athletes in tech',
    createdBy: 'Maya Okafor · Athlete',
    members: 58,
    official: false,
    searchableOptIns: 0,
    joined: false,
    about: 'Software, data and product. Share internships and side projects.',
  },
  {
    id: 'runners',
    name: 'Boston runners',
    createdBy: 'Kevin Osei · Alumni',
    members: 31,
    official: false,
    searchableOptIns: 0,
    joined: false,
    about: 'Weekend long runs along the Charles.',
  },
];

export const posts: Post[] = [
  {
    id: 'p1',
    author: 'Team IMPACT',
    role: 'Staff',
    time: '2h',
    text: 'Family night at the Tufts home game, Oct 19. Bring the whole crew. Details in Events.',
    scope: 'community',
    likes: 48,
    comments: [],
    official: true,
  },
  {
    id: 'p2',
    author: 'Coach Rivera',
    role: 'Coach',
    team: 'ws',
    time: '4h',
    text: 'Huge win Saturday! Leo led the warm-up chant and we are keeping it. Practice moves to 4pm Thursday.',
    scope: 'team',
    likes: 22,
    comments: [{ author: 'Dana Kim', text: 'He has not stopped talking about it!' }],
  },
  {
    id: 'p3',
    author: 'Maya Okafor',
    role: 'Athlete',
    team: 'ws',
    time: '1d',
    text: 'Finished my Baseball Card. If anyone wants help with theirs, I am in the library Tuesdays.',
    scope: 'community',
    likes: 31,
    comments: [],
  },
  {
    id: 'p4',
    author: 'Priya Shah',
    role: 'Alumni',
    time: '2d',
    text: 'Women in finance mock interviews are back. Sign-up sheet in the group.',
    scope: 'community',
    likes: 17,
    comments: [],
  },
];

export const events: EventItem[] = [
  {
    id: 'e1',
    title: 'Family night: Tufts vs. Amherst',
    date: 'Sat, Oct 19',
    time: '1:00 PM',
    place: 'Kraft Field, Medford',
    host: 'Team IMPACT',
    hostRole: 'Staff',
    going: 64,
    rsvp: false,
    scope: 'Everyone',
  },
  {
    id: 'e2',
    title: 'Team pizza and movie',
    date: 'Fri, Oct 25',
    time: '6:30 PM',
    place: 'Cousens Gym lounge',
    host: 'Coach Rivera',
    hostRole: 'Coach',
    going: 21,
    rsvp: true,
    scope: 'Women’s Soccer',
  },
  {
    id: 'e3',
    title: 'Resume night with alumni',
    date: 'Tue, Oct 29',
    time: '7:00 PM',
    place: 'Tisch Library, room 304',
    host: 'Priya Shah',
    hostRole: 'Alumni',
    going: 18,
    rsvp: false,
    scope: 'Everyone',
  },
];

export const tickets: Ticket[] = [
  {
    id: '482',
    kind: 'Comment',
    reason: 'Inappropriate for kids',
    target: 'Comment on Coach Rivera’s post',
    author: 'Chris D. · Alumni',
    where: 'Women’s Soccer feed',
    reports: [
      { by: 'Dana Kim (parent)', note: 'Not okay with kids on this team.' },
      { by: 'Grace Liu (athlete)', note: '' },
    ],
    status: 'open',
    age: '2h',
  },
  {
    id: '481',
    kind: 'Post',
    reason: 'Spam or scam',
    target: 'Post “Earn $$$ from home”',
    author: 'New account · Alumni',
    where: 'Community feed',
    reports: [{ by: 'Kai Brooks (athlete)', note: 'Looks like a scam link.' }],
    status: 'open',
    age: '5h',
  },
  {
    id: '479',
    kind: 'Profile',
    reason: 'Pretending to be someone',
    target: 'Profile “Coach Rivera 2”',
    author: 'Unknown',
    where: 'Profiles',
    reports: [{ by: 'Coach Rivera (coach)', note: 'This is not me.' }],
    status: 'open',
    age: '1d',
  },
  {
    id: '470',
    kind: 'Comment',
    reason: 'Bullying',
    target: 'Comment on a teammate’s post',
    author: 'R. James · Athlete',
    where: 'Men’s Lacrosse feed',
    reports: [{ by: 'Jordan Alvarez (athlete)', note: '' }],
    status: 'warned',
    age: '4d',
  },
];

export const joinRequests: JoinRequest[] = [
  {
    id: 'r1',
    teamId: 'ws',
    name: 'Dana Kim',
    role: 'parent',
    detail: 'Parent of Leo, age 9',
    status: 'pending',
  },
  {
    id: 'r2',
    teamId: 'ws',
    name: 'Hannah Cole',
    role: 'athlete',
    detail: 'Class of 2029 · Tufts',
    status: 'pending',
  },
  {
    id: 'r3',
    teamId: 'ws',
    name: 'Sam Patel',
    role: 'teen',
    detail: 'Teammate, 13–17 · parent confirmed',
    status: 'pending',
  },
];

export const alumni: Alumni[] = [
  {
    id: 'a1',
    name: 'Priya Shah',
    school: 'Tufts ’17',
    sport: 'Swimming',
    year: '2017',
    work: 'VP, Northbeam Capital',
    city: 'Boston, MA',
    mentoring: true,
    hiring: true,
    source: 'LinkedIn profile',
    invite: 'claimed',
  },
  {
    id: 'a2',
    name: 'Jamal Wright',
    school: 'Boston College ’19',
    sport: 'Lacrosse',
    year: '2019',
    work: 'Product manager, HubSpot',
    city: 'Cambridge, MA',
    mentoring: true,
    hiring: false,
    source: 'LinkedIn profile',
    invite: 'sent',
  },
  {
    id: 'a3',
    name: 'Marcus Hill',
    school: 'Northeastern ’15',
    sport: 'Track',
    year: '2015',
    work: 'Physical therapist',
    city: 'Quincy, MA',
    mentoring: true,
    hiring: false,
    source: 'LinkedIn profile',
    invite: 'not sent',
  },
  {
    id: 'a4',
    name: 'Elena Ruiz',
    school: 'Tufts ’20',
    sport: 'Soccer',
    year: '2020',
    work: 'Consultant, Kestrel Consulting',
    city: 'Boston, MA',
    mentoring: false,
    hiring: true,
    source: 'LinkedIn profile',
    invite: 'sent',
  },
];

export const children = [
  {
    id: 'leo',
    name: 'Leo',
    age: 9,
    teamId: 'ws',
    parent: 'Dana Kim',
    interests: 'Goalkeeping, dinosaurs, picking the playlist',
  },
];

export const teamOf = (id: string) => teams.find((t) => t.id === id)!;
export const fullName = (a: Athlete) => a.first + ' ' + a.last;
