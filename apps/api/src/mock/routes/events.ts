import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  CalendarEvent,
  canCreateEventIn,
  EventAttendee,
  IdParams,
  NewEventRequest,
  RsvpRequest,
} from '@team-impact/contracts';
import type { ZodApp } from '../../zod';
import { holdForReview } from '../activity';
import { summaryOf } from '../fixtures';
import type { MockEvent } from '../fixtures';
import { hiddenFor } from '../safety';
import type { MockWorld } from '../world';
import { httpError, type Guards } from './context';
import { seenCommunity } from './posts';

/** Creating events (held for moderation), RSVPs, and the organizer's attendee list. */
export const registerEventRoutes = (app: ZodApp, world: MockWorld, { viewer }: Guards) => {
  /** An event the viewer can read: approved in a community they read, or their own held one. */
  const readableEvent = (request: FastifyRequest, eventId: string) => {
    const u = viewer(request);
    const e = world.events.find((x) => x.id === eventId);
    const c = e && world.communities.find((x) => x.id === e.communityId);
    if (!e || !c || !world.readsCommunity(c, u)) throw httpError(404, 'No such event');
    const visible =
      e.moderation === 'approved' || (e.moderation === 'in_review' && e.hostId === u.id);
    if (!visible || hiddenFor(world, u, { id: e.id, authorId: e.hostId })) {
      throw httpError(404, 'No such event');
    }
    return { u, e, c };
  };

  app.post(
    '/communities/:id/events',
    { schema: { params: IdParams, body: NewEventRequest, response: { 201: CalendarEvent } } },
    async (request, reply) => {
      const u = viewer(request);
      const c = seenCommunity(world, u, request.params.id);
      if (!world.readsCommunity(c, u) || !canCreateEventIn(u.role, world.community(c, u))) {
        throw httpError(403, 'You can’t create events in this community');
      }
      const { title, details, startsAt, endsAt, location } = request.body;
      const now = new Date().toISOString();
      const created: MockEvent = {
        id: world.newId(),
        title,
        details: details ?? null,
        startsAt,
        endsAt: endsAt ?? null,
        location,
        hostId: u.id,
        communityId: c.id,
        // The host is RSVP'd going.
        goingCount: 1,
        moderation: 'in_review',
        createdAt: now,
      };
      world.events.push(created);
      world.rsvps.push({ eventId: created.id, userId: u.id, status: 'going', respondedAt: now });
      holdForReview(world, { kind: 'event', id: created.id }, `${title} · ${location}`);
      return reply.status(201).send(world.calendarEvent(created, c, u));
    },
  );

  app.get(
    '/events/:id',
    { schema: { params: IdParams, response: { 200: CalendarEvent } } },
    async (request) => {
      const { u, e, c } = readableEvent(request, request.params.id);
      return world.calendarEvent(e, c, u);
    },
  );

  app.put(
    '/events/:id/rsvp',
    { schema: { params: IdParams, body: RsvpRequest, response: { 200: CalendarEvent } } },
    async (request) => {
      const { u, e, c } = readableEvent(request, request.params.id);
      if (e.moderation !== 'approved') throw httpError(409, 'This event is waiting for review');
      const status = request.body.status;
      const mine = world.rsvps.find((r) => r.eventId === e.id && r.userId === u.id);
      const wasGoing = mine?.status === 'going';
      if (mine) {
        mine.status = status;
        mine.respondedAt = new Date().toISOString();
      } else {
        world.rsvps.push({
          eventId: e.id,
          userId: u.id,
          status,
          respondedAt: new Date().toISOString(),
        });
      }
      e.goingCount = Math.max(0, e.goingCount + Number(status === 'going') - Number(wasGoing));
      return world.calendarEvent(e, c, u);
    },
  );

  app.get(
    '/events/:id/rsvps',
    { schema: { params: IdParams, response: { 200: z.array(EventAttendee) } } },
    async (request) => {
      const { u, e, c } = readableEvent(request, request.params.id);
      if (e.hostId !== u.id) throw httpError(403, 'Only the organizer sees who’s coming');
      return (
        world.rsvps
          .filter((r) => r.eventId === e.id)
          .map((r) => ({ r, who: world.user(r.userId)! }))
          // A teen's name never appears outside their team (CLAUDE.md): outside a team
          // community their RSVP counts, but the organizer doesn't see who it is.
          .filter(({ who }) => who.role !== 'teen' || c.kind === 'team')
          .sort((a, b) => a.r.respondedAt.localeCompare(b.r.respondedAt))
          .map(({ r, who }) => ({
            user: summaryOf(who),
            status: r.status,
            respondedAt: r.respondedAt,
          }))
      );
    },
  );
};
