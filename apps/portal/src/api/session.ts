import type {
  AcceptTermsRequest,
  Community,
  FeatureFlags,
  HealthResponse,
  Me,
  Role,
  TermsStatus,
} from '@team-impact/contracts';
import { request, post } from './client';

export const session = {
  health: () => request<HealthResponse>('/health'),
  flags: () => request<FeatureFlags>('/config/flags'),

  me: () => request<Me>('/me'),
  /** Mock API only: sign in as a role's fixture user. */
  devSignIn: (role: Role) => post<Me>('/auth/dev-sign-in', { role }),
  signOut: () => post<void>('/auth/sign-out'),
  /** Whether the legal text changed since this account last accepted it (TI-107). */
  termsStatus: () => request<TermsStatus>('/me/terms'),
  acceptTerms: (body: AcceptTermsRequest) => post<TermsStatus>('/me/terms', body),

  communities: () => request<Community[]>('/communities'),
};
