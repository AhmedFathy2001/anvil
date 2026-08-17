// Shared harness for tests that run against a REAL database.
//
// Why this exists: of 34 test files, exactly one executed SQL. Everything else tests pure functions
// against `@/`-free modules, which means the suite says nothing about whether the database layer
// works — a completely broken dialect would leave it green. That is fine while there is one dialect
// and it never changes; it is not fine going into a Postgres port.
//
// DIALECT-AGNOSTIC BY CONSTRUCTION. Every test built on this seeds and asserts through Drizzle and
// the app's own libs, never through hand-written SQL strings. That is the whole point: the same
// files must run unchanged against SQLite today and Postgres after the port, so a passing run on
// both is real evidence the port preserved behaviour — not just that it compiled. Any raw SQL added
// to a test on top of this helper silently destroys that property.
//
// Usage — call useTestDatabase() at MODULE TOP LEVEL, before anything imports the db:
//
//   const DB = useTestDatabase('my-suite');
//   let db: Awaited<ReturnType<typeof loadDb>>['db'];
//   before(async () => { resetDatabase(DB); ({ db } = await loadDb()); });
//   after(() => dropDatabase(DB));
//
// The top-level call matters. src/db/index.ts reads DATABASE_URL once at module load, so the env has
// to be set before the first import of it — hence the dynamic import inside before().

import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';

/**
 * Point the app's db client at a private file for this suite, and hand back its path.
 *
 * MUST be called at module top level. Each suite gets its own file so suites can run concurrently
 * without stepping on each other's rows.
 */
export function useTestDatabase(name: string): string {
  const file = `./.test-${name}.db`;
  process.env.DATABASE_URL = `file:${file}`;
  return file;
}

/** Delete any leftover file and run migrations, leaving an empty schema-current database. */
export function resetDatabase(file: string): void {
  dropDatabase(file);
  execFileSync('node', ['scripts/migrate.mjs'], { env: { ...process.env }, stdio: 'pipe' });
}

/** Remove the database and its WAL sidecars. Safe to call when they don't exist. */
export function dropDatabase(file: string): void {
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${file}${suffix}`, { force: true });
}

/** Load the app's own db handle + schema, after the env is pointed at the test file. */
export async function loadDb() {
  const { db } = await import('../../src/db/index.ts');
  const schema = await import('../../src/db/schema.ts');
  return { db, schema };
}
