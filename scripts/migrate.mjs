// Apply pending Drizzle migrations, then exit. Runs at container start (entrypoint) before the
// Next server boots, so a freshly-provisioned clan gets every table/index/trigger with no manual
// `db:push`. Plain ESM + runtime deps only (no drizzle-kit) so it works inside the standalone image.
//
// Two-step flow:
//   1. drizzle migrate() — applies the committed migration chain (the normal path; fresh DBs build
//      from 0000_init, existing DBs apply whatever they're missing).
//   2. reconcileBaselineDrift() — idempotent self-heal for objects that live ONLY in the squashed
//      0000_init baseline. Because that baseline is stamped-not-run on pre-squash DBs (the reference
//      instance and early self-hosters), columns/tables added at squash time never got created on
//      them. SQLite has no `ADD COLUMN IF NOT EXISTS`, and drizzle-kit won't emit a catch-up (its
//      snapshots already include these), so we introspect and add only what's missing. No-op on
//      fresh DBs and on already-reconciled DBs.

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

const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error('[migrate] No database URL — set DATABASE_URL (e.g. file:/data/anvil.db).');
  process.exit(1);
}

const client = createClient({ url, authToken });

if (url.startsWith('file:')) {
  await client.execute('PRAGMA journal_mode=WAL;').catch(() => {});
}

const db = drizzle(client);

// Idempotent self-heal for squash-baseline drift (see header). Each item is checked before it's
// applied, so this is safe to run on every boot and on every kind of DB.
async function reconcileBaselineDrift() {
  // users.is_owner — added to the schema at squash time; missing on stamped-not-run baselines.
  const col = await client.execute(
    "SELECT count(*) AS n FROM pragma_table_info('users') WHERE name='is_owner'",
  );
  if (Number(col.rows[0].n) === 0) {
    // DEFAULT 0 (not `false`): this libsql build mis-parses the `false` keyword in ALTER ADD COLUMN.
    // Stored value is identical to the schema's `DEFAULT false`.
    await client.execute('ALTER TABLE users ADD COLUMN is_owner integer DEFAULT 0 NOT NULL');
    console.log('[migrate] reconciled users.is_owner');
  }

  // pending_notifications — table only present in the baseline; CREATE IF NOT EXISTS is naturally idempotent.
  await client.execute(`CREATE TABLE IF NOT EXISTS pending_notifications (
    tile_id integer NOT NULL,
    team_id integer NOT NULL,
    event_id integer NOT NULL,
    pending_amount integer DEFAULT 0 NOT NULL,
    latest_total integer,
    required_amount integer,
    latest_image_url text,
    latest_note text,
    latest_credit_name text,
    completed integer DEFAULT 0 NOT NULL,
    first_queued_at text NOT NULL,
    last_event_at text NOT NULL,
    PRIMARY KEY(tile_id, team_id),
    FOREIGN KEY (tile_id) REFERENCES tiles(id) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (event_id) REFERENCES events(id) ON UPDATE no action ON DELETE cascade
  )`);
  await client.execute(
    'CREATE INDEX IF NOT EXISTS pending_notifications_last_event_idx ON pending_notifications (last_event_at)',
  );
}

try {
  await migrate(db, { migrationsFolder: './drizzle' });
  await reconcileBaselineDrift();
  console.log('[migrate] up to date');
  process.exit(0);
} catch (err) {
  console.error('[migrate] failed:', err);
  process.exit(1);
}
