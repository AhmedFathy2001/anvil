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
import { readFileSync, readdirSync, unlinkSync } from 'fs';
import { dirname, basename, join } from 'path';

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

// Take a consistent on-disk snapshot of a local SQLite DB right before applying migrations, so a bad
// or half-applied migration has an instant same-volume restore point. The durable, off-box copy is
// the daily R2 backup (scripts/backup + /api/cron/backup); this is the fast, local, deploy-scoped net
// that covers the exact moment a migration mutates the schema. Best-effort on purpose: a snapshot
// failure logs a warning but NEVER blocks a needed migration — aborting boot on a backup hiccup would
// trade data-safety for availability, and R2 already covers durability. Only fires for a `file:` DB
// that (a) actually has data and (b) has pending migrations, so ordinary restarts don't churn copies.
const SNAPSHOT_KEEP = Number(process.env.MIGRATE_SNAPSHOT_KEEP || 3);

async function snapshotBeforeMigrate() {
  if (!url.startsWith('file:')) return; // remote DB (Turso): not ours to snapshot
  const dbPath = url.slice('file:'.length).replace(/^\/\//, '/'); // file:/data/anvil.db -> /data/anvil.db

  // How many migrations are already applied. A fresh DB (no ledger yet) has nothing worth snapshotting
  // — it's about to be built from 0000 — so applied===0 means skip. We gate on this, NOT file
  // existence: the libsql client opened above has already created an empty file, so existsSync would
  // wrongly report a brand-new clan's DB as "present with data".
  let applied = 0;
  try {
    const r = await client.execute('SELECT count(*) AS n FROM __drizzle_migrations');
    applied = Number(r.rows[0].n) || 0;
  } catch {
    applied = 0; // ledger table absent = fresh DB, nothing applied yet
  }
  if (applied === 0) return;

  // Pending = journal entries beyond what's applied. Skip when already current so container restarts
  // (which re-run this migrator) don't pile up snapshots.
  let total = applied;
  try {
    const journal = JSON.parse(readFileSync('./drizzle/meta/_journal.json', 'utf-8'));
    total = Array.isArray(journal.entries) ? journal.entries.length : applied;
  } catch {
    total = applied + 1; // can't read the journal: assume a migration may run and snapshot to be safe
  }
  const pending = Math.max(0, total - applied);
  if (pending === 0) return;

  const dir = dirname(dbPath);
  const stem = basename(dbPath);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const snapPath = join(dir, `${stem}.premigrate-${ts}`);
  try {
    // VACUUM INTO writes a fully consistent, standalone copy (safe under WAL, no manual lock dance).
    // The target must not pre-exist; the timestamped name guarantees that. Path is process-controlled
    // (/data + ISO ts), but escape quotes defensively since VACUUM won't take a bound parameter.
    await client.execute(`VACUUM INTO '${snapPath.replace(/'/g, "''")}'`);
    console.log(`[migrate] pre-migration snapshot -> ${snapPath} (${pending} pending)`);
  } catch (e) {
    console.warn(`[migrate] WARNING: pre-migration snapshot failed (continuing): ${e?.message || e}`);
    return;
  }

  // Prune to the newest SNAPSHOT_KEEP. Names are timestamp-suffixed, so a lexical sort is chronological.
  try {
    const snaps = readdirSync(dir).filter((f) => f.startsWith(`${stem}.premigrate-`)).sort();
    for (const f of snaps.slice(0, Math.max(0, snaps.length - SNAPSHOT_KEEP))) {
      try {
        unlinkSync(join(dir, f));
      } catch {}
    }
  } catch {}
}

// Materialize provisioner-passed identity into the settings table. The managed control-plane hands
// a new clan its name/invite as env vars (CLAN_NAME / DISCORD_INVITE_URL), but the admin UI, setup
// checklist, and most reads go through settings rows — only a handful of pages ever fall back to
// env. Seed ONLY when the row is missing or empty, so a clan admin's later edit always wins over a
// container recreate. No-op for self-hosters (env unset) and on already-seeded DBs.
async function seedSettingsFromEnv() {
  const seeds = [
    ['clan_name', process.env.CLAN_NAME],
    ['discord_invite_url', process.env.DISCORD_INVITE_URL],
  ];
  for (const [key, raw] of seeds) {
    const value = raw?.trim();
    if (!value) continue;
    try {
      const existing = await client.execute({ sql: 'SELECT value FROM settings WHERE key = ?', args: [key] });
      const current = existing.rows[0]?.value;
      if (existing.rows.length > 0 && current != null && String(current).trim() !== '') continue;
      if (existing.rows.length === 0) {
        await client.execute({ sql: 'INSERT INTO settings (key, value) VALUES (?, ?)', args: [key, value] });
      } else {
        await client.execute({ sql: 'UPDATE settings SET value = ? WHERE key = ?', args: [value, key] });
      }
      console.log(`[migrate] seeded settings.${key} from env`);
    } catch (e) {
      // Seeding is convenience, not correctness — never block boot on it.
      console.warn(`[migrate] WARNING: seeding settings.${key} failed (continuing): ${e?.message || e}`);
    }
  }
}

try {
  await snapshotBeforeMigrate();
  await migrate(db, { migrationsFolder: './drizzle' });
  await reconcileBaselineDrift();
  await seedSettingsFromEnv();
  console.log('[migrate] up to date');
  process.exit(0);
} catch (err) {
  console.error('[migrate] failed:', err);
  process.exit(1);
}
