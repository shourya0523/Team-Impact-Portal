import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Role } from '@team-impact/contracts';

const RoleContext = createContext<{ role: Role | null; setRole: (r: Role | null) => void } | null>(
  null,
);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be inside RoleProvider');
  return ctx;
}
