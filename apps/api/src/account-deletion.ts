// =============================================================================================
// Account deletion (PRD §9, P3; TI-79). Apple requires it in the app. It happens in two steps:
//
//   1. DELETE /me hides the account at once: `users.deleted_at` is set, every session and push
//      token is removed, and the interest or medical communities the person created pass to their
//      longest-standing member. Sign-in then answers as if there were no account (auth.ts).
//   2. After 30 days a daily job erases the row. Foreign keys cascade to everything the person
//      owned (card, media, posts, comments, a parent's children's profiles, consents, memberships,
//      blocks, …) and set null on records that outlive them (who invited or decided, and a
//      recruiter's lists and notes, which belong to their company). An erased athlete's entries on
//      recruiters' lists become "withdrawn", and the notes written about them are erased with them.
//
// Backups age out on their own; see docs/account-deletion.md for the windows.
// =============================================================================================
import { and, asc, eq, inArray, isNotNull, isNull, lte, ne } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import type { Db } from './db/client';
import * as schema from './db/schema';

/** How long a deleted account is kept, hidden, before it is erased (PRD §9). */
export const ERASE_AFTER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Why an account can't be deleted in the app, as an HTTP status and message. */
export type DeletionRefusal = [status: 403 | 409, message: string];

/**
 * Whether `userId` is the only coach who can act for one of their live teams. A live team always
 * keeps at least one coach (PRD §3), so that coach must hand over before leaving. Suspended and
 * already-deleted coaches don't count, as in the mock (`isLastCoach`).
 */
const isLastCoach = async (db: Db, userId: string) => {
  const theirTeams = await db
    .select({ communityId: schema.memberships.communityId })
    .from(schema.memberships)
    .innerJoin(schema.communities, eq(schema.communities.id, schema.memberships.communityId))
    .innerJoin(schema.teams, eq(schema.teams.id, schema.communities.teamId))
    .where(
      and(
        eq(schema.memberships.userId, userId),
        eq(schema.memberships.role, 'coach'),
        eq(schema.teams.status, 'live'),
      ),
    );
  for (const { communityId } of theirTeams) {
    const [other] = await db
      .select({ id: schema.users.id })
      .from(schema.memberships)
      .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
      .where(
        and(
          eq(schema.memberships.communityId, communityId),
          eq(schema.memberships.role, 'coach'),
          ne(schema.users.id, userId),
          eq(schema.users.status, 'active'),
          isNull(schema.users.deletedAt),
        ),
      )
      .limit(1);
    if (!other) return true;
  }
  return false;
};

/**
 * Communities `userIds` created pass to their longest-standing remaining member, so a private
 * community's join requests still have someone to approve them. With nobody left, the community
 * stays with its creator: hidden now, erased with them (`eraseDeletedAccounts`).
 */
const handOverCommunities = async (db: Db, userIds: string[]) => {
  const created = await db
    .select({ id: schema.communities.id })
    .from(schema.communities)
    .where(
      and(
        inArray(schema.communities.createdBy, userIds),
        inArray(schema.communities.kind, ['interest', 'medical']),
      ),
    );
  for (const { id } of created) {
    const [heir] = await db
      .select({ userId: schema.memberships.userId })
      .from(schema.memberships)
      .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
      .where(
        and(
          eq(schema.memberships.communityId, id),
          isNull(schema.users.deletedAt),
          // Not one of the people leaving (a list of one, or every account erased in a batch).
          ...userIds.map((u) => ne(schema.users.id, u)),
        ),
      )
      .orderBy(asc(schema.memberships.joinedAt))
      .limit(1);
    if (heir) {
      await db
        .update(schema.communities)
        .set({ createdBy: heir.userId })
        .where(eq(schema.communities.id, id));
    }
  }
};

/**
 * Deletes `userId`'s account: hidden at once, erased after 30 days. Staff accounts are closed by
 * Team Impact, and a team's only coach must hand over first. Returns why it can't, or null.
 */
export const deleteAccount = async (
  db: Db,
  userId: string,
  now = new Date(),
): Promise<DeletionRefusal | null> => {
  const [user] = await db
    .select({ userType: schema.users.userType, deletedAt: schema.users.deletedAt })
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  if (!user || user.deletedAt) return null; // already gone: deleting again changes nothing
  if (user.userType === 'staff') {
    return [403, 'Staff accounts are closed by Team Impact, not in the app'];
  }
  if (await isLastCoach(db, userId)) {
    return [409, 'You’re this team’s only coach. Ask Team Impact to add another coach first.'];
  }

  await db.transaction(async (tx) => {
    await tx.update(schema.users).set({ deletedAt: now }).where(eq(schema.users.id, userId));
    // Signed out everywhere, and no more pushes: these would otherwise last until the erase.
    await tx.delete(schema.authSessions).where(eq(schema.authSessions.userId, userId));
    await tx.delete(schema.deviceTokens).where(eq(schema.deviceTokens.userId, userId));
    await handOverCommunities(tx, [userId]);
  });
  return null;
};

export interface ErasureResult {
  /** How many accounts were erased. */
  count: number;
  /**
   * Storage keys of the files those accounts owned (photos, resumes, children's photos). Their
   * rows are gone; the files themselves are deleted by `deleteFiles`, once storage exists (#8).
   */
  storageKeys: string[];
}

/**
 * Erases every account deleted at least `days` before `now`, in one transaction, then hands the
 * files they owned to `deleteFiles`. Safe to run again, and on several instances at once: an
 * account already erased simply isn't found.
 */
export const eraseDeletedAccounts = async (
  db: Db,
  {
    now = new Date(),
    days = ERASE_AFTER_DAYS,
    deleteFiles,
  }: { now?: Date; days?: number; deleteFiles?: (keys: string[]) => Promise<void> } = {},
): Promise<ErasureResult> => {
  const cutoff = new Date(now.getTime() - days * DAY_MS);
  const result = await db.transaction(async (tx): Promise<ErasureResult> => {
    const due = await tx
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(isNotNull(schema.users.deletedAt), lte(schema.users.deletedAt, cutoff)));
    const ids = due.map((u) => u.id);
    if (ids.length === 0) return { count: 0, storageKeys: [] };

    const media = await tx
      .select({ key: schema.media.storageKey })
      .from(schema.media)
      .where(inArray(schema.media.ownerUserId, ids));
    const childPhotos = await tx
      .select({ key: schema.children.photoStorageKey })
      .from(schema.children)
      .where(
        and(inArray(schema.children.parentUserId, ids), isNotNull(schema.children.photoStorageKey)),
      );

    // On recruiters' lists the athlete becomes "profile withdrawn" (athlete_id goes null with the
    // erase), and what recruiters wrote about them goes: it is about the person being erased.
    const entries = await tx
      .update(schema.shortlistEntries)
      .set({ status: 'withdrawn' })
      .where(inArray(schema.shortlistEntries.athleteId, ids))
      .returning({ id: schema.shortlistEntries.id });
    if (entries.length) {
      await tx.delete(schema.shortlistNotes).where(
        inArray(
          schema.shortlistNotes.shortlistEntryId,
          entries.map((e) => e.id),
        ),
      );
    }

    // A community still theirs gets one last chance at an heir (someone may have joined since);
    // otherwise it is erased with them, posts and all.
    await handOverCommunities(tx, ids);
    await tx
      .delete(schema.communities)
      .where(
        and(
          inArray(schema.communities.createdBy, ids),
          inArray(schema.communities.kind, ['interest', 'medical']),
        ),
      );

    await tx.delete(schema.users).where(inArray(schema.users.id, ids));
    return {
      count: ids.length,
      storageKeys: [...media.map((m) => m.key), ...childPhotos.map((c) => c.key!)],
    };
  });
  // After the commit: a file deleted for a rolled-back erase couldn't be brought back.
  if (deleteFiles && result.storageKeys.length) await deleteFiles(result.storageKeys);
  return result;
};

/**
 * Erases due accounts on start-up, then daily, inside the API (no host scheduler needed), like
 * events-log retention. Returns a function that stops it.
 */
export const scheduleAccountErasure = (
  db: Db,
  { log, deleteFiles }: { log: FastifyBaseLogger; deleteFiles?: (keys: string[]) => Promise<void> },
): (() => void) => {
  const run = () =>
    eraseDeletedAccounts(db, { deleteFiles }).then(
      ({ count, storageKeys }) => {
        log.info({ count }, 'Erased deleted accounts');
        // Until uploads land there's no storage to delete from; say so rather than drop it silently.
        if (!deleteFiles && storageKeys.length) {
          log.warn(
            { count: storageKeys.length },
            'Erased accounts left files with no storage to delete',
          );
        }
      },
      (error: unknown) => log.error(error, 'Erasing deleted accounts failed'),
    );
  void run();
  const timer = setInterval(run, DAY_MS);
  timer.unref();
  return () => clearInterval(timer);
};
