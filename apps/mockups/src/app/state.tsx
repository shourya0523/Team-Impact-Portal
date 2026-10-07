// App-local UI state for the mobile mockup (not shared with other surfaces).
import { createContext, useContext, type ReactNode } from 'react';
import type { useNav } from '../shared/store';
import type { PersonaId, Role, Screen } from './model';

export type Draft = {
  role: Role;
  year: number;
  name: string;
  email: string;
  child: string;
  childAge: string;
  teamId: string;
  via: 'request' | 'qr';
  requestId: string;
  agree: boolean;
  parentOk: boolean;
};
export const newDraft = (): Draft => ({
  role: 'athlete',
  year: 2006,
  name: 'Maya Okafor',
  email: '',
  child: 'Leo',
  childAge: '9',
  teamId: 'ws',
  via: 'request',
  requestId: '',
  agree: false,
  parentOk: false,
});

export type Member = { id: string; name: string; detail: string; color: string; viaQr: boolean };
export type Local = {
  liked: string[]; // `${persona}:${postId}`
  blocked: string[]; // author names
  hiddenForMe: string[]; // posts this user reported
  reported: string[]; // ticket ids this user filed
  groupOf: Record<string, string>; // postId -> groupId
  prefs: { approvals: boolean; replies: boolean; events: boolean; digest: boolean };
  hasCard: boolean; // fresh sign-ups start without a card
  members: Member[]; // coach's team members
  coaches: { name: string; role: string; note: string }[];
  qr: { len: 'night' | 'day' | 'week'; revoked: boolean };
  child: { name: string; age: string; interests: string };
  fam: { Phone: boolean; Email: boolean; LinkedIn: boolean };
  rec: { Phone: boolean; Email: boolean; LinkedIn: boolean };
  rv: { idx: number; target: string; majors: string[]; years: string[]; regions: string[] }; // recruiter quick review
  teamAbout: string;
  cardDraft: CardFields | null; // fields read from a resume, waiting for the athlete to confirm
};
export type CardFields = {
  first: string;
  last: string;
  num: string;
  position: string;
  year: string;
  major: string;
  hometown: string;
  exp: string;
  skills: string;
  looking: string;
};
export const initialLocal = (): Local => ({
  liked: [],
  blocked: [],
  hiddenForMe: [],
  reported: [],
  groupOf: { p4: 'women-fin' },
  prefs: { approvals: true, replies: true, events: true, digest: false },
  hasCard: true,
  members: [
    {
      id: 'm1',
      name: 'Dana Kim',
      detail: 'Parent of Leo · joined by QR, Sep 28',
      color: '#0F7B5F',
      viaQr: true,
    },
    {
      id: 'm2',
      name: 'Grace Liu',
      detail: 'Athlete · joined by QR, Sep 29',
      color: 'var(--navy)',
      viaQr: true,
    },
    {
      id: 'm3',
      name: 'Maya Okafor',
      detail: 'Athlete · approved Sep 26',
      color: 'var(--navy)',
      viaQr: false,
    },
    {
      id: 'm4',
      name: 'Sam',
      detail: 'Teammate, 15 · parent confirmed',
      color: '#7A1F2B',
      viaQr: false,
    },
  ],
  coaches: [
    { name: 'Coach Rivera', role: 'Head coach', note: 'Added by Team IMPACT staff' },
    { name: 'Ben Lopez', role: 'Assistant', note: 'Added by Coach Rivera · Sep 24' },
  ],
  qr: { len: 'week', revoked: false },
  child: {
    name: 'Leo',
    age: '9',
    interests: 'Goalkeeping drills, dinosaurs, and picking the team playlist.',
  },
  fam: { Phone: true, Email: true, LinkedIn: false },
  rec: { Phone: false, Email: true, LinkedIn: true },
  rv: {
    idx: 0,
    target: 'fall',
    majors: ['Economics', 'Finance'],
    years: [],
    regions: ['Northeast'],
  },
  teamAbout: 'Jumbos women’s soccer. Home games at Kraft Field.',
  cardDraft: null,
});

export type Me = {
  persona: PersonaId;
  name: string;
  first: string;
  roleLabel: string;
  teamId?: string;
  color: string;
  fresh: boolean;
};

export type AppCtx = {
  me: Me;
  nav: ReturnType<typeof useNav<Screen>>;
  toast: (m: string) => void;
  local: Local;
  setLocal: (fn: (l: Local) => Local) => void;
  draft: Draft;
  setDraft: (fn: (d: Draft) => Draft) => void;
  /** Enter the app as a persona (from sign-up or the demo switcher). */
  become: (p: PersonaId, opts?: { name?: string; fresh?: boolean; screen?: Screen }) => void;
  layer: HTMLElement | null;
};
const Ctx = createContext<AppCtx | null>(null);
export const AppProvider = ({ value, children }: { value: AppCtx; children: ReactNode }) => (
  <Ctx.Provider value={value}>{children}</Ctx.Provider>
);
export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp outside AppProvider');
  return c;
}
