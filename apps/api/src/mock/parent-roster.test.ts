// Parent, child and teen profiles (PRD §2, §6; stories F4, T2, T3):
// - a parent's roster shows each athlete's family-visible contacts, and nothing more
// - teens and children stay inside their own team
import { afterEach, describe, expect, it } from 'vitest';
import type { FamilyVisibleAthlete, Role } from '@team-impact/contracts';
import { buildApp } from '../app';
import { CHILDREN, id, USERS } from './fixtures';

const TEAM = id(201); // Tufts women's soccer: Jordan, Sam, Riley, Ava; parents Lisa and Mark; teen Noah
const TEAM_COMMUNITY = id(301); // the team's private community
const TEAM_IMPACT = id(302);
const MATEO = CHILDREN[0]!; // Lisa's son, on the team
const ATHLETE_PHONE = '+1 617 555 0100'; // every fixture card's phone

let close: (() => Promise<void>) | undefined;
afterEach(() => close?.());

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

/** One mock API; `as(role)` signs a fixture user in, so several people act on the same world. */
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
    const call = async (method: Method, url: string, payload?: object) => {
      const r = await app.inject({
        method,
        url,
        payload,
        cookies: { [cookie.name]: cookie.value },
      });
      return { status: r.statusCode, body: r.json(), text: r.body };
    };
    return {
      call,
      get: (url: string) => call('GET', url),
      /** What each athlete shares with this (parent) viewer, by athlete id. */
      athletes: async () => {
        const res = await call('GET', `/teams/${TEAM}/athlete-contacts`);
        expect(res.status).toBe(200);
        return new Map(
          (res.body as FamilyVisibleAthlete[]).map((a) => [a.athlete.id, a.contact] as const),
        );
      },
    };
  };
  return { as };
};

describe('parent roster: athletes’ family contacts (F4)', () => {
  it('shows a parent exactly the channels each athlete shares with families', async () => {
    const { as } = await world();
    const athletes = await (await as('parent')).athletes();
    // Every athlete on the team is listed, and nobody else (no parents, coaches or teens).
    expect([...athletes.keys()].sort()).toEqual(
      [USERS.jordan.id, USERS.sam.id, USERS.riley.id, USERS.ava.id].sort(),
    );
    // Every published fixture card shares email only with families.
    for (const athlete of [USERS.jordan, USERS.sam, USERS.riley]) {
      expect(athletes.get(athlete.id), athlete.firstName).toEqual({ email: athlete.email });
    }
  });

  it('never shows a channel the athlete shares only with recruiters', async () => {
    const { as } = await world();
    // Sam shares email, phone and LinkedIn with recruiters, but only email with families.
    const sam = (await (await as('parent')).athletes()).get(USERS.sam.id);
    expect(sam).toEqual({ email: USERS.sam.email });
    expect(sam).not.toHaveProperty('phone');
    expect(sam).not.toHaveProperty('linkedinUrl');
  });

  it('shows nothing for an athlete whose card isn’t published', async () => {
    const { as } = await world();
    // Ava's card is a draft: her family contacts aren't out yet.
    expect((await (await as('parent')).athletes()).get(USERS.ava.id)).toEqual({});
  });

  it('follows the athlete’s settings: sharing more shows more, sharing less hides it', async () => {
    const { as } = await world();
    const jordan = await as('athlete');
    const lisa = await as('parent');
    const changed = await jordan.call('PUT', '/me/settings', {
      familiesSee: { email: false, phone: true, linkedin: true },
    });
    expect(changed.status).toBe(200);
    expect((await lisa.athletes()).get(USERS.jordan.id)).toEqual({
      phone: ATHLETE_PHONE,
      linkedinUrl: 'https://www.linkedin.com/in/jordan-lee',
    });

    await jordan.call('PUT', '/me/settings', {
      familiesSee: { email: false, phone: false, linkedin: false },
    });
    expect((await lisa.athletes()).get(USERS.jordan.id)).toEqual({});
  });

  it('stops showing contacts once the athlete unpublishes their card', async () => {
    const { as } = await world();
    const jordan = await as('athlete');
    const lisa = await as('parent');
    expect((await jordan.call('POST', '/cards/me/unpublish')).status).toBe(200);
    expect((await lisa.athletes()).get(USERS.jordan.id)).toEqual({});
  });

  it('matches what the athlete’s profile shows the same parent', async () => {
    const { as } = await world();
    const lisa = await as('parent');
    const athletes = await lisa.athletes();
    for (const athlete of [USERS.jordan, USERS.sam, USERS.riley]) {
      const profile = await lisa.get(`/profiles/${athlete.id}`);
      expect(profile.body.contact, athlete.firstName).toEqual(athletes.get(athlete.id));
    }
  });

  it('is refused to everyone on the team who isn’t a parent, teens included', async () => {
    const { as } = await world();
    for (const role of ['athlete', 'coach', 'staff', 'teen'] as const) {
      const res = await (await as(role)).get(`/teams/${TEAM}/athlete-contacts`);
      expect(res.status, role).toBe(403);
      expect(res.text, role).not.toContain(ATHLETE_PHONE);
    }
  });

  it('never puts athletes’ contacts on the roster itself, for anyone', async () => {
    const { as } = await world();
    // The roster is read by the whole team, teens included, so it carries none, even for parents.
    for (const role of ['parent', 'teen', 'athlete', 'coach', 'staff'] as const) {
      const res = await (await as(role)).get(`/teams/${TEAM}/members`);
      expect(res.status, role).toBe(200);
      for (const athlete of [USERS.jordan, USERS.sam, USERS.riley, USERS.ava]) {
        expect(res.text, `${role} → ${athlete.firstName}`).not.toContain(athlete.email);
      }
      expect(res.text, role).not.toContain(ATHLETE_PHONE);
    }
  });

  it('is for parents on the team only: a parent off it, or removed from it, sees no roster', async () => {
    const { as } = await world();
    const newcomer = await as('parent', true); // Rosa, on no team yet
    expect((await newcomer.get(`/teams/${TEAM}/athlete-contacts`)).status).toBe(404);
    for (const role of ['recruiter', 'alumni_athlete'] as const) {
      expect((await (await as(role)).get(`/teams/${TEAM}/athlete-contacts`)).status, role).toBe(
        404,
      );
    }

    const lisa = await as('parent');
    const coach = await as('coach');
    expect((await coach.call('DELETE', `/teams/${TEAM}/members/${USERS.lisa.id}`)).status).toBe(
      200,
    );
    expect((await lisa.get(`/teams/${TEAM}/athlete-contacts`)).status).toBe(404);
    // Off the team, the athlete's profile (and its family contacts) is out of reach too.
    expect((await lisa.get(`/profiles/${USERS.jordan.id}`)).status).toBe(404);
  });
});

describe('teens stay inside their team (T2, T3)', () => {
  /** Staff approve the moderation ticket holding `targetId`, so it can appear. */
  const approve = async (
    staff: Awaited<ReturnType<Awaited<ReturnType<typeof world>>['as']>>,
    targetId: string,
  ) => {
    const tickets = (await staff.get('/staff/moderation/tickets')).body as {
      id: string;
      target: { id: string };
      status: string;
    }[];
    const ticket = tickets.find((t) => t.target.id === targetId && t.status === 'open');
    expect(ticket, 'held for review').toBeTruthy();
    const res = await staff.call('POST', `/staff/moderation/tickets/${ticket!.id}/resolve`, {
      resolution: 'dismiss',
    });
    expect(res.status).toBe(200);
  };

  it('a teen’s post reaches their team and nobody outside it', async () => {
    const { as } = await world();
    const noah = await as('teen');
    const created = await noah.call('POST', `/communities/${TEAM_COMMUNITY}/posts`, {
      text: 'Big win today',
    });
    expect(created.status).toBe(201);
    await approve(await as('staff'), created.body.id);

    const postId = created.body.id as string;
    const feedIds = async (role: Role) =>
      ((await (await as(role)).get('/feed')).body.items as { id: string }[]).map((p) => p.id);

    expect(await feedIds('athlete')).toContain(postId); // Jordan, on the team
    expect(await feedIds('parent')).toContain(postId); // Lisa, on the team
    for (const role of ['recruiter', 'alumni_athlete', 'alumni_mentor'] as const) {
      expect(await feedIds(role), role).not.toContain(postId);
      expect((await (await as(role)).get(`/posts/${postId}`)).status, role).toBe(404);
    }
  });

  it('a teen can’t post to the network-wide Team Impact community', async () => {
    const { as } = await world();
    const noah = await as('teen');
    const res = await noah.call('POST', `/communities/${TEAM_IMPACT}/posts`, { text: 'Hi all' });
    expect(res.status).toBe(403);
  });

  it('a teen’s profile is hidden from everyone off the team', async () => {
    const { as } = await world();
    for (const [role, newcomer] of [
      ['recruiter', false],
      ['alumni_athlete', false],
      ['alumni_mentor', false],
      ['parent', true],
      ['athlete', true],
    ] as const) {
      const viewer = await as(role, newcomer);
      expect((await viewer.get(`/profiles/${USERS.noah.id}`)).status, role).toBe(404);
    }
  });
});

describe('children stay inside their team (F3)', () => {
  it('a child’s name never reaches anyone off the team, on any of their screens', async () => {
    const { as } = await world();
    const screens = ['/feed', '/events', '/communities', `/communities/${TEAM_IMPACT}/members`];
    for (const [role, newcomer] of [
      ['recruiter', false],
      ['alumni_athlete', false],
      ['alumni_mentor', false],
      ['parent', true],
    ] as const) {
      const viewer = await as(role, newcomer);
      for (const url of screens) {
        const res = await viewer.get(url);
        expect(res.text, `${role} ${url}`).not.toContain(MATEO.firstName);
      }
      expect((await viewer.get(`/profiles/${MATEO.id}`)).status, role).toBe(404);
    }
  });
});
