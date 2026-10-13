import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Me, Role } from '@team-impact/contracts';

interface RoleState {
  role: Role | null;
  setRole: (r: Role | null) => void;
  /** The signed-in account once the API has said who it is (mock sign-in sets it). */
  me: Me | null;
  setMe: (me: Me | null) => void;
}

const RoleContext = createContext<RoleState | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  return (
    <RoleContext.Provider value={{ role, setRole, me, setMe }}>{children}</RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be inside RoleProvider');
  return ctx;
}
