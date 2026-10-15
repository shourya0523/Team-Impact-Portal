import type { Community, FeatureFlags, HealthResponse, Me, Role } from '@team-impact/contracts';
import { request, post } from './client';

export const session = {
  health: () => request<HealthResponse>('/health'),
  flags: () => request<FeatureFlags>('/config/flags'),

  me: () => request<Me>('/me'),
  /** Mock API only: sign in as a role's fixture user. */
  devSignIn: (role: Role) => post<Me>('/auth/dev-sign-in', { role }),
  signOut: () => post<void>('/auth/sign-out'),

  communities: () => request<Community[]>('/communities'),
};
