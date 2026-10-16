import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { buildApp } from '../app';
import { devHeaderAuth } from '../auth';
import * as schema from '../db/schema';
import { createMemoryStorage } from '../storage/memory';

/** The real app on an in-process Postgres with every migration applied, plus an in-memory bucket. */
export const createTestApp = async () => {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: new URL('../../drizzle', import.meta.url).pathname });
  const { storage, objects } = createMemoryStorage();
  const app = await buildApp({
    sessionSecret: 'x'.repeat(32),
    corsOrigins: [],
    media: { db, storage, authenticate: devHeaderAuth(db, 'test') },
  });
  return {
    app,
    db,
    objects,
    close: async () => {
      await app.close();
      await client.close();
    },
  };
};
