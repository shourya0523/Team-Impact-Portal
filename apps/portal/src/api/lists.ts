import type {
  CreateListRequest,
  RecruiterList,
  RecruiterListDetail,
  RecruiterNote,
  UpdateListRequest,
} from '@team-impact/contracts';
import { post, request } from './client';

/** Recruiter list writes (R6). Reads (`lists`, `list`) live in ./recruiter. */
export const lists = {
  createList: (body: CreateListRequest) => post<RecruiterList>('/lists', body),
  updateList: (id: string, body: UpdateListRequest) =>
    post<RecruiterList>(`/lists/${id}`, body, 'PATCH'),
  deleteList: (id: string) => request<void>(`/lists/${id}`, { method: 'DELETE' }),
  addToList: (id: string, athleteId: string) =>
    post<RecruiterListDetail>(`/lists/${id}/athletes/${athleteId}`),
  /** By the entry's id, so "no longer available" entries can be cleared too. */
  removeFromList: (id: string, entryId: string) =>
    request<RecruiterListDetail>(`/lists/${id}/entries/${entryId}`, { method: 'DELETE' }),
  setNote: (id: string, athleteId: string, text: string) =>
    post<RecruiterNote>(`/lists/${id}/athletes/${athleteId}/note`, { text }, 'PUT'),
};
