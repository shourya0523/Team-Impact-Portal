// Account deletion (PRD §9, P3; TI-79) on the real API and a real Postgres: DELETE /me hides the
// account and signs it out everywhere at once; 30 days later the erase job removes it, cascading to
// what the person owned, and a parent's children's profiles go with them.
import { eq, inArray, sql } from 'drizzle-orm';
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deleteAccount, eraseDeletedAccounts, ERASE_AFTER_DAYS } from './account-deletion';
import { buildApp } from './app';
import type { Db } from './db/client';
import * as schema from './db/schema';
import { createMemoryMailer } from './identity/mailer';
import { freshTestDatabase } from './test/database';

const PORTAL = 'http://localhost:5173';
// argon2id hash of "team-impact-dev", the seed data's shared password.
const SEED_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$kwOXDCSVp3jrLCRhtryvcw$3F8TXsfX3cZ6DhEoMEoYr1C1B20F0TTfGItSyp1tal4';
const DAY = 24 * 60 * 60 * 1000;

let db: Db;
let closeDb: () => Promise<void>;
let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  ({ db, close: closeDb } = await freshTestDatabase('deletion'));
  app = await buildApp({
    sessionSecret: 's'.repeat(32),
    corsOrigins: [PORTAL],
    identity: {
      db,
      secret: 's'.repeat(32),
      baseURL: 'http://localhost:3000',
      links: { portalUrl: 'http://portal.test', athleteAppUrl: 'http://app.test' },
      mailer: createMemoryMailer(),
      production: false,
    },
  });
  app.get('/test/whoami', async (request, reply) => {
    const user = await app.authenticate(request);
    return user ?? reply.status(401).send({ error: 'unauthenticated' });
  });
});
afterAll(async () => {
  await app.close();
  await closeDb();
});
beforeEach(async () => {
  await db.execute(sql`truncate table users, orgs, colleges restart identity cascade`);
});

// The world -------------------------------------------------------------------------------------

type UserType = (typeof schema.users.$inferInsert)['userType'];

/** A verified account that can sign in with the seed password. */
const addUser = async (firstName: string, userType: UserType, extra = {}) => {
  const [user] = await db
    .insert(schema.users)
    .values({
      email: `${firstName.toLowerCase()}@example.test`,
      firstName,
      lastName: 'Test',
      userType,
      dob: '1990-01-01',
      emailVerified: true,
      ...extra,
    })
    .returning();
  await db.insert(schema.authAccounts).values({
    userId: user!.id,
    accountId: user!.id,
    providerId: 'credential',
    password: SEED_HASH,
  });
  return user!;
};

/** A live team with its team community; `members` join it with the given roles. */
const addTeam = async (members: [{ id: string }, 'coach' | 'member'][]) => {
  const [college] = await db.insert(schema.colleges).values({ name: 'Tufts' }).returning();
  const [team] = await db
    .insert(schema.teams)
    .values({
      collegeId: college!.id,
      sport: 'Soccer',
      gender: 'women',
      displayName: "Women's Soccer",
    })
    .returning();
  const [community] = await db
    .insert(schema.communities)
    .values({ kind: 'team', name: "Women's Soccer", teamId: team!.id, status: 'approved' })
    .returning();
  for (const [user, role] of members) {
    await db
      .insert(schema.memberships)
      .values({ userId: user.id, communityId: community!.id, role, source: 'join_request' });
  }
  return { team: team!, community: community! };
};

const signIn = async (email: string) => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    payload: { email, password: 'team-impact-dev' },
    headers: { origin: PORTAL },
  });
  return res;
};

const cookieOf = (res: LightMyRequestResponse) =>
  res.cookies.map((c) => `${c.name}=${c.value}`).join('; ');

const signedIn = async (email: string) => {
  const res = await signIn(email);
  expect(res.statusCode).toBe(200);
  return cookieOf(res);
};

const deleteMe = (cookie?: string) =>
  app.inject({
    method: 'DELETE',
    url: '/me',
    headers: { origin: PORTAL, ...(cookie ? { cookie } : {}) },
  });

const whoami = (cookie: string) =>
  app.inject({ method: 'GET', url: '/test/whoami', headers: { cookie } });

const userRow = async (id: string) =>
  (await db.select().from(schema.users).where(eq(schema.users.id, id)))[0];

// DELETE /me ------------------------------------------------------------------------------------

describe('deleting your account', () => {
  it('needs a session', async () => {
    expect((await deleteMe()).statusCode).toBe(401);
  });

  it('hides it at once: signed out on every device, no more pushes, can’t sign in', async () => {
    const maya = await addUser('Maya', 'athlete');
    const bob = await addUser('Bob', 'athlete');
    const phone = await signedIn(maya.email);
    const laptop = await signedIn(maya.email);
    const bobs = await signedIn(bob.email);
    await db.insert(schema.deviceTokens).values({ userId: maya.id, platform: 'ios', token: 't-1' });

    expect((await deleteMe(phone)).statusCode).toBe(204);

    expect((await userRow(maya.id))!.deletedAt).toBeInstanceOf(Date);
    // Checked before any request with the old cookies, which would also end them.
    const sessions = await db
      .select()
      .from(schema.authSessions)
      .where(eq(schema.authSessions.userId, maya.id));
    expect(sessions).toEqual([]);
    const tokens = await db
      .select()
      .from(schema.deviceTokens)
      .where(eq(schema.deviceTokens.userId, maya.id));
    expect(tokens).toEqual([]);
    expect((await whoami(phone)).statusCode).toBe(401);
    expect((await whoami(laptop)).statusCode).toBe(401);
    // Sign-in answers as if there were no account at all.
    const again = await signIn(maya.email);
    expect(again.statusCode).toBe(401);
    expect(again.json().code).toBe('INVALID_EMAIL_OR_PASSWORD');
    // Nobody else is touched.
    expect((await whoami(bobs)).statusCode).toBe(200);
    expect((await userRow(bob.id))!.deletedAt).toBeNull();
  });

  it('refuses staff accounts, which Team Impact closes', async () => {
    const staff = await addUser('Sam', 'staff');
    const res = await deleteMe(await signedIn(staff.email));
    expect(res.statusCode).toBe(403);
    expect((await userRow(staff.id))!.deletedAt).toBeNull();
  });

  it('refuses a live team’s only coach, until another coach joins', async () => {
    const dana = await addUser('Dana', 'coach');
    const jordan = await addUser('Jordan', 'athlete');
    const { community } = await addTeam([
      [dana, 'coach'],
      [jordan, 'member'],
    ]);
    const cookie = await signedIn(dana.email);
    const refused = await deleteMe(cookie);
    expect(refused.statusCode).toBe(409);
    expect(refused.json().error.message).toMatch(/only coach/);
    expect((await userRow(dana.id))!.deletedAt).toBeNull();

    // A suspended second coach can't act for the team, so doesn't count.
    const kim = await addUser('Kim', 'coach', { status: 'suspended' });
    await db
      .insert(schema.memberships)
      .values({ userId: kim.id, communityId: community.id, role: 'coach', source: 'coach_added' });
    expect((await deleteMe(cookie)).statusCode).toBe(409);

    const lee = await addUser('Lee', 'coach');
    await db
      .insert(schema.memberships)
      .values({ userId: lee.id, communityId: community.id, role: 'coach', source: 'coach_added' });
    expect((await deleteMe(cookie)).statusCode).toBe(204);
  });

  it('hands communities the person created to their longest-standing member', async () => {
    const maya = await addUser('Maya', 'athlete');
    const early = await addUser('Early', 'athlete');
    const late = await addUser('Late', 'athlete');
    const [book] = await db
      .insert(schema.communities)
      .values({ kind: 'interest', name: 'Book club', private: true, createdBy: maya.id })
      .returning();
    const at = (days: number) => new Date(Date.now() - days * DAY);
    await db.insert(schema.memberships).values([
      { userId: maya.id, communityId: book!.id, source: 'signup', joinedAt: at(30) },
      { userId: late.id, communityId: book!.id, source: 'join_request', joinedAt: at(5) },
      { userId: early.id, communityId: book!.id, source: 'join_request', joinedAt: at(20) },
    ]);
    expect((await deleteMe(await signedIn(maya.email))).statusCode).toBe(204);
    const [after] = await db
      .select()
      .from(schema.communities)
      .where(eq(schema.communities.id, book!.id));
    expect(after!.createdBy).toBe(early.id);
  });

  it('never hands a community to a suspended or deleted member', async () => {
    const maya = await addUser('Maya', 'athlete');
    const suspended = await addUser('Sus', 'athlete', { status: 'suspended' });
    const gone = await addUser('Gone', 'athlete', { deletedAt: new Date() });
    const active = await addUser('Active', 'athlete');
    const [book] = await db
      .insert(schema.communities)
      .values({ kind: 'interest', name: 'Book club', private: true, createdBy: maya.id })
      .returning();
    const at = (days: number) => new Date(Date.now() - days * DAY);
    await db.insert(schema.memberships).values([
      { userId: maya.id, communityId: book!.id, source: 'signup', joinedAt: at(30) },
      // Longer-standing than `active`, but they can't act for the community.
      { userId: suspended.id, communityId: book!.id, source: 'join_request', joinedAt: at(25) },
      { userId: gone.id, communityId: book!.id, source: 'join_request', joinedAt: at(20) },
      { userId: active.id, communityId: book!.id, source: 'join_request', joinedAt: at(5) },
    ]);
    expect((await deleteMe(await signedIn(maya.email))).statusCode).toBe(204);
    const [after] = await db
      .select()
      .from(schema.communities)
      .where(eq(schema.communities.id, book!.id));
    expect(after!.createdBy).toBe(active.id);
  });

  it('keeps a community with its creator when only suspended members remain', async () => {
    const maya = await addUser('Maya', 'athlete');
    const suspended = await addUser('Sus', 'athlete', { status: 'suspended' });
    const [club] = await db
      .insert(schema.communities)
      .values({ kind: 'interest', name: 'Club', createdBy: maya.id, status: 'approved' })
      .returning();
    await db.insert(schema.memberships).values([
      { userId: maya.id, communityId: club!.id, source: 'signup' },
      { userId: suspended.id, communityId: club!.id, source: 'join_request' },
    ]);
    expect(await deleteAccount(db, maya.id)).toBeNull();
    const [after] = await db
      .select()
      .from(schema.communities)
      .where(eq(schema.communities.id, club!.id));
    expect(after!.createdBy).toBe(maya.id);
  });

  it('deleting twice changes nothing', async () => {
    const maya = await addUser('Maya', 'athlete');
    expect(await deleteAccount(db, maya.id, new Date(Date.now() - 10 * DAY))).toBeNull();
    const first = (await userRow(maya.id))!.deletedAt;
    expect(await deleteAccount(db, maya.id)).toBeNull();
    // The 30 days still count from the first time.
    expect((await userRow(maya.id))!.deletedAt).toEqual(first);
  });
});

// The erase job ---------------------------------------------------------------------------------

describe('erasing deleted accounts after 30 days', () => {
  it('keeps a deleted account for 30 days, then erases it', async () => {
    const maya = await addUser('Maya', 'athlete');
    const deletedAt = new Date('2026-10-01T12:00:00Z');
    await deleteAccount(db, maya.id, deletedAt);

    const almost = new Date(deletedAt.getTime() + ERASE_AFTER_DAYS * DAY - 1000);
    expect((await eraseDeletedAccounts(db, { now: almost })).count).toBe(0);
    expect(await userRow(maya.id)).toBeDefined();

    const due = new Date(deletedAt.getTime() + ERASE_AFTER_DAYS * DAY);
    expect((await eraseDeletedAccounts(db, { now: due })).count).toBe(1);
    expect(await userRow(maya.id)).toBeUndefined();
    // Running again is harmless.
    expect((await eraseDeletedAccounts(db, { now: due })).count).toBe(0);
  });

  it('never erases an account that wasn’t deleted', async () => {
    const maya = await addUser('Maya', 'athlete', { createdAt: new Date('2020-01-01') });
    expect((await eraseDeletedAccounts(db, { now: new Date('2030-01-01') })).count).toBe(0);
    expect(await userRow(maya.id)).toBeDefined();
  });

  it('cascades to what they owned: card, media, posts, comments, consents, memberships, blocks', async () => {
    const maya = await addUser('Maya', 'athlete');
    const bob = await addUser('Bob', 'athlete');
    const { community } = await addTeam([
      [maya, 'member'],
      [bob, 'member'],
    ]);
    await db.insert(schema.cards).values({ athleteId: maya.id, season: '2026-27' });
    await db.insert(schema.media).values({
      ownerUserId: maya.id,
      purpose: 'card_photo',
      storageKey: 'photo/maya',
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
    });
    const [mayasPost] = await db
      .insert(schema.posts)
      .values({ authorId: maya.id, communityId: community.id, payload: { text: 'hi' } })
      .returning();
    const [bobsPost] = await db
      .insert(schema.posts)
      .values({ authorId: bob.id, communityId: community.id, payload: { text: 'yo' } })
      .returning();
    await db.insert(schema.comments).values([
      { postId: bobsPost!.id, authorId: maya.id, body: 'Maya on Bob’s post' },
      { postId: mayasPost!.id, authorId: bob.id, body: 'Bob on Maya’s post' },
    ]);
    await db.insert(schema.consentRecords).values({ userId: maya.id, flag: 'terms', value: true });
    await db.insert(schema.blocks).values({ blockerId: bob.id, blockedId: maya.id });

    await deleteAccount(db, maya.id, new Date(Date.now() - 31 * DAY));
    const { count, storageKeys } = await eraseDeletedAccounts(db);
    expect(count).toBe(1);
    expect(storageKeys).toEqual(['photo/maya']);

    const ids = (rows: { id: string }[]) => rows.map((r) => r.id);
    const { cards, media, posts, consentRecords, memberships } = schema;
    expect(ids(await db.select().from(cards).where(eq(cards.athleteId, maya.id)))).toEqual([]);
    expect(ids(await db.select().from(media).where(eq(media.ownerUserId, maya.id)))).toEqual([]);
    expect(ids(await db.select().from(posts).where(eq(posts.authorId, maya.id)))).toEqual([]);
    expect(
      ids(await db.select().from(consentRecords).where(eq(consentRecords.userId, maya.id))),
    ).toEqual([]);
    expect(ids(await db.select().from(memberships).where(eq(memberships.userId, maya.id)))).toEqual(
      [],
    );
    // Every comment on her post and every comment she wrote go; Bob's own post stays.
    expect(await db.select({ body: schema.comments.body }).from(schema.comments)).toEqual([]);
    expect(await db.select({ id: schema.posts.id }).from(schema.posts)).toEqual([
      { id: bobsPost!.id },
    ]);
    expect(await db.select().from(schema.blocks)).toEqual([]);
    expect(await userRow(bob.id)).toBeDefined();
  });

  it('takes a parent’s children’s profiles with them, photos included', async () => {
    const lisa = await addUser('Lisa', 'parent');
    const mark = await addUser('Mark', 'parent');
    const [mateo] = await db
      .insert(schema.children)
      .values([
        { parentUserId: lisa.id, firstName: 'Mateo', age: 9 },
        { parentUserId: lisa.id, firstName: 'Sofia', age: 7 },
        { parentUserId: mark.id, firstName: 'Ollie', age: 8 },
      ])
      .returning();
    const [photo] = await db
      .insert(schema.media)
      .values({
        ownerUserId: lisa.id,
        purpose: 'child_photo',
        status: 'ready',
        childId: mateo!.id,
        storageKey: 'child_photo/mateo',
        finalKey: 'files/child_photo/mateo/1',
        mimeType: 'image/jpeg',
        sizeBytes: 1000,
      })
      .returning();
    await db
      .update(schema.children)
      .set({ photoMediaId: photo!.id })
      .where(eq(schema.children.id, mateo!.id));
    await deleteAccount(db, lisa.id, new Date(Date.now() - 31 * DAY));
    const deleted: string[][] = [];
    const { storageKeys } = await eraseDeletedAccounts(db, {
      deleteFiles: async (keys) => void deleted.push(keys),
    });
    // The upload object and the served copy both go.
    expect(storageKeys).toEqual(['child_photo/mateo', 'files/child_photo/mateo/1']);
    expect(deleted).toEqual([storageKeys]); // handed over for deletion, after commit
    const left = await db.select({ name: schema.children.firstName }).from(schema.children);
    expect(left).toEqual([{ name: 'Ollie' }]);
  });

  it('withdraws an erased athlete from recruiters’ lists and erases the notes about them', async () => {
    const maya = await addUser('Maya', 'athlete');
    const bob = await addUser('Bob', 'athlete');
    const [org] = await db.insert(schema.orgs).values({ name: 'Northbeam' }).returning();
    const elena = await addUser('Elena', 'recruiter', { orgId: org!.id });
    const [list] = await db
      .insert(schema.shortlists)
      .values({ orgId: org!.id, name: 'Fall interns', createdBy: elena.id })
      .returning();
    const [mayaEntry, bobEntry] = await db
      .insert(schema.shortlistEntries)
      .values([
        { shortlistId: list!.id, athleteId: maya.id, addedBy: elena.id },
        { shortlistId: list!.id, athleteId: bob.id, addedBy: elena.id },
      ])
      .returning();
    await db.insert(schema.shortlistNotes).values([
      { shortlistEntryId: mayaEntry!.id, authorId: elena.id, body: 'Maya: great interview' },
      { shortlistEntryId: bobEntry!.id, authorId: elena.id, body: 'Bob: follow up' },
    ]);

    await deleteAccount(db, maya.id, new Date(Date.now() - 31 * DAY));
    await eraseDeletedAccounts(db);

    const entries = await db
      .select({
        athleteId: schema.shortlistEntries.athleteId,
        status: schema.shortlistEntries.status,
      })
      .from(schema.shortlistEntries)
      .where(inArray(schema.shortlistEntries.id, [mayaEntry!.id, bobEntry!.id]))
      .orderBy(schema.shortlistEntries.status);
    expect(entries).toEqual([
      { athleteId: bob.id, status: 'active' },
      { athleteId: null, status: 'withdrawn' }, // "profile withdrawn"
    ]);
    const notes = await db.select({ body: schema.shortlistNotes.body }).from(schema.shortlistNotes);
    expect(notes).toEqual([{ body: 'Bob: follow up' }]);
  });

  it('leaves a recruiter’s lists and notes with their company, unattributed', async () => {
    const [org] = await db.insert(schema.orgs).values({ name: 'Northbeam' }).returning();
    const elena = await addUser('Elena', 'recruiter', { orgId: org!.id });
    const bob = await addUser('Bob', 'athlete');
    const [list] = await db
      .insert(schema.shortlists)
      .values({ orgId: org!.id, name: 'Fall interns', createdBy: elena.id })
      .returning();
    const [entry] = await db
      .insert(schema.shortlistEntries)
      .values({ shortlistId: list!.id, athleteId: bob.id, addedBy: elena.id })
      .returning();
    await db
      .insert(schema.shortlistNotes)
      .values({ shortlistEntryId: entry!.id, authorId: elena.id, body: 'Strong fit' });

    await deleteAccount(db, elena.id, new Date(Date.now() - 31 * DAY));
    await eraseDeletedAccounts(db);

    const [after] = await db.select().from(schema.shortlists);
    expect(after).toMatchObject({ name: 'Fall interns', createdBy: null });
    const [note] = await db.select().from(schema.shortlistNotes);
    expect(note).toMatchObject({ body: 'Strong fit', authorId: null });
  });

  it('erases a community the person created that nobody else joined, posts and all', async () => {
    const maya = await addUser('Maya', 'athlete');
    const [solo] = await db
      .insert(schema.communities)
      .values({ kind: 'interest', name: 'Solo club', createdBy: maya.id, status: 'approved' })
      .returning();
    await db
      .insert(schema.memberships)
      .values({ userId: maya.id, communityId: solo!.id, source: 'signup' });
    await deleteAccount(db, maya.id, new Date(Date.now() - 31 * DAY));
    await eraseDeletedAccounts(db);
    expect(await db.select().from(schema.communities)).toEqual([]);
  });

  it('a community joined after the creator deleted their account passes to that member', async () => {
    const maya = await addUser('Maya', 'athlete');
    const bob = await addUser('Bob', 'athlete');
    const [club] = await db
      .insert(schema.communities)
      .values({ kind: 'interest', name: 'Late club', createdBy: maya.id, status: 'approved' })
      .returning();
    await deleteAccount(db, maya.id, new Date(Date.now() - 31 * DAY));
    await db
      .insert(schema.memberships)
      .values({ userId: bob.id, communityId: club!.id, source: 'signup' });
    await eraseDeletedAccounts(db);
    const [after] = await db.select().from(schema.communities);
    expect(after!.createdBy).toBe(bob.id);
  });
});
