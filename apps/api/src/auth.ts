import { and, eq, isNull } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Db } from './db/client';
import { users, type userType } from './db/schema';

export interface SessionUser {
  id: string;
  userType: (typeof userType.enumValues)[number];
}

export type Authenticate = (request: FastifyRequest) => Promise<SessionUser | null>;

/**
 * Stand-in until real sessions land: trusts an `x-dev-user-id` header naming an active user. It
 * never authenticates anyone in production, so routes behind it answer 401 there.
 */
export const devHeaderAuth =
  (db: Db, nodeEnv: string): Authenticate =>
  async (request) => {
    if (nodeEnv === 'production') return null;
    const id = z.uuid().safeParse(request.headers['x-dev-user-id']);
    if (!id.success) return null;
    const [user] = await db
      .select({ id: users.id, userType: users.userType })
      .from(users)
      .where(and(eq(users.id, id.data), eq(users.status, 'active'), isNull(users.deletedAt)));
    return user ?? null;
  };
