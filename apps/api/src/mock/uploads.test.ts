// Child photos (PRD §2, F3) through the upload flow of the uploads PR (#8), on the mock API: the
// parent asks for a signed URL (affirming they may share the photo), PUTs the file, confirms, and
// the photo is then visible to exactly who may see the child: their team and family.
import { afterEach, describe, expect, it } from 'vitest';
import type { Role } from '@team-impact/contracts';
import { buildApp } from '../app';
import { CHILDREN, USERS } from './fixtures';
import { receiveFile, startUpload, UPLOAD_URL_TTL_MS } from './uploads';
import { MockWorld } from './world';

const MATEO = CHILDREN[0]!; // Lisa's son, on the team
const PHOTO = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array.from({ length: 60 }, (_, i) => i)]);

let close: (() => Promise<void>) | undefined;
afterEach(() => close?.());

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

const world = async () => {
  const app = await buildApp({ sessionSecret: 'x'.repeat(32), corsOrigins: [], mock: true });
  close = () => app.close();
  const raw = (method: Method, url: string, body: Buffer, contentType: string) =>
    app.inject({ method, url, payload: body, headers: { 'content-type': contentType } });
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
        ...(payload ? { payload } : {}),
        cookies: { [cookie.name]: cookie.value },
      });
      return { status: r.statusCode, body: r.body ? safeJson(r.body) : null, raw: r.rawPayload, r };
    };
    return {
      get: (url: string) => call('GET', url),
      post: (url: string, payload: object = {}) => call('POST', url, payload),
      del: (url: string) => call('DELETE', url),
    };
  };
  return { as, raw, inject: app.inject.bind(app) };
};

const safeJson = (text: string) => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const childPhoto = (overrides: object = {}) => ({
  purpose: 'child_photo',
  childId: MATEO.id,
  mimeType: 'image/jpeg',
  sizeBytes: PHOTO.length,
  rightsAffirmed: true,
  ...overrides,
});

/** The whole flow as the app does it: ask, PUT, confirm. Returns the media id. */
const uploadMateoPhoto = async (w: Awaited<ReturnType<typeof world>>) => {
  const lisa = await w.as('parent');
  const asked = await lisa.post('/uploads', childPhoto());
  expect(asked.status).toBe(201);
  const { mediaId, url, method, headers } = asked.body;
  expect(method).toBe('PUT');
  const put = await w.raw('PUT', new URL(url).pathname, PHOTO, headers['content-type']);
  expect(put.statusCode).toBe(200);
  expect((await lisa.post(`/uploads/${mediaId}/complete`)).status).toBe(204);
  return { lisa, mediaId: mediaId as string };
};

describe('child photos: uploading', () => {
  it('a parent uploads their child’s photo, and the profile shows it', async () => {
    const w = await world();
    const { lisa, mediaId } = await uploadMateoPhoto(w);
    const profile = (await lisa.get(`/profiles/${MATEO.id}`)).body;
    expect(profile.photoUrl).toMatch(new RegExp(`/media/${mediaId}$`));
    const children = (await lisa.get('/children')).body;
    expect(children.find((c: { id: string }) => c.id === MATEO.id).photoUrl).toBe(profile.photoUrl);

    const file = await lisa.get(`/media/${mediaId}`);
    expect(file.status).toBe(200);
    expect(file.r.headers['content-type']).toBe('image/jpeg');
    expect(Buffer.compare(file.raw, PHOTO)).toBe(0);
  });

  it('only the child’s own parent can upload it', async () => {
    const w = await world();
    for (const [role, newcomer] of [
      ['athlete', false],
      ['coach', false],
      ['parent', true], // Rosa, another family
    ] as const) {
      const res = await (await w.as(role, newcomer)).post('/uploads', childPhoto());
      expect(res.status, `${role}${newcomer ? ' (newcomer)' : ''}`).toBe(403);
    }
  });

  it('requires affirming the right to share the photo', async () => {
    const w = await world();
    const lisa = await w.as('parent');
    for (const rightsAffirmed of [false, undefined]) {
      expect((await lisa.post('/uploads', childPhoto({ rightsAffirmed }))).status).toBe(400);
    }
  });

  it('refuses files that aren’t photos, or are too big', async () => {
    const w = await world();
    const lisa = await w.as('parent');
    for (const overrides of [
      { mimeType: 'image/heic' },
      { mimeType: 'application/pdf' },
      { sizeBytes: 10 * 1024 * 1024 + 1 },
      { sizeBytes: 0 },
    ]) {
      expect(
        (await lisa.post('/uploads', childPhoto(overrides))).status,
        JSON.stringify(overrides),
      ).toBe(400);
    }
  });

  it('the signed link accepts only exactly the file it was signed for', async () => {
    const w = await world();
    const lisa = await w.as('parent');
    const { mediaId, url } = (await lisa.post('/uploads', childPhoto())).body;
    const path = new URL(url).pathname;
    expect((await w.raw('PUT', path, Buffer.concat([PHOTO, PHOTO]), 'image/jpeg')).statusCode).toBe(
      403,
    );
    expect((await w.raw('PUT', path, PHOTO, 'image/png')).statusCode).toBe(403);
    // Confirming before the file arrived is refused; the photo isn't set.
    expect((await lisa.post(`/uploads/${mediaId}/complete`)).status).toBe(409);
    expect((await lisa.get(`/profiles/${MATEO.id}`)).body.photoUrl).toBeNull();
  });

  it('only the uploader can confirm, and a pending file can’t be read', async () => {
    const w = await world();
    const lisa = await w.as('parent');
    const { mediaId, url } = (await lisa.post('/uploads', childPhoto())).body;
    await w.raw('PUT', new URL(url).pathname, PHOTO, 'image/jpeg');
    expect((await lisa.get(`/media/${mediaId}`)).status).toBe(404); // not confirmed yet
    expect((await (await w.as('coach')).post(`/uploads/${mediaId}/complete`)).status).toBe(404);
  });

  it('a link stops working after five minutes', () => {
    const w = new MockWorld({ identitySearch: true, medicalCommunities: true });
    const lisa = w.user(USERS.lisa.id)!;
    const now = Date.now();
    const upload = startUpload(
      w,
      lisa,
      {
        purpose: 'child_photo',
        childId: MATEO.id,
        mimeType: 'image/jpeg',
        sizeBytes: PHOTO.length,
        rightsAffirmed: true,
      },
      now,
    );
    if ('error' in upload) throw new Error(upload.error);
    expect(
      receiveFile(w, upload.id, 'image/jpeg', PHOTO, now + UPLOAD_URL_TTL_MS + 1),
    ).toMatchObject({
      status: 403,
    });
    expect(receiveFile(w, upload.id, 'image/jpeg', PHOTO, now + UPLOAD_URL_TTL_MS - 1)).toBeNull();
  });
});

describe('child photos: who sees them', () => {
  it('the team and family see the photo; nobody else does', async () => {
    const w = await world();
    const { mediaId } = await uploadMateoPhoto(w);
    for (const role of ['parent', 'coach', 'athlete', 'teen'] as const) {
      expect((await (await w.as(role)).get(`/media/${mediaId}`)).status, role).toBe(200);
    }
    for (const [role, newcomer] of [
      ['recruiter', false],
      ['staff', false],
      ['alumni_athlete', false],
      ['parent', true],
    ] as const) {
      const res = await (await w.as(role, newcomer)).get(`/media/${mediaId}`);
      expect(res.status, `${role}${newcomer ? ' (newcomer)' : ''}`).toBe(404);
    }
  });

  it('is hidden from someone who blocked the parent', async () => {
    const w = await world();
    const { mediaId } = await uploadMateoPhoto(w);
    const jordan = await w.as('athlete');
    expect((await jordan.get(`/media/${mediaId}`)).status).toBe(200);
    expect((await jordan.post(`/blocks/${USERS.lisa.id}`)).status).toBe(201);
    expect((await jordan.get(`/media/${mediaId}`)).status).toBe(404);
  });

  it('needs a session, and is erased with the parent’s account', async () => {
    const w = await world();
    const { lisa, mediaId } = await uploadMateoPhoto(w);
    expect((await w.inject({ method: 'GET', url: `/media/${mediaId}` })).statusCode).toBe(401);
    expect((await lisa.del('/me')).status).toBe(204);
    expect((await (await w.as('coach')).get(`/media/${mediaId}`)).status).toBe(404);
  });
});
