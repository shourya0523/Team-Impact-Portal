import { and, eq, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CURRENT_TERMS_VERSION, type Role } from '@team-impact/contracts';
import { cards, eventsLog, users } from '../db/schema';
import { fixtureRows } from '../db/seed/fixtures';
import { id, USERS } from '../mock/fixtures';
import { anonymous, dbApp, dbUserAs, mockApp, signInAs } from './agents';
import { createTestDb, DB_TIMEOUT_MS, type TestDb } from './db';
import { forgedBody } from './events';

// TI-89 smoke suite: the first real tests through the harness. Mock-mode tests run the routes the
// clients use today; database tests run real SQL on the migrated, seeded schema (PGlite locally,
// a throwaway Postgres database in CI).

const TEAM = id(301); // the soccer team's community
const TEAM_IMPACT = id(302);
const FIRST_GEN = id(304); // official interest community
const ROLES: Role[] = ['staff', 'coach', 'athlete', 'parent', 'teen', 'recruiter'];

let close: (() => Promise<void>) | undefined;
afterEach(() => close?.());

const setup = async () => {
  const m = await mockApp();
  close = m.close;
  return m;
};

describe('smoke: sign-up and sign-in', () => {
  it('signs up a new athlete, keeps them signed in, and signs them out', async () => {
    const { app } = await setup();
    const casey = anonymous(app);
    const res = await casey.post('/auth/sign-up', {
      email: 'casey.smoke@example.org',
      password: 'correct horse battery',
      firstName: 'Casey',
      lastName: 'Smoke',
      birthDate: '2004-02-03',
      role: 'athlete',
      acceptTerms: true,
      termsVersion: CURRENT_TERMS_VERSION,
    });
    expect(res.status).toBe(201);
    expect((await casey.get('/me')).body.id).toBe(res.body.id);
    expect((await casey.post('/auth/sign-out')).status).toBe(204);
    expect((await casey.get('/me')).status).toBe(401);
  });

  // Real login (argon2 + signed cookie) isn't built yet; dev sign-in sets the same cookie.
  it('signs in every role in one line, and refuses strangers', async () => {
    const { app } = await setup();
    for (const role of ROLES) {
      const agent = await signInAs(app, role);
      expect(agent.me.role, role).toBe(role);
      expect((await agent.get('/me')).body.id, role).toBe(agent.me.id);
    }
    expect((await anonymous(app).get('/me')).status).toBe(401);
  });
});

describe('smoke: consent-filtered athlete query', () => {
  it('shows recruiters only athletes with a published card and open-to-recruiting on', async () => {
    const { app } = await setup();
    const recruiter = await signInAs(app, 'recruiter');
    const res = await recruiter.get('/search/athletes');
    expect(res.status).toBe(200);
    const shown = res.body.items.map((c: { athleteId: string }) => c.athleteId).sort();
    // Riley isn't open to recruiting and Ava's card isn't published; the teen never shows.
    expect(shown).toEqual([USERS.jordan.id, USERS.sam.id, USERS.priya.id].sort());
    expect(res.text).not.toContain(USERS.noah.id);
  });
});

describe('smoke: write-gate bypass attempts fail', () => {
  it('refuses posts from roles that can’t post there, and stores nothing', async () => {
    const { app, world } = await setup();
    const posts = world.posts.length;
    const attempts: [Role, string][] = [
      ['teen', TEAM_IMPACT], // teens post to their own team only
      ['parent', TEAM], // parents comment, never post
      ['recruiter', FIRST_GEN], // recruiters read official communities, never post
    ];
    for (const [role, communityId] of attempts) {
      const agent = await signInAs(app, role);
      const res = await agent.post(`/communities/${communityId}/posts`, { text: 'Let me in' });
      expect(res.status, `${role} → ${communityId}`).toBe(403);
    }
    expect((await anonymous(app).post(`/communities/${TEAM}/posts`, { text: 'Hi' })).status).toBe(
      401,
    );
    expect(world.posts).toHaveLength(posts);
    // The gate isn't a blanket no: the same teen can post to their own team, held for review.
    const teen = await signInAs(app, 'teen');
    const own = await teen.post(`/communities/${TEAM}/posts`, { text: 'Great game!' });
    expect(own.status).toBe(201);
    expect(world.posts.find((p) => p.id === own.body.id)?.moderation).toBe('in_review');
  });
});

describe('smoke: database', () => {
  let testDb: TestDb;
  beforeAll(async () => {
    testDb = await createTestDb();
    await testDb.seed(fixtureRows());
  }, DB_TIMEOUT_MS);
  afterAll(() => testDb?.close());

  it('seeds the mock world into the migrated schema', async () => {
    const [row] = await testDb.rows(sql`select count(*)::int as n from users`);
    expect(row!.n).toBe(Object.keys(USERS).length);
  });

  it('finds recruiter-visible athletes with real SQL: published card and open to recruiting', async () => {
    const visible = await testDb.db
      .selectDistinct({ id: users.id })
      .from(users)
      .innerJoin(cards, eq(cards.athleteId, users.id))
      .where(
        and(
          eq(users.openToRecruiting, true),
          eq(cards.status, 'published'),
          sql`${users.deletedAt} is null`,
          eq(users.status, 'active'),
        ),
      );
    expect(visible.map((r) => r.id).sort()).toEqual(
      [USERS.jordan.id, USERS.sam.id, USERS.priya.id].sort(),
    );
  });

  it('holds the PRD privacy invariants in the seeded rows', async () => {
    // Recruiters are in no community; teens are in no medical community.
    expect(
      await testDb.rows(sql`
        select u.user_type, c.kind from memberships m
        join users u on u.id = m.user_id join communities c on c.id = m.community_id
        where u.user_type = 'recruiter' or (u.user_type = 'teen' and c.kind = 'medical')`),
    ).toEqual([]);
    // Recruiter search opt-ins exist only in official, open interest communities.
    expect(
      await testDb.rows(sql`
        select c.name from memberships m join communities c on c.id = m.community_id
        where m.recruiter_search_opt_in and not (c.kind = 'interest' and c.official and not c.private)`),
    ).toEqual([]);
    // Team, medical and private communities are never official.
    expect(
      await testDb.rows(sql`
        select name from communities where official and (kind <> 'interest' or private)`),
    ).toEqual([]);
    // Children are never accounts, and no child keeps a birth date (the table has no column).
    expect(await testDb.rows(sql`select c.id from children c join users u on u.id = c.id`)).toEqual(
      [],
    );
    expect(
      await testDb.rows(sql`
        select column_name from information_schema.columns
        where table_name = 'children' and column_name in ('dob', 'birth_date', 'email')`),
    ).toEqual([]);
    // Every teen confirmed a parent or guardian agreed, with a terms version.
    expect(
      await testDb.rows(sql`
        select u.id from users u where u.user_type = 'teen' and not exists (
          select 1 from consent_records r where r.user_id = u.id and r.flag = 'parent_agreed'
            and r.value and r.terms_version is not null)`),
    ).toEqual([]);
  });

  it(
    'refuses a client forging a server-only event, and logs nothing',
    async () => {
      const app = await dbApp(testDb);
      try {
        const recruiter = await dbUserAs(app, testDb, 'recruiter');
        const before = await testDb.db.$count(eventsLog);
        // Only the server may log a card as published; a client claiming it is refused.
        const forged = await recruiter.post(
          '/events',
          forgedBody('card.published', USERS.jordan.id),
        );
        expect(forged.status).toBe(400);
        // And nobody signed out can send even an allowed event.
        const stranger = await anonymous(app).post('/events', {
          name: 'card.viewed',
          subjectId: USERS.jordan.id,
          properties: { cardId: id(401) },
        });
        expect(stranger.status).toBe(401);
        expect(await testDb.db.$count(eventsLog)).toBe(before);
      } finally {
        await app.close();
      }
    },
    DB_TIMEOUT_MS,
  );
});
