import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { IdParams, UploadRequest, UploadResponse } from '@team-impact/contracts';
import type { Authenticate, SessionUser } from '../auth';
import type { Db } from '../db/client';
import { children, communities, media, memberships } from '../db/schema';
import type { Storage } from '../storage';
import type { ZodTypeProvider } from '../zod';

const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const READ_URL_TTL_SECONDS = 60;

export interface MediaRoutesOptions {
  db: Db;
  storage: Storage;
  authenticate: Authenticate;
}

type MediaRow = typeof media.$inferSelect;

/** Fastify's error handler (src/zod.ts) turns `statusCode` into the shared error shape. */
const httpError = (statusCode: number, message: string) =>
  Object.assign(new Error(message), { statusCode });

/**
 * The one upload path (TI-111): ask for a signed URL, PUT the file to the private bucket, confirm.
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
    const [member] = await db
      .select({ id: memberships.id })
      .from(memberships)
      // Only a team community has a team_id (a check constraint), so this is the child's team.
      .innerJoin(communities, eq(communities.id, memberships.communityId))
      .where(and(eq(communities.teamId, child.teamId), eq(memberships.userId, user.id)))
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

    if (row.status === 'pending') {
      if (!(await storage.head(row.storageKey))) {
        throw httpError(409, 'The file has not been uploaded yet');
      }
      await db.transaction(async (tx) => {
        await tx.update(media).set({ status: 'ready' }).where(eq(media.id, row.id));
        if (row.childId) {
          await tx
            .update(children)
            .set({ photoMediaId: row.id })
            .where(eq(children.id, row.childId));
        }
      });
    }
    return reply.code(204).send();
  });

  app.get('/media/:id', { schema: { params: IdParams } }, async (request, reply) => {
    const user = await currentUser(request);
    const row = await findMedia(request.params.id);
    // Pending, taken-down and off-limits files all look the same as missing ones.
    if (!row || row.status !== 'ready' || !(await canView(user, row))) {
      throw httpError(404, 'File not found');
    }
    const url = await storage.presignGet(row.storageKey, READ_URL_TTL_SECONDS);
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

      if (row.status !== 'taken_down') {
        await db.transaction(async (tx) => {
          await tx
            .update(media)
            .set({ status: 'taken_down', takenDownAt: new Date() })
            .where(eq(media.id, row.id));
          await tx
            .update(children)
            .set({ photoMediaId: null })
            .where(eq(children.photoMediaId, row.id));
        });
      }
      // Always delete, so retrying a takedown whose delete failed still removes the file.
      await storage.delete(row.storageKey);
      return reply.code(204).send();
    },
  );
};
