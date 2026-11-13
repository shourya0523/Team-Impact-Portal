import { z } from 'zod';
import { CardWithContact } from './cards';
import { HexColor, Id, Timestamp } from './common';
import { UserSummary } from './users';

/**
 * A shortlist. Every list belongs to a company: all its recruiters see it, add and remove athletes
 * and see every note. Only the owner renames or deletes it. Athletes are never told they're on a
 * list.
 */
export const RecruiterList = z.object({
  id: Id,
  companyId: Id,
  name: z.string(),
  color: HexColor,
  /** What it's for: role, team or hiring cycle. Everyone at the company sees it. */
  note: z.string().nullable(),
  /** Who made it. Null once their account is gone; then anyone at the company can manage it. */
  owner: UserSummary.nullable(),
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

const EntryBase = z.object({
  id: Id,
  /** Null once the colleague who added them has left and the list has no owner either. */
  addedBy: UserSummary.nullable(),
  addedAt: Timestamp,
});

/**
 * An athlete on a list. One who turns off open-to-recruiting (or unpublishes, or is suspended)
 * stays on it as "no longer available": no card, contacts, name or notes, because they're off the
 * employer portal entirely. They come back as they were if they turn it back on.
 */
export const RecruiterListEntry = z.discriminatedUnion('available', [
  EntryBase.extend({
    available: z.literal(true),
    card: CardWithContact,
    latestNote: RecruiterNote.nullable(),
  }),
  EntryBase.extend({ available: z.literal(false) }),
]);
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
});
export type UpdateListRequest = z.infer<typeof UpdateListRequest>;

export const AddToListRequest = z.object({ athleteId: Id });
export type AddToListRequest = z.infer<typeof AddToListRequest>;

export const CreateRecruiterNoteRequest = z.object({
  athleteId: Id,
  text: z.string().trim().min(1, 'Write a note first.').max(2000),
});
export type CreateRecruiterNoteRequest = z.infer<typeof CreateRecruiterNoteRequest>;
