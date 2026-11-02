import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { getTableName, type SQL } from 'drizzle-orm';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import type { PgTable } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import type { Db } from '../db/client';
import * as schema from '../db/schema';

const MIGRATIONS = fileURLToPath(new URL('../../drizzle', import.meta.url));

/**
 * The Postgres server tests run against, if any (TI-89). CI sets `DATABASE_URL` to its throwaway
 * Postgres service (turbo passes only declared env to `test`, and `test` declares that one);
 * `TEST_DATABASE_URL` wins when both are set. Unset, tests use in-memory PGlite.
 *
 * Tests never touch the database the URL names: each `createTestDb()` creates its own database on
 * that server and drops it on `close()`, so the role needs CREATEDB.
 */
export const testDatabaseUrl = () =>
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || undefined;

export interface TestDb {
  db: Db;
  /** Which engine this test got: `postgres` in CI, `pglite` locally unless a URL is set. */
  driver: 'postgres' | 'pglite';
  /** Runs raw SQL and returns its rows, the same shape on either driver. */
  rows: (query: SQL) => Promise<Record<string, unknown>[]>;
  /** Inserts rows table by table, in order (parents first), like `pnpm db:seed`. */
  seed: (tables: readonly (readonly [PgTable, readonly object[]])[]) => Promise<void>;
  close: () => Promise<void>;
}

const seedWith =
  (db: Db): TestDb['seed'] =>
  async (tables) => {
    for (const [table, tableRows] of tables) {
      // Stay well under Postgres's 65,535 bind-parameter limit.
      for (let i = 0; i < tableRows.length; i += 500) {
        try {
          await db.insert(table).values(tableRows.slice(i, i + 500) as never);
        } catch (e) {
          throw new Error(`Seeding ${getTableName(table)} failed: ${(e as Error).message}`, {
            cause: e,
          });
        }
      }
    }
  };

/** A fresh database on the test server, migrated, and dropped again on close. */
const createPostgresDb = async (url: string): Promise<TestDb> => {
  const name = `ti_test_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
  const admin = postgres(url, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database "${name}"`);
  const target = new URL(url);
  target.pathname = `/${name}`;
  const client = postgres(target.toString(), { max: 5, onnotice: () => {} });
  const db = drizzlePostgres(client, { schema });
  const close = async () => {
    await client.end({ timeout: 5 });
    await admin.unsafe(`drop database if exists "${name}" with (force)`);
    await admin.end({ timeout: 5 });
  };
  try {
    await migratePostgres(db, { migrationsFolder: MIGRATIONS });
  } catch (e) {
    await close();
    throw e;
  }
  return {
    db,
    driver: 'postgres',
    rows: async (query) => [...(await db.execute(query))] as Record<string, unknown>[],
    seed: seedWith(db),
    close,
  };
};

/** An in-memory Postgres (PGlite) with the real migrations applied, so tests need no server. */
const createPgliteDb = async (): Promise<TestDb> => {
  const client = new PGlite();
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS });
  return {
    db,
    driver: 'pglite',
    rows: async (query) => (await db.execute(query)).rows as Record<string, unknown>[],
    seed: seedWith(db),
    close: () => client.close(),
  };
};

/**
 * A throwaway database with the real migrations applied (TI-89). Each call is isolated: a fresh
 * database on the test server when one is configured (`testDatabaseUrl`), otherwise a fresh
 * in-memory PGlite. Always `close()` it (in `afterAll`) so CI drops what it created.
 */
export const createTestDb = (): Promise<TestDb> => {
  const url = testDatabaseUrl();
  return url ? createPostgresDb(url) : createPgliteDb();
};

/** Booting PGlite or creating and migrating a database can take a while on a busy CI runner. */
export const DB_TIMEOUT_MS = 30_000;
