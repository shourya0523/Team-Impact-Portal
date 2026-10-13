import { z } from 'zod';
import { CalendarDate, Id, Timestamp } from './common';
import { CommunitySummary } from './communities';
import { ModerationStatus } from './moderation';
import { UserSummary } from './users';

/**
 * Every post lives in one community (PRD v2.2 §5). Staff, coaches, athletes and alumni post in any
 * community they belong to; teens only in their team's. Parents and recruiters don't post
 * (recruiters only put opportunities into official communities). The API enforces this from the
 * author's role and the community's kind.
 */
const postBase = {
  id: Id,
  author: UserSummary,
  community: CommunitySummary,
  text: z.string(),
  /** Posted by Team IMPACT staff. Official posts can't be blocked. */
  official: z.boolean(),
  likeCount: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
  likedByMe: z.boolean(),
  moderation: ModerationStatus,
  createdAt: Timestamp,
};

/** A sponsor's opening, posted into an official interest community. Members apply through the link. */
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
  communityId: Id,
  text: z.string().trim().min(1, 'Write something first.').max(2000),
});
export type CreatePostRequest = z.infer<typeof CreatePostRequest>;

/** Staff only, into a team community or Team Impact's. The API checks the kind. */
export const CreateAnnouncementRequest = z.object({
  communityId: Id,
  text: z.string().trim().min(10).max(2000),
  sendPush: z.boolean(),
});
export type CreateAnnouncementRequest = z.infer<typeof CreateAnnouncementRequest>;

/**
 * Recruiters only. Posted into one official interest community, after moderation like everything
 * else. The API rejects any other kind.
 */
export const CreateOpportunityRequest = z.object({
  communityId: Id,
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
