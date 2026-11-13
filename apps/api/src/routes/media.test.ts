// TI-111 on the real API: Better Auth sessions, an in-process Postgres (PGlite) with every
// migration applied, and an in-memory bucket standing in for Spaces.
import { eq } from 'drizzle-orm';
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UploadResponse } from '@team-impact/contracts';
import { buildApp } from '../app';
import {
  authAccounts,
  children,
  colleges,
  communities,
  media,
  memberships,
  teams,
  users,
} from '../db/schema';
import { createMemoryMailer } from '../identity/mailer';
import { createMemoryStorage } from '../storage/memory';
import { createTestDb } from '../test/db';
import { bytes, sampleFile } from '../test/files';

const PORTAL = 'http://localhost:5173';
// argon2id hash of "team-impact-dev", the seed data's shared password.
const SEED_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$kwOXDCSVp3jrLCRhtryvcw$3F8TXsfX3cZ6DhEoMEoYr1C1B20F0TTfGItSyp1tal4';

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let app: Awaited<ReturnType<typeof buildApp>>;
const { storage, objects } = createMemoryStorage();
/** Session cookies by person. */
const cookies = { parent: '', teammate: '', outsider: '', staff: '' };
let childId: string;

type Person = keyof typeof cookies;

const addUser = async (name: Person, userType: 'parent' | 'athlete' | 'staff') => {
  const [user] = await testDb.db
    .insert(users)
    .values({
      userType,
      email: `${name}@example.test`,
      firstName: name,
      lastName: 'Test',
      dob: '1990-01-01',
      emailVerified: true,
    })
    .returning();
  await testDb.db.insert(authAccounts).values({
    userId: user!.id,
    accountId: user!.id,
    providerId: 'credential',
    password: SEED_HASH,
  });
  return user!;
};

const cookieOf = (res: LightMyRequestResponse) =>
  res.cookies.map((c) => `${c.name}=${c.value}`).join('; ');

const signIn = async (name: Person) => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    payload: { email: `${name}@example.test`, password: 'team-impact-dev' },
    headers: { origin: PORTAL },
  });
  expect(res.statusCode).toBe(200);
  cookies[name] = cookieOf(res);
};

// Booting PGlite and running the migrations can take a while on a busy CI runner.
beforeAll(async () => {
  testDb = await createTestDb();
  app = await buildApp({
    sessionSecret: 's'.repeat(32),
    corsOrigins: [PORTAL],
    identity: {
      db: testDb.db,
      secret: 's'.repeat(32),
      baseURL: 'http://localhost:3000',
      links: { portalUrl: 'http://portal.test', athleteAppUrl: 'http://app.test' },
      mailer: createMemoryMailer(),
      production: false,
    },
    storage,
  });

  const parent = await addUser('parent', 'parent');
  const teammate = await addUser('teammate', 'athlete');
  await addUser('outsider', 'athlete');
  await addUser('staff', 'staff');
  const [college] = await testDb.db.insert(colleges).values({ name: 'Tufts' }).returning();
  const [team] = await testDb.db
    .insert(teams)
    .values({ collegeId: college!.id, sport: 'Soccer', gender: 'women', displayName: 'Jumbos' })
    .returning();
  const [community] = await testDb.db
    .insert(communities)
    .values({ kind: 'team', name: 'Jumbos', teamId: team!.id, status: 'approved' })
    .returning();
  await testDb.db.insert(memberships).values([
    { userId: parent.id, communityId: community!.id, source: 'join_code' },
    { userId: teammate.id, communityId: community!.id, source: 'join_code' },
  ]);
  const [child] = await testDb.db
    .insert(children)
    .values({ parentUserId: parent.id, teamId: team!.id, firstName: 'Sam', age: 8 })
    .returning();
  childId = child!.id;
  for (const name of Object.keys(cookies) as Person[]) await signIn(name);
}, 30_000);

afterAll(async () => {
  await app.close();
  await testDb.close();
});

const as = (name: Person) => ({ cookie: cookies[name] });

const requestUpload = (name: Person, payload: object) =>
  app.inject({ method: 'POST', url: '/uploads', headers: as(name), payload });

const complete = (name: Person, mediaId: string) =>
  app.inject({ method: 'POST', url: `/uploads/${mediaId}/complete`, headers: as(name) });

const photo = { mimeType: 'image/jpeg', sizeBytes: 2000, rightsAffirmed: true } as const;

const rowOf = async (mediaId: string) =>
  (await testDb.db.select().from(media).where(eq(media.id, mediaId)))[0]!;

/** Requests an upload and returns its row, as the client would before PUTting the file. */
const startUpload = async (name: Person, payload: object) => {
  const res = await requestUpload(name, payload);
  expect(res.statusCode).toBe(201);
  return rowOf(UploadResponse.parse(res.json()).mediaId);
};

/** Requests an upload, "PUTs" a real file of the signed type and size, and completes it. */
const upload = async (name: Person, payload: object) => {
  const row = await startUpload(name, payload);
  objects.set(row.storageKey, {
    contentType: row.mimeType,
    body: sampleFile(row.mimeType as 'image/jpeg', row.sizeBytes),
  });
  expect((await complete(name, row.id)).statusCode).toBe(204);
  return row.id;
};

const view = (name: Person, mediaId: string) =>
  app.inject({ method: 'GET', url: `/media/${mediaId}`, headers: as(name) });

describe('upload', () => {
  it('needs a signed-in user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/uploads',
      payload: { purpose: 'card_photo', ...photo },
    });
    expect(res.statusCode).toBe(401);
    // The old development stand-in is gone: a header naming a user signs no one in.
    const forged = await app.inject({
      method: 'POST',
      url: '/uploads',
      headers: { 'x-dev-user-id': '00000000-0000-4000-8000-000000000000' },
      payload: { purpose: 'card_photo', ...photo },
    });
    expect(forged.statusCode).toBe(401);
  });

  it('returns a signed PUT with type and size pinned, and stores the rights affirmation', async () => {
    const res = await requestUpload('teammate', { purpose: 'card_photo', ...photo });
    expect(res.statusCode).toBe(201);
    const body = UploadResponse.parse(res.json());
    expect(body.headers).toEqual({ 'content-type': 'image/jpeg', 'content-length': '2000' });
    const [row] = await testDb.db.select().from(media).where(eq(media.id, body.mediaId));
    expect(row).toMatchObject({ status: 'pending', purpose: 'card_photo', sizeBytes: 2000 });
    expect(row!.rightsAffirmedAt).toBeInstanceOf(Date);
  });

  it('rejects files over the cap, the wrong type, or photos without a rights affirmation', async () => {
    const tooBig = await requestUpload('teammate', {
      purpose: 'post_image',
      ...photo,
      sizeBytes: 50 * 1024 * 1024,
    });
    const wrongType = await requestUpload('teammate', {
      purpose: 'resume',
      mimeType: 'text/html',
      sizeBytes: 2000,
    });
    const noRights = await requestUpload('teammate', {
      purpose: 'post_image',
      mimeType: 'image/png',
      sizeBytes: 2000,
    });
    expect([tooBig.statusCode, wrongType.statusCode, noRights.statusCode]).toEqual([400, 400, 400]);
  });

  it("only lets a child's parent upload their photo", async () => {
    const res = await requestUpload('teammate', {
      purpose: 'child_photo',
      childId,
      ...photo,
    });
    expect(res.statusCode).toBe(403);
  });

  it('will not complete until the file is in the bucket', async () => {
    const res = await requestUpload('teammate', {
      purpose: 'resume',
      mimeType: 'application/pdf',
      sizeBytes: 3000,
    });
    const { mediaId } = UploadResponse.parse(res.json());
    expect((await complete('teammate', mediaId)).statusCode).toBe(409);
  });
});

describe('completing an upload checks what landed in the bucket', () => {
  const resume = { purpose: 'resume', mimeType: 'application/pdf', sizeBytes: 3000 } as const;
  type Row = typeof media.$inferSelect;

  /** Puts `body` in the bucket for `row` as `contentType`, then tries to complete it. */
  const land = async (row: Row, body: Uint8Array, contentType: string = row.mimeType) => {
    objects.set(row.storageKey, { contentType, body });
    return complete('teammate', row.id);
  };

  /** The upload was refused: the file is gone from the bucket and the upload is still pending. */
  const expectRefused = async (res: LightMyRequestResponse, row: Row) => {
    expect(res.statusCode).toBe(400);
    expect(objects.has(row.storageKey)).toBe(false);
    expect((await rowOf(row.id)).status).toBe('pending');
    expect((await view('teammate', row.id)).statusCode).toBe(404);
  };

  it('accepts a file of the signed type and size whose bytes are that type', async () => {
    const row = await startUpload('teammate', resume);
    const res = await land(row, sampleFile('application/pdf', 3000), 'application/PDF');
    expect(res.statusCode).toBe(204);
    expect((await rowOf(row.id)).status).toBe('ready');
    expect((await view('teammate', row.id)).statusCode).toBe(302);
  });

  it('refuses a file stored with a different content type, and deletes it', async () => {
    const row = await startUpload('teammate', resume);
    await expectRefused(await land(row, sampleFile('application/pdf', 3000), 'text/html'), row);
  });

  it('refuses a file of a different size, and deletes it', async () => {
    const row = await startUpload('teammate', resume);
    await expectRefused(await land(row, sampleFile('application/pdf', 2999)), row);
  });

  it('refuses a file whose bytes are not the claimed type, and deletes it', async () => {
    const row = await startUpload('teammate', { purpose: 'post_image', ...photo });
    const html = new Uint8Array(2000);
    html.set(bytes('<!doctype html><script>alert(1)</script>'));
    await expectRefused(await land(row, html), row);

    const pngAsJpeg = await startUpload('teammate', { purpose: 'post_image', ...photo });
    await expectRefused(await land(pngAsJpeg, sampleFile('image/png', 2000)), pngAsJpeg);
  });

  it('lets the client upload again after a refused file', async () => {
    const row = await startUpload('teammate', resume);
    await expectRefused(await land(row, new Uint8Array(3000)), row);
    expect((await land(row, sampleFile('application/pdf', 3000))).statusCode).toBe(204);
  });

  it('only lets the uploader complete it', async () => {
    const row = await startUpload('teammate', resume);
    objects.set(row.storageKey, {
      contentType: row.mimeType,
      body: sampleFile('application/pdf', 3000),
    });
    expect((await complete('outsider', row.id)).statusCode).toBe(404);
    expect((await rowOf(row.id)).status).toBe('pending');
  });
});

describe('child photos through the access layer', () => {
  let photoId: string;
  beforeAll(async () => {
    photoId = await upload('parent', { purpose: 'child_photo', childId, ...photo });
  });

  it('becomes the child profile photo once complete', async () => {
    const [child] = await testDb.db.select().from(children).where(eq(children.id, childId));
    expect(child!.photoMediaId).toBe(photoId);
  });

  it('shows the photo to the parent and the team via a short-lived signed URL', async () => {
    for (const viewer of ['parent', 'teammate'] as const) {
      const res = await view(viewer, photoId);
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain('signature=get');
    }
  });

  it('hides the photo from anyone outside the team and family, staff included', async () => {
    expect((await view('outsider', photoId)).statusCode).toBe(404);
    expect((await view('staff', photoId)).statusCode).toBe(404);
  });

  it('does not serve an upload that was never completed', async () => {
    const res = await requestUpload('parent', {
      purpose: 'child_photo',
      childId,
      ...photo,
    });
    const { mediaId } = UploadResponse.parse(res.json());
    expect((await view('parent', mediaId)).statusCode).toBe(404);
  });
});

describe('staff takedown', () => {
  it('is staff only', async () => {
    const mediaId = await upload('teammate', { purpose: 'post_image', ...photo });
    const res = await app.inject({
      method: 'POST',
      url: `/staff/media/${mediaId}/takedown`,
      headers: as('teammate'),
    });
    expect(res.statusCode).toBe(403);
  });

  it('deletes the file, unlinks it from the child, and stops serving it', async () => {
    const mediaId = await upload('parent', {
      purpose: 'child_photo',
      childId,
      ...photo,
    });
    const [row] = await testDb.db.select().from(media).where(eq(media.id, mediaId));
    const res = await app.inject({
      method: 'POST',
      url: `/staff/media/${mediaId}/takedown`,
      headers: as('staff'),
    });
    expect(res.statusCode).toBe(204);

    const [after] = await testDb.db.select().from(media).where(eq(media.id, mediaId));
    expect(after!.status).toBe('taken_down');
    expect(objects.has(row!.storageKey)).toBe(false);
    const [child] = await testDb.db.select().from(children).where(eq(children.id, childId));
    expect(child!.photoMediaId).toBeNull();
    expect((await view('parent', mediaId)).statusCode).toBe(404);
  });
});
