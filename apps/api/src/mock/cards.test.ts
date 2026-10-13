import { afterEach, describe, expect, it } from 'vitest';
import type { ExperienceEntry, Role } from '@team-impact/contracts';
import { buildApp } from '../app';
import { id, USERS } from './fixtures';
import { CURRENT_SEASON, historyFor, publishCard } from './profiles';
import { MockWorld } from './world';

const MATEO = id(150); // Lisa's child, on the soccer team

let close: (() => Promise<void>) | undefined;
afterEach(() => close?.());

/** One mock API; `as(role)` signs a fixture user in, so several viewers share one world. */
const world = async () => {
  const app = await buildApp({ sessionSecret: 'x'.repeat(32), corsOrigins: [], mock: true });
  close = () => app.close();
  const as = async (role: Role, newcomer = false) => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/dev-sign-in',
      payload: { role, newcomer },
    });
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

const entry = (role: string): ExperienceEntry => ({
  role,
  organization: 'Lowell Credit Union',
  period: 'Summer 2025',
});

const ids = (res: { body: { items: { athleteId: string }[] } }) =>
  res.body.items.map((c) => c.athleteId);

describe('cards: experience entries (TI-150)', () => {
  it('serves experience as role / organization / period entries', async () => {
    const w = await world();
    const card = await (await w.as('recruiter')).get(`/cards/${USERS.jordan.id}`);
    expect(card.status).toBe(200);
    expect(card.body.experience).toEqual([
      { role: 'Treasurer', organization: 'Tufts Investment Club', period: '2025 – Now' },
      { role: 'Summer intern', organization: 'Lowell Credit Union', period: 'Summer 2025' },
    ]);
  });

  it('takes at most 3 entries and no empty ones', async () => {
    const w = await world();
    const jordan = await w.as('athlete');
    const three = [entry('One'), entry('Two'), entry('Three')];
    const saved = await jordan.put('/cards/me', { experience: three });
    expect(saved.status).toBe(200);
    expect(saved.body.draft.experience).toEqual(three);

    expect((await jordan.put('/cards/me', { experience: [...three, entry('Four')] })).status).toBe(
      400,
    );
    expect(
      (await jordan.put('/cards/me', { experience: [{ role: ' ', organization: '', period: '' }] }))
        .status,
    ).toBe(400);
    expect((await jordan.put('/cards/me', { experience: 'Free text' })).status).toBe(400);
    // The rejected saves didn't touch the draft.
    expect((await jordan.get('/cards/me')).body.draft.experience).toEqual(three);
  });

  it('searches the role and organisation of the entries', async () => {
    const w = await world();
    const recruiter = await w.as('recruiter');
    expect(ids(await recruiter.get('/search/athletes?experience=credit%20union'))).toEqual([
      USERS.jordan.id,
    ]);
    expect(ids(await recruiter.get('/search/athletes?experience=teaching'))).toEqual([
      USERS.sam.id,
    ]);
  });

  it('proposes extracted entries that show nowhere until the athlete confirms them', async () => {
    const w = await world();
    const jordan = await w.as('athlete');
    const sam = await w.as('athlete');
    const recruiter = await w.as('recruiter');
    const upload = await jordan.post('/cards/me/resume', {
      fileName: 'resume.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 20_000,
      text: [
        'Experience: Quant intern at Harbor Capital (Summer 2026); Tutor, <b>Math Lab</b>, 2025; ' +
          'Captain, Club rugby, 2024; Fourth, Ignored, 2023',
      ].join('\n'),
    });
    expect(upload.status).toBe(200);
    expect(upload.body.needsReview).toEqual(['experience']);
    // Plain text, the card's entry shape, at most 3.
    expect(upload.body.fields.experience).toEqual([
      { role: 'Quant intern', organization: 'Harbor Capital', period: 'Summer 2026' },
      { role: 'Tutor', organization: 'b Math Lab /b', period: '2025' },
      { role: 'Captain', organization: 'Club rugby', period: '2024' },
    ]);
    expect(upload.text).not.toContain('<');

    // Not on the draft, the card, search, profiles or the card other people see.
    expect((await jordan.get('/cards/me')).body.draft).toBeNull();
    for (const res of [
      await jordan.get('/cards/me/history'),
      await recruiter.get(`/cards/${USERS.jordan.id}`),
      await recruiter.get('/search/athletes?experience=harbor'),
      await sam.get(`/profiles/${USERS.jordan.id}`),
      await sam.get(`/cards/${USERS.jordan.id}`),
    ]) {
      expect(res.text).not.toContain('Harbor');
    }

    // The athlete accepts the first entry only (one by one in the app).
    const first = upload.body.fields.experience[0];
    const confirmed = await jordan.post('/cards/me/resume/confirm', {
      draftId: upload.body.id,
      fields: { experience: [first] },
    });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.draft).toEqual({ experience: [first] });
    expect(confirmed.text).not.toContain('Club rugby');
    // Confirmed into the draft only: still private until published.
    expect((await recruiter.get(`/cards/${USERS.jordan.id}`)).text).not.toContain('Harbor');

    await jordan.post('/cards/me/publish');
    const card = await recruiter.get(`/cards/${USERS.jordan.id}`);
    expect(card.body.experience).toEqual([first]);
  });

  it('can’t confirm more than 3 entries', async () => {
    const w = await world();
    const jordan = await w.as('athlete');
    const upload = await jordan.post('/cards/me/resume', {
      fileName: 'resume.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1000,
    });
    const four = [entry('A'), entry('B'), entry('C'), entry('D')];
    const res = await jordan.post('/cards/me/resume/confirm', {
      draftId: upload.body.id,
      fields: { experience: four },
    });
    expect(res.status).toBe(400);
  });
});

describe('cards: unpublish', () => {
  it('takes the card out of recruiter search, cards and lists at once', async () => {
    const w = await world();
    const jordan = await w.as('athlete');
    const recruiter = await w.as('recruiter');
    const parent = await w.as('parent'); // Lisa, on Jordan's team
    expect(ids(await recruiter.get('/search/athletes'))).toContain(USERS.jordan.id);
    expect((await parent.get(`/cards/${USERS.jordan.id}`)).status).toBe(200);

    const res = await jordan.post('/cards/me/unpublish');
    expect(res.status).toBe(200);
    expect(res.body.card.visibility).toMatchObject({ published: false, openToRecruiting: false });

    expect(ids(await recruiter.get('/search/athletes'))).not.toContain(USERS.jordan.id);
    expect((await recruiter.get(`/cards/${USERS.jordan.id}`)).status).toBe(404);
    expect((await recruiter.get('/lists')).text).not.toContain(USERS.jordan.id);
    expect((await recruiter.get(`/profiles/${USERS.jordan.id}`)).status).toBe(404);
    expect((await parent.get(`/cards/${USERS.jordan.id}`)).status).toBe(404);
    expect((await jordan.post('/cards/me/export')).status).toBe(400);
    // The athlete still has the card and its history.
    expect((await jordan.get('/cards/me')).body.card.major).toBe('Economics');
    expect((await jordan.get('/cards/me/history')).body.length).toBeGreaterThan(0);

    // Republishing doesn't put them back in front of recruiters until they turn recruiting on.
    await jordan.post('/cards/me/publish');
    expect(ids(await recruiter.get('/search/athletes'))).not.toContain(USERS.jordan.id);
    expect((await jordan.put('/me/settings', { openToRecruiting: true })).status).toBe(200);
    expect(ids(await recruiter.get('/search/athletes'))).toContain(USERS.jordan.id);
  });

  it('is for card holders only; children and teens never get a card', async () => {
    const w = await world();
    const athlete = await w.as('athlete', true);
    expect((await athlete.post('/cards/me/unpublish')).status).toBe(400);
    for (const role of ['teen', 'parent', 'coach', 'recruiter'] as const) {
      const u = await w.as(role);
      expect((await u.post('/cards/me/unpublish')).status, role).toBe(403);
      expect((await u.put('/cards/me', { experience: [entry('Intern')] })).status, role).toBe(403);
      expect((await u.post('/cards/me/publish')).status, role).toBe(403);
    }
    const recruiter = await w.as('recruiter');
    expect((await recruiter.get(`/cards/${MATEO}`)).status).toBe(404);
    expect((await recruiter.get(`/cards/${USERS.noah.id}`)).status).toBe(404);
  });
});

describe('cards: per season', () => {
  it('publishing a card from an earlier season saves this season’s card and keeps the old one', () => {
    const w = new MockWorld({ identitySearch: true, medicalCommunities: true });
    const jordan = w.user(USERS.jordan.id)!;
    const card = w.cards.find((c) => c.face.athleteId === jordan.id)!;
    const lastSeasonId = card.face.id;
    card.face.season = CURRENT_SEASON - 1;
    w.profiles.drafts.set(jordan.id, { experience: [entry('Analyst intern')] });

    expect(publishCard(w, jordan, '2026-10-13T12:00:00.000Z')).toBeNull();
    expect(card.face.season).toBe(CURRENT_SEASON);
    expect(card.face.id).not.toBe(lastSeasonId);
    const history = historyFor(w, jordan);
    expect(history[0]).toMatchObject({ season: CURRENT_SEASON });
    expect(history[0]!.face.experience).toEqual([entry('Analyst intern')]);
    // Earlier seasons stay as they were published.
    expect(history.filter((v) => v.season < CURRENT_SEASON).length).toBeGreaterThan(0);
  });
});
