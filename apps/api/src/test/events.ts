import { randomUUID } from 'node:crypto';
import type { TrackedEvent, TrackedEventName } from '@team-impact/contracts';

/**
 * The only events a client may send through `POST /events`. Written out rather than read from
 * the catalog, so marking another event `client` fails a test instead of quietly opening the
 * route to it.
 */
export const CLIENT_EVENTS: readonly TrackedEventName[] = ['card.viewed', 'contact.viewed'];

/**
 * One valid instance of every event, with `subjectId` as the person it's about. Typed by name, so
 * a new event fails to compile until it has a sample.
 */
export const sampleEvents = (
  subjectId: string,
  id: string = randomUUID(),
): { [N in TrackedEventName]: TrackedEvent<N> } => ({
  'user.signed_up': { name: 'user.signed_up', properties: { role: 'athlete' } },
  'team.created': { name: 'team.created', properties: { teamId: id } },
  'team.updated': { name: 'team.updated', properties: { teamId: id, fields: ['color'] } },
  'coach.invited': { name: 'coach.invited', properties: { teamId: id, inviteId: id } },
  'coach.added': { name: 'coach.added', subjectId, properties: { teamId: id, via: 'invite' } },
  'community.marked_official': {
    name: 'community.marked_official',
    properties: { communityId: id },
  },
  'join_request.created': {
    name: 'join_request.created',
    properties: { joinRequestId: id, teamId: id, role: 'athlete' },
  },
  'qr_code.redeemed': { name: 'qr_code.redeemed', properties: { teamId: id, qrCodeId: id } },
  'card.published': { name: 'card.published', properties: { cardId: id } },
  'post.created': { name: 'post.created', properties: { postId: id, kind: 'post' } },
  'rsvp.set': { name: 'rsvp.set', properties: { calendarEventId: id, status: 'going' } },
  'search.run': {
    name: 'search.run',
    properties: { searchId: id, surface: 'alumni', filters: ['college'], resultCount: 1 },
  },
  'search.identity_filter': {
    name: 'search.identity_filter',
    properties: {
      searchId: id,
      communityId: id,
      companyId: id,
      filters: ['sport', 'division'],
      resultCount: 1,
    },
  },
  'search.result_shown': {
    name: 'search.result_shown',
    subjectId,
    properties: { searchId: id, position: 0 },
  },
  'card.viewed': { name: 'card.viewed', subjectId, properties: { cardId: id } },
  'contact.viewed': { name: 'contact.viewed', subjectId, properties: { channel: 'email' } },
  'list.athlete_saved': { name: 'list.athlete_saved', subjectId, properties: { listId: id } },
});

/**
 * The body a client would send to forge `name`: its valid properties, plus a real `subjectId`
 * even when the event has none, so a refusal can only be about the name.
 */
export const forgedBody = (name: TrackedEventName, subjectId: string) => ({
  ...sampleEvents(subjectId)[name],
  subjectId,
});
