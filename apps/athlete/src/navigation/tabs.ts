import type { Href } from 'expo-router';
import type { Role } from '@team-impact/contracts';

export type TabName = 'home' | 'events' | 'team' | 'child' | 'card' | 'review' | 'lists' | 'me';

/** Which tabs each role sees, from the hi-fi wireframe's tab bars. */
export const TABS_BY_ROLE: Partial<Record<Role, TabName[]>> = {
  athlete: ['home', 'events', 'team', 'card', 'me'],
  parent: ['home', 'events', 'team', 'child', 'me'],
  teen: ['home', 'events', 'team', 'me'],
  coach: ['home', 'events', 'team', 'me'],
  // The wireframe has no alumni tab bar. Assumption: alumni athletes keep a Card (contracts'
  // hasImpactCard includes them, and "claim your pre-built card" lands in card review).
  alumni_athlete: ['home', 'events', 'card', 'me'],
  alumni_mentor: ['home', 'events', 'me'],
  // The wireframe's recruiter bar is Review · Lists; Me is added so recruiters can sign out.
  recruiter: ['review', 'lists', 'me'],
};

/** Where a role lands when it enters the app: its first tab. */
export const firstTab = (role: Role) => `/${TABS_BY_ROLE[role]?.[0] ?? 'me'}` as Href;
