// `pnpm db:seed`: wipes every table and fills it with the mock API's fixtures (`./fixtures.ts`),
// so the database and `MOCK_API=1` serve the same world. `pnpm db:seed:bulk` loads the large
// Faker dataset (`./bulk.ts`) instead. Both are safe to re-run. Every seeded password is
// team-impact-dev.
import { getTableName, is, sql } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema';
import { fixtureRows } from './fixtures';

// Write

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');
const target = new URL(databaseUrl);
const dbName = target.pathname.slice(1);

const ORDER = process.argv.includes('--bulk') ? (await import('./bulk')).BULK_ROWS : fixtureRows();

const allTables = (Object.values(schema) as unknown[]).filter((value): value is PgTable =>
  is(value, PgTable),
);
const client = postgres(databaseUrl, { max: 1, onnotice: () => {} });
const db = drizzle(client);
const started = Date.now();
try {
  await db.transaction(async (tx) => {
    const names = allTables.map((table) => `"${getTableName(table)}"`).join(', ');
    await tx.execute(sql.raw(`truncate table ${names} restart identity cascade`));
    for (const [table, tableRows] of ORDER) {
      // Stay well under Postgres's 65,535 bind-parameter limit.
      for (let i = 0; i < tableRows.length; i += 1000) {
        await tx.insert(table).values(tableRows.slice(i, i + 1000) as never);
      }
    }
  });
  const counts = ORDER.map(([table, tableRows]) => `${getTableName(table)} ${tableRows.length}`);
  console.log(
    `Seeded ${target.hostname}/${dbName} in ${Date.now() - started} ms\n  ${counts.join('\n  ')}`,
  );
} finally {
  await client.end();
}
