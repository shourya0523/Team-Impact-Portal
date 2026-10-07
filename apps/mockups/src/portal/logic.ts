// Portal-local types and pure helpers (no React). Shared world lives in ../shared/store.
import type { Athlete, Company, Group } from '../shared/data';
import { teamOf } from '../shared/data';
import type { World } from '../shared/store';
import { visibleToRecruiters } from '../shared/store';

export type Screen =
  'signup' | 'verify' | 'search' | 'athlete' | 'lists' | 'list' | 'saved' | 'jd' | 'post';

export type Account = { name: string; email: string; title: string; companyId: string };

export const SAM: Account = {
  name: 'Sam Park',
  email: 'sam.park@northbeam.com',
  title: 'Campus Recruiter',
  companyId: 'northbeam',
};

export type Colleague = { key: string; name: string; email: string; label: string };
/** Northbeam colleagues. List.sharedWith stores the `key`. */
export const COLLEAGUES: Colleague[] = [
  { key: 'Priya', name: 'Priya Shah', email: 'priya.shah@northbeam.com', label: 'Priya' },
  { key: 'Tom', name: 'Tom Becker', email: 'tom.becker@northbeam.com', label: 'Tom' },
  { key: 'Lee', name: 'Lee Chen', email: 'lee.chen@northbeam.com', label: 'Lee' },
  { key: 'Dana', name: 'Dana Ortiz', email: 'dana.ortiz@northbeam.com', label: 'Dana (HR)' },
];
export const colleaguesFor = (companyId: string) => (companyId === 'northbeam' ? COLLEAGUES : []);
export const colleagueName = (key: string) => COLLEAGUES.find((c) => c.key === key)?.name ?? key;

export const LIST_COLORS: [string, string][] = [
  ['#D0213C', 'Red'],
  ['#1E3F7B', 'Navy'],
  ['#0F7B5F', 'Green'],
  ['#4A4F57', 'Gray'],
];

export const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
export const today = () =>
  new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const stamp = () =>
  new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
export const uid = (p: string) =>
  p + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);

/* ---------- sign up ---------- */
const PERSONAL = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'live.com',
  'me.com',
];

export type DomainCheck =
  | { kind: 'empty' }
  | { kind: 'format' }
  | { kind: 'personal'; domain: string }
  | { kind: 'unknown'; domain: string }
  | { kind: 'pending'; company: Company }
  | { kind: 'suspended'; company: Company }
  | { kind: 'ok'; company: Company };

export function checkEmail(w: World, email: string): DomainCheck {
  const e = email.trim().toLowerCase();
  if (!e) return { kind: 'empty' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { kind: 'format' };
  const domain = e.split('@')[1] ?? '';
  if (PERSONAL.includes(domain)) return { kind: 'personal', domain };
  const company = w.companies.find((c) =>
    c.domains.some((d) => domain === d || domain.endsWith('.' + d)),
  );
  if (!company) return { kind: 'unknown', domain };
  if (company.status === 'suspended') return { kind: 'suspended', company };
  if (company.status !== 'active') return { kind: 'pending', company };
  return { kind: 'ok', company };
}

/* ---------- search ---------- */
export type Filters = {
  keyword: string;
  expText: string;
  sport: string[];
  major: string[];
  year: string[];
  region: string[];
  city: string[];
  division: string[];
  exp: string[];
  groups: string[];
};
export const EMPTY: Filters = {
  keyword: '',
  expText: '',
  sport: [],
  major: [],
  year: [],
  region: [],
  city: [],
  division: [],
  exp: [],
  groups: [],
};

export const EXP_TAGS: Record<string, RegExp> = {
  Internship: /intern|analyst/i,
  Research: /research|lab/i,
  Leadership: /captain|treasurer|mentor|lead|president/i,
};

export const cityOf = (a: Athlete) => a.city.split(',')[0] ?? a.city;
export const sportOf = (w: World, a: Athlete) =>
  (w.teams.find((t) => t.id === a.teamId) ?? teamOf(a.teamId)).sport;
export const teamFor = (w: World, a: Athlete) =>
  w.teams.find((t) => t.id === a.teamId) ?? teamOf(a.teamId);

export function filterOptions(w: World) {
  const vis = visibleToRecruiters(w);
  const uniq = (xs: string[]) => [...new Set(xs)];
  return {
    REGION: ['Northeast', 'Midwest', 'South', 'West'],
    CITY: uniq(vis.map(cityOf)).sort(),
    SPORT: uniq([
      'Soccer',
      'Lacrosse',
      'Basketball',
      'Swimming',
      'Volleyball',
      ...vis.map((a) => sportOf(w, a)),
    ]),
    MAJOR: uniq([
      'Economics',
      'Finance',
      'Computer Science',
      'Engineering',
      ...vis.map((a) => a.major),
    ]),
    'GRAD YEAR': ['2026', '2027', '2028', '2029'],
    DIVISION: ['I', 'II', 'III'],
    EXPERIENCE: Object.keys(EXP_TAGS),
  };
}
export const FILTER_KEYS: [keyof ReturnType<typeof filterOptions>, keyof Filters][] = [
  ['REGION', 'region'],
  ['CITY', 'city'],
  ['SPORT', 'sport'],
  ['MAJOR', 'major'],
  ['GRAD YEAR', 'year'],
  ['DIVISION', 'division'],
  ['EXPERIENCE', 'exp'],
];

export const officialGroups = (w: World): Group[] => w.groups.filter((g) => g.official);
/** Identity groups only count when the staff flag is on and the group is still official. */
export const activeGroups = (w: World, f: Filters) =>
  w.identitySearchOn ? f.groups.filter((id) => officialGroups(w).some((g) => g.id === id)) : [];

const hay = (w: World, a: Athlete) =>
  [
    a.first,
    a.last,
    a.position,
    a.major,
    a.exp,
    a.skills,
    a.looking,
    a.city,
    a.hometown,
    teamFor(w, a).name,
    teamFor(w, a).college,
  ]
    .join(' ')
    .toLowerCase();

export function runSearch(w: World, f: Filters): Athlete[] {
  const groups = activeGroups(w, f);
  const kw = f.keyword.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const ex = f.expText.trim().toLowerCase();
  return visibleToRecruiters(w).filter((a) => {
    if (kw.length && !kw.every((k) => hay(w, a).includes(k))) return false;
    if (ex && !(a.exp + ' ' + a.skills).toLowerCase().includes(ex)) return false;
    if (f.sport.length && !f.sport.includes(sportOf(w, a))) return false;
    if (f.major.length && !f.major.includes(a.major)) return false;
    if (f.year.length && !f.year.includes(a.year)) return false;
    if (f.region.length && !f.region.includes(a.region)) return false;
    if (f.city.length && !f.city.includes(cityOf(a))) return false;
    if (f.division.length && !f.division.includes(a.division)) return false;
    if (f.exp.length && !f.exp.some((t) => EXP_TAGS[t]?.test(a.exp + ' ' + a.skills))) return false;
    if (groups.length && !(a.identityOptIn && a.groups.some((g) => groups.includes(g))))
      return false;
    return true;
  });
}

export function describeFilters(w: World, f: Filters): string {
  const parts: string[] = [];
  if (f.keyword.trim()) parts.push(`"${f.keyword.trim()}"`);
  if (f.major.length) parts.push(f.major.join(', '));
  if (f.year.length) parts.push('Class of ' + f.year.join(', '));
  if (f.sport.length) parts.push(f.sport.join(', '));
  if (f.region.length) parts.push(f.region.join(', '));
  if (f.city.length) parts.push(f.city.join(', '));
  if (f.division.length) parts.push('Division ' + f.division.join(', '));
  if (f.exp.length) parts.push(f.exp.join(', ') + ' experience');
  if (f.expText.trim()) parts.push(`experience mentions "${f.expText.trim()}"`);
  const g = activeGroups(w, f);
  if (g.length)
    parts.push('Group: ' + g.map((id) => w.groups.find((x) => x.id === id)?.name ?? id).join(', '));
  return parts.length ? parts.join(' · ') : 'All athletes open to recruiting';
}

export const filterCount = (f: Filters) =>
  (f.keyword.trim() ? 1 : 0) +
  (f.expText.trim() ? 1 : 0) +
  f.sport.length +
  f.major.length +
  f.year.length +
  f.region.length +
  f.city.length +
  f.division.length +
  f.exp.length +
  f.groups.length;

export type SortKey = 'newest' | 'year' | 'name';
export function sortResults(list: Athlete[], k: SortKey) {
  if (k === 'year') return [...list].sort((a, b) => a.year.localeCompare(b.year));
  if (k === 'name') return [...list].sort((a, b) => a.last.localeCompare(b.last));
  return list;
}

/* ---------- saved searches ---------- */
export type SavedSearch = {
  id: string;
  name: string;
  filters: Filters;
  freq: 'Weekly' | 'Daily' | 'Off';
  fresh: number;
};
export const SEED_SEARCHES: SavedSearch[] = [
  {
    id: 's1',
    name: 'Finance interns, Northeast',
    filters: {
      ...EMPTY,
      major: ['Economics', 'Finance'],
      year: ['2027', '2028'],
      region: ['Northeast'],
      exp: ['Internship'],
    },
    freq: 'Weekly',
    fresh: 4,
  },
  {
    id: 's2',
    name: 'Boston ops roles',
    filters: { ...EMPTY, city: ['Boston'] },
    freq: 'Weekly',
    fresh: 1,
  },
  {
    id: 's3',
    name: 'Data and engineering',
    filters: { ...EMPTY, major: ['Computer Science', 'Engineering'] },
    freq: 'Daily',
    fresh: 0,
  },
];

/* ---------- job match ---------- */
export type Term = {
  label: string;
  kind: 'major' | 'year' | 'city' | 'skill' | 'lead';
  value: string;
};
const SKILLS = [
  'Excel',
  'SQL',
  'Python',
  'R',
  'Tableau',
  'React',
  'Stata',
  'Valuation',
  'Financial modeling',
  'Research',
  'Public speaking',
  'Writing',
  'Lab methods',
];
const MAJORS = [
  'Economics',
  'Finance',
  'Computer Science',
  'Psychology',
  'Biology',
  'Engineering',
  'Accounting',
  'Statistics',
];

export function termsFromJD(w: World, text: string): Term[] {
  const t = ' ' + text.toLowerCase().replace(/[^a-z0-9+#\s]/g, ' ') + ' ';
  const has = (word: string) => t.includes(' ' + word.toLowerCase() + ' ');
  const out: Term[] = [];
  for (const m of MAJORS) if (has(m)) out.push({ label: m, kind: 'major', value: m });
  const years = new Set<string>();
  for (const y of ['2026', '2027', '2028', '2029']) if (has(y)) years.add(y);
  if (/junior/.test(t)) years.add('2028');
  if (/senior/.test(t)) years.add('2027');
  if (/sophomore/.test(t)) years.add('2029');
  for (const y of [...years].sort()) out.push({ label: 'Class of ' + y, kind: 'year', value: y });
  const cities = [...new Set(visibleToRecruiters(w).map(cityOf)), 'New York', 'Chicago', 'Boston'];
  for (const c of [...new Set(cities)])
    if (t.includes(' ' + c.toLowerCase() + ' ')) out.push({ label: c, kind: 'city', value: c });
  for (const s of SKILLS) if (has(s)) out.push({ label: s, kind: 'skill', value: s });
  if (/lead|captain|club|team/.test(t))
    out.push({ label: 'Leadership', kind: 'lead', value: 'Leadership' });
  return out;
}

export type Match = {
  a: Athlete;
  reasons: string[];
  score: number;
  fit: 'Strong match' | 'Good match' | 'Some overlap';
};
export function matchAthletes(w: World, terms: Term[]): Match[] {
  if (!terms.length) return [];
  return visibleToRecruiters(w)
    .map((a) => {
      const text = (a.exp + ' ' + a.skills + ' ' + a.looking).toLowerCase();
      const reasons: string[] = [];
      for (const term of terms) {
        if (term.kind === 'major' && a.major === term.value) reasons.push(a.major);
        if (term.kind === 'year' && a.year === term.value) reasons.push('Class of ' + a.year);
        if (term.kind === 'city' && (cityOf(a) === term.value || a.looking.includes(term.value)))
          reasons.push(term.value);
        if (
          term.kind === 'skill' &&
          new RegExp('\\b' + term.value.toLowerCase() + '\\b').test(text)
        )
          reasons.push(term.value);
        if (term.kind === 'lead' && EXP_TAGS.Leadership?.test(a.exp + ' ' + a.skills))
          reasons.push('Leadership');
      }
      const score = reasons.length;
      const ratio = score / terms.length;
      const fit: Match['fit'] =
        ratio >= 0.45 || score >= 4 ? 'Strong match' : score >= 2 ? 'Good match' : 'Some overlap';
      return { a, reasons, score, fit };
    })
    .filter((m) => m.score > 0)
    .sort((x, y) => y.score - x.score);
}

export const SAMPLE_JD =
  'Summer Analyst, Boston. Rising juniors or seniors in economics, finance or a related field. Experience with Excel and SQL. Leadership on a team or in a club is a plus.';
