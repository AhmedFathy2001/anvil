/**
 * One-shot helper: marks all already-applied migrations as applied in the
 * `__drizzle_migrations` tracking table so `drizzle-kit migrate` only runs the
 * new ones going forward. Use this once when switching a database that was
 * previously bootstrapped via `drizzle-kit push`.
 *
 * Defaults to marking everything EXCEPT the latest migration (0018) as applied,
 * so the next `drizzle-kit migrate` actually runs the pending one. Pass
 * `--mark-all` to also include the latest entry (useful if you've already
 * applied it manually).
 *
 * Run:  npx tsx scripts/bootstrap-migrations-table.ts
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
