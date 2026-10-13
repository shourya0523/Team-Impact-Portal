import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Me, Role } from '@team-impact/contracts';
import { api } from '@/api';

interface RoleState {
  role: Role | null;
  setRole: (r: Role | null) => void;
  /** The signed-in account once the API has said who it is (mock sign-in sets it). */
  me: Me | null;
  setMe: (me: Me | null) => void;
  /** False until the first `/me` check returns, so a reload doesn't bounce to the landing page. */
  ready: boolean;
}

const RoleContext = createContext<RoleState | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);

  // The session lives in a signed cookie; ask the API who it belongs to on start.
  useEffect(() => {
    let live = true;
    api
      .me()
      .then(
        (m) => {
          if (!live) return;
          setMe((cur) => cur ?? m);
          setRole((cur) => cur ?? m.role);
        },
        () => undefined, // signed out
      )
      .finally(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);

  return (
    <RoleContext.Provider value={{ role, setRole, me, setMe, ready }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be inside RoleProvider');
  return ctx;
}
