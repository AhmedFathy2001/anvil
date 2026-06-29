import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

// `next build` collects page data with NODE_ENV=production but no real env (and the Docker build
// has no .env at all). Don't hard-fail then — fall back to a throwaway file URL so module load
// during the build doesn't crash. Real runtime still fails loud if the URL is missing.
const IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build';

// DATABASE_URL is the primary var (local SQLite file by default). TURSO_* names are still read as a
// deprecated fallback so older deployments keep working.
let url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

if (!url) {
  if (IS_BUILD) {
    url = 'file:./.next-build-placeholder.db'; // never queried during build (no DB-touching SSG)
  } else {
    throw new Error(
      'DB config: set DATABASE_URL (e.g. file:/data/anvil.db) — the app cannot boot without a database URL.',
    );
  }
}

// A local file DB (libsql `file:` scheme) needs no auth token; a remote libSQL endpoint does.
const isRemote = url.startsWith('libsql://') || url.startsWith('https://') || url.startsWith('wss://');
if (process.env.NODE_ENV === 'production' && isRemote && !authToken) {
  throw new Error(
    'DB config: DATABASE_AUTH_TOKEN is required in production for a remote libSQL database.',
  );
}

const client = createClient({ url, authToken });

// The self-hosted default is a local SQLite file (`file:` scheme). WAL lets readers and the single
// writer proceed concurrently, and a busy timeout makes brief write contention retry instead of
// throwing SQLITE_BUSY under a full clan's load.
if (url.startsWith('file:')) {
  client.execute('PRAGMA journal_mode=WAL;').catch(() => {});
  client.execute('PRAGMA busy_timeout=5000;').catch(() => {});
}

export const db = drizzle(client, { schema });
