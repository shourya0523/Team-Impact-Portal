import { createContext, useContext, useState, type ReactNode } from 'react';
import type { useNav } from '../shared/store';

/** Screens inside the staff portal. Sidenav items reset the stack to their root screen. */
export type Screen =
  | 'teams'
  | 'createTeam'
  | 'team'
  | 'companies'
  | 'addCompany'
  | 'company'
  | 'moderation'
  | 'ticket'
  | 'groups'
  | 'announce'
  | 'analytics'
  | 'alumni';

export type Nav = ReturnType<typeof useNav<Screen>>;

export const STAFF_NAME = 'Alex Morgan';

export type Person = { name: string; email: string; joined: string };
export type Coach = { name: string; email: string; role: string; added: string };
export type LogEntry = {
  ticketId: string;
  action: string;
  note: string;
  who: string;
  when: string;
};

/**
 * Session-only staff state (details the shared world does not model).
 * Anything other surfaces react to lives in the shared world instead.
 */
type Local = {
  coaches: Record<string, Coach[]>; // extra coaches per team id
  recruiters: Record<string, Person[]>; // recruiter roster per company id
  suspendedPeople: string[]; // recruiter emails suspended one by one
  modLog: LogEntry[];
};

const seedRecruiters: Record<string, Person[]> = {
  northbeam: [
    { name: 'Sam Park', email: 'sam.park@northbeam.com', joined: 'Oct 7' },
    { name: 'Priya Shah', email: 'priya.shah@northbeam.com', joined: 'Sep 30' },
    { name: 'Tom Becker', email: 'tom.becker@northbeam.com', joined: 'Sep 30' },
    { name: 'Lee Chen', email: 'lee.chen@northbeam.com', joined: 'Oct 2' },
  ],
  harbor: [
    { name: 'Nina Brooks', email: 'nina.brooks@harborhp.com', joined: 'Sep 22' },
    { name: 'Omar Haddad', email: 'omar.haddad@harborhp.com', joined: 'Sep 29' },
  ],
  kestrel: [
    { name: 'Rachel Wong', email: 'rachel.wong@kestrel.co', joined: 'Oct 1' },
    { name: 'Ben Ortiz', email: 'ben.ortiz@kestrel.co', joined: 'Oct 3' },
    { name: 'Claire Dunn', email: 'claire.dunn@kestrelconsulting.com', joined: 'Oct 5' },
  ],
};

const seedCoaches: Record<string, Coach[]> = {
  ws: [
    {
      name: 'Ben Lopez',
      email: 'ben.lopez@tufts.edu',
      role: 'Assistant',
      added: 'added by Coach Rivera, Sep 24',
    },
  ],
};

type Ctx = {
  local: Local;
  setLocal: (fn: (l: Local) => Local) => void;
  nav: Nav;
  toast: (m: string) => void;
};
const StaffCtx = createContext<Ctx | null>(null);

export function StaffProvider({
  nav,
  toast,
  children,
}: {
  nav: Nav;
  toast: (m: string) => void;
  children: ReactNode;
}) {
  const [local, setLocal] = useState<Local>({
    coaches: seedCoaches,
    recruiters: seedRecruiters,
    suspendedPeople: [],
    modLog: [],
  });
  return <StaffCtx.Provider value={{ local, setLocal, nav, toast }}>{children}</StaffCtx.Provider>;
}

export function useStaff() {
  const c = useContext(StaffCtx);
  if (!c) throw new Error('useStaff outside StaffProvider');
  return c;
}

/* ---------- small pure helpers ---------- */

export const uid = (p: string) => p + Math.random().toString(36).slice(2, 8);

export const nowLabel = () =>
  new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
export const DOMAIN_RE =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;
export const PERSONAL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'aol.com',
  'proton.me',
  'live.com',
];

export function domainError(
  raw: string,
  existing: string[],
  takenElsewhere: string[] = [],
): string {
  const d = raw.trim().toLowerCase().replace(/^@/, '');
  if (!d) return 'Type a domain, like company.com.';
  if (!DOMAIN_RE.test(d)) return 'That does not look like a domain. Use the form name.com.';
  if (PERSONAL_DOMAINS.includes(d))
    return d + ' can’t be added. Personal email providers are blocked.';
  if (existing.includes(d)) return d + ' is already on the list.';
  if (takenElsewhere.includes(d)) return d + ' already belongs to another company.';
  return '';
}

export const initials = (name: string) =>
  name
    .replace(/[’']s\b/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2) || 'T';

export const firstName = (author: string) => (author.split(' · ')[0] ?? author).trim();
