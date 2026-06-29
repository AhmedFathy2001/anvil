// Apply pending Drizzle migrations, then exit. Runs at container start (entrypoint) before the
// Next server boots, so a freshly-provisioned clan gets every table/index/trigger with no manual
// `db:push`. Plain ESM + runtime deps only (no drizzle-kit) so it works inside the standalone image.
//
// Fresh DBs (the provisioning case) migrate cleanly from 0000. An *existing* DB first populated via
// `db:push` has no __drizzle_migrations ledger — reconcile that once by hand before switching it to
// this path (see docs/SELF_HOSTING.md), otherwise migrate() will try to recreate existing tables.

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { readFileSync } from 'fs';

// Best-effort .env loader so `npm run db:migrate` works locally / against prod creds in a .env
// file. A no-op in containers (Vercel/Hetzner) where the platform already sets the env and no
// .env file exists; never overrides a var that's already set.
for (const envFile of ['.env', '.env.local']) {
  try {
    for (const line of readFileSync(envFile, 'utf-8').split('\n')) {
      const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
      if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2];
    }
  } catch {}
}

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;

if (!url) {
  console.error('[migrate] No database URL — set TURSO_DATABASE_URL (or DATABASE_URL).');
  process.exit(1);
}

const client = createClient({ url, authToken });

if (url.startsWith('file:')) {
  await client.execute('PRAGMA journal_mode=WAL;').catch(() => {});
}

const db = drizzle(client);

try {
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('[migrate] up to date');
  process.exit(0);
} catch (err) {
  console.error('[migrate] failed:', err);
  process.exit(1);
}
