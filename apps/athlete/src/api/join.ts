import type { College, CreateJoinRequest, JoinRequest, TeamSummary } from '@team-impact/contracts';
import { request, post } from './client';

export const join = {
  colleges: () => request<College[]>('/colleges'),
  teams: (collegeId: string) => request<TeamSummary[]>(`/teams?collegeId=${collegeId}`),
  requestToJoin: (body: CreateJoinRequest) => post<JoinRequest>('/join-requests', body),
};
