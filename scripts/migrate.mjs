// Apply pending Drizzle migrations, then exit. Runs at container start (entrypoint) before the
// Next server boots, so a freshly-provisioned clan gets every table/index with no manual `db:push`.
// Plain ESM + runtime deps only (no drizzle-kit) so it works inside the standalone image.
//
// Flow: pre-migration snapshot (pg_dump, best-effort) -> drizzle migrate() -> settings seeding.
//
// The SQLite version also ran reconcileBaselineDrift(), an introspect-and-patch self-heal for
// columns that existed only inside the squashed baseline and were therefore stamped-not-run on
// pre-squash databases. That is gone: the Postgres chain starts from a single 0000_init that every
// database actually executes, so there is no drift to reconcile.

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, copyFileSync, readdirSync, unlinkSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Best-effort .env loader so `npm run db:migrate` works locally / against prod creds in a .env
// file. A no-op in containers where the platform already sets the env and no .env file exists;
// never overrides a var that's already set.
for (const envFile of ['.env', '.env.local']) {
  try {
    for (const line of readFileSync(envFile, 'utf-8').split('\n')) {
      const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
      if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2];
    }
  } catch {}
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[migrate] DATABASE_URL is not set — nothing to migrate against.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, max: 1 });
const db = drizzle(pool);

const SNAPSHOT_KEEP = Number(process.env.MIGRATE_SNAPSHOT_KEEP || 3);
const SNAPSHOT_DIR = process.env.MIGRATE_SNAPSHOT_DIR || '/data/premigrate';

/**
 * Dump the database before applying anything, so a migration that goes wrong is recoverable.
 *
 * Best-effort by design: a missing pg_dump or an unwritable directory must not stop a container
 * booting. Skipped when nothing is pending, so restarts (which re-run this migrator) don't pile up
 * dumps, and on a fresh database, which is about to be built from 0000 and has nothing worth keeping.
 */
async function snapshotBeforeMigrate() {
  let applied = 0;
  try {
    const r = await pool.query('SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations');
    applied = r.rows[0]?.n ?? 0;
  } catch {
    applied = 0; // ledger absent = fresh database, nothing applied yet
  }
  if (applied === 0) return;

  let total = applied;
  try {
    const journal = JSON.parse(readFileSync('./drizzle/meta/_journal.json', 'utf-8'));
    total = Array.isArray(journal.entries) ? journal.entries.length : applied;
  } catch {
    total = applied + 1; // can't read the journal: assume something may run and dump to be safe
  }
  if (total - applied <= 0) return;

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const snapPath = join(SNAPSHOT_DIR, `anvil.premigrate-${ts}.sql`);
  try {
    mkdirSync(SNAPSHOT_DIR, { recursive: true });
    // --no-owner/--no-acl so the dump restores cleanly into a differently-owned database.
    execFileSync('pg_dump', ['--no-owner', '--no-acl', '--file', snapPath, url], { stdio: 'pipe' });
    console.log(`[migrate] pre-migration snapshot -> ${snapPath} (${total - applied} pending)`);
  } catch (e) {
    console.warn(`[migrate] WARNING: pre-migration snapshot failed (continuing): ${e?.message || e}`);
    return;
  }

  // Prune to the newest SNAPSHOT_KEEP. Names are timestamp-suffixed, so a lexical sort is chronological.
  try {
    const snaps = readdirSync(SNAPSHOT_DIR).filter((f) => f.startsWith('anvil.premigrate-')).sort();
    for (const f of snaps.slice(0, Math.max(0, snaps.length - SNAPSHOT_KEEP))) {
      try {
        unlinkSync(join(SNAPSHOT_DIR, f));
      } catch {}
    }
  } catch {}
}

/**
 * Which clan the provisioner's env vars describe, or null.
 *
 * Settings are per-clan now, so every seeder below needs a clan to write against — and at boot,
 * before any request, the ONLY thing that names one is CLAN_SLUG. A shared multi-clan deployment
 * sets no CLAN_SLUG and correctly seeds nothing; a single-clan container keeps its behaviour.
 *
 * Without this the seeders below matched `WHERE key = $1` across every clan's rows and inserted
 * without a clan_id, which the NOT NULL added with the per-clan settings split turned into a
 * swallowed warning on every boot.
 */
async function envClanId() {
  const slug = process.env.CLAN_SLUG?.trim();
  if (!slug) return null;
  try {
    const r = await pool.query('SELECT id FROM clans WHERE slug = $1', [slug]);
    return r.rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

// Materialize provisioner-passed identity into the settings table. The managed control-plane hands
// a new clan its name/invite as env vars (CLAN_NAME / DISCORD_INVITE_URL), but the admin UI, setup
// checklist, and most reads go through settings rows — only a handful of pages ever fall back to
// env. Seed ONLY when the row is missing or empty, so a clan admin's later edit always wins over a
// container recreate. No-op for self-hosters (env unset) and on already-seeded DBs.
async function seedSettingsFromEnv(clanId) {
  if (!clanId) return;
  const seeds = [
    ['clan_name', process.env.CLAN_NAME],
    ['clan_ingame_name', process.env.CLAN_INGAME_NAME],
    ['discord_invite_url', process.env.DISCORD_INVITE_URL],
  ];
  for (const [key, raw] of seeds) {
    const value = raw?.trim();
    if (!value) continue;
    try {
      const existing = await pool.query('SELECT value FROM settings WHERE clan_id = $1 AND key = $2', [clanId, key]);
      const current = existing.rows[0]?.value;
      if (existing.rows.length > 0 && current != null && String(current).trim() !== '') continue;
      if (existing.rows.length === 0) {
        await pool.query('INSERT INTO settings (clan_id, key, value) VALUES ($1, $2, $3)', [clanId, key, value]);
      } else {
        await pool.query('UPDATE settings SET value = $1 WHERE clan_id = $2 AND key = $3', [value, clanId, key]);
      }
      console.log(`[migrate] seeded settings.${key} from env`);
    } catch (e) {
      // Seeding is convenience, not correctness — never block boot on it.
      console.warn(`[migrate] WARNING: seeding settings.${key} failed (continuing): ${e?.message || e}`);
    }
  }
}

/**
 * Managed-hosting defaults. A clan we host is listed on the public "clans on Anvil" page by default.
 * A self-hoster (no provisioner env) gets none of this.
 *
 * INSERT-ONLY-IF-ABSENT, deliberately stricter than seedSettingsFromEnv's "missing or empty" rule:
 * these are toggles whose OFF state is the empty string / 'off'. Treating empty as unset would
 * silently re-enable a toggle the clan turned off, on every single container recreate. A row
 * existing at all — whatever its value — means the clan has an opinion, so we leave it alone.
 */
async function seedManagedDefaults(clanId) {
  if (!clanId) return; // no CLAN_SLUG = not a provisioner-managed single-clan container

  const defaults = [
    ['public_showcase', 'on'], // listed on anvilosrs.com/clans (opt-out in Advanced settings)
  ];
  for (const [key, value] of defaults) {
    try {
      const existing = await pool.query('SELECT 1 FROM settings WHERE clan_id = $1 AND key = $2', [clanId, key]);
      if (existing.rows.length > 0) continue;
      await pool.query('INSERT INTO settings (clan_id, key, value) VALUES ($1, $2, $3)', [clanId, key, value]);
      console.log(`[migrate] seeded settings.${key}=${value} (managed clan default)`);
    } catch (e) {
      // Convenience, not correctness — never block boot on it.
      console.warn(`[migrate] WARNING: seeding settings.${key} failed (continuing): ${e?.message || e}`);
    }
  }
}

// One-time backfill for the clan_name split (display name vs in-game clan name). Before the split
// a single `clan_name` did both jobs, including gating the plugin's roster sync. Copy it into the
// new `clan_ingame_name` key so an existing clan's sync gate keeps matching after the upgrade.
//
// Keyed on ROW EXISTENCE, not emptiness: once the row exists (even as NULL, which the settings API
// writes when an admin clears the field) this never fires again, so "accept any clan" stays a
// choice the admin can make. Runs after seedSettingsFromEnv so a freshly provisioned clan has its
// clan_name row already in place.
async function backfillInGameClanName(clanId) {
  if (!clanId) return;
  try {
    const existing = await pool.query('SELECT 1 FROM settings WHERE clan_id = $1 AND key = $2', [clanId, 'clan_ingame_name']);
    if (existing.rows.length > 0) return;
    const display = await pool.query('SELECT value FROM settings WHERE clan_id = $1 AND key = $2', [clanId, 'clan_name']);
    const value = display.rows[0]?.value == null ? '' : String(display.rows[0].value).trim();
    if (!value) return;
    await pool.query('INSERT INTO settings (clan_id, key, value) VALUES ($1, $2, $3)', [clanId, 'clan_ingame_name', value]);
    console.log('[migrate] backfilled settings.clan_ingame_name from clan_name');
  } catch (e) {
    console.warn(`[migrate] WARNING: clan_ingame_name backfill failed (continuing): ${e?.message || e}`);
  }
}

// Apply only up to and including a given migration tag: `node scripts/migrate.mjs --through 0005_clan_staff`.
//
// For rehearsing a migration against a copy of real data, and for tests that need the database in
// its shape BEFORE some migration so they can seed old-shape rows and watch the migration transform
// them — which is the only way to test a data backfill, since a backfill runs once and only at
// migration time.
//
// Implemented as a truncated copy of the migrations folder rather than by applying SQL by hand, so
// drizzle stays the thing that runs migrations and writes the ledger. The .sql files are byte-identical
// copies, so their hashes match and a later full run picks up exactly where this one stopped.
function migrationsFolderThrough(tag) {
  const journal = JSON.parse(readFileSync('./drizzle/meta/_journal.json', 'utf-8'));
  const cut = journal.entries.findIndex((e) => e.tag === tag);
  if (cut === -1) throw new Error(`--through: no migration tagged '${tag}'`);

  const dir = join(tmpdir(), `anvil-migrate-through-${tag}-${process.pid}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'meta'), { recursive: true });
  const entries = journal.entries.slice(0, cut + 1);
  writeFileSync(join(dir, 'meta/_journal.json'), JSON.stringify({ ...journal, entries }, null, 2));
  for (const e of entries) copyFileSync(join('./drizzle', `${e.tag}.sql`), join(dir, `${e.tag}.sql`));
  return dir;
}

const throughIdx = process.argv.indexOf('--through');
const through = throughIdx === -1 ? null : process.argv[throughIdx + 1];

try {
  await snapshotBeforeMigrate();
  if (through) {
    const folder = migrationsFolderThrough(through);
    await migrate(db, { migrationsFolder: folder });
    rmSync(folder, { recursive: true, force: true });
    console.log(`[migrate] stopped after ${through}`);
    await pool.end();
    process.exit(0);
  }
  await migrate(db, { migrationsFolder: './drizzle' });
  const clanId = await envClanId();
  await seedSettingsFromEnv(clanId);
  await seedManagedDefaults(clanId);
  await backfillInGameClanName(clanId);
  console.log('[migrate] up to date');
  await pool.end();
  process.exit(0);
} catch (err) {
  console.error('[migrate] failed:', err);
  await pool.end().catch(() => {});
  process.exit(1);
}
