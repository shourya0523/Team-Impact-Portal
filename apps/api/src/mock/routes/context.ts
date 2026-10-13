import type { FastifyRequest } from 'fastify';
import type { Role } from '@team-impact/contracts';
import type { MockUser, MockWorld } from '../world';

export const SESSION_COOKIE = 'ti_session';

/** Fastify's error handler (src/zod.ts) turns `statusCode` into the shared error shape. */
export const httpError = (statusCode: number, message: string) =>
  Object.assign(new Error(message), { statusCode });

/** Cursor pagination over an in-memory array: the cursor is the next offset. */
export const paginate = <T>(
  items: T[],
  { cursor, limit = 20 }: { cursor?: string; limit?: number },
) => {
  const start = Number(cursor ?? 0);
  const next = start + limit;
  return {
    items: items.slice(start, next),
    nextCursor: next < items.length ? String(next) : null,
  };
};

/** Who's asking, from the signed session cookie, and a role check on top. */
export const guards = (world: MockWorld) => {
  const viewer = (request: FastifyRequest): MockUser => {
    const raw = request.cookies[SESSION_COOKIE];
    const unsigned = raw ? request.unsignCookie(raw) : null;
    const u = unsigned?.valid && unsigned.value ? world.user(unsigned.value) : undefined;
    if (!u) throw httpError(401, 'Sign in first');
    // A suspended company's recruiters are locked out until staff restore it (PRD §9).
    const company = u.companyId && world.companies.find((c) => c.id === u.companyId);
    if (company && company.status === 'suspended') {
      throw httpError(403, 'Your company’s access is suspended. Contact Team Impact.');
    }
    return u;
  };

  const requireRole = (request: FastifyRequest, ...roles: Role[]) => {
    const u = viewer(request);
    if (!roles.includes(u.role)) throw httpError(403, 'Not available for your role');
    return u;
  };

  return { viewer, requireRole };
};
export type Guards = ReturnType<typeof guards>;
