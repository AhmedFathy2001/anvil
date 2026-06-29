/**
 * One-shot reconcile helper: marks already-applied migrations as applied in the
 * `__drizzle_migrations` tracking table so `npm run db:migrate` only runs the new
 * ones going forward. Use this ONCE when switching a database that was previously
 * built with `drizzle-kit push` (and therefore has no ledger) onto the migration
 * path — e.g. an early Turso install whose schema already matches src/db/schema.ts.
 *
 * Pick the mode by what schema the push DB ALREADY has:
 *
 *   default (no flag)  — stamp every migration EXCEPT the latest as applied, leaving the
 *                        newest for `db:migrate` to run. Use when the DB has all prior
 *                        schema but is missing just the most recent migration. This is the
 *                        case when reconciling prod onto a newly-added migration, e.g. an
 *                        existing Turso install that has 0000_init's schema but not 0001:
 *                          npx tsx scripts/bootstrap-migrations-table.ts   # stamps 0000
 *                          npm run db:migrate                              # applies 0001
 *
 *   --mark-all         — stamp EVERY migration as applied. Use when the DB already matches
 *                        the full current schema and nothing is pending:
 *                          npx tsx scripts/bootstrap-migrations-table.ts --mark-all
 *
 * On a fresh DB, don't run this at all — `db:migrate` applies the chain from 0000 cleanly.
 */
import { createClient } from '@libsql/client';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';

for (const envFile of ['.env', '.env.local']) {
  try {
    const content = readFileSync(envFile, 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
      if (match && !process.env[match[1].trim()]) {
        process.env[match[1].trim()] = match[2];
      }
    }
  } catch {}
}

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;
if (!url) {
  console.error('Set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN if remote).');
  process.exit(1);
}

const markAll = process.argv.includes('--mark-all');

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
  breakpoints: boolean;
}

const journalPath = resolve('drizzle/meta/_journal.json');
const journal = JSON.parse(readFileSync(journalPath, 'utf-8')) as { entries: JournalEntry[] };

const sortedEntries = [...journal.entries].sort((a, b) => a.idx - b.idx);
const toMark = markAll ? sortedEntries : sortedEntries.slice(0, -1);
const skipped = markAll ? [] : sortedEntries.slice(-1);

if (toMark.length === 0) {
  console.error('No entries to mark.');
  process.exit(1);
}

const client = createClient({ url, authToken });

async function main() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash text NOT NULL,
      created_at numeric
    )
  `);

  const existing = await client.execute('SELECT hash FROM __drizzle_migrations');
  const existingHashes = new Set(existing.rows.map((r) => String(r.hash)));

  let inserted = 0;
  let skippedExisting = 0;

  for (const entry of toMark) {
    const sqlPath = resolve(`drizzle/${entry.tag}.sql`);
    const sql = readFileSync(sqlPath, 'utf-8');
    const hash = createHash('sha256').update(sql).digest('hex');

    if (existingHashes.has(hash)) {
      skippedExisting++;
      continue;
    }

    await client.execute({
      sql: 'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
      args: [hash, entry.when],
    });
    inserted++;
    console.log(`  ✓ marked applied: ${entry.tag}`);
  }

  console.log('');
  console.log(`Inserted ${inserted} entries, ${skippedExisting} already present.`);
  if (skipped.length > 0) {
    console.log(`Left for migrate to run: ${skipped.map((e) => e.tag).join(', ')}`);
    console.log('Now run:  npx drizzle-kit migrate');
  } else {
    console.log('All entries marked applied.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => client.close());
