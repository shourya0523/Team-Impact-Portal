import type { MockWorld } from './world';

/**
 * One row of the audit trail, shaped like the `events_log` table: who did what, when. Properties
 * name records by id; never put a token, hash or anything secret in them.
 */
export interface MockLogEntry {
  id: string;
  /** Who did it; null when the system noticed it (an invite found expired). */
  userId: string | null;
  event: string;
  properties: Record<string, unknown>;
  occurredAt: string;
}

export const logEvent = (
  world: MockWorld,
  userId: string | null,
  event: string,
  properties: Record<string, unknown>,
  occurredAt = new Date().toISOString(),
) => {
  world.eventLog.push({ id: world.newId(), userId, event, properties, occurredAt });
};
