// =============================================================================================
// Mounts Better Auth's endpoints on Fastify at /api/auth/* (sign-up, sign-in, sign-out, verify
// email, reset password, get session, …), following Better Auth's Fastify guide: each request is
// turned into a standard Fetch `Request`, handed to Better Auth, and its `Response` copied back.
//
// Our own routes don't go through here: they call `authenticate` (session.ts) to learn who is
// signed in. The mock API's GET /me keeps serving the full profile until the real one is built.
// =============================================================================================
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Auth } from './auth';

const toFetchRequest = (request: FastifyRequest) => {
  const url = new URL(request.url, `${request.protocol}://${request.host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD' && request.body != null;
  return new Request(url, {
    method: request.method,
    headers,
    body: hasBody ? JSON.stringify(request.body) : undefined,
  });
};

const sendFetchResponse = async (response: Response, reply: FastifyReply) => {
  reply.status(response.status);
  response.headers.forEach((value, key) => {
    // Set-Cookie can repeat; Headers#forEach would merge them into one invalid header.
    if (key !== 'set-cookie') reply.header(key, value);
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) reply.header('set-cookie', cookies);
  return reply.send(response.body ? Buffer.from(await response.arrayBuffer()) : null);
};

export const registerAuthRoutes = (app: FastifyInstance, auth: Auth) => {
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    handler: async (request, reply) =>
      sendFetchResponse(await auth.handler(toFetchRequest(request)), reply),
  });
};
