import { IdParams, UPLOAD_LIMITS, UploadRequest, UploadResponse } from '@team-impact/contracts';
import type { FastifyRequest } from 'fastify';
import type { ZodApp } from '../../zod';
import { canViewUpload, completeUpload, receiveFile, startUpload } from '../uploads';
import type { MockWorld } from '../world';
import { httpError, type Guards } from './context';

/** Every type the upload contract accepts, read as raw bytes on the mock's signed URL. */
const FILE_TYPES = [...new Set(Object.values(UPLOAD_LIMITS).flatMap((l) => [...l.mimeTypes]))];
const MAX_BYTES = Math.max(...Object.values(UPLOAD_LIMITS).map((l) => l.maxBytes));

const origin = (request: FastifyRequest) => `${request.protocol}://${request.host}`;

/** Uploads (see ../uploads.ts): the real API's routes, with files kept in memory. */
export const registerUploadRoutes = (app: ZodApp, world: MockWorld, { viewer }: Guards) => {
  // The signed URL receives the file itself, not JSON.
  app.addContentTypeParser(
    FILE_TYPES,
    { parseAs: 'buffer', bodyLimit: MAX_BYTES },
    (_r, body, done) => done(null, body),
  );

  app.post(
    '/uploads',
    { schema: { body: UploadRequest, response: { 201: UploadResponse } } },
    async (request, reply) => {
      const u = viewer(request);
      const result = startUpload(world, u, request.body);
      if ('error' in result) throw httpError(result.status, result.error);
      return reply.status(201).send({
        mediaId: result.id,
        url: `${origin(request)}/mock-storage/${result.id}`,
        method: 'PUT' as const,
        headers: { 'content-type': result.mimeType },
        expiresAt: new Date(result.expiresAt).toISOString(),
      });
    },
  );

  // The mock's stand-in for a presigned bucket URL: the link itself is the permission.
  app.put('/mock-storage/:id', { schema: { params: IdParams } }, async (request, reply) => {
    const bytes = request.body;
    if (!Buffer.isBuffer(bytes)) throw httpError(415, 'Send the file itself');
    const error = receiveFile(world, request.params.id, request.headers['content-type'], bytes);
    if (error) throw httpError(error.status, error.error);
    return reply.status(200).send();
  });

  app.post('/uploads/:id/complete', { schema: { params: IdParams } }, async (request, reply) => {
    const u = viewer(request);
    const id = request.params.id;
    const error = completeUpload(world, u, id, `${origin(request)}/media/${id}`);
    if (error) throw httpError(error.status, error.error);
    return reply.status(204).send();
  });

  app.get('/media/:id', { schema: { params: IdParams } }, async (request, reply) => {
    const u = viewer(request);
    const upload = world.uploads.find((x) => x.id === request.params.id);
    // Pending and off-limits files look the same as missing ones.
    if (!upload?.bytes || !canViewUpload(world, u, upload)) throw httpError(404, 'File not found');
    return (
      reply
        .header('content-type', upload.mimeType)
        // Private: never cached by a shared cache, and only briefly by the browser.
        .header('cache-control', 'private, max-age=60')
        .send(upload.bytes)
    );
  });
};
