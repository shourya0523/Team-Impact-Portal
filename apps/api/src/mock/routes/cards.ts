import { z } from 'zod';
import {
  CardExport,
  CardVersion,
  ConfirmResumeRequest,
  MyCardState,
  RESUME_UPLOAD_LIMITS,
  ResumeExtraction,
  ResumeUploadRequest,
  UpdateCardRequest,
} from '@team-impact/contracts';
import type { FastifyRequest } from 'fastify';
import { readResume, type ResumeReaderConfig } from '../../resume';
import type { ZodApp } from '../../zod';
import {
  cardOf,
  extractionFromReading,
  extractResume,
  historyFor,
  myCardState,
  publishCard,
  unpublishCard,
} from '../profiles';
import type { MockWorld } from '../world';
import { httpError, type Guards } from './context';

/**
 * The athlete's own Impact Card: draft, resume upload and review, publish, history, export.
 * Only card holders (current and alumni athletes) reach these, so parents can't make a card for
 * a child and teens never have one.
 */
export const registerCardRoutes = (
  app: ZodApp,
  world: MockWorld,
  { requireRole }: Guards,
  resume: ResumeReaderConfig = {},
) => {
  const athlete = (request: FastifyRequest) => requireRole(request, 'athlete', 'alumni_athlete');
  const now = () => new Date().toISOString();

  app.get('/cards/me', { schema: { response: { 200: MyCardState } } }, async (request) =>
    myCardState(world, athlete(request)),
  );

  /** Saves unpublished edits. Nobody else sees them until the athlete publishes. */
  app.put(
    '/cards/me',
    { schema: { body: UpdateCardRequest, response: { 200: MyCardState } } },
    async (request) => {
      const u = athlete(request);
      const draft = { ...world.profiles.drafts.get(u.id), ...request.body };
      world.profiles.drafts.set(u.id, draft);
      return myCardState(world, u);
    },
  );

  app.post('/cards/me/publish', { schema: { response: { 200: MyCardState } } }, async (request) => {
    const u = athlete(request);
    const problem = publishCard(world, u, now());
    if (problem) throw httpError(400, problem);
    const card = cardOf(world, u.id)!;
    world.track(u.id, { name: 'card.published', properties: { cardId: card.face.id } });
    return myCardState(world, u);
  });

  /** Hides the card from everyone else at once, recruiter search included. Edits are kept. */
  app.post(
    '/cards/me/unpublish',
    { schema: { response: { 200: MyCardState } } },
    async (request) => {
      const u = athlete(request);
      const problem = unpublishCard(world, u, now());
      if (problem) throw httpError(400, problem);
      return myCardState(world, u);
    },
  );

  app.get(
    '/cards/me/history',
    { schema: { response: { 200: z.array(CardVersion) } } },
    async (request) => historyFor(world, athlete(request)),
  );

  /**
   * Resume upload (TI-113). With `fileBase64` the real reader runs (src/resume): the bytes stay in
   * memory and are dropped when the request ends, so the raw file is never stored. Without a file,
   * the mock reads the pasted text (or a sample) for trying the flow. Either way the extraction
   * waits for review and touches neither the draft nor the card.
   */
  app.post(
    '/cards/me/resume',
    {
      // The JSON body carries the file as base64 (4/3 of 5 MB, plus the other fields).
      bodyLimit: 8 * 1024 * 1024,
      schema: { body: ResumeUploadRequest, response: { 200: ResumeExtraction } },
    },
    async (request) => {
      const u = athlete(request);
      const { fileName, mimeType, fileBase64, text } = request.body;
      let extraction: ResumeExtraction;
      if (fileBase64) {
        const bytes = Buffer.from(fileBase64, 'base64');
        if (bytes.byteLength > RESUME_UPLOAD_LIMITS.maxBytes) {
          throw httpError(
            400,
            `Resumes can be up to ${RESUME_UPLOAD_LIMITS.maxBytes / 2 ** 20} MB`,
          );
        }
        const reading = await readResume({ bytes, mimeType, fileName }, resume);
        if (reading.reason === 'wrong_file_type') {
          throw httpError(400, 'That file doesn’t match its type. Upload a PDF or a photo.');
        }
        if (reading.reason === 'too_many_pages') {
          throw httpError(400, `Resumes can be up to ${RESUME_UPLOAD_LIMITS.maxPages} pages`);
        }
        extraction = extractionFromReading(world, reading, fileName, now());
      } else {
        extraction = extractResume(world, fileName, text, now());
      }
      world.profiles.resumes.set(u.id, extraction);
      return extraction;
    },
  );

  /** The athlete's accepted (and corrected) fields go into the draft; the rest are dropped. */
  app.post(
    '/cards/me/resume/confirm',
    { schema: { body: ConfirmResumeRequest, response: { 200: MyCardState } } },
    async (request) => {
      const u = athlete(request);
      const pending = world.profiles.resumes.get(u.id);
      if (!pending || pending.id !== request.body.draftId) {
        throw httpError(404, 'No resume waiting for review');
      }
      world.profiles.resumes.delete(u.id);
      world.profiles.drafts.set(u.id, {
        ...world.profiles.drafts.get(u.id),
        ...request.body.fields,
      });
      return myCardState(world, u);
    },
  );

  app.post(
    '/cards/me/resume/discard',
    { schema: { response: { 200: MyCardState } } },
    async (request) => {
      const u = athlete(request);
      world.profiles.resumes.delete(u.id);
      return myCardState(world, u);
    },
  );

  /**
   * The face a PNG export may draw. Published cards of athletes only: children and teens have no
   * card, so their profiles never end up in an export. No contact details.
   */
  app.post('/cards/me/export', { schema: { response: { 200: CardExport } } }, async (request) => {
    const u = athlete(request);
    const card = cardOf(world, u.id);
    if (!card?.visibility.published) throw httpError(400, 'Publish your Impact Card first');
    const face = world.cardFace(card);
    const slug = `${face.firstName}-${face.lastName}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
    return { face, fileName: `${slug}-impact-card-${face.season}.png` };
  });
};
