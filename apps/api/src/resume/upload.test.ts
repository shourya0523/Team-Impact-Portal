import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { USERS } from '../mock/fixtures';
import { buildScan } from './test/build-pdf';
import { CORPUS, longPdf } from './test/corpus';

/** POST /cards/me/resume with a real file: the route the athlete app's upload screen calls. */
let close: (() => Promise<void>) | undefined;
afterEach(() => close?.());

const signedIn = async () => {
  const app = await buildApp({ sessionSecret: 'x'.repeat(32), corsOrigins: [], mock: true });
  close = () => app.close();
  const as = async (role: 'athlete' | 'recruiter') => {
    const res = await app.inject({ method: 'POST', url: '/auth/dev-sign-in', payload: { role } });
    const cookie = res.cookies[0]!;
    return (method: 'GET' | 'POST', url: string, payload?: object) =>
      app.inject({ method, url, payload, cookies: { [cookie.name]: cookie.value } });
  };
  return { athlete: await as('athlete'), recruiter: await as('recruiter') };
};

const upload = (bytes: Uint8Array, mimeType = 'application/pdf') => ({
  fileName: 'resume.pdf',
  mimeType,
  sizeBytes: bytes.byteLength,
  fileBase64: Buffer.from(bytes).toString('base64'),
});

describe('POST /cards/me/resume with a file', () => {
  it('reads the PDF into an unconfirmed extraction that nobody else can see', async () => {
    const { athlete, recruiter } = await signedIn();
    const c = CORPUS.find((x) => x.name === 'double-major-two-schools')!;
    const res = await athlete('POST', '/cards/me/resume', upload(await c.pdf()));
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      status: 'unconfirmed',
      failed: false,
      failReason: null,
      fields: { major: 'Computer Science and Mathematics', classYear: 2026 },
    });
    expect(body.check).toEqual(expect.arrayContaining(['major', 'classYear']));
    expect(body.needsReview).toEqual(expect.arrayContaining(body.check));

    const before = await athlete('GET', '/cards/me');
    expect(before.json().draft).toBeNull();
    const card = await recruiter('GET', `/cards/${USERS.jordan.id}`);
    expect(card.body).not.toContain('Northwind');
  });

  it('refuses a file that is not what it claims to be', async () => {
    const { athlete } = await signedIn();
    const res = await athlete(
      'POST',
      '/cards/me/resume',
      upload(new TextEncoder().encode('<html></html>')),
    );
    expect(res.statusCode).toBe(400);
  });

  it('refuses resumes over three pages', async () => {
    const { athlete } = await signedIn();
    const res = await athlete('POST', '/cards/me/resume', upload(await longPdf()));
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain('3 pages');
  });

  it('falls back to typing the card in for a scan when OCR is not set up', async () => {
    const { athlete } = await signedIn();
    const res = await athlete('POST', '/cards/me/resume', upload(await buildScan()));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ failed: true, failReason: 'no_text', fields: {} });
  });

  it('is for card holders only', async () => {
    const { recruiter } = await signedIn();
    const c = CORPUS[0]!;
    expect((await recruiter('POST', '/cards/me/resume', upload(await c.pdf()))).statusCode).toBe(
      403,
    );
  });
});
