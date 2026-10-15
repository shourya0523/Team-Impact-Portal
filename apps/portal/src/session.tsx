import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { FeatureFlags, Me, Role } from '@team-impact/contracts';
import { api } from './api';

interface Session {
  /** `undefined` while the first `/me` is in flight; `null` when signed out. */
  me: Me | null | undefined;
  flags: FeatureFlags | undefined;
  signIn: (role: Role) => Promise<Me>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

/** Reads the signed cookie's session once on load; sign-in and sign-out keep it in step. */
export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [flags, setFlags] = useState<FeatureFlags>();

  useEffect(() => {
    // A 401 means signed out; any other failure also shows sign-in, with the API's error there.
    api.me().then(setMe, () => setMe(null));
    // If flags can't load, keep both gated features hidden rather than guessing they're on.
    api
      .flags()
      .then(setFlags, () => setFlags({ identitySearch: false, medicalCommunities: false }));
  }, []);

  const signIn = useCallback(async (role: Role) => {
    const signedIn = await api.devSignIn(role);
    setMe(signedIn);
    return signedIn;
  }, []);

  const signOut = useCallback(async () => {
    await api.signOut();
    setMe(null);
  }, []);

  return (
    <SessionContext.Provider value={{ me, flags, signIn, signOut }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be inside SessionProvider');
  return session;
};

/** The portal is for recruiters and Team Impact staff; everyone else uses the app. */
export const PORTAL_ROLES = ['recruiter', 'staff'] as const satisfies readonly Role[];
export const isPortalRole = (role: Role) => (PORTAL_ROLES as readonly Role[]).includes(role);

/** Where each portal role lands after signing in. */
export const homeFor = (role: Role) => (role === 'staff' ? '/staff/teams' : '/search');
