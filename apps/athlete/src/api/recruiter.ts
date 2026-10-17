import type {
  AthleteSearchQuery,
  CardFace,
  CardWithContact,
  CreateListRequest,
  RecruiterList,
  RecruiterListDetail,
  RecruiterNote,
  UpdateListRequest,
  UserSummary,
} from '@team-impact/contracts';
import { post, put, request, type Page } from './client';

/** Query values go as strings; empty ones are left out so they don't filter anything. */
const query = (q: AthleteSearchQuery) => {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
};

/**
 * Recruiters (PRD §7): athlete search for quick review, an athlete's card with the contacts they
 * share with recruiters, and lists (R5, R6). Only published, open-to-recruiting adult athletes
 * ever come back.
 */
export const recruiter = {
  searchAthletes: (q: AthleteSearchQuery = {}) =>
    request<Page<CardFace>>(`/search/athletes${query(q)}`),
  /** By athlete id. 404 once the athlete unpublishes or stops being open to recruiting. */
  recruiterCard: (athleteId: string) => request<CardWithContact>(`/cards/${athleteId}`),

  lists: () => request<RecruiterList[]>('/lists'),
  list: (id: string) => request<RecruiterListDetail>(`/lists/${id}`),
  createList: (body: CreateListRequest) => post<RecruiterList>('/lists', body),
  updateList: (id: string, body: UpdateListRequest) =>
    request<RecruiterList>(`/lists/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteList: (id: string) => request<void>(`/lists/${id}`, { method: 'DELETE' }),
  addToList: (id: string, athleteId: string) =>
    post<RecruiterListDetail>(`/lists/${id}/athletes/${athleteId}`),
  removeFromList: (id: string, athleteId: string) =>
    request<RecruiterListDetail>(`/lists/${id}/athletes/${athleteId}`, { method: 'DELETE' }),
  /** Company-wide: every colleague sees it, the athlete never does. */
  setListNote: (id: string, athleteId: string, text: string) =>
    put<RecruiterNote>(`/lists/${id}/athletes/${athleteId}/note`, { text }),
  /** Verified recruiters at the same company, for sharing a list. */
  colleagues: () => request<UserSummary[]>('/company/colleagues'),
};
