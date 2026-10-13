import type {
  AcceptCoachInviteBody,
  CoachInvitePreview,
  Me,
  QrCodePreview,
  QrJoinResult,
  SignupRequest,
} from '@team-impact/contracts';
import { post, request } from './client';

const enc = encodeURIComponent;

export const signup = {
  /** Open sign-up; signs the new account in. Under-13s are refused (a parent signs up instead). */
  signUp: (body: SignupRequest) => post<Me>('/auth/sign-up', body),
  /** What a team QR code is for, before joining. Works signed out. */
  qrPreview: (code: string) => request<QrCodePreview>(`/qr/${enc(code)}`),
  /** The fast lane: a live code puts you on the team straight away. */
  joinWithQr: (code: string) => post<QrJoinResult>(`/qr/${enc(code)}/join`),
  coachInvite: (token: string) => request<CoachInvitePreview>(`/invites/${enc(token)}`),
  acceptCoachInvite: (token: string, body: AcceptCoachInviteBody) =>
    post<Me>(`/invites/${enc(token)}/accept`, body),
};
