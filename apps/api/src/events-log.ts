import { and, eq, isNull, lt } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import { TRACKED_EVENTS, type TrackedEvent } from '@team-impact/contracts';
import type { Db } from './db/client';
import { eventsLog, users } from './db/schema';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Logs events done by `userId`. Pass the route's transaction when it has one, so the event
 * commits or rolls back with the action it records. Properties are parsed against the contract,
 * so a spread object can't slip in a field the event doesn't define.
 */
export const track = async (
  db: Db,
  userId: string,
  events: TrackedEvent | readonly TrackedEvent[],
): Promise<void> => {
  const list: readonly TrackedEvent[] = 'name' in events ? [events] : events;
  if (list.length === 0) return;
  await db.insert(eventsLog).values(
    list.map((event) => {
      const definition = TRACKED_EVENTS[event.name];
      if (definition.subject !== (event.subjectId !== undefined)) {
        throw new Error(`${event.name} ${definition.subject ? 'needs' : 'takes no'} subjectId`);
      }
      return {
        name: event.name,
        userId,
        subjectId: event.subjectId ?? null,
        properties: definition.properties.parse(event.properties),
      };
    }),
  );
};

/** A client event's subject must still be someone; late events about deleted users are refused. */
export const isActiveUser = async (db: Db, id: string): Promise<boolean> => {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)));
  return row !== undefined;
};

/** Deletes events older than `days` before `now`, returning how many went. */
export const pruneEventsLog = async (db: Db, days: number, now = new Date()): Promise<number> => {
  const cutoff = new Date(now.getTime() - days * DAY_MS);
  const deleted = await db
    .delete(eventsLog)
    .where(lt(eventsLog.occurredAt, cutoff))
    .returning({ id: eventsLog.id });
  return deleted.length;
};

/**
 * Enforces retention: prunes on start-up, then daily. It runs inside the API so it needs no
 * scheduler from the host; with several instances each one prunes, which is harmless. Returns a
 * function that stops it.
 */
export const scheduleEventsLogRetention = (
  db: Db,
  { days, log }: { days: number; log: FastifyBaseLogger },
): (() => void) => {
  const run = () =>
    pruneEventsLog(db, days).then(
      (count) => log.info({ count, days }, 'Pruned events_log'),
      (error: unknown) => log.error(error, 'Pruning events_log failed'),
    );
  void run();
  const timer = setInterval(run, DAY_MS);
  timer.unref();
  return () => clearInterval(timer);
};
