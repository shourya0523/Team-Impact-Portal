import type {
  AlumniProfile,
  CardClaimPreview,
  CardClaimResult,
  FindAlumniQuery,
  UpdateAlumniProfileRequest,
} from '@team-impact/contracts';
import { post, put, request } from './client';

const query = (q: FindAlumniQuery) => {
  const params = new URLSearchParams(
    Object.entries(q).filter((e): e is [string, string] => typeof e[1] === 'string' && !!e[1]),
  ).toString();
  return params ? `?${params}` : '';
};

/** Alumni who help (athletes and alumni browse them), alumni's own details, pre-built card claims. */
export const alumni = {
  /** Alumni mentoring or hiring, with the contacts they share. Athletes and alumni only. */
  findAlumni: (q: FindAlumniQuery = {}) => request<AlumniProfile[]>(`/alumni${query(q)}`),
  /** 404 when they aren't mentoring or hiring. */
  alumnus: (id: string) => request<AlumniProfile>(`/alumni/${id}`),
  myAlumni: () => request<AlumniProfile>('/me/alumni'),
  updateMyAlumni: (body: UpdateAlumniProfileRequest) => put<AlumniProfile>('/me/alumni', body),

  /** The pre-built card behind a personal invite link (alumni athletes only). */
  cardClaim: (token: string) =>
    request<CardClaimPreview>(`/card-claims/${encodeURIComponent(token)}`),
  /** Single use. The card's fields then wait in the card review; nothing is published. */
  claimCard: (token: string) =>
    post<CardClaimResult>(`/card-claims/${encodeURIComponent(token)}/claim`),
};
