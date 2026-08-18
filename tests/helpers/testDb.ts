// Shared harness for tests that run against a REAL database.
//
// Why this exists: of the test files in this repo, one executed SQL. Everything else tests pure
// functions against `@/`-free modules, which means the suite says nothing about whether the database
// layer works — a completely broken dialect would leave it green. That is fine while there is one
// dialect and it never changes; it is not fine going into (or out of) a Postgres port.
//
// DIALECT-AGNOSTIC BY CONSTRUCTION. Every test built on this seeds and asserts through Drizzle and
// the app's own libs, never through hand-written SQL strings. That is the whole point: the same
// files must run unchanged against either dialect, so a passing run is real evidence that behaviour
// was preserved — not just that it compiled. Any raw SQL added to a test on top of this helper
// silently destroys that property.
//
// Usage — call useTestDatabase() at MODULE TOP LEVEL, before anything imports the db:
//
//   const DB = useTestDatabase('my-suite');
//   let db: Awaited<ReturnType<typeof loadDb>>['db'];
//   before(async () => { await resetDatabase(DB); ({ db } = await loadDb()); });
//   after(async () => { await dropDatabase(DB); });
//
// The top-level call matters. src/db/index.ts reads DATABASE_URL once at module load, so the env has
// to be set before the first import of it — hence the dynamic import inside before().
//
// Each suite gets its OWN Postgres database, created and dropped around the run, so suites cannot
// see each other's rows and a crashed run leaves nothing behind that the next one trips over.
// Point TEST_DATABASE_URL at any server; the default matches the local dev container.

import { execFileSync } from 'node:child_process';
import pg from 'pg';

/** Admin connection string — the server to create/drop per-suite databases on. */
const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgres://anvil:anvil@127.0.0.1:5439/postgres';

function urlFor(dbName: string): string {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${dbName}`;
  return u.toString();
}

/**
 * Point the app's db client at a private database for this suite, and hand back its name.
 *
 * MUST be called at module top level, before anything imports src/db.
 */
export function useTestDatabase(name: string): string {
  const dbName = `anvil_test_${name.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`;
  process.env.DATABASE_URL = urlFor(dbName);
  return dbName;
}

async function withAdmin<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: ADMIN_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/**
 * Drop any leftover database, create it fresh, and run migrations into it.
 *
 * `through` stops after the named migration, leaving the database in the shape it had BEFORE the
 * next one. That is what a data-migration test needs: seed rows in the old shape, apply the
 * migration, assert on what it made of them. Finish the chain afterwards with migrateRest().
 */
export async function resetDatabase(dbName: string, through?: string): Promise<void> {
  await dropDatabase(dbName);
  // Identifiers can't be bound parameters; dbName is derived from a literal in the test file and
  // stripped to [a-z0-9_] above, so it cannot carry anything to quote out of.
  await withAdmin((c) => c.query(`CREATE DATABASE "${dbName}"`));
  runMigrator(dbName, through ? ['--through', through] : []);
}

/** Apply whatever migrations remain — the other half of resetDatabase(db, through). */
export function migrateRest(dbName: string): void {
  runMigrator(dbName, []);
}

function runMigrator(dbName: string, args: string[]): void {
  execFileSync('node', ['scripts/migrate.mjs', ...args], {
    env: { ...process.env, DATABASE_URL: urlFor(dbName) },
    stdio: 'pipe',
  });
}

/** Remove the suite's database. Safe to call when it doesn't exist. */
export async function dropDatabase(dbName: string): Promise<void> {
  await withAdmin((c) => c.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`));
}

/** Load the app's own db handle + schema, after the env is pointed at the test database. */
export async function loadDb() {
  const { db, pool } = await import('../../src/db/index.ts');
  const schema = await import('../../src/db/schema.ts');
  return { db, pool, schema };
}
