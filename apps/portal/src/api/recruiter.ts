import type {
  AthleteSearchQuery,
  CardFace,
  CardWithContact,
  RecruiterList,
  RecruiterListDetail,
} from '@team-impact/contracts';
import { request, query, type Page } from './client';

export const recruiter = {
  searchAthletes: (q: Omit<AthleteSearchQuery, 'cursor' | 'limit'>) =>
    request<Page<CardFace>>(`/search/athletes${query({ ...q, limit: 100 })}`),
  card: (athleteId: string) => request<CardWithContact>(`/cards/${athleteId}`),
  lists: () => request<RecruiterList[]>('/lists'),
  list: (id: string) => request<RecruiterListDetail>(`/lists/${id}`),
};
