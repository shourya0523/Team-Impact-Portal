import { afterEach, describe, expect, it } from 'vitest';
import { CONSENT_FLAGS, CURRENT_TERMS_VERSION, mustAcceptTerms } from '@team-impact/contracts';
import { consentsOf } from '../mock/signup';
import { INVITE_TOKENS } from '../mock/team';
import { anonymous, mockApp, signInAs } from './agents';

// TI-107: sign-up accepts only the current terms, a teen also confirms a parent or guardian
// agreed, and the accepted version is stored with the account.

let close: (() => Promise<void>) | undefined;
afterEach(() => close?.());

const setup = async () => {
  const m = await mockApp();
  close = m.close;
  return m;
};

const bornYearsAgo = (years: number) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

const adult = {
  email: 'casey.terms@example.org',
  password: 'correct horse battery',
  firstName: 'Casey',
  lastName: 'Terms',
  birthDate: bornYearsAgo(20),
  role: 'athlete',
  acceptTerms: true,
  termsVersion: CURRENT_TERMS_VERSION,
};
const teen = {
  ...adult,
  email: 'tess.teen@example.org',
  birthDate: bornYearsAgo(15),
  role: 'teen',
  parentAgreed: true,
};
const recruiter = {
  email: 'robin.terms@northbeam.com',
  password: 'correct horse battery',
  firstName: 'Robin',
  lastName: 'Terms',
  acceptTerms: true,
  termsVersion: CURRENT_TERMS_VERSION,
};

/** `obj` without `key`, for requests that leave a field out. */
const without = <T extends object>(obj: T, key: keyof T) =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));

const issuePaths = (body: { error: { issues?: { path: string[] }[] } }) =>
  body.error.issues?.map((i) => i.path.join('.'));

describe('terms acceptance at sign-up (TI-107)', () => {
  it('refuses a missing or outdated terms version, and creates no account', async () => {
    const { app, world } = await setup();
    const users = world.users.length;
    for (const body of [without(adult, 'termsVersion'), { ...adult, termsVersion: 'v2.0' }]) {
      const res = await anonymous(app).post('/auth/sign-up', body);
      expect(res.status).toBe(400);
      expect(issuePaths(res.body)).toEqual(['body.termsVersion']);
    }
    expect(world.users).toHaveLength(users);
    expect(world.signup.consents).toEqual([]);
  });

  it('refuses a teen without a parent or guardian’s agreement', async () => {
    const { app, world } = await setup();
    for (const body of [without(teen, 'parentAgreed'), { ...teen, parentAgreed: false }]) {
      const res = await anonymous(app).post('/auth/sign-up', body);
      expect(res.status).toBe(400);
      expect(issuePaths(res.body)).toEqual(['body.parentAgreed']);
    }
    expect(world.users.some((u) => u.email === teen.email)).toBe(false);
  });

  it('records the accepted version for an adult', async () => {
    const { app, world } = await setup();
    const res = await anonymous(app).post('/auth/sign-up', adult);
    expect(res.status).toBe(201);
    expect(consentsOf(world.signup, res.body.id)).toEqual([
      expect.objectContaining({
        flag: CONSENT_FLAGS.terms,
        value: true,
        termsVersion: CURRENT_TERMS_VERSION,
      }),
    ]);
  });

  it('records a teen’s acceptance and their parent or guardian’s agreement, with the version', async () => {
    const { app, world } = await setup();
    const res = await anonymous(app).post('/auth/sign-up', teen);
    expect(res.status).toBe(201);
    const records = consentsOf(world.signup, res.body.id);
    expect(records.map((r) => [r.flag, r.value, r.termsVersion])).toEqual([
      [CONSENT_FLAGS.terms, true, CURRENT_TERMS_VERSION],
      [CONSENT_FLAGS.parentAgreed, true, CURRENT_TERMS_VERSION],
    ]);
  });

  it('records the version a new coach accepts from their invite', async () => {
    const { app, world } = await setup();
    const coach = anonymous(app);
    const newAccount = {
      firstName: 'Pat',
      lastName: 'Nguyen',
      password: 'correct horse battery',
      acceptTerms: true,
    };
    const old = await coach.post(`/invites/${INVITE_TOKENS.lacrosse}/accept`, {
      newAccount: { ...newAccount, termsVersion: '2026-10-draft.1' },
    });
    expect(old.status).toBe(400);
    const res = await coach.post(`/invites/${INVITE_TOKENS.lacrosse}/accept`, {
      newAccount: { ...newAccount, termsVersion: CURRENT_TERMS_VERSION },
    });
    expect(res.status).toBe(200);
    expect(consentsOf(world.signup, res.body.id).map((r) => r.termsVersion)).toEqual([
      CURRENT_TERMS_VERSION,
    ]);
  });

  it('keeps a recruiter’s accepted version while they wait, and records it on approval', async () => {
    const { app, world } = await setup();
    const noVersion = without(recruiter, 'termsVersion');
    expect((await anonymous(app).post('/auth/recruiter-sign-up', noVersion)).status).toBe(400);
    expect((await anonymous(app).post('/auth/recruiter-sign-up', recruiter)).status).toBe(202);

    const staff = await signInAs(app, 'staff');
    const queue = await staff.get('/staff/recruiter-sign-ups');
    // Staff's queue is the contract's shape: the version stays server-side.
    expect(queue.body[0]).not.toHaveProperty('termsVersion');
    const approved = await staff.post(`/staff/recruiter-sign-ups/${queue.body[0].id}/approve`);
    expect(approved.status).toBe(200);
    expect(consentsOf(world.signup, approved.body.user.id)).toEqual([
      expect.objectContaining({ flag: CONSENT_FLAGS.terms, termsVersion: CURRENT_TERMS_VERSION }),
    ]);
  });
});

describe('accepting the terms again after they change (TI-107)', () => {
  /** Signs `body` up, then rewrites their acceptance as if it was of an earlier text. */
  const signedUpOnOldTerms = async (body: object) => {
    const { app, world } = await setup();
    const agent = anonymous(app);
    const res = await agent.post('/auth/sign-up', body);
    expect(res.status).toBe(201);
    for (const c of consentsOf(world.signup, res.body.id)) c.termsVersion = '2026-10-draft.1';
    return { agent, world, id: res.body.id as string };
  };

  it('tells an account on the current text that nothing is needed', async () => {
    const { app } = await setup();
    for (const role of ['athlete', 'parent', 'recruiter', 'staff'] as const) {
      const res = await (await signInAs(app, role)).get('/me/terms');
      expect(res.body).toEqual({
        current: CURRENT_TERMS_VERSION,
        accepted: CURRENT_TERMS_VERSION,
        mustAccept: false,
      });
    }
  });

  it('asks an account on an earlier text to accept the current one, and records it', async () => {
    const { agent, world, id } = await signedUpOnOldTerms(adult);
    expect((await agent.get('/me/terms')).body).toMatchObject({
      accepted: '2026-10-draft.1',
      mustAccept: true,
    });

    const stale = await agent.post('/me/terms', {
      acceptTerms: true,
      termsVersion: '2026-10-draft.1',
    });
    expect(stale.status).toBe(400);
    expect(issuePaths(stale.body)).toEqual(['body.termsVersion']);
    const unticked = await agent.post('/me/terms', { termsVersion: CURRENT_TERMS_VERSION });
    expect(unticked.status).toBe(400);

    const res = await agent.post('/me/terms', {
      acceptTerms: true,
      termsVersion: CURRENT_TERMS_VERSION,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ accepted: CURRENT_TERMS_VERSION, mustAccept: false });
    // Append-only: the earlier acceptance stays on record, with the text it was of.
    expect(consentsOf(world.signup, id).map((c) => c.termsVersion)).toEqual([
      '2026-10-draft.1',
      CURRENT_TERMS_VERSION,
    ]);
  });

  it('has a teen confirm again that a parent or guardian agreed', async () => {
    const { agent, world, id } = await signedUpOnOldTerms(teen);
    const accept = { acceptTerms: true, termsVersion: CURRENT_TERMS_VERSION };
    expect((await agent.post('/me/terms', accept)).status).toBe(400);
    const res = await agent.post('/me/terms', { ...accept, parentAgreed: true });
    expect(res.status).toBe(200);
    expect(
      consentsOf(world.signup, id)
        .slice(-2)
        .map((c) => [c.flag, c.termsVersion]),
    ).toEqual([
      [CONSENT_FLAGS.terms, CURRENT_TERMS_VERSION],
      [CONSENT_FLAGS.parentAgreed, CURRENT_TERMS_VERSION],
    ]);
  });

  it('asks a recruiter approved after the terms changed to accept the new text', async () => {
    const { app, world } = await setup();
    expect((await anonymous(app).post('/auth/recruiter-sign-up', recruiter)).status).toBe(202);
    // The text changed while they waited for staff.
    world.signup.pendingRecruiters[0]!.termsVersion = '2026-10-draft.1';
    const staff = await signInAs(app, 'staff');
    const queue = await staff.get('/staff/recruiter-sign-ups');
    const approved = await staff.post(`/staff/recruiter-sign-ups/${queue.body[0].id}/approve`);
    expect(consentsOf(world.signup, approved.body.user.id).map((c) => c.termsVersion)).toEqual([
      '2026-10-draft.1',
    ]);
    expect(
      mustAcceptTerms(consentsOf(world.signup, approved.body.user.id).at(-1)!.termsVersion),
    ).toBe(true);
  });

  it('needs a session', async () => {
    const { app } = await setup();
    expect((await anonymous(app).get('/me/terms')).status).toBe(401);
  });
});
