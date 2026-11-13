import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { IdParams, UploadRequest, UploadResponse } from '@team-impact/contracts';
import type { Db } from '../db/client';
import { children, communities, media, memberships } from '../db/schema';
import type { Authenticate, SessionUser } from '../identity/session';
import type { Storage } from '../storage';
import { matchesSignature, SIGNATURE_BYTES } from '../storage/sniff';
import { httpError, type ZodTypeProvider } from '../zod';

const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const READ_URL_TTL_SECONDS = 60;

export interface MediaRoutesOptions {
  db: Db;
  storage: Storage;
  /** The real session check (identity/session.ts). */
  authenticate: Authenticate;
}

type MediaRow = typeof media.$inferSelect;

/** `image/JPEG; charset=…` and `image/jpeg` are the same type. */
const baseType = (contentType: string | undefined) =>
  contentType?.split(';')[0]?.trim().toLowerCase();

/**
 * The one upload path (TI-111): ask for a signed URL, PUT the file to the private bucket, confirm.
 * Confirming copies the file to its final key and checks the copy; only that copy is ever served.
 * Reads go through GET /media/:id, the access layer, which hands out a short-lived signed URL.
 */
export const mediaRoutes = async (
  instance: FastifyInstance,
  { db, storage, authenticate }: MediaRoutesOptions,
) => {
  const app = instance.withTypeProvider<ZodTypeProvider>();

  const currentUser = async (request: FastifyRequest) => {
    const user = await authenticate(request);
    if (!user) throw httpError(401, 'Sign in first');
    return user;
  };

  const findMedia = async (id: string) => {
    const [row] = await db.select().from(media).where(eq(media.id, id));
    return row;
  };

  // Child photos are visible only to the child's team and family (PRD §2, §6). Everything else is
  // owner-only until the feature that shows it adds its own rule.
  const canView = async (user: SessionUser, row: MediaRow) => {
    if (row.purpose !== 'child_photo') return row.ownerUserId === user.id;
    if (!row.childId) return false;
    const [child] = await db
      .select({ parentUserId: children.parentUserId, teamId: children.teamId })
      .from(children)
      .where(eq(children.id, row.childId));
    if (!child) return false;
    if (child.parentUserId === user.id) return true;
    if (!child.teamId) return false;
    // On the team: a member of the child's team community, any season.
    const [member] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .innerJoin(communities, eq(communities.id, memberships.communityId))
      .where(
        and(
          eq(communities.kind, 'team'),
          eq(communities.teamId, child.teamId),
          eq(memberships.userId, user.id),
        ),
      )
      .limit(1);
    return Boolean(member);
  };

  app.post(
    '/uploads',
    { schema: { body: UploadRequest, response: { 201: UploadResponse } } },
    async (request, reply) => {
      const user = await currentUser(request);
      const body = request.body;

      const childId = body.purpose === 'child_photo' ? body.childId : null;
      if (childId) {
        const [child] = await db
          .select({ id: children.id })
          .from(children)
          .where(and(eq(children.id, childId), eq(children.parentUserId, user.id)));
        if (!child) throw httpError(403, "Only the child's parent can upload their photo");
      }

      const id = randomUUID();
      const storageKey = `${body.purpose}/${id}`;
      await db.insert(media).values({
        id,
        ownerUserId: user.id,
        purpose: body.purpose,
        childId,
        storageKey,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        rightsAffirmedAt: 'rightsAffirmed' in body ? new Date() : null,
      });

      const { url, headers } = await storage.presignPut(
        storageKey,
        { contentType: body.mimeType, byteSize: body.sizeBytes },
        UPLOAD_URL_TTL_SECONDS,
      );
      return reply.code(201).send({
        mediaId: id,
        url,
        method: 'PUT',
        headers,
        expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000).toISOString(),
      });
    },
  );

  app.post('/uploads/:id/complete', { schema: { params: IdParams } }, async (request, reply) => {
    const user = await currentUser(request);
    const row = await findMedia(request.params.id);
    if (!row || row.ownerUserId !== user.id || row.status === 'taken_down') {
      throw httpError(404, 'Upload not found');
    }

    // Already complete: nothing is copied again and the final key stays as it is.
    if (row.status === 'ready') return reply.code(204).send();

    // The signed PUT URL for storage_key stays valid for minutes after this, so the bytes there can
    // still change. Copy them to a fresh key no signed URL ever pointed at, check the copy, and
    // serve only the copy: what was checked is exactly what is served.
    const finalKey = `files/${row.purpose}/${row.id}/${randomUUID()}`;
    if (!(await storage.copy(row.storageKey, finalKey))) {
      throw httpError(409, 'The file has not been uploaded yet');
    }
    // The signed PUT pins type and size, but check what actually landed before trusting it, and
    // that its bytes really are the type it claims. Anything else is deleted (both copies); the
    // upload stays pending, so the client may PUT again while the signed URL lasts.
    const object = await storage.head(finalKey);
    const firstBytes =
      object && object.byteSize > 0 ? await storage.readStart(finalKey, SIGNATURE_BYTES) : null;
    if (
      !object ||
      baseType(object.contentType) !== row.mimeType ||
      object.byteSize !== row.sizeBytes ||
      !firstBytes ||
      !matchesSignature(row.mimeType, firstBytes)
    ) {
      await Promise.all([storage.delete(finalKey), storage.delete(row.storageKey)]);
      throw httpError(400, 'The uploaded file isn’t the file that was signed for');
    }

    // Only a still-pending upload takes the key, so a concurrent completion can't replace it.
    const completed = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(media)
        .set({ status: 'ready', finalKey })
        .where(and(eq(media.id, row.id), eq(media.status, 'pending')))
        .returning({ id: media.id });
      if (!updated) return false;
      if (row.childId) {
        await tx.update(children).set({ photoMediaId: row.id }).where(eq(children.id, row.childId));
      }
      return true;
    });
    if (!completed) {
      // Another request completed it (or staff took it down) first: drop this copy, keep theirs.
      await storage.delete(finalKey);
      const now = await findMedia(row.id);
      if (now?.status !== 'ready') throw httpError(404, 'Upload not found');
      return reply.code(204).send();
    }

    // The upload object is no longer needed. If deleting it fails the upload is still complete;
    // account erasure deletes storage_key too, so nothing is left behind for good.
    try {
      await storage.delete(row.storageKey);
    } catch (error) {
      request.log.warn({ err: error, mediaId: row.id }, 'Could not delete the upload object');
    }
    return reply.code(204).send();
  });

  app.get('/media/:id', { schema: { params: IdParams } }, async (request, reply) => {
    const user = await currentUser(request);
    const row = await findMedia(request.params.id);
    // Pending, taken-down and off-limits files all look the same as missing ones.
    if (!row || row.status !== 'ready' || !row.finalKey || !(await canView(user, row))) {
      throw httpError(404, 'File not found');
    }
    // Always the checked copy, never the upload key a signed PUT may still write to.
    const url = await storage.presignGet(row.finalKey, READ_URL_TTL_SECONDS);
    return reply.redirect(url, 302);
  });

  app.post(
    '/staff/media/:id/takedown',
    { schema: { params: IdParams } },
    async (request, reply) => {
      const user = await currentUser(request);
      if (user.userType !== 'staff') throw httpError(403, 'Not available for your role');
      const row = await findMedia(request.params.id);
      if (!row) throw httpError(404, 'File not found');

      // The final key as the update sees it, in case a completion landed since the read above.
      let finalKey = row.finalKey;
      if (row.status !== 'taken_down') {
        finalKey = await db.transaction(async (tx) => {
          const [updated] = await tx
            .update(media)
            .set({ status: 'taken_down', takenDownAt: new Date() })
            .where(eq(media.id, row.id))
            .returning({ finalKey: media.finalKey });
          await tx
            .update(children)
            .set({ photoMediaId: null })
            .where(eq(children.photoMediaId, row.id));
          return updated?.finalKey ?? null;
        });
      }
      // Always delete, so retrying a takedown whose delete failed still removes the file. Both
      // keys: the served copy, and the upload object a signed PUT may have written again.
      await Promise.all([
        storage.delete(row.storageKey),
        ...(finalKey ? [storage.delete(finalKey)] : []),
      ]);
      return reply.code(204).send();
    },
  );
};
