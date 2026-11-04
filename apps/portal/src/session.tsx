import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  CURRENT_TERMS_VERSION,
  type FeatureFlags,
  type Me,
  type Role,
} from '@team-impact/contracts';
import { api } from './api';

interface Session {
  /** `undefined` while the first `/me` is in flight; `null` when signed out. */
  me: Me | null | undefined;
  flags: FeatureFlags | undefined;
  /**
   * True when the legal text changed since the signed-in account accepted it: the portal shows
   * the new text and nothing else until they accept (TI-107). `undefined` while asking.
   */
  mustAcceptTerms: boolean | undefined;
  acceptTerms: () => Promise<void>;
  signIn: (role: Role) => Promise<Me>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

/** Reads the signed cookie's session once on load; sign-in and sign-out keep it in step. */
export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [flags, setFlags] = useState<FeatureFlags>();
  const [mustAcceptTerms, setMustAcceptTerms] = useState<boolean>();

  useEffect(() => {
    // A 401 means signed out; any other failure also shows sign-in, with the API's error there.
    api.me().then(setMe, () => setMe(null));
    // If flags can't load, keep both gated features hidden rather than guessing they're on.
    api
      .flags()
      .then(setFlags, () => setFlags({ identitySearch: false, medicalCommunities: false }));
  }, []);

  // Asked again for each account that signs in. If the API can't say, the portal carries on: it
  // still refuses a stale version wherever one is sent.
  const meId = me?.id;
  useEffect(() => {
    setMustAcceptTerms(undefined);
    if (!meId) return;
    let live = true;
    api.termsStatus().then(
      (status) => live && setMustAcceptTerms(status.mustAccept),
      () => live && setMustAcceptTerms(false),
    );
    return () => {
      live = false;
    };
  }, [meId]);

  const acceptTerms = useCallback(async () => {
    const status = await api.acceptTerms({
      acceptTerms: true,
      termsVersion: CURRENT_TERMS_VERSION,
    });
    setMustAcceptTerms(status.mustAccept);
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
    <SessionContext.Provider value={{ me, flags, mustAcceptTerms, acceptTerms, signIn, signOut }}>
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
