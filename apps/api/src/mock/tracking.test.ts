import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { id, USERS } from './fixtures';

let close: (() => Promise<void>) | undefined;
afterEach(() => close?.());

describe('mock API: tracking', () => {
  it('checks client events against the contract and the session, then drops them', async () => {
    const app = await buildApp({ sessionSecret: 'x'.repeat(32), corsOrigins: [], mock: true });
    close = () => app.close();
    const signIn = await app.inject({
      method: 'POST',
      url: '/auth/dev-sign-in',
      payload: { role: 'recruiter' },
    });
    const cookie = signIn.cookies[0]!;
    const post = (
      payload: object,
      cookies: Record<string, string> = { [cookie.name]: cookie.value },
    ) => app.inject({ method: 'POST', url: '/events', payload, cookies });

    const view = { name: 'card.viewed', properties: { cardId: id(1) }, subjectId: USERS.jordan.id };
    expect((await post(view)).statusCode).toBe(204);
    expect((await post(view, {})).statusCode).toBe(401);
    expect((await post({ ...view, name: 'search.identity_filter' })).statusCode).toBe(400);
  });
});
