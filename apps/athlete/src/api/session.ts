import type {
  AcceptTermsRequest,
  HealthResponse,
  Me,
  Role,
  TermsStatus,
} from '@team-impact/contracts';
import { request, post } from './client';

export const session = {
  health: () => request<HealthResponse>('/health'),
  me: () => request<Me>('/me'),
  /** Mock API only: sign in as a role's fixture user, or a newcomer on no team yet. */
  devSignIn: (role: Role, newcomer = false) => post<Me>('/auth/dev-sign-in', { role, newcomer }),
  signOut: () => post<void>('/auth/sign-out'),
  /** Whether the legal text changed since this account last accepted it (TI-107). */
  termsStatus: () => request<TermsStatus>('/me/terms'),
  acceptTerms: (body: AcceptTermsRequest) => post<TermsStatus>('/me/terms', body),
};
