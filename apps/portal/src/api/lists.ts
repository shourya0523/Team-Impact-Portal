import type {
  CreateListRequest,
  RecruiterList,
  RecruiterListDetail,
  RecruiterNote,
  UpdateListRequest,
  UserSummary,
} from '@team-impact/contracts';
import { post, request } from './client';

/** Recruiter list writes (R6). Reads (`lists`, `list`) live in ./recruiter. */
export const lists = {
  colleagues: () => request<UserSummary[]>('/company/colleagues'),
  createList: (body: CreateListRequest) => post<RecruiterList>('/lists', body),
  updateList: (id: string, body: UpdateListRequest) =>
    post<RecruiterList>(`/lists/${id}`, body, 'PATCH'),
  deleteList: (id: string) => request<void>(`/lists/${id}`, { method: 'DELETE' }),
  shareList: (id: string, userId: string) => post<RecruiterList>(`/lists/${id}/share`, { userId }),
  addToList: (id: string, athleteId: string) =>
    post<RecruiterListDetail>(`/lists/${id}/athletes/${athleteId}`),
  removeFromList: (id: string, athleteId: string) =>
    request<RecruiterListDetail>(`/lists/${id}/athletes/${athleteId}`, { method: 'DELETE' }),
  setNote: (id: string, athleteId: string, text: string) =>
    post<RecruiterNote>(`/lists/${id}/athletes/${athleteId}/note`, { text }, 'PUT'),
};
