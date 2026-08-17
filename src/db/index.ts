import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, types } from 'pg';
import * as schema from './schema';

// Return 64-bit integers as JS numbers instead of strings.
//
// Postgres types COUNT() and SUM(integer) as bigint, and node-postgres hands bigint back as a STRING
// by default, because a 64-bit value can exceed what a double represents exactly. Every aggregate in
// this app is a score, a point total, a kill count or a row count compared with === against a number,
// so the default turns `total === 20` into `'20' === 20` — false, silently, with no error and a
// leaderboard that simply reads wrong.
//
// Converting is safe at this app's magnitudes: the ceiling for exact integers in a double is ~9.0e15,
// while the largest quantity here is loot GP (a max cash stack is 2.1e9) and total XP (~4.6e9 across
// every skill maxed). Nothing is within six orders of magnitude of the boundary. If a genuinely
// 64-bit column ever appears, it needs an explicit cast at its own call site rather than this
// default being widened.
types.setTypeParser(types.builtins.INT8, (v) => Number(v));

// `next build` collects page data with NODE_ENV=production but no real env (and the Docker build
// has no .env at all). Don't hard-fail then — fall back to a URL that is never connected to, so
// module load during the build doesn't crash. Real runtime still fails loud if the URL is missing.
const IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build';

let url = process.env.DATABASE_URL;

if (!url) {
  if (IS_BUILD) {
    url = 'postgres://build:build@127.0.0.1:5432/build'; // never queried during build (no DB-touching SSG)
  } else {
    throw new Error(
      'DB config: set DATABASE_URL (e.g. postgres://user:pass@host:5432/anvil) — the app cannot boot without a database URL.',
    );
  }
}

// One pool per process. Next keeps the module alive across requests, so this is the connection
// budget for the whole server: `max` must stay comfortably under Postgres's own max_connections
// once every worker is counted, or a traffic spike exhausts the server rather than queueing here.
export const pool = new Pool({
  connectionString: url,
  max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  // A connection that can't be established should fail the request, not hang it.
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});

// A pool emits 'error' for idle clients dropped by the server (restart, failover, idle reaper).
// Unhandled, that event takes the process down — so swallow it deliberately: the pool replaces the
// connection on the next acquire, and the in-flight query surfaces its own error to its caller.
pool.on('error', () => {});

export const db = drizzle(pool, { schema });
