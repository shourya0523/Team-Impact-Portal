import type {
  CalendarEvent,
  Comment,
  Community,
  CreateCommunityRequest,
  EventAttendee,
  FeatureFlags,
  Me,
  NewEventRequest,
  NewPostRequest,
  NotificationList,
  NotificationPrefs,
  Post,
  RsvpStatus,
} from '@team-impact/contracts';
import { post, put, request } from './client';

/** Posting, comments, rallies, events, community create/leave and notifications. */
export const activity = {
  flags: () => request<FeatureFlags>('/config/flags'),

  /** Held for review: only the author sees it ("Waiting for review") until staff approve it. */
  createPost: (communityId: string, body: NewPostRequest) =>
    post<Post>(`/communities/${communityId}/posts`, body),
  getPost: (id: string) => request<Post>(`/posts/${id}`),
  comments: (postId: string) => request<Comment[]>(`/posts/${postId}/comments`),
  /** Held for review like posts. */
  addComment: (postId: string, text: string) =>
    post<Comment>(`/posts/${postId}/comments`, { text }),
  rally: (postId: string) => post<Post>(`/posts/${postId}/rally`),
  unrally: (postId: string) => request<Post>(`/posts/${postId}/rally`, { method: 'DELETE' }),

  createEvent: (communityId: string, body: NewEventRequest) =>
    post<CalendarEvent>(`/communities/${communityId}/events`, body),
  event: (id: string) => request<CalendarEvent>(`/events/${id}`),
  rsvp: (id: string, status: RsvpStatus) => put<CalendarEvent>(`/events/${id}/rsvp`, { status }),
  /** Organizer only. */
  attendees: (id: string) => request<EventAttendee[]>(`/events/${id}/rsvps`),

  createCommunity: (body: CreateCommunityRequest) => post<Community>('/communities', body),
  /** Leaving drops the recruiter opt-in too. */
  leaveCommunity: (id: string) => post<Community>(`/communities/${id}/leave`),

  notifications: () => request<NotificationList>('/notifications'),
  /** No ids marks everything read. */
  markNotificationsRead: (ids?: string[]) =>
    post<NotificationList>('/notifications/read', ids ? { ids } : {}),
  setNotificationPrefs: (prefs: Partial<NotificationPrefs>) =>
    put<Me>('/me/notification-prefs', prefs),
};
