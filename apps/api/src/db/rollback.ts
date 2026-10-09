// Rolls back the most recently applied migration using its hand-written drizzle/down/<tag>.sql.
// drizzle-kit only generates forward migrations, so every new migration needs a matching down file
// (schema-rules.test.ts fails without one).
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const migrationsDir = new URL('../../drizzle/', import.meta.url);
const journal = JSON.parse(readFileSync(new URL('meta/_journal.json', migrationsDir), 'utf8')) as {
  entries: { tag: string; when: number }[];
};

const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
try {
  const [tracking] = await sql`select to_regclass('drizzle.__drizzle_migrations') as name`;
  const [last] = tracking?.name
    ? await sql`select created_at from drizzle.__drizzle_migrations order by created_at desc limit 1`
    : [];
  if (!last) {
    console.log('Nothing to roll back.');
  } else {
    const entry = journal.entries.find((e) => e.when === Number(last.created_at));
    if (!entry) throw new Error(`Applied migration ${last.created_at} is not in the journal`);
    const down = readFileSync(new URL(`down/${entry.tag}.sql`, migrationsDir), 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(down);
      await tx`delete from drizzle.__drizzle_migrations where created_at = ${last.created_at}`;
    });
    console.log(`Rolled back ${entry.tag}.`);
  }
} finally {
  await sql.end();
}
