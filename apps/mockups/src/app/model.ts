// Mobile app: personas, screens and pure world helpers (no React here).
import type { World } from '../shared/store';
import type { EventItem, Group, JoinRequest, List, Post, Ticket } from '../shared/data';

export type PersonaId = 'athlete' | 'parent' | 'teen' | 'coach' | 'alumni' | 'recruiter' | 'new';
export type Role = Exclude<PersonaId, 'new'>;

export type Screen =
  // onboarding
  | 'welcome'
  | 'account'
  | 'under13'
  | 'details'
  | 'terms'
  | 'find'
  | 'request'
  | 'pending'
  | 'scan'
  | 'signed'
  | 'verify'
  | 'alumniInvite'
  // community
  | 'home'
  | 'composer'
  | 'post'
  | 'report'
  | 'notifications'
  | 'events'
  | 'event'
  | 'createEvent'
  | 'groups'
  | 'group'
  | 'createGroup'
  // team
  | 'roster'
  | 'child'
  | 'coachTeam'
  | 'coachQR'
  | 'addCoach'
  | 'editTeam'
  // card
  | 'card'
  | 'upload'
  | 'cardReview'
  | 'editor'
  | 'export'
  | 'history'
  // me
  | 'me'
  | 'recruiting'
  | 'safety'
  | 'alumni'
  | 'alumniProfile'
  // recruiter
  | 'quick'
  | 'rcard'
  | 'lists'
  | 'list';

export type Persona = {
  id: PersonaId;
  label: string;
  who: string;
  name: string;
  roleLabel: string;
  teamId?: string;
  color: string;
};

export const PERSONAS: Persona[] = [
  {
    id: 'athlete',
    label: 'Athlete',
    who: 'Maya',
    name: 'Maya Okafor',
    roleLabel: 'Athlete',
    teamId: 'ws',
    color: 'var(--navy)',
  },
  {
    id: 'parent',
    label: 'Parent',
    who: 'Dana',
    name: 'Dana Kim',
    roleLabel: 'Parent',
    teamId: 'ws',
    color: '#0F7B5F',
  },
  {
    id: 'teen',
    label: 'Teen',
    who: 'Sam',
    name: 'Sam',
    roleLabel: 'Teammate',
    teamId: 'ws',
    color: '#7A1F2B',
  },
  {
    id: 'coach',
    label: 'Coach',
    who: 'Rivera',
    name: 'Coach Rivera',
    roleLabel: 'Coach',
    teamId: 'ws',
    color: 'var(--ink)',
  },
  {
    id: 'alumni',
    label: 'Alumni',
    who: 'Priya',
    name: 'Priya Shah',
    roleLabel: 'Alumni',
    color: '#0F7B5F',
  },
  {
    id: 'recruiter',
    label: 'Recruiter',
    who: 'Sam Park',
    name: 'Sam Park',
    roleLabel: 'Recruiter',
    color: 'var(--ink)',
  },
];
export const personaOf = (id: PersonaId): Persona =>
  PERSONAS.find((p) => p.id === id) ?? {
    id: 'new',
    label: 'New user',
    who: 'New user',
    name: 'New user',
    roleLabel: 'Guest',
    color: 'var(--navy)',
  };

export type Tab = { label: string; icon: string; screen: Screen; also: Screen[] };
export function tabsFor(p: PersonaId, childName = 'Leo'): Tab[] {
  const home: Tab = {
    label: 'Home',
    icon: 'home',
    screen: 'home',
    also: ['notifications', 'groups'],
  };
  const events: Tab = { label: 'Events', icon: 'events', screen: 'events', also: [] };
  const me: Tab = { label: 'Me', icon: 'me', screen: 'me', also: [] };
  void childName;
  switch (p) {
    case 'athlete':
      return [
        home,
        events,
        { label: 'Team', icon: 'team', screen: 'roster', also: [] },
        { label: 'Card', icon: 'card', screen: 'card', also: [] },
        me,
      ];
    case 'parent':
      return [home, events, { label: 'Team', icon: 'team', screen: 'roster', also: [] }, me];
    case 'teen':
      return [home, events, { label: 'Team', icon: 'team', screen: 'roster', also: [] }, me];
    case 'coach':
      return [home, events, { label: 'Team', icon: 'team', screen: 'coachTeam', also: [] }, me];
    case 'alumni':
      return [home, events, { label: 'Alumni', icon: 'users', screen: 'alumni', also: [] }, me];
    case 'recruiter':
      return [
        { label: 'Review', icon: 'review', screen: 'quick', also: [] },
        { label: 'Lists', icon: 'bookmark', screen: 'lists', also: [] },
        me,
      ];
    default:
      return [];
  }
}
export const homeOf = (p: PersonaId): Screen =>
  p === 'new' ? 'welcome' : p === 'recruiter' ? 'quick' : 'home';

/* ---------- small utilities ---------- */
export const initials = (n: string) =>
  n
    .replace(/^Coach /, 'C ')
    .split(/\s+/)
    .map((x) => x[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
export const uid = (p: string) => p + Math.random().toString(36).slice(2, 8);
const ROLE_COLORS: Record<string, string> = {
  Coach: 'var(--ink)',
  Staff: 'var(--navy)',
  Athlete: 'var(--navy)',
  Parent: '#0F7B5F',
  Alumni: '#7A1F2B',
  Teammate: '#4A4F57',
};
export const roleColor = (r: string) => ROLE_COLORS[r] ?? 'var(--text-2)';

/** Light content check, like the real pre-moderation: no health details, no phone numbers. */
export function checkText(t: string): string | null {
  if (!t.trim()) return 'Write something first.';
  if (/(diagnos|cancer|surgery|chemo|medication|treatment|illness|hospital)/i.test(t))
    return 'It mentions health details. Team IMPACT never shares those. Take them out and try again.';
  if (/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(t))
    return 'It includes a phone number. Share contact details from your profile instead.';
  return null;
}

export function splitDate(d: string): { month: string; day: string } {
  const m = d.match(/([A-Za-z]{3})\w*\s+(\d{1,2})/);
  return { month: (m?.[1] ?? 'OCT').toUpperCase(), day: m?.[2] ?? '–' };
}

/* ---------- world helpers (immutable) ---------- */
type W = World;
export const addPost =
  (p: Post) =>
  (w: W): W => ({ ...w, posts: [p, ...w.posts] });
export const removePost =
  (id: string) =>
  (w: W): W => ({ ...w, posts: w.posts.filter((p) => p.id !== id) });
export const likePost =
  (id: string, d: number) =>
  (w: W): W => ({
    ...w,
    posts: w.posts.map((p) => (p.id === id ? { ...p, likes: Math.max(0, p.likes + d) } : p)),
  });
export const addComment =
  (id: string, author: string, text: string) =>
  (w: W): W => ({
    ...w,
    posts: w.posts.map((p) =>
      p.id === id ? { ...p, comments: [...p.comments, { author, text }] } : p,
    ),
  });
export const setRsvp =
  (id: string, on: boolean) =>
  (w: W): W => ({
    ...w,
    events: w.events.map((e) =>
      e.id === id && e.rsvp !== on ? { ...e, rsvp: on, going: e.going + (on ? 1 : -1) } : e,
    ),
  });
export const addEvent =
  (e: EventItem) =>
  (w: W): W => ({ ...w, events: [...w.events, e] });
export const addGroup =
  (g: Group) =>
  (w: W): W => ({ ...w, groups: [g, ...w.groups] });
export const setJoined =
  (id: string, on: boolean) =>
  (w: W): W => ({
    ...w,
    groups: w.groups.map((g) =>
      g.id === id && g.joined !== on ? { ...g, joined: on, members: g.members + (on ? 1 : -1) } : g,
    ),
  });
export function addTicket(t: Omit<Ticket, 'id'>) {
  return (w: W): W => {
    const next = Math.max(0, ...w.tickets.map((x) => Number(x.id) || 0)) + 1;
    return { ...w, tickets: [{ ...t, id: String(next) }, ...w.tickets] };
  };
}
export const nextTicketId = (w: W) =>
  String(Math.max(0, ...w.tickets.map((x) => Number(x.id) || 0)) + 1);
export const addRequest =
  (r: JoinRequest) =>
  (w: W): W => ({ ...w, joinRequests: [r, ...w.joinRequests] });
export const setRequest =
  (id: string, status: JoinRequest['status']) =>
  (w: W): W => {
    const r = w.joinRequests.find((x) => x.id === id);
    const bump = r && r.status === 'pending' && status === 'approved' ? 1 : 0;
    return {
      ...w,
      joinRequests: w.joinRequests.map((x) => (x.id === id ? { ...x, status } : x)),
      teams:
        bump && r
          ? w.teams.map((t) => (t.id === r.teamId ? { ...t, members: t.members + 1 } : t))
          : w.teams,
    };
  };
export const dropRequest =
  (id: string) =>
  (w: W): W => ({ ...w, joinRequests: w.joinRequests.filter((x) => x.id !== id) });
export const bumpMembers =
  (teamId: string, d: number) =>
  (w: W): W => ({
    ...w,
    teams: w.teams.map((t) =>
      t.id === teamId ? { ...t, members: Math.max(0, t.members + d) } : t,
    ),
  });
export const patchTeam =
  (teamId: string, patch: Partial<W['teams'][number]>) =>
  (w: W): W => ({ ...w, teams: w.teams.map((t) => (t.id === teamId ? { ...t, ...patch } : t)) });
export const patchAthlete =
  (id: string, patch: Partial<W['athletes'][number]>) =>
  (w: W): W => ({ ...w, athletes: w.athletes.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
export const saveToList =
  (listId: string, athleteId: string) =>
  (w: W): W => ({
    ...w,
    lists: w.lists.map((l) =>
      l.id === listId && !l.athleteIds.includes(athleteId)
        ? { ...l, athleteIds: [...l.athleteIds, athleteId], updated: 'Today' }
        : l,
    ),
  });
export const removeFromList =
  (listId: string, athleteId: string) =>
  (w: W): W => ({
    ...w,
    lists: w.lists.map((l) =>
      l.id === listId
        ? { ...l, athleteIds: l.athleteIds.filter((x) => x !== athleteId), updated: 'Today' }
        : l,
    ),
  });
export const createList =
  (l: List) =>
  (w: W): W => ({ ...w, lists: [...w.lists, l] });
export const addNote =
  (athleteId: string, text: string) =>
  (w: W): W => ({
    ...w,
    notes: [
      { id: uid('n'), athleteId, companyId: 'northbeam', author: 'Sam Park', date: 'Oct 7', text },
      ...w.notes,
    ],
  });

export const ROLE_OPTIONS: { id: Role; name: string; sub: string }[] = [
  { id: 'athlete', name: 'Athlete', sub: 'On a college team' },
  { id: 'parent', name: 'Parent', sub: 'Of a Team IMPACT kid' },
  { id: 'teen', name: 'Teammate, 13–17', sub: 'A Team IMPACT kid' },
  { id: 'coach', name: 'Coach', sub: 'Invited by Team IMPACT' },
  { id: 'alumni', name: 'Alumni', sub: 'Mentor or hire' },
  { id: 'recruiter', name: 'Recruiter', sub: 'Sponsor company' },
];
