import { z } from 'zod';
import {
  CalendarDate,
  GroupAudience,
  Id,
  NetworkAudience,
  TeamAudience,
  Timestamp,
} from './common';
import { ModerationStatus } from './moderation';
import { UserSummary } from './users';

/**
 * Staff, coaches, athletes and alumni post anywhere; teens only to their own team. Parents and
 * recruiters don't post (recruiters only put opportunities into groups). Child profiles never
 * appear in the network feed. The API enforces all of this from the author's role.
 */
export const PostAudience = z.discriminatedUnion('scope', [
  TeamAudience,
  NetworkAudience,
  GroupAudience,
]);
export type PostAudience = z.infer<typeof PostAudience>;

const postBase = {
  id: Id,
  author: UserSummary,
  audience: PostAudience,
  text: z.string(),
  /** Posted by Team IMPACT staff. Official posts can't be blocked. */
  official: z.boolean(),
  likeCount: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
  likedByMe: z.boolean(),
  moderation: ModerationStatus,
  createdAt: Timestamp,
};

/** A sponsor's opening, posted into an affinity group. Members apply through the link. */
export const Opportunity = z.object({
  title: z.string(),
  link: z.url(),
  closesOn: CalendarDate.nullable(),
  company: z.object({ id: Id, name: z.string() }),
});
export type Opportunity = z.infer<typeof Opportunity>;

export const Post = z.discriminatedUnion('kind', [
  z.object({ ...postBase, kind: z.literal('post') }),
  z.object({ ...postBase, kind: z.literal('announcement') }),
  z.object({ ...postBase, kind: z.literal('opportunity'), opportunity: Opportunity }),
]);
export type Post = z.infer<typeof Post>;

export const CreatePostRequest = z.object({
  audience: PostAudience,
  text: z.string().trim().min(1, 'Write something first.').max(2000),
});
export type CreatePostRequest = z.infer<typeof CreatePostRequest>;

/** Staff only. */
export const CreateAnnouncementRequest = z.object({
  audience: z.discriminatedUnion('scope', [TeamAudience, NetworkAudience]),
  text: z.string().trim().min(10).max(2000),
  sendPush: z.boolean(),
});
export type CreateAnnouncementRequest = z.infer<typeof CreateAnnouncementRequest>;

/** Recruiters only. Posted into one affinity group, after moderation like everything else. */
export const CreateOpportunityRequest = z.object({
  groupId: Id,
  title: z.string().trim().min(1).max(80),
  details: z.string().trim().min(10).max(2000),
  /** http(s) only, so a link can't run script when tapped. */
  link: z.httpUrl(),
  closesOn: CalendarDate.optional(),
});
export type CreateOpportunityRequest = z.infer<typeof CreateOpportunityRequest>;

export const Comment = z.object({
  id: Id,
  postId: Id,
  author: UserSummary,
  text: z.string(),
  moderation: ModerationStatus,
  createdAt: Timestamp,
});
export type Comment = z.infer<typeof Comment>;

/** Everyone but recruiters can comment, teens included, on any post they can read. */
export const CreateCommentRequest = z.object({
  text: z.string().trim().min(1, 'Write something first.').max(1000),
});
export type CreateCommentRequest = z.infer<typeof CreateCommentRequest>;
