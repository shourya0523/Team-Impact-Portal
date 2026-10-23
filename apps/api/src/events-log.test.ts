import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { eq, sql, TransactionRollbackError } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  type Role,
  TRACKED_EVENT_NAMES,
  type TrackedEvent,
} from '@team-impact/contracts';
import { buildApp } from './app';
import { eventsLog, users } from './db/schema';
import { eventRow, pruneEventsLog, scheduleEventsLogRetention, track } from './events-log';
import { createTestDb } from './test/db';
import { CLIENT_EVENTS, forgedBody, sampleEvents } from './test/events';

const ID = randomUUID();
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

let testDb: Awaited<ReturnType<typeof createTestDb>>;
// Booting PGlite and running the migrations can take a while on a busy CI runner.
beforeAll(async () => {
  testDb = await createTestDb();
}, 30_000);
afterAll(() => testDb.close());
beforeEach(() => testDb.db.execute(sql`truncate users cascade`));
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const addUser = async (userType: (typeof users.userType.enumValues)[number] = 'athlete') => {
  const [user] = await testDb.db
    .insert(users)
    .values({
      email: `${randomUUID()}@example.com`,
      passwordHash: 'x',
      firstName: 'Test',
      lastName: 'User',
      dob: '2004-05-06',
      userType,
    })
    .returning({ id: users.id });
  return user!.id;
};

const loggedEvents = () => testDb.db.select().from(eventsLog);

const samples = (subjectId: string) => sampleEvents(subjectId, ID);

/** Logs `event` as it happened at `occurredAt`, through the contract like `track()`. */
const logAt = (userId: string, event: TrackedEvent, occurredAt: Date) =>
  testDb.db.insert(eventsLog).values({ ...eventRow(userId, event), occurredAt });

describe('track', () => {
  it('logs every event with who did it, who it was about and its properties', async () => {
    const recruiter = await addUser('recruiter');
    const athlete = await addUser();
    const events = Object.values(samples(athlete));
    await track(testDb.db, recruiter, events);

    const rows = await loggedEvents();
    expect(rows.map((row) => row.event).sort()).toEqual([...TRACKED_EVENT_NAMES].sort());
    for (const event of events) {
      expect(rows.find((row) => row.event === event.name)).toMatchObject({
        userId: recruiter,
        subjectId: event.subjectId ?? null,
        properties: event.properties,
      });
    }
  });

  it('refuses properties the event doesn’t define and a missing subject', async () => {
    const athlete = await addUser();
    const withName = {
      name: 'card.published',
      properties: { cardId: ID, firstName: 'Maya' },
    } as TrackedEvent;
    await expect(track(testDb.db, athlete, withName)).rejects.toThrow();
    // @ts-expect-error card.viewed has to say whose card it was
    const noSubject: TrackedEvent = { name: 'card.viewed', properties: { cardId: ID } };
    await expect(track(testDb.db, athlete, noSubject)).rejects.toThrow('needs subjectId');
    expect(await loggedEvents()).toEqual([]);
  });

  it('refuses a subject on an event that isn’t about anyone', async () => {
    const athlete = await addUser();
    const published = samples(athlete)['card.published'];
    // @ts-expect-error card.published isn't about anyone
    const withSubject: TrackedEvent = { ...published, subjectId: athlete };
    await expect(track(testDb.db, athlete, withSubject)).rejects.toThrow('takes no subjectId');
    expect(await loggedEvents()).toEqual([]);
  });

  it('refuses an event name that isn’t in the contract', async () => {
    const athlete = await addUser();
    const invented = { name: 'card.liked', properties: { cardId: ID } } as unknown as TrackedEvent;
    await expect(track(testDb.db, athlete, invented)).rejects.toThrow();
    expect(await loggedEvents()).toEqual([]);
  });

  it('rolls back with the action it records', async () => {
    const athlete = await addUser();
    const signup = samples(athlete)['user.signed_up'];
    await expect(
      testDb.db.transaction(async (tx) => {
        await track(tx, athlete, signup);
        tx.rollback();
      }),
    ).rejects.toThrow(TransactionRollbackError);
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
    const res = await send(recruiter, samples(athlete)['contact.viewed']);
    expect(res.statusCode).toBe(204);
    expect(await loggedEvents()).toMatchObject([
      {
        event: 'contact.viewed',
        userId: recruiter,
        subjectId: athlete,
        properties: { channel: 'email' },
      },
    ]);
  });

  it('needs a signed-in user', async () => {
    const athlete = await addUser();
    const res = await send(null, samples(athlete)['card.viewed']);
    expect(res.statusCode).toBe(401);
    expect(ApiError.parse(res.json()).error.code).toBe('unauthenticated');
    expect(await loggedEvents()).toEqual([]);
  });

  it('takes card and contact views only, refusing every well-formed API event', async () => {
    const recruiter = await addUser('recruiter');
    const athlete = await addUser();
    for (const name of TRACKED_EVENT_NAMES) {
      const res = await send(recruiter, forgedBody(name, athlete));
      expect(res.statusCode, name).toBe(CLIENT_EVENTS.includes(name) ? 204 : 400);
    }
    const logged = (await loggedEvents()).map((row) => row.event);
    expect(logged.sort()).toEqual([...CLIENT_EVENTS].sort());
  });

  it('takes the user from the session and the time from the server, never the body', async () => {
    const recruiter = await addUser('recruiter');
    const other = await addUser('recruiter');
    const athlete = await addUser();
    const view = samples(athlete)['card.viewed'];
    const forgedAt = '2020-01-01T00:00:00.000Z';
    const before = Date.now();
    for (const forged of [
      { userId: other },
      { occurredAt: forgedAt },
      { user_id: other, occurred_at: forgedAt },
    ]) {
      const res = await send(recruiter, { ...view, ...forged });
      // Refusing the field and ignoring it both keep the client from setting it.
      expect([204, 400], JSON.stringify(forged)).toContain(res.statusCode);
    }
    expect((await send(recruiter, view)).statusCode).toBe(204);
    const after = Date.now();

    const rows = await loggedEvents();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.userId).toBe(recruiter);
      expect(row.occurredAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(row.occurredAt.getTime()).toBeLessThanOrEqual(after + 1000);
    }
  });

  it('refuses events about someone who doesn’t exist or deleted their account', async () => {
    const recruiter = await addUser('recruiter');
    const athlete = await addUser();
    await testDb.db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, athlete));
    for (const subject of [randomUUID(), athlete]) {
      const res = await send(recruiter, samples(subject)['card.viewed']);
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
    await track(testDb.db, recruiter, [
      samples(athlete)['search.result_shown'],
      samples(other)['card.viewed'],
    ]);
    await track(testDb.db, athlete, samples(athlete)['card.published']);

    await testDb.db.delete(users).where(eq(users.id, athlete));
    expect(await loggedEvents()).toMatchObject([
      { event: 'card.viewed', userId: recruiter, subjectId: other },
    ]);
  });

  it('prunes only events older than the retention period', async () => {
    const athlete = await addUser();
    const now = new Date();
    await testDb.db.insert(eventsLog).values(
      [400, 10].map((daysAgo) => ({
        event: 'card.viewed',
        userId: athlete,
        properties: { daysAgo },
        occurredAt: new Date(now.getTime() - daysAgo * DAY_MS),
      })),
    );
    expect(await pruneEventsLog(testDb.db, 365, now)).toBe(1);
    expect(await loggedEvents()).toMatchObject([{ properties: { daysAgo: 10 } }]);
  });
});

describe('retention schedule', () => {
  const fakeLog = () => {
    const log = { info: vi.fn(), error: vi.fn() };
    return { log, logger: log as unknown as FastifyBaseLogger };
  };

  /** How many days old each remaining event is, rounded to a tenth. */
  const ages = async (since: number) =>
    (await loggedEvents())
      .map((row) => Math.round(((since - row.occurredAt.getTime()) / DAY_MS) * 10) / 10)
      .sort((a, b) => a - b);

  it('prunes on start-up, then every 24 hours, until stopped', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    const start = Date.now();
    const athlete = await addUser();
    // Past retention now, in a day, in two days, and in three (after it's stopped).
    for (const daysAgo of [400, 364.5, 363.5, 362.5]) {
      const published = samples(athlete)['card.published'];
      await logAt(athlete, published, new Date(start - daysAgo * DAY_MS));
    }
    const { logger } = fakeLog();

    const stop = scheduleEventsLogRetention(testDb.db, { days: 365, log: logger });
    await vi.waitFor(async () => expect(await ages(start)).toEqual([362.5, 363.5, 364.5]));

    await vi.advanceTimersByTimeAsync(DAY_MS);
    await vi.waitFor(async () => expect(await ages(start)).toEqual([362.5, 363.5]));

    await vi.advanceTimersByTimeAsync(DAY_MS);
    await vi.waitFor(async () => expect(await ages(start)).toEqual([362.5]));

    stop();
    await vi.advanceTimersByTimeAsync(3 * DAY_MS);
    // Real time for a run that shouldn't have started to finish anyway.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await ages(start)).toEqual([362.5]);
  });

  it('logs a failed prune and keeps running', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    const start = Date.now();
    const athlete = await addUser();
    await logAt(athlete, samples(athlete)['card.published'], new Date(start - 400 * DAY_MS));
    vi.spyOn(testDb.db, 'delete').mockImplementationOnce(() => {
      throw new Error('connection reset');
    });
    const { log, logger } = fakeLog();

    const stop = scheduleEventsLogRetention(testDb.db, { days: 365, log: logger });
    await vi.waitFor(() => expect(log.error).toHaveBeenCalledTimes(1));
    expect(await loggedEvents()).toHaveLength(1);

    // The next day's run goes ahead and prunes what the failed one missed.
    await vi.advanceTimersByTimeAsync(DAY_MS);
    await vi.waitFor(async () => expect(await loggedEvents()).toEqual([]));
    expect(log.error).toHaveBeenCalledTimes(1);
    stop();
  });
});

describe('pilot completion query', () => {
  const start = new Date('2026-10-01T12:00:00Z').getTime();
  const at = (hours: number) => new Date(start + hours * HOUR_MS);
  const signedUp = (role: Role): TrackedEvent => ({ name: 'user.signed_up', properties: { role } });
  const published = (): TrackedEvent => ({
    name: 'card.published',
    properties: { cardId: randomUUID() },
  });

  const PILOT_WINDOW =
    "select '-infinity'::timestamptz as starts_at, 'infinity'::timestamptz as ends_at";

  /** The saved query, optionally with the `pilot` window set to [startsAt, endsAt). */
  const pilotQuery = async (window?: { startsAt: Date; endsAt: Date }) => {
    const query = await readFile(new URL('../sql/pilot-completion.sql', import.meta.url), 'utf8');
    if (!window) return query;
    expect(query, 'the pilot window this test sets').toContain(PILOT_WINDOW);
    return query.replace(
      PILOT_WINDOW,
      `select '${window.startsAt.toISOString()}'::timestamptz as starts_at, ` +
        `'${window.endsAt.toISOString()}'::timestamptz as ends_at`,
    );
  };

  /** Its one row, with numbers as numbers and nulls kept. */
  const report = async (query: string) => {
    const { rows } = await testDb.db.execute(sql.raw(query));
    expect(rows).toHaveLength(1);
    return Object.fromEntries(
      Object.entries(rows[0] as Record<string, unknown>).map(([key, value]) => [
        key,
        value === null ? null : Number(value),
      ]),
    );
  };

  it('reports the completion rate and time to first card for athletes', async () => {
    const [fast, slow, unfinished, alumna] = await Promise.all([
      addUser(),
      addUser(),
      addUser(),
      addUser('alumni'),
    ]);
    const parent = await addUser('parent');
    for (const athlete of [fast!, slow!, unfinished!]) {
      await logAt(athlete, signedUp('athlete'), at(0));
    }
    await logAt(alumna!, signedUp('alumni_athlete'), at(24));
    await logAt(parent, signedUp('parent'), at(0));
    await logAt(fast!, published(), at(2));
    await logAt(fast!, published(), at(50)); // A re-publish doesn't move the first card.
    await logAt(slow!, published(), at(10));
    await logAt(alumna!, published(), at(30));

    // First cards after 2, 10 and 6 hours; the parent isn't in the cohort.
    expect(await report(await pilotQuery())).toEqual({
      athletes: 4,
      completed: 3,
      completion_rate: 0.75,
      median_hours_to_first_card: 6,
      p90_hours_to_first_card: 9.2,
    });
  });

  it('answers with no athletes yet, without dividing by zero', async () => {
    const parent = await addUser('parent');
    await logAt(parent, signedUp('parent'), at(0));
    expect(await report(await pilotQuery())).toEqual({
      athletes: 0,
      completed: 0,
      completion_rate: null,
      median_hours_to_first_card: null,
      p90_hours_to_first_card: null,
    });
  });

  it('counts only athletes who signed up inside the pilot window', async () => {
    const [early, inside, waiting, late] = await Promise.all([
      addUser(),
      addUser(),
      addUser(),
      addUser(),
    ]);
    const days = (n: number) => at(n * 24);
    await logAt(early!, signedUp('athlete'), days(-5));
    await logAt(early!, published(), days(1));
    await logAt(inside!, signedUp('athlete'), days(3));
    await logAt(inside!, published(), at(3 * 24 + 4));
    await logAt(waiting!, signedUp('athlete'), days(10));
    await logAt(late!, signedUp('athlete'), days(35));
    await logAt(late!, published(), days(36));

    const query = await pilotQuery({ startsAt: days(0), endsAt: days(30) });
    expect(await report(query)).toEqual({
      athletes: 2,
      completed: 1,
      completion_rate: 0.5,
      median_hours_to_first_card: 4,
      p90_hours_to_first_card: 4,
    });
  });
});
