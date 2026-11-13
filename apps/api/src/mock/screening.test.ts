import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModerationTicket, Role } from '@team-impact/contracts';
import { buildApp } from '../app';
import type { Screen } from '../moderation';
import { id } from './fixtures';

const TEAM = id(301);
const TEAM_IMPACT = id(302);
const COACH_POST = id(401); // approved, in the team community

let close: (() => Promise<void>) | undefined;
afterEach(() => close?.());

/** Holds anything saying "rude", blocks anything saying "threat", allows the rest. */
const byKeyword = vi.fn<Screen>(async ({ text }) =>
  /threat/i.test(text)
    ? { outcome: 'block', flags: ['violence', 'harassment/threatening'] }
    : /rude/i.test(text)
      ? { outcome: 'hold', flags: ['harassment'] }
      : { outcome: 'allow', flags: [] },
);

type Method = 'GET' | 'POST';

/** One mock API screened by `screen` (default `byKeyword`), with several signed-in clients. */
const world = async (screen: Screen = byKeyword) => {
  byKeyword.mockClear();
  const app = await buildApp({
    sessionSecret: 'x'.repeat(32),
    corsOrigins: [],
    mock: true,
    screen,
  });
  close = () => app.close();
  const as = async (role: Role) => {
    const res = await app.inject({ method: 'POST', url: '/auth/dev-sign-in', payload: { role } });
    const cookie = res.cookies[0]!;
    const call = async (method: Method, url: string, payload?: object) => {
      const r = await app.inject({
        method,
        url,
        ...(payload ? { payload } : {}),
        cookies: { [cookie.name]: cookie.value },
      });
      return { status: r.statusCode, body: r.json() };
    };
    return {
      get: (url: string) => call('GET', url),
      post: (url: string, payload: object = {}) => call('POST', url, payload),
    };
  };
  return { as };
};

type Client = Awaited<ReturnType<Awaited<ReturnType<typeof world>>['as']>>;

const ids = (items: { id: string }[]) => items.map((i) => i.id);

const ticketsOn = async (staff: Client, targetId: string): Promise<ModerationTicket[]> =>
  (await staff.get('/staff/moderation/tickets')).body.filter(
    (t: ModerationTicket) => t.target.id === targetId,
  );

describe('screening new posts', () => {
  it('publishes what the screen allows at once, with no ticket', async () => {
    const { as } = await world();
    const athlete = await as('athlete');
    const coach = await as('coach');
    const created = await athlete.post(`/communities/${TEAM}/posts`, { text: 'Lift at 6?' });
    expect(created).toMatchObject({ status: 201, body: { moderation: 'approved' } });
    expect(byKeyword).toHaveBeenCalledWith({ text: 'Lift at 6?', imageUrl: null });
    expect(ids((await coach.get('/feed')).body.items)).toContain(created.body.id);
    expect(await ticketsOn(await as('staff'), created.body.id)).toEqual([]);
  });

  it('holds what the screen flags for staff, showing staff why', async () => {
    const { as } = await world();
    const athlete = await as('athlete');
    const coach = await as('coach');
    const created = await athlete.post(`/communities/${TEAM}/posts`, { text: 'A rude one' });
    expect(created).toMatchObject({ status: 201, body: { moderation: 'in_review' } });
    expect(ids((await athlete.get('/feed')).body.items)).toContain(created.body.id);
    expect(ids((await coach.get('/feed')).body.items)).not.toContain(created.body.id);
    expect(await ticketsOn(await as('staff'), created.body.id)).toEqual([
      expect.objectContaining({
        status: 'open',
        flags: ['harassment'],
        reasons: [],
        reportCount: 0,
      }),
    ]);
  });

  it('blocks over the threshold: refused, shown to nobody, and on record for staff', async () => {
    const { as } = await world();
    const athlete = await as('athlete');
    const staff = await as('staff');
    const res = await athlete.post(`/communities/${TEAM}/posts`, { text: 'A threat' });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/community guidelines/);

    const ticket = ((await staff.get('/staff/moderation/tickets')).body as ModerationTicket[]).find(
      (t) => t.preview === 'A threat',
    );
    expect(ticket).toMatchObject({
      target: { kind: 'post' },
      preview: 'A threat',
      flags: ['violence', 'harassment/threatening'],
      status: 'resolved',
      resolution: 'remove',
    });
    expect(
      (await athlete.get('/feed')).body.items.map((p: { text: string }) => p.text),
    ).not.toContain('A threat');
    expect((await athlete.get(`/posts/${ticket!.target.id}`)).status).toBe(404);

    // What the screen blocked can't be kept by re-deciding its ticket.
    const kept = await staff.post(`/staff/moderation/tickets/${ticket!.id}/resolve`, {
      resolution: 'dismiss',
    });
    expect(kept.status).toBe(409);
    expect((await athlete.get(`/posts/${ticket!.target.id}`)).status).toBe(404);

    // Staff can still warn the author from the blocked item's ticket, logged as a warning only:
    // no staff member removed the post.
    const warned = await staff.post(`/staff/moderation/tickets/${ticket!.id}/resolve`, {
      resolution: 'remove',
      authorAction: 'warn',
    });
    expect(warned.status).toBe(200);
    expect((await athlete.get('/notifications')).body.items[0]).toMatchObject({ kind: 'warning' });
    expect(
      (await staff.get('/staff/moderation/log')).body.map((e: { action: string }) => e.action),
    ).toEqual(['warn']);
  });

  it('never screens or holds Team Impact staff content', async () => {
    const { as } = await world();
    const staff = await as('staff');
    const created = await staff.post(`/communities/${TEAM_IMPACT}/posts`, {
      text: 'A rude-sounding threat that is really a drill announcement',
    });
    expect(created).toMatchObject({ status: 201, body: { moderation: 'approved' } });
    expect(byKeyword).not.toHaveBeenCalled();
    expect(await ticketsOn(staff, created.body.id)).toEqual([]);
  });
});

describe('screening comments, events and communities', () => {
  it('screens comments, notifying the post’s author only once one is published', async () => {
    const { as } = await world();
    const athlete = await as('athlete');
    const coach = await as('coach');
    const held = await athlete.post(`/posts/${COACH_POST}/comments`, { text: 'rude' });
    expect(held.body.moderation).toBe('in_review');
    expect((await coach.get('/notifications')).body.unreadCount).toBe(0);

    const ok = await athlete.post(`/posts/${COACH_POST}/comments`, { text: 'Nice work' });
    expect(ok.body.moderation).toBe('approved');
    expect((await coach.get('/notifications')).body.items[0]).toMatchObject({ kind: 'reply' });

    expect((await athlete.post(`/posts/${COACH_POST}/comments`, { text: 'threat' })).status).toBe(
      422,
    );
  });

  it('screens an event’s title, details and location together', async () => {
    const { as } = await world();
    const coach = await as('coach');
    const event = {
      title: 'Film session',
      details: 'Bring a notebook',
      startsAt: '2026-11-20T18:00:00.000Z',
      location: 'Room rude',
    };
    const held = await coach.post(`/communities/${TEAM}/events`, event);
    expect(held).toMatchObject({ status: 201, body: { moderation: 'in_review' } });
    expect(byKeyword).toHaveBeenCalledWith({ text: 'Film session\nBring a notebook\nRoom rude' });
    const ok = await coach.post(`/communities/${TEAM}/events`, { ...event, location: 'Gym' });
    expect(ok.body.moderation).toBe('approved');
  });

  it('screens a new community’s name and description', async () => {
    const { as } = await world();
    const athlete = await as('athlete');
    const make = (name: string) =>
      athlete.post('/communities', { kind: 'interest', name, about: 'For all', private: false });
    expect((await make('Threat club')).status).toBe(422);
    expect((await make('Rude jokes')).body.moderation).toBe('in_review');
    expect((await make('Chess')).body.moderation).toBe('approved');
  });

  it('lets only one of two creates racing on the same name through the screen', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const slow = vi.fn<Screen>(async () => {
      await gate;
      return { outcome: 'allow', flags: [] };
    });
    const { as } = await world(slow);
    const athlete = await as('athlete');
    const coach = await as('coach');
    const body = { kind: 'interest', name: 'Night owls', about: 'Late lifts', private: false };

    const both = Promise.all([
      athlete.post('/communities', body),
      coach.post('/communities', body),
    ]);
    // Both passed the first name check and are waiting on the screen.
    await vi.waitFor(() => expect(slow).toHaveBeenCalledTimes(2));
    release();
    const statuses = (await both).map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);
    const named = (await athlete.get('/communities')).body.filter(
      (c: { name: string }) => c.name === 'Night owls',
    );
    expect(named).toHaveLength(1);
  });
});
