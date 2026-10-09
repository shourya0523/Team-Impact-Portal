import { z } from 'zod';
import { CardWithContact } from './cards';
import { HexColor, Id, Timestamp } from './common';
import { UserSummary } from './users';

/**
 * A recruiter's shortlist. The owner can share it with colleagues at the same company, who can
 * add and remove athletes and see every note. Athletes are never told they're on a list.
 */
export const RecruiterList = z.object({
  id: Id,
  companyId: Id,
  name: z.string(),
  color: HexColor,
  /** What it's for: role, team or hiring cycle. Everyone it's shared with sees it. */
  note: z.string().nullable(),
  owner: UserSummary,
  sharedWith: z.array(UserSummary),
  /** Athletes recruiters can currently see; see `RecruiterListEntry`. */
  athleteCount: z.number().int().nonnegative(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type RecruiterList = z.infer<typeof RecruiterList>;

/** Company-wide: kept when a list is deleted or the company is suspended. The athlete never sees it. */
export const RecruiterNote = z.object({
  id: Id,
  athleteId: Id,
  author: UserSummary,
  text: z.string(),
  createdAt: Timestamp,
});
export type RecruiterNote = z.infer<typeof RecruiterNote>;

/**
 * An athlete who unpublishes or turns off open-to-recruiting stays on the list but drops out of
 * its entries until they turn it back on.
 */
export const RecruiterListEntry = z.object({
  card: CardWithContact,
  addedBy: UserSummary,
  addedAt: Timestamp,
  latestNote: RecruiterNote.nullable(),
});
export type RecruiterListEntry = z.infer<typeof RecruiterListEntry>;

export const RecruiterListDetail = RecruiterList.extend({ entries: z.array(RecruiterListEntry) });
export type RecruiterListDetail = z.infer<typeof RecruiterListDetail>;

const ListName = z.string().trim().min(1).max(60);
const ListNote = z.string().trim().max(300);

/** Names are unique within a company. */
export const CreateListRequest = z.object({
  name: ListName,
  color: HexColor,
  note: ListNote.optional(),
});
export type CreateListRequest = z.infer<typeof CreateListRequest>;

export const UpdateListRequest = z.object({
  name: ListName.optional(),
  color: HexColor.optional(),
  note: ListNote.nullable().optional(),
  /** Verified recruiters at the same company. Replaces the current set. */
  sharedWithUserIds: z.array(Id).max(50).optional(),
});
export type UpdateListRequest = z.infer<typeof UpdateListRequest>;

export const AddToListRequest = z.object({ athleteId: Id });
export type AddToListRequest = z.infer<typeof AddToListRequest>;

export const CreateRecruiterNoteRequest = z.object({
  athleteId: Id,
  text: z.string().trim().min(1, 'Write a note first.').max(2000),
});
export type CreateRecruiterNoteRequest = z.infer<typeof CreateRecruiterNoteRequest>;
