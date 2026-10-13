import { z } from 'zod';
import {
  CardExport,
  CardVersion,
  ConfirmResumeRequest,
  MyCardState,
  ResumeExtraction,
  ResumeUploadRequest,
  UpdateCardRequest,
} from '@team-impact/contracts';
import type { FastifyRequest } from 'fastify';
import type { ZodApp } from '../../zod';
import { cardOf, extractResume, historyFor, myCardState, publishCard } from '../profiles';
import type { MockWorld } from '../world';
import { httpError, type Guards } from './context';

/**
 * The athlete's own Baseball Card: draft, resume upload and review, publish, history, export.
 * Only card holders (current and alumni athletes) reach these, so parents can't make a card for
 * a child and teens never have one.
 */
export const registerCardRoutes = (app: ZodApp, world: MockWorld, { requireRole }: Guards) => {
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
    return myCardState(world, u);
  });

  app.get(
    '/cards/me/history',
    { schema: { response: { 200: z.array(CardVersion) } } },
    async (request) => historyFor(world, athlete(request)),
  );

  /**
   * Mock upload: the file name (and, for trying it out, the resume's text). The extraction waits
   * for review and touches neither the draft nor the card.
   */
  app.post(
    '/cards/me/resume',
    { schema: { body: ResumeUploadRequest, response: { 200: ResumeExtraction } } },
    async (request) => {
      const u = athlete(request);
      const extraction = extractResume(world, request.body.fileName, request.body.text, now());
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
    if (!card?.visibility.published) throw httpError(400, 'Publish your Baseball Card first');
    const face = world.cardFace(card);
    const slug = `${face.firstName}-${face.lastName}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
    return { face, fileName: `${slug}-baseball-card-${face.season}.png` };
  });
};
