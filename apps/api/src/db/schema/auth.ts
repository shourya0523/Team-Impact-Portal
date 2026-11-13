import { index, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { at, createdAt, id } from './columns';
import { users } from './identity';

// Better Auth's tables (TI-101). It also uses `users` itself as its user table, so an account is one
// row in `users` plus the rows here. Column names follow Better Auth's model (see `authSchema` in
// src/identity/auth.ts for the mapping); every foreign key cascades, so deleting a user (or the
// 30-day erasure job) takes their sessions, sign-in methods and pending links with it.

const updatedAt = () =>
  at('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/**
 * One row per signed-in device. Browsers carry `token` in an HttpOnly cookie; the Expo app keeps it
 * in the device keychain. A session ends at `expires_at` (pushed forward while it's used), or when
 * the row is deleted: sign out, password reset, or a suspension.
 */
export const authSessions = pgTable(
  'auth_sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: at('expires_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('auth_sessions_user_id_idx').on(t.userId)],
);

/**
 * How a user signs in. Email and password is one row with `provider_id = 'credential'` and the
 * password hash in `password`; a later phone number or social sign-in adds its own row. The token
 * columns are only used by social providers.
 */
export const authAccounts = pgTable(
  'auth_accounts',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    password: text('password'),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: at('access_token_expires_at'),
    refreshTokenExpiresAt: at('refresh_token_expires_at'),
    scope: text('scope'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('auth_accounts_user_id_idx').on(t.userId),
    unique('auth_accounts_provider_account_key').on(t.providerId, t.accountId),
  ],
);

/** Short-lived values behind emailed links, such as password resets. Deleted once used. */
export const authVerifications = pgTable(
  'auth_verifications',
  {
    id: id(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: at('expires_at').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('auth_verifications_identifier_idx').on(t.identifier)],
);
