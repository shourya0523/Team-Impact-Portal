// =============================================================================================
// "Who is making this request?" for every real (non-mock) route.
//
// `Authenticate` is the seam the rest of the API uses. It has the same shape as the stand-in in the
// uploads PR (#8, `devHeaderAuth`), so routes written against that work unchanged once they use
// this instead: a signed-in, allowed account, or null (answer 401).
//
// The session comes from Better Auth (cookie in browsers, the Expo app's stored cookie on phones),
// then the account is re-checked against the database, so a suspension, a deletion or a recruiter's
// company being suspended takes effect on the very next request. A blocked account's sessions are
// deleted there and then, so Better Auth's own endpoints (get-session) agree it is signed out.
// =============================================================================================
import { fromNodeHeaders } from 'better-auth/node';
import { eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { Db } from '../db/client';
import * as schema from '../db/schema';
import { type Auth, signInBlock } from './auth';
import type { AccountType } from './signup-rules';

export interface SessionUser {
  id: string;
  userType: AccountType;
}

export type Authenticate = (request: FastifyRequest) => Promise<SessionUser | null>;

export const sessionAuth =
  (auth: Auth, db: Db): Authenticate =>
  async (request) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session) return null;

    const [row] = await db
      .select({
        status: schema.users.status,
        deletedAt: schema.users.deletedAt,
        userType: schema.users.userType,
        orgStatus: schema.orgs.status,
      })
      .from(schema.users)
      .leftJoin(schema.orgs, eq(schema.orgs.id, schema.users.orgId))
      .where(eq(schema.users.id, session.user.id));
    if (signInBlock(row)) {
      await db.delete(schema.authSessions).where(eq(schema.authSessions.userId, session.user.id));
      return null;
    }

    return { id: session.user.id, userType: row!.userType };
  };
