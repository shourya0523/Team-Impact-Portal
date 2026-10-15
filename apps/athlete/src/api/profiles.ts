import type {
  CardExport,
  CardVersion,
  ChildProfile,
  ConfirmResumeRequest,
  MyCardState,
  MySettings,
  Profile,
  ResumeExtraction,
  ResumeUploadRequest,
  UpdateCardRequest,
  UpdateChildRequest,
  UpdateMySettingsRequest,
} from '@team-impact/contracts';
import { post, put, request } from './client';

/** Profiles, privacy settings and the athlete's own Baseball Card. */
export const profiles = {
  /** A person's or a child's profile, shaped for the viewer; 404 if they may not see it. */
  profile: (id: string) => request<Profile>(`/profiles/${id}`),
  /** The parent's children. */
  children: () => request<ChildProfile[]>('/children'),
  updateChild: (id: string, body: UpdateChildRequest) =>
    request<ChildProfile>(`/children/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  settings: () => request<MySettings>('/me/settings'),
  updateSettings: (body: UpdateMySettingsRequest) => put<MySettings>('/me/settings', body),

  myCard: () => request<MyCardState>('/cards/me'),
  saveCardDraft: (body: UpdateCardRequest) => put<MyCardState>('/cards/me', body),
  publishCard: () => post<MyCardState>('/cards/me/publish'),
  /** Hides the card from everyone else at once, recruiters included; recruiting goes off. */
  unpublishCard: () => post<MyCardState>('/cards/me/unpublish'),
  cardHistory: () => request<CardVersion[]>('/cards/me/history'),
  uploadResume: (body: ResumeUploadRequest) => post<ResumeExtraction>('/cards/me/resume', body),
  confirmResume: (body: ConfirmResumeRequest) =>
    post<MyCardState>('/cards/me/resume/confirm', body),
  discardResume: () => post<MyCardState>('/cards/me/resume/discard'),
  /** The face a PNG export may draw (published cards only, no contacts). */
  cardExport: () => post<CardExport>('/cards/me/export'),
};
