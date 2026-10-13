import type { College, CreateJoinRequest, JoinRequest, TeamSummary } from '@team-impact/contracts';
import { request, post } from './client';

export const join = {
  colleges: () => request<College[]>('/colleges'),
  /** Live teams at a college, optionally for one sport. */
  teams: (collegeId: string, sport?: string) =>
    request<TeamSummary[]>(
      `/teams?collegeId=${collegeId}${sport ? `&sport=${encodeURIComponent(sport)}` : ''}`,
    ),
  requestToJoin: (body: CreateJoinRequest) => post<JoinRequest>('/join-requests', body),
};
