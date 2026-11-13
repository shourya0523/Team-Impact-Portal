// A fresh, migrated Postgres database for tests that need the real schema and SQL (the mock API's
// tests don't). Locally that's the docker compose Postgres; CI runs a Postgres service.
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { createDb } from '../db/client';

/** A database the tests may drop and recreate. Must never point at real data. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/team_impact_test';

if (!new URL(TEST_DATABASE_URL).pathname.endsWith('_test')) {
  throw new Error('TEST_DATABASE_URL must name a database ending in _test: tests drop it.');
}

/**
 * Drops and recreates the test database, applies every migration, and returns a client. Test files
 * run in parallel, so each file that needs its own database passes a `label`: `team_impact_test`
 * becomes `team_impact_<label>_test`, still ending in `_test`.
 */
export const freshTestDatabase = async (label?: string) => {
  const url = new URL(TEST_DATABASE_URL);
  if (label) url.pathname = url.pathname.replace(/_test$/, `_${label}_test`);
  const name = url.pathname.slice(1);
  const admin = postgres({
    host: url.hostname,
    port: Number(url.port || 5432),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: 'postgres',
    max: 1,
    onnotice: () => {},
  });
  try {
    await admin.unsafe(`drop database if exists "${name}" with (force)`);
    await admin.unsafe(`create database "${name}"`);
  } catch (error) {
    throw new Error(
      `Can't prepare the test database at ${url.host}. Is Postgres running? (docker compose up -d)`,
      { cause: error },
    );
  } finally {
    await admin.end();
  }

  const migrator = postgres(url.toString(), { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(migrator), {
      migrationsFolder: new URL('../../drizzle', import.meta.url).pathname,
    });
  } finally {
    await migrator.end();
  }
  return createDb(url.toString());
};
