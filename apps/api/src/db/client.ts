import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const createDb = (databaseUrl: string) => {
  const sql = postgres(databaseUrl);
  return { db: drizzle(sql, { schema }), close: () => sql.end() };
};

// Driver-agnostic, so tests can run the same queries against an in-process PGlite database.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
