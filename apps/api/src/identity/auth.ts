// =============================================================================================
// Better Auth, configured for Team Impact (TI-101).
//
// What Better Auth does for us: sign-up and sign-in with email and password, email verification,
// password reset, sessions (HttpOnly cookie in browsers, device keychain in the Expo app), sign-out,
// and rate limiting on its endpoints. It serves them under /api/auth/* (see routes.ts).
//
// What we add, in its hooks, because they are our product rules (PRD §2, §3, §9):
//   - the age gate and allowed account types (signup-rules.ts), on every sign-up
//   - recruiters only on a domain staff registered for an active company, linked to that company
//   - consent records for the terms (and a teen's "a parent agreed") in consent_records
//   - suspended or deleted accounts, and recruiters of a suspended company, can't sign in
//
// Data: Better Auth uses our own `users` table as its user table, plus auth_sessions,
// auth_accounts and auth_verifications (db/schema/auth.ts). Everything stays in our Postgres.
// =============================================================================================
import { expo } from '@better-auth/expo';
import argon2 from 'argon2';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { and, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/client';
import * as schema from '../db/schema';
import { accountExistsEmail, passwordResetEmail, verificationEmail } from './emails';
import type { Mailer, MailMessage } from './mailer';
import { type AccountType, checkSelfSignup, domainCandidates } from './signup-rules';

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Matches the seed data. Bump when the Terms change; consent records keep the version accepted. */
export const TERMS_VERSION = 'v2.0';

/** argon2id, 64 MiB / 3 passes / 4 lanes: what CLAUDE.md specifies and the seed's hashes use. */
const ARGON2 = { type: argon2.argon2id, memoryCost: 65_536, timeCost: 3, parallelism: 4 } as const;

export interface AuthConfig {
  db: Db;
  /** Signs cookies and tokens. At least 32 random characters (SESSION_SECRET). */
  secret: string;
  /** Where the API is reached, e.g. https://api.teamimpact.org. Emailed links point here first. */
  baseURL: string;
  /** Browser origins allowed to call auth: the portal and the athlete app on web. */
  trustedOrigins: string[];
  /** Where a link lands once the API has handled it: recruiters and staff on the portal. */
  links: { portalUrl: string; athleteAppUrl: string };
  mailer: Mailer;
  /** Logs a failed email send; the user can always ask for the link again. */
  onMailError: (error: unknown, message: MailMessage) => void;
  production: boolean;
  /** Rate limiting is on in production; tests turn it on to check it. */
  rateLimit?: boolean;
}

/**
 * Recruiters and staff work in the portal; everyone else in the athlete app. Better Auth's email
 * callbacks type `user` without our extra fields, but the record they pass carries them.
 */
const appUrlFor = (links: AuthConfig['links'], user: object) => {
  const { userType } = user as { userType?: unknown };
  return userType === 'recruiter' || userType === 'staff' ? links.portalUrl : links.athleteAppUrl;
};

const refuse = (field: string, message: string) =>
  new APIError('BAD_REQUEST', { code: 'SIGNUP_REFUSED', field, message });

export const createAuth = (config: AuthConfig) => {
  const { db, mailer, links } = config;

  /**
   * Better Auth advises not to await email sends inside a request, so response time doesn't reveal
   * whether an email went out (and so whether an account exists). A failed send is logged.
   */
  const deliver = (message: MailMessage) => {
    mailer.send(message).catch((error: unknown) => config.onMailError(error, message));
  };

  /** The most specific registered domain of an active company the email is on, if any. */
  const companyFor = async (email: string) => {
    const matches = await db
      .select({ orgId: schema.orgDomains.orgId, domain: schema.orgDomains.domain })
      .from(schema.orgDomains)
      .innerJoin(schema.orgs, eq(schema.orgs.id, schema.orgDomains.orgId))
      .where(
        and(
          eq(schema.orgs.status, 'active'),
          inArray(schema.orgDomains.domain, domainCandidates(email)),
        ),
      );
    return matches.sort((a, b) => b.domain.length - a.domain.length)[0]?.orgId ?? null;
  };

  return betterAuth({
    appName: 'Team Impact',
    secret: config.secret,
    baseURL: config.baseURL,
    basePath: '/api/auth',
    trustedOrigins: [
      ...config.trustedOrigins,
      // The Expo app's deep-link scheme (apps/athlete/app.json).
      'teamimpact://',
      // Expo Go during development only: it serves the app from exp:// on a local IP.
      ...(config.production ? [] : ['exp://']),
    ],
    telemetry: { enabled: false },
    // Per-IP limits on every auth endpoint, stricter on sign-in and sign-up (Better Auth's
    // defaults). In memory, so per API instance: move to Valkey when there is more than one.
    rateLimit: {
      enabled: config.rateLimit ?? config.production,
      customRules: {
        // A whole team may sign up together on one campus Wi-Fi (one IP). 20 a minute allows that
        // burst while keeping password guessing near Better Auth's default daily rate (3 per 10s).
        '/sign-in/email': { window: MINUTE, max: 20 },
        '/sign-up/email': { window: MINUTE, max: 20 },
        // Both send an email to whatever address is typed: keep them from flooding an inbox.
        '/send-verification-email': { window: 5 * MINUTE, max: 3 },
        '/request-password-reset': { window: 5 * MINUTE, max: 3 },
      },
    },
    // Only the endpoints we use are served. The rest would let a signed-in user edit or delete
    // their account outside our rules (profile edits and account deletion are our own routes),
    // or reach social sign-in, which isn't set up.
    disabledPaths: [
      '/update-user',
      '/change-email',
      '/delete-user',
      '/delete-user/callback',
      '/update-session',
      '/sign-in/social',
      '/link-social',
      '/unlink-account',
      '/callback/:id',
      '/get-access-token',
      '/refresh-token',
      '/account-info',
      '/list-accounts',
      '/expo-authorization-proxy',
      // Revokes one session by its token, which responses no longer carry (routes.ts). Sign-out,
      // "sign out everywhere" and "sign out other devices" still work.
      '/revoke-session',
    ],

    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.users,
        session: schema.authSessions,
        account: schema.authAccounts,
        verification: schema.authVerifications,
      },
    }),
    advanced: {
      // Postgres makes the ids (uuid, gen_random_uuid()), like every other table.
      database: { generateId: false },
      cookiePrefix: 'ti',
    },

    user: {
      // Better Auth's `name` is our first name; the rest of the profile is ours.
      fields: { name: 'firstName' },
      additionalFields: {
        lastName: { type: 'string', required: true },
        // Server-owned (`input: false`): no request can write them directly, at sign-up or after.
        // Sign-up sends `accountType` and `birthDate`, which the create hook validates and copies
        // in; nothing can change them later. The database's NOT NULL still backs this up.
        userType: { type: [...schema.userType.enumValues], required: false, input: false },
        // Birth date is collected only for the age gate, and never sent back to anyone.
        dob: { type: 'string', required: false, input: false, returned: false },
        status: { type: ['active', 'suspended'], required: false, input: false },
        orgId: { type: 'string', required: false, input: false },
      },
    },

    emailAndPassword: {
      enabled: true,
      // Length is the only password rule (NIST SP 800-63B); the cap stops huge inputs.
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      // Signing up never signs you in: the email has to be verified first.
      autoSignIn: false,
      password: {
        hash: (password) => argon2.hash(password, ARGON2),
        // A hash argon2 can't read (bad data) counts as a wrong password, never a crash.
        verify: ({ hash, password }) => argon2.verify(hash, password).catch(() => false),
      },
      resetPasswordTokenExpiresIn: 30 * MINUTE,
      // Whoever had the old password loses access everywhere.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, token }) => {
        const landing = `${appUrlFor(links, user)}/reset-password`;
        const url = `${config.baseURL}/api/auth/reset-password/${token}?callbackURL=${encodeURIComponent(landing)}`;
        deliver(passwordResetEmail(user.email, user.name, url));
      },
      // Someone signed up with a taken address: tell the real owner, reveal nothing to the caller.
      onExistingUserSignUp: async ({ user }) => {
        deliver(accountExistsEmail(user.email, user.name));
      },
    },

    emailVerification: {
      sendOnSignUp: true,
      // Signing in unverified sends a fresh link (and is refused with 403).
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      expiresIn: DAY,
      sendVerificationEmail: async ({ user, token }) => {
        // The link goes to the API, which verifies it and then opens the app or portal.
        const landing = `${appUrlFor(links, user)}/verified`;
        const url = `${config.baseURL}/api/auth/verify-email?token=${token}&callbackURL=${encodeURIComponent(landing)}`;
        deliver(verificationEmail(user.email, user.name, url));
      },
      // Keep TI-14's verification timestamp alongside Better Auth's flag.
      afterEmailVerification: async (user) => {
        await db
          .update(schema.users)
          .set({ emailVerifiedAt: new Date() })
          .where(eq(schema.users.id, user.id));
      },
    },

    session: {
      // A session ends after 14 days unused; each day of use pushes that forward.
      expiresIn: 14 * DAY,
      updateAge: DAY,
      // Off: every request reads the session from the database, so signing out, a password reset
      // or a suspension takes effect at once instead of after a cache window.
      cookieCache: { enabled: false },
    },

    databaseHooks: {
      user: {
        create: {
          /**
           * Every sign-up made over HTTP passes the age and role rules; nothing can skip them by
           * calling Better Auth's endpoint directly. Accounts made by the server itself (staff
           * by script, coaches by invite) have no request and are trusted.
           */
          before: async (user, ctx) => {
            if (!ctx?.request) return;
            const body = (ctx.body ?? {}) as Record<string, unknown>;
            const refusal = checkSelfSignup({
              accountType: body.accountType,
              birthDate: body.birthDate,
              email: user.email,
              acceptTerms: body.acceptTerms,
              parentAgreed: body.parentAgreed,
            });
            if (refusal) throw refuse(refusal.field, refusal.message);
            // Checked above: a self-sign-up type and a real ISO date.
            const userType = body.accountType as AccountType;
            const dob = body.birthDate as string;

            if (userType !== 'recruiter') return { data: { ...user, userType, dob } };

            const orgId = await companyFor(user.email);
            if (!orgId) {
              throw refuse(
                'email',
                'Your company isn’t a registered Team Impact partner yet. Ask your Team Impact contact to add it.',
              );
            }
            return { data: { ...user, userType, dob, orgId } };
          },
          /** What a self-sign-up agreed to, kept as consent history (PRD §6). */
          after: async (user, ctx) => {
            if (!ctx?.request) return;
            const flags = user.userType === 'teen' ? ['terms', 'parent_agreed'] : ['terms'];
            await db.insert(schema.consentRecords).values(
              flags.map((flag) => ({
                userId: user.id,
                flag,
                value: true,
                termsVersion: TERMS_VERSION,
              })),
            );
          },
        },
      },
      session: {
        create: {
          /**
           * Runs only after the password checked out, so these answers reveal nothing to a
           * guesser. A deleted account reads as "no such account".
           */
          before: async (session) => {
            const [row] = await db
              .select({
                status: schema.users.status,
                deletedAt: schema.users.deletedAt,
                userType: schema.users.userType,
                orgStatus: schema.orgs.status,
              })
              .from(schema.users)
              .leftJoin(schema.orgs, eq(schema.orgs.id, schema.users.orgId))
              .where(eq(schema.users.id, session.userId));
            const block = signInBlock(row);
            if (block === 'deleted') {
              throw new APIError('UNAUTHORIZED', {
                code: 'INVALID_EMAIL_OR_PASSWORD',
                message: 'Invalid email or password',
              });
            }
            if (block === 'suspended') {
              throw new APIError('FORBIDDEN', {
                code: 'ACCOUNT_SUSPENDED',
                message:
                  'This account is suspended. Contact appdev@teamimpact.org if you think that’s a mistake.',
              });
            }
          },
        },
      },
    },

    plugins: [expo()],
  });
};

export type Auth = ReturnType<typeof createAuth>;

export interface SignInState {
  status: 'active' | 'suspended';
  deletedAt: Date | null;
  userType: AccountType;
  orgStatus: 'active' | 'suspended' | null;
}

/**
 * Why an account can't hold a session, or null if it can. Used when signing in and on every
 * request (session.ts), so a suspension or deletion takes effect immediately.
 */
export const signInBlock = (row: SignInState | undefined): 'deleted' | 'suspended' | null => {
  if (!row || row.deletedAt) return 'deleted';
  if (row.status !== 'active') return 'suspended';
  // A recruiter's access comes from their company (PRD §3): no active company, no access.
  if (row.userType === 'recruiter' && row.orgStatus !== 'active') return 'suspended';
  return null;
};
