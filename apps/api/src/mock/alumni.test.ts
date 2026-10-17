import { afterEach, describe, expect, it } from 'vitest';
import {
  AlumniProfile,
  CardClaimPreview,
  CardClaimResult,
  type Role,
} from '@team-impact/contracts';
import { buildApp } from '../app';
import { CLAIM_TOKENS, USERS } from './fixtures';

/** Only the pre-built card says this, so finding it anywhere means the card leaked. */
const PREBUILT_MARKER = 'heading into finance';

let close: (() => Promise<void>) | undefined;
afterEach(() => close?.());

/** One mock API; `as(role)` signs a fixture user in, so several viewers share one world. */
const world = async () => {
  const app = await buildApp({ sessionSecret: 'x'.repeat(32), corsOrigins: [], mock: true });
  close = () => app.close();
  const as = async (role: Role) => {
    const res = await app.inject({ method: 'POST', url: '/auth/dev-sign-in', payload: { role } });
    expect(res.statusCode).toBe(200);
    const cookie = res.cookies[0]!;
    const cookies = { [cookie.name]: cookie.value };
    const call = async (method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) => {
      const r = await app.inject({ method, url, payload, cookies });
      return { status: r.statusCode, body: r.json(), text: r.body };
    };
    return {
      get: (url: string) => call('GET', url),
      post: (url: string, payload: object = {}) => call('POST', url, payload),
      put: (url: string, payload: object) => call('PUT', url, payload),
    };
  };
  return { as };
};

const userIds = (items: { user: { id: string } }[]) => items.map((a) => a.user.id);

describe('alumni: browse (PRD §8, A7)', () => {
  it('shows athletes only alumni mentoring or hiring, with their contacts', async () => {
    const jordan = await (await world()).as('athlete');
    const res = await jordan.get('/alumni');
    expect(res.status).toBe(200);
    expect(() => AlumniProfile.array().parse(res.body)).not.toThrow();
    expect(userIds(res.body).sort()).toEqual(
      [USERS.priya.id, USERS.chris.id, USERS.jamal.id, USERS.marisol.id].sort(),
    );
    // Marcus has both flags off: not listed, and his profile is a 404 like an unknown id.
    expect(res.text).not.toContain(USERS.marcus.id);
    expect((await jordan.get(`/alumni/${USERS.marcus.id}`)).status).toBe(404);
    for (const a of res.body as AlumniProfile[]) {
      expect(a.mentoring || a.hiring).toBe(true);
      expect(a.contact.email).toBeDefined();
    }
    const priya = await jordan.get(`/alumni/${USERS.priya.id}`);
    expect(priya.status).toBe(200);
    expect(priya.body).toMatchObject({
      college: 'Tufts University',
      mentoring: true,
      hiring: true,
      contact: { email: USERS.priya.email, phone: '+1 617 555 0142' },
    });
    // Medical community membership is never on a profile (Priya isn't in one; Jordan is).
    expect(priya.text).not.toMatch(/medical|Heart warriors/i);
  });

  it('filters by college, employer and flag', async () => {
    const jordan = await (await world()).as('athlete');
    const tufts = await jordan.get('/alumni?college=tufts');
    expect(userIds(tufts.body).sort()).toEqual([USERS.priya.id, USERS.marisol.id].sort());
    const hiring = await jordan.get('/alumni?flag=hiring');
    expect(userIds(hiring.body).sort()).toEqual([USERS.priya.id, USERS.marisol.id].sort());
    const mentoringAtTufts = await jordan.get('/alumni?flag=mentoring&college=Tufts');
    expect(userIds(mentoringAtTufts.body)).toEqual([USERS.priya.id]);
    const lumen = await jordan.get('/alumni?employer=lumen');
    expect(userIds(lumen.body)).toEqual([USERS.chris.id]);
    expect((await jordan.get('/alumni?flag=recruiting')).status).toBe(400);
  });

  it('lets alumni browse each other (never themselves) and staff see everyone', async () => {
    const w = await world();
    const chris = await (await w.as('alumni_mentor')).get('/alumni');
    expect(chris.status).toBe(200);
    expect(userIds(chris.body)).not.toContain(USERS.chris.id);
    expect(userIds(chris.body)).toContain(USERS.priya.id);
    const staff = await (await w.as('staff')).get('/alumni');
    expect(userIds(staff.body)).toContain(USERS.marcus.id);
  });

  it('is refused to teens, parents, coaches and recruiters, server-side', async () => {
    const w = await world();
    for (const role of ['teen', 'parent', 'coach', 'recruiter'] as const) {
      const u = await w.as(role);
      for (const url of ['/alumni', `/alumni/${USERS.priya.id}`]) {
        const res = await u.get(url);
        expect(res.status, `${role} ${url}`).toBe(403);
        expect(res.text).not.toContain(USERS.priya.email);
      }
      expect((await u.get('/me/alumni')).status, role).toBe(403);
    }
    // Athletes aren't alumni: no alumni details of their own.
    expect((await (await w.as('athlete')).put('/me/alumni', { mentoring: true })).status).toBe(403);
  });
});

describe('alumni: their own details (L3, L4)', () => {
  it('turning mentoring and hiring off hides the alumnus from athletes, and back on shows them', async () => {
    const w = await world();
    const priya = await w.as('alumni_athlete');
    const jordan = await w.as('athlete');

    const mine = await priya.get('/me/alumni');
    expect(mine.status).toBe(200);
    expect(mine.body).toMatchObject({ college: 'Tufts University', mentoring: true, hiring: true });

    const off = await priya.put('/me/alumni', { mentoring: false, hiring: false });
    expect(off.status).toBe(200);
    expect(off.body).toMatchObject({ mentoring: false, hiring: false });
    expect(userIds((await jordan.get('/alumni')).body)).not.toContain(USERS.priya.id);
    expect((await jordan.get(`/alumni/${USERS.priya.id}`)).status).toBe(404);

    const on = await priya.put('/me/alumni', { hiring: true, employer: 'Harbor Point Capital' });
    expect(on.body).toMatchObject({
      mentoring: false,
      hiring: true,
      employer: 'Harbor Point Capital',
    });
    const back = await jordan.get(`/alumni/${USERS.priya.id}`);
    expect(back.status).toBe(200);
    expect(back.body.contact.email).toBe(USERS.priya.email);
  });

  it('needs a college before mentoring or hiring goes on', async () => {
    const w = await world();
    const chris = await w.as('alumni_mentor');
    expect((await chris.put('/me/alumni', { college: '' })).status).toBe(400);
    expect((await chris.put('/me/alumni', { employer: null })).body.employer).toBeNull();
  });
});

describe('card claims: a pre-built card from a personal link (L5)', () => {
  const url = `/card-claims/${CLAIM_TOKENS.priya}`;

  it('previews by first name only, for a signed-in alumni athlete', async () => {
    const w = await world();
    const priya = await w.as('alumni_athlete');
    const preview = await priya.get(url);
    expect(preview.status).toBe(200);
    expect(() => CardClaimPreview.parse(preview.body)).not.toThrow();
    expect(preview.body.face.firstName).toBe('Priya');
    expect(preview.text).not.toContain('Shah');
    expect(preview.body.face).not.toHaveProperty('athleteId');
    for (const role of [
      'athlete',
      'alumni_mentor',
      'teen',
      'parent',
      'recruiter',
      'staff',
    ] as const) {
      const res = await (await w.as(role)).get(url);
      expect(res.status, role).toBe(403);
      expect(res.text).not.toContain(PREBUILT_MARKER);
    }
  });

  it('is single use and lands in review, publishing nothing', async () => {
    const w = await world();
    const priya = await w.as('alumni_athlete');
    const before = (await priya.get('/cards/me')).body;

    const claim = await priya.post(`${url}/claim`);
    expect(claim.status).toBe(200);
    const result = CardClaimResult.parse(claim.body);
    expect(result.card.pendingResume).toMatchObject({ source: 'prebuilt', status: 'unconfirmed' });
    expect(result.card.pendingResume?.fields.lookingFor).toContain(PREBUILT_MARKER);
    // Her published card is untouched until she accepts fields and publishes.
    expect(result.card.card?.lookingFor).toBe(before.card.lookingFor);
    expect(result.card.draft).toBeNull();

    expect((await priya.post(`${url}/claim`)).status).toBe(410);
    expect((await priya.get(url)).status).toBe(410);
    expect((await priya.get('/card-claims/claim-no-such-card-token-123')).status).toBe(404);
    expect((await priya.get(`/card-claims/${CLAIM_TOKENS.expired}`)).status).toBe(410);
    expect((await priya.post(`/card-claims/${CLAIM_TOKENS.expired}/claim`)).status).toBe(410);
    // Other roles can't claim even with the link.
    expect((await (await w.as('athlete')).post(`${url}/claim`)).status).toBe(403);
  });

  it('stays invisible to everyone until claimed, and until published after that', async () => {
    const w = await world();
    const viewers = {
      athlete: await w.as('athlete'),
      recruiter: await w.as('recruiter'),
      staff: await w.as('staff'),
      parent: await w.as('parent'),
      priya: await w.as('alumni_athlete'),
    };
    const reads: [keyof typeof viewers, string][] = [
      ['recruiter', '/search/athletes'],
      ['recruiter', `/cards/${USERS.priya.id}`],
      ['recruiter', `/profiles/${USERS.priya.id}`],
      ['recruiter', '/lists'],
      ['athlete', `/cards/${USERS.priya.id}`],
      ['athlete', `/profiles/${USERS.priya.id}`],
      ['athlete', '/alumni'],
      ['staff', `/profiles/${USERS.priya.id}`],
      ['staff', '/alumni'],
      ['parent', `/profiles/${USERS.priya.id}`],
      ['priya', '/cards/me'],
      ['priya', '/cards/me/history'],
    ];
    const check = async () => {
      for (const [who, path] of reads) {
        const res = await viewers[who].get(path);
        expect(res.text, `${who} ${path}`).not.toContain(PREBUILT_MARKER);
      }
    };
    await check();
    expect((await viewers.priya.post(`${url}/claim`)).status).toBe(200);
    // Claimed, but waiting for review: still nobody else's to see.
    for (const [who, path] of reads.filter(([who]) => who !== 'priya')) {
      const res = await viewers[who].get(path);
      expect(res.text, `${who} ${path}`).not.toContain(PREBUILT_MARKER);
    }
  });

  it('lets an account claim one card only', async () => {
    const w = await world();
    const priya = await w.as('alumni_athlete');
    expect((await priya.post(`${url}/claim`)).status).toBe(200);
    expect((await priya.post(`/card-claims/${CLAIM_TOKENS.jamal}/claim`)).status).toBe(409);
    // Refused, so Jamal's link still works for its holder.
    expect((await priya.get(`/card-claims/${CLAIM_TOKENS.jamal}`)).status).toBe(200);
  });
});
