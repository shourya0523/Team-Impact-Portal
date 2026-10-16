import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UploadResponse } from '@team-impact/contracts';
import { children, colleges, groups, media, memberships, teams, users } from '../db/schema';
import { createTestApp } from '../test/app';

type TestApp = Awaited<ReturnType<typeof createTestApp>>;
let t: TestApp;

const ids = {
  parent: randomUUID(),
  teammate: randomUUID(),
  outsider: randomUUID(),
  staff: randomUUID(),
  child: randomUUID(),
};

const addUser = (id: string, userType: 'parent' | 'athlete' | 'staff') =>
  t.db.insert(users).values({
    id,
    userType,
    email: `${id}@example.test`,
    passwordHash: 'x',
    firstName: 'Test',
    lastName: 'User',
    dob: '1990-01-01',
  });

beforeAll(async () => {
  t = await createTestApp();
  await addUser(ids.parent, 'parent');
  await addUser(ids.teammate, 'athlete');
  await addUser(ids.outsider, 'athlete');
  await addUser(ids.staff, 'staff');
  const [college] = await t.db.insert(colleges).values({ name: 'Tufts' }).returning();
  const [team] = await t.db
    .insert(teams)
    .values({ collegeId: college!.id, sport: 'Soccer', gender: 'women', displayName: 'Jumbos' })
    .returning();
  const [group] = await t.db
    .insert(groups)
    .values({ kind: 'team', name: 'Jumbos', teamId: team!.id })
    .returning();
  await t.db.insert(memberships).values([
    { userId: ids.parent, groupId: group!.id, source: 'join_code' },
    { userId: ids.teammate, groupId: group!.id, source: 'join_code' },
  ]);
  await t.db.insert(children).values({
    id: ids.child,
    parentUserId: ids.parent,
    teamId: team!.id,
    firstName: 'Sam',
    age: 8,
  });
});

afterAll(() => t.close());

const as = (userId: string) => ({ 'x-dev-user-id': userId });

const requestUpload = (userId: string, payload: object) =>
  t.app.inject({ method: 'POST', url: '/uploads', headers: as(userId), payload });

const photo = { mimeType: 'image/jpeg', sizeBytes: 2000, rightsAffirmed: true };

/** Requests an upload, "PUTs" the file into the fake bucket and completes it. */
const upload = async (userId: string, payload: object) => {
  const res = await requestUpload(userId, payload);
  expect(res.statusCode).toBe(201);
  const body = UploadResponse.parse(res.json());
  const [row] = await t.db.select().from(media).where(eq(media.id, body.mediaId));
  t.objects.set(row!.storageKey, { contentType: row!.mimeType, byteSize: row!.sizeBytes });
  const done = await t.app.inject({
    method: 'POST',
    url: `/uploads/${body.mediaId}/complete`,
    headers: as(userId),
  });
  expect(done.statusCode).toBe(204);
  return body.mediaId;
};

const view = (userId: string, mediaId: string) =>
  t.app.inject({ method: 'GET', url: `/media/${mediaId}`, headers: as(userId) });

describe('upload', () => {
  it('needs a signed-in user', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/uploads',
      payload: { purpose: 'card_photo', ...photo },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns a signed PUT with type and size pinned, and stores the rights affirmation', async () => {
    const res = await requestUpload(ids.teammate, { purpose: 'card_photo', ...photo });
    expect(res.statusCode).toBe(201);
    const body = UploadResponse.parse(res.json());
    expect(body.headers).toEqual({ 'content-type': 'image/jpeg', 'content-length': '2000' });
    const [row] = await t.db.select().from(media).where(eq(media.id, body.mediaId));
    expect(row).toMatchObject({ status: 'pending', purpose: 'card_photo', sizeBytes: 2000 });
    expect(row!.rightsAffirmedAt).toBeInstanceOf(Date);
  });

  it('rejects files over the cap, the wrong type, or photos without a rights affirmation', async () => {
    const tooBig = await requestUpload(ids.teammate, {
      purpose: 'post_image',
      ...photo,
      sizeBytes: 50 * 1024 * 1024,
    });
    const wrongType = await requestUpload(ids.teammate, {
      purpose: 'resume',
      mimeType: 'text/html',
      sizeBytes: 2000,
    });
    const noRights = await requestUpload(ids.teammate, {
      purpose: 'post_image',
      mimeType: 'image/png',
      sizeBytes: 2000,
    });
    expect([tooBig.statusCode, wrongType.statusCode, noRights.statusCode]).toEqual([400, 400, 400]);
  });

  it("only lets a child's parent upload their photo", async () => {
    const res = await requestUpload(ids.teammate, {
      purpose: 'child_photo',
      childId: ids.child,
      ...photo,
    });
    expect(res.statusCode).toBe(403);
  });

  it('will not complete until the file is in the bucket', async () => {
    const res = await requestUpload(ids.teammate, {
      purpose: 'resume',
      mimeType: 'application/pdf',
      sizeBytes: 3000,
    });
    const { mediaId } = UploadResponse.parse(res.json());
    const complete = await t.app.inject({
      method: 'POST',
      url: `/uploads/${mediaId}/complete`,
      headers: as(ids.teammate),
    });
    expect(complete.statusCode).toBe(409);
  });
});

describe('child photos through the access layer', () => {
  let photoId: string;
  beforeAll(async () => {
    photoId = await upload(ids.parent, { purpose: 'child_photo', childId: ids.child, ...photo });
  });

  it('becomes the child profile photo once complete', async () => {
    const [child] = await t.db.select().from(children).where(eq(children.id, ids.child));
    expect(child!.photoMediaId).toBe(photoId);
  });

  it('shows the photo to the parent and the team via a short-lived signed URL', async () => {
    for (const viewer of [ids.parent, ids.teammate]) {
      const res = await view(viewer, photoId);
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain('signature=get');
    }
  });

  it('hides the photo from anyone outside the team and family, staff included', async () => {
    expect((await view(ids.outsider, photoId)).statusCode).toBe(404);
    expect((await view(ids.staff, photoId)).statusCode).toBe(404);
  });

  it('does not serve an upload that was never completed', async () => {
    const res = await requestUpload(ids.parent, {
      purpose: 'child_photo',
      childId: ids.child,
      ...photo,
    });
    const { mediaId } = UploadResponse.parse(res.json());
    expect((await view(ids.parent, mediaId)).statusCode).toBe(404);
  });
});

describe('staff takedown', () => {
  it('is staff only', async () => {
    const mediaId = await upload(ids.teammate, { purpose: 'post_image', ...photo });
    const res = await t.app.inject({
      method: 'POST',
      url: `/staff/media/${mediaId}/takedown`,
      headers: as(ids.teammate),
    });
    expect(res.statusCode).toBe(403);
  });

  it('deletes the file, unlinks it from the child, and stops serving it', async () => {
    const mediaId = await upload(ids.parent, {
      purpose: 'child_photo',
      childId: ids.child,
      ...photo,
    });
    const [row] = await t.db.select().from(media).where(eq(media.id, mediaId));
    const res = await t.app.inject({
      method: 'POST',
      url: `/staff/media/${mediaId}/takedown`,
      headers: as(ids.staff),
    });
    expect(res.statusCode).toBe(204);

    const [after] = await t.db.select().from(media).where(eq(media.id, mediaId));
    expect(after!.status).toBe('taken_down');
    expect(t.objects.has(row!.storageKey)).toBe(false);
    const [child] = await t.db.select().from(children).where(eq(children.id, ids.child));
    expect(child!.photoMediaId).toBeNull();
    expect((await view(ids.parent, mediaId)).statusCode).toBe(404);
  });
});
