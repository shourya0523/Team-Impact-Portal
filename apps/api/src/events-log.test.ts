import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ApiError,
  type Role,
  TRACKED_EVENT_NAMES,
  type TrackedEvent,
  type TrackedEventName,
} from '@team-impact/contracts';
import { buildApp } from './app';
import { eventsLog, users } from './db/schema';
import { pruneEventsLog, track } from './events-log';
import { createTestDb } from './test/db';

const ID = randomUUID();
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

let testDb: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  testDb = await createTestDb();
});
afterAll(() => testDb.close());
beforeEach(() => testDb.db.execute(sql`truncate users cascade`));

const addUser = async (role: Role = 'athlete') => {
  const [user] = await testDb.db
    .insert(users)
    .values({ email: `${randomUUID()}@example.com`, passwordHash: 'x', role })
    .returning({ id: users.id });
  return user!.id;
};

const loggedEvents = () => testDb.db.select().from(eventsLog);

/** One of every event. Typed by name, so a new event fails to compile until it has a sample. */
const samples = (subjectId: string): { [N in TrackedEventName]: TrackedEvent<N> } => ({
  signed_up: { name: 'signed_up', properties: { role: 'athlete' } },
  join_requested: {
    name: 'join_requested',
    properties: { joinRequestId: ID, teamId: ID, role: 'athlete' },
  },
  qr_joined: { name: 'qr_joined', properties: { teamId: ID, qrCodeId: ID } },
  card_published: { name: 'card_published', properties: { cardId: ID, season: 2026 } },
  post_created: {
    name: 'post_created',
    properties: { postId: ID, kind: 'post', audience: 'team' },
  },
  rsvp_set: { name: 'rsvp_set', properties: { calendarEventId: ID, status: 'going' } },
  search_run: {
    name: 'search_run',
    properties: { searchId: ID, surface: 'alumni', filters: ['college'], resultCount: 1 },
  },
  identity_search_run: {
    name: 'identity_search_run',
    properties: { searchId: ID, groupIds: [ID], filters: [], resultCount: 1 },
  },
  result_shown: { name: 'result_shown', subjectId, properties: { searchId: ID, position: 0 } },
  card_viewed: { name: 'card_viewed', subjectId, properties: { cardId: ID } },
  contact_viewed: { name: 'contact_viewed', subjectId, properties: { channel: 'email' } },
  saved_to_list: { name: 'saved_to_list', subjectId, properties: { listId: ID } },
});

describe('track', () => {
  it('logs every event with who did it, who it was about and its properties', async () => {
    const recruiter = await addUser('recruiter');
    const athlete = await addUser();
    const events = Object.values(samples(athlete));
    await track(testDb.db, recruiter, events);

    const rows = await loggedEvents();
    expect(rows.map((row) => row.name).sort()).toEqual([...TRACKED_EVENT_NAMES].sort());
    for (const event of events) {
      expect(rows.find((row) => row.name === event.name)).toMatchObject({
        userId: recruiter,
        subjectId: event.subjectId ?? null,
        properties: event.properties,
      });
    }
  });

  it('refuses properties the event doesn’t define and a missing subject', async () => {
    const athlete = await addUser();
    const withName = {
      name: 'card_published',
      properties: { cardId: ID, season: 2026, firstName: 'Maya' },
    } as TrackedEvent;
    await expect(track(testDb.db, athlete, withName)).rejects.toThrow();
    // @ts-expect-error card_viewed has to say whose card it was
    const noSubject: TrackedEvent = { name: 'card_viewed', properties: { cardId: ID } };
    await expect(track(testDb.db, athlete, noSubject)).rejects.toThrow('needs subjectId');
    expect(await loggedEvents()).toEqual([]);
  });

  it('rolls back with the action it records', async () => {
    const athlete = await addUser();
    const signup = samples(athlete).signed_up;
    await expect(
      testDb.db.transaction(async (tx) => {
        await track(tx, athlete, signup);
        tx.rollback();
      }),
    ).rejects.toThrow();
    expect(await loggedEvents()).toEqual([]);
  });
});

describe('POST /events', () => {
  const buildTestApp = () =>
    buildApp({
      sessionSecret: 'x'.repeat(32),
      corsOrigins: [],
      db: testDb.db,
      // Stands in for sessions until auth lands.
      currentUserId: async (request) => (request.headers['x-test-user'] as string) ?? null,
    });

  const send = async (userId: string | null, payload: object) => {
    const app = await buildTestApp();
    const headers = userId ? { 'x-test-user': userId } : {};
    const res = await app.inject({ method: 'POST', url: '/events', headers, payload });
    await app.close();
    return res;
  };

  it('logs a client event for the signed-in user', async () => {
    const recruiter = await addUser('recruiter');
    const athlete = await addUser();
    const res = await send(recruiter, samples(athlete).contact_viewed);
    expect(res.statusCode).toBe(204);
    expect(await loggedEvents()).toMatchObject([
      {
        name: 'contact_viewed',
        userId: recruiter,
        subjectId: athlete,
        properties: { channel: 'email' },
      },
    ]);
  });

  it('needs a signed-in user', async () => {
    const athlete = await addUser();
    const res = await send(null, samples(athlete).card_viewed);
    expect(res.statusCode).toBe(401);
    expect(ApiError.parse(res.json()).error.code).toBe('unauthenticated');
  });

  it('won’t take events only the API may log', async () => {
    const recruiter = await addUser('recruiter');
    const res = await send(recruiter, samples(recruiter).identity_search_run);
    expect(res.statusCode).toBe(400);
    expect(await loggedEvents()).toEqual([]);
  });

  it('refuses events about someone who doesn’t exist or deleted their account', async () => {
    const recruiter = await addUser('recruiter');
    const athlete = await addUser();
    await testDb.db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, athlete));
    for (const subject of [randomUUID(), athlete]) {
      const res = await send(recruiter, samples(subject).card_viewed);
      expect(res.statusCode).toBe(404);
    }
    expect(await loggedEvents()).toEqual([]);
  });
});

describe('deletion and retention', () => {
  it('deleting a user deletes what they did and what was shown about them', async () => {
    const recruiter = await addUser('recruiter');
    const athlete = await addUser();
    const other = await addUser();
    await track(testDb.db, recruiter, [samples(athlete).result_shown, samples(other).card_viewed]);
    await track(testDb.db, athlete, samples(athlete).card_published);

    await testDb.db.delete(users).where(eq(users.id, athlete));
    expect(await loggedEvents()).toMatchObject([
      { name: 'card_viewed', userId: recruiter, subjectId: other },
    ]);
  });

  it('prunes only events older than the retention period', async () => {
    const athlete = await addUser();
    const now = new Date();
    await testDb.db.insert(eventsLog).values(
      [400, 10].map((daysAgo) => ({
        name: 'card_viewed',
        userId: athlete,
        properties: { daysAgo },
        occurredAt: new Date(now.getTime() - daysAgo * DAY_MS),
      })),
    );
    expect(await pruneEventsLog(testDb.db, 365, now)).toBe(1);
    expect(await loggedEvents()).toMatchObject([{ properties: { daysAgo: 10 } }]);
  });
});

describe('pilot completion query', () => {
  it('reports the completion rate and time to first card for athletes', async () => {
    const start = new Date('2026-10-01T12:00:00Z').getTime();
    const at = (hours: number) => new Date(start + hours * HOUR_MS);
    const log = (userId: string, name: TrackedEventName, hours: number, properties = {}) =>
      testDb.db.insert(eventsLog).values({ name, userId, properties, occurredAt: at(hours) });

    const [fast, slow, unfinished, alumna] = await Promise.all([
      addUser(),
      addUser(),
      addUser(),
      addUser('alumni_athlete'),
    ]);
    const parent = await addUser('parent');
    for (const athlete of [fast!, slow!, unfinished!]) {
      await log(athlete, 'signed_up', 0, { role: 'athlete' });
    }
    await log(alumna!, 'signed_up', 24, { role: 'alumni_athlete' });
    await log(parent, 'signed_up', 0, { role: 'parent' });
    await log(fast!, 'card_published', 2);
    await log(fast!, 'card_published', 50); // A re-publish doesn't move the first card.
    await log(slow!, 'card_published', 10);
    await log(alumna!, 'card_published', 30);

    const query = await readFile(new URL('../sql/pilot-completion.sql', import.meta.url), 'utf8');
    const { rows } = await testDb.db.execute(sql.raw(query));
    const numbers = Object.fromEntries(
      Object.entries(rows[0] as Record<string, unknown>).map(([key, value]) => [
        key,
        Number(value),
      ]),
    );
    // First cards after 2, 10 and 6 hours; the parent isn't in the cohort.
    expect(numbers).toEqual({
      athletes: 4,
      completed: 3,
      completion_rate: 0.75,
      median_hours_to_first_card: 6,
      p90_hours_to_first_card: 9.2,
    });
  });
});
