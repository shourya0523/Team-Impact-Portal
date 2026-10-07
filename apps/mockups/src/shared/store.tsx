import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import * as seed from './data';

export type World = {
  athletes: seed.Athlete[];
  teams: seed.Team[];
  companies: seed.Company[];
  lists: seed.List[];
  notes: seed.Note[];
  groups: seed.Group[];
  posts: seed.Post[];
  events: seed.EventItem[];
  tickets: seed.Ticket[];
  joinRequests: seed.JoinRequest[];
  alumni: seed.Alumni[];
  identitySearchOn: boolean; // staff feature flag (PRD: identity search behind one flag)
  searchLog: { who: string; query: string; when: string }[];
};

const KEY = 'ti-mockups-world-v1';

export function initialWorld(): World {
  const c = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
  return {
    athletes: c(seed.athletes),
    teams: c(seed.teams),
    companies: c(seed.companies),
    lists: c(seed.lists),
    notes: c(seed.notes),
    groups: c(seed.groups),
    posts: c(seed.posts),
    events: c(seed.events),
    tickets: c(seed.tickets),
    joinRequests: c(seed.joinRequests),
    alumni: c(seed.alumni),
    identitySearchOn: true,
    searchLog: [],
  };
}

function load(): World {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...initialWorld(), ...JSON.parse(raw) };
  } catch {
    /* storage blocked: start fresh */
  }
  return initialWorld();
}

type Ctx = { world: World; update: (fn: (w: World) => World) => void; reset: () => void };
const WorldCtx = createContext<Ctx | null>(null);

export function WorldProvider({ children }: { children: ReactNode }) {
  const [world, setWorld] = useState<World>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(world));
    } catch {
      /* ignore */
    }
  }, [world]);
  const update = useCallback((fn: (w: World) => World) => setWorld((w) => fn(w)), []);
  const reset = useCallback(() => setWorld(initialWorld()), []);
  return <WorldCtx.Provider value={{ world, update, reset }}>{children}</WorldCtx.Provider>;
}

export function useWorld() {
  const ctx = useContext(WorldCtx);
  if (!ctx) throw new Error('useWorld outside WorldProvider');
  return ctx;
}

/** Helpers that keep the hard product rules in one place (CLAUDE.md). */
export const visibleToRecruiters = (w: World) =>
  w.athletes.filter((a) => a.published && a.openToRecruiting);

/** Tiny in-memory navigator with history, used inside each mockup. */
export function useNav<S extends string>(start: S, startParams: Record<string, string> = {}) {
  const [stack, setStack] = useState<{ screen: S; params: Record<string, string> }[]>([
    { screen: start, params: startParams },
  ]);
  const cur = stack[stack.length - 1] ?? { screen: start, params: startParams };
  return {
    screen: cur.screen,
    params: cur.params,
    go: (screen: S, params: Record<string, string> = {}) =>
      setStack((s) => [...s, { screen, params }]),
    replace: (screen: S, params: Record<string, string> = {}) =>
      setStack((s) => [...s.slice(0, -1), { screen, params }]),
    reset: (screen: S, params: Record<string, string> = {}) => setStack([{ screen, params }]),
    back: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
    canGoBack: stack.length > 1,
  };
}
