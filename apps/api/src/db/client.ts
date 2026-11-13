import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const createDb = (databaseUrl: string) => {
  const sql = postgres(databaseUrl);
  return { db: drizzle(sql, { schema }), close: () => sql.end() };
};

/** Any database or transaction with our schema, whatever the driver (tests use PGlite). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
