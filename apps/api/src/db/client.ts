import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const createDb = (databaseUrl: string) => {
  const sql = postgres(databaseUrl);
  return { db: drizzle(sql, { schema }), close: () => sql.end() };
};

export type Db = ReturnType<typeof createDb>['db'];
