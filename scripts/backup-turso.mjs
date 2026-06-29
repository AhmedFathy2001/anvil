// Export the live remote Turso/libSQL database into a self-contained local SQLite file, ready to
// drop onto the box at /data/anvil.db. READ-ONLY against Turso — it never writes to the remote.
//
// It also stamps the Drizzle migration ledger (__drizzle_migrations) so the boot-time migrator
// (scripts/migrate.mjs) sees the schema as already up to date and applies nothing — avoiding the
// "table already exists" failure you'd get migrating a db:push-built database.
//
// Usage:   node scripts/backup-turso.mjs            -> writes ./anvil.db
//          BACKUP_OUT=/path/x.db node scripts/...    -> custom output path
// Verify:  sqlite3 anvil.db "PRAGMA integrity_check; SELECT count(*) FROM users;"

import { createClient } from '@libsql/client';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { existsSync, readFileSync, rmSync } from 'node:fs';

// Minimal .env loader (.env.local overrides .env), matching the app's convention.
for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2].trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
}

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;
const OUT = process.env.BACKUP_OUT || 'anvil.db';

if (!url) {
  console.error('No TURSO_DATABASE_URL / DATABASE_URL found in env.');
  process.exit(1);
}
const isRemote = url.startsWith('libsql://') || url.startsWith('https://') || url.startsWith('wss://');
if (!isRemote) {
  console.error(`Refusing to run: ${url} is not a remote URL. This script exports a remote DB.`);
  process.exit(1);
}

// Start from a clean output file (+ any stray WAL/SHM sidecars).
for (const ext of ['', '-wal', '-shm', '-journal']) {
  if (existsSync(OUT + ext)) rmSync(OUT + ext);
}

const remote = createClient({ url, authToken });
const local = createClient({ url: `file:${OUT}` });

console.log(`Exporting ${url.replace(/\?.*$/, '')}\n            -> ${OUT}\n`);

// Read the full schema. Skip SQLite internals and the migration ledger (recreated below).
const master = await remote.execute(
  `SELECT type, name, sql FROM sqlite_master
   WHERE sql IS NOT NULL
     AND name NOT LIKE 'sqlite_%'
     AND name <> '__drizzle_migrations'`,
);
const tableDDL = master.rows.filter((r) => r.type === 'table');
const restDDL = master.rows.filter((r) => r.type !== 'table'); // views, indexes, triggers
const tables = tableDDL.map((r) => String(r.name));

// 1. Create tables only — defer indexes/views/triggers until after data so triggers don't fire
//    during the bulk insert and indexes are built once at the end.
for (const row of tableDDL) {
  await local.execute(String(row.sql));
}

// 2. Import data in a SINGLE write transaction with deferred FK checks. libsql pools connections,
//    so a connection-level `PRAGMA foreign_keys=OFF` wouldn't reach the tx; defer_foreign_keys is
//    set inside the tx and checked only at commit, by which point every parent row exists.
const counts = {};
const tx = await local.transaction('write');
try {
  await tx.execute('PRAGMA defer_foreign_keys=ON;');
  // Page the remote reads — Turso's hrana protocol caps response size, so SELECT * on a big table
  // (e.g. submissions) fails with "Resource exhausted". LIMIT/OFFSET keeps each response small.
  const PAGE = 500;
  for (const t of tables) {
    counts[t] = 0;
    let insertSql = null;
    for (let offset = 0; ; offset += PAGE) {
      const res = await remote.execute({
        sql: `SELECT * FROM "${t}" LIMIT ? OFFSET ?`,
        args: [PAGE, offset],
      });
      if (res.rows.length === 0) break;
      if (!insertSql) {
        const cols = res.columns;
        const colList = cols.map((c) => `"${c}"`).join(', ');
        const placeholders = cols.map(() => '?').join(', ');
        insertSql = { sql: `INSERT INTO "${t}" (${colList}) VALUES (${placeholders})`, cols };
      }
      for (const row of res.rows) {
        await tx.execute({ sql: insertSql.sql, args: insertSql.cols.map((c) => row[c]) });
      }
      counts[t] += res.rows.length;
      if (res.rows.length < PAGE) break;
    }
  }
  await tx.commit();
} catch (e) {
  await tx.rollback();
  throw new Error(`Import failed: ${e.message}`);
}

// 3. Now create indexes, views, and triggers.
for (const row of restDDL) {
  await local.execute(String(row.sql));
}

// 3. Stamp the migration ledger. The libsql migrator only compares created_at to decide what to
//    apply, so inserting every migration's (hash, folderMillis) makes it a no-op on boot.
const migs = readMigrationFiles({ migrationsFolder: './drizzle' });
await local.execute(
  `CREATE TABLE IF NOT EXISTS __drizzle_migrations (
     id SERIAL PRIMARY KEY,
     hash text NOT NULL,
     created_at numeric
   );`,
);
for (const m of migs) {
  await local.execute({
    sql: `INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)`,
    args: [m.hash, m.folderMillis],
  });
}

await local.close();
remote.close();

// Report.
const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);
console.log('Tables exported:');
for (const t of tables) console.log(`  ${t.padEnd(28)} ${counts[t]} rows`);
console.log(`\n${tables.length} tables, ${totalRows} rows total.`);
console.log(`Stamped ${migs.length} migrations as applied (boot migrator will be a no-op).`);
console.log(`\nWrote ${OUT}. Verify with:`);
console.log(`  sqlite3 ${OUT} "PRAGMA integrity_check;"`);
