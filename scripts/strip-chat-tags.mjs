// Clean OSRS chat styling out of names already stored.
//
// The plugin stripped RuneLite's `<col=…>` markup but not Jagex's older `@tag@` colour codes, so a
// Combat Achievement landed as "@ach_comp@Phantom Muspah Speed-Chaser" — in the Discord post, in
// the wiki link built from it, and in whatever the highlight feed stored. Both sides strip it now
// (lib/chatTags here, AnvilPlugin.stripChatTags there), but rows written before that keep the code.
//
// A polluted CA name is not only ugly: the feed looks the task up in our own dataset BY NAME to
// find its tier and the boss it belongs to, so a stored row still reads as a task nothing
// recognises. Cleaning them is what makes those rows judgeable again.
//
// Plain ESM + runtime deps only — the same reason migrate.mjs is written this way. A clan's rows
// live inside its own container, whose image ships neither tsx nor devDependencies, so the one form
// of this script that can actually reach the data is one that runs on @libsql alone.
//
// Only names are touched, and only by removing markup — no row is created, deleted or re-scoped.
// Safe to run repeatedly: a cleaned string is already clean.
//
// On the box (the normal case — a clan's DB is a volume, not a network endpoint):
//   docker cp scripts/strip-chat-tags.mjs clan-<slug>:/app/strip-chat-tags.mjs
//   docker exec clan-<slug> node /app/strip-chat-tags.mjs            # report
//   docker exec clan-<slug> node /app/strip-chat-tags.mjs --apply    # write
//
// Anywhere else:
//   node scripts/strip-chat-tags.mjs --url=file:/path/to/anvil.db [--apply]

import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';

// Best-effort .env load, like migrate.mjs — a no-op in a container, where DATABASE_URL is already
// set (the image bakes file:/data/anvil.db) and no .env exists.
for (const envFile of ['.env', '.env.local']) {
  try {
    for (const line of readFileSync(envFile, 'utf-8').split('\n')) {
      const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
      if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2];
    }
  } catch {}
}

const apply = process.argv.includes('--apply');

// Same precedence as src/db/index.ts — DATABASE_URL first, the TURSO_* names only as the deprecated
// fallback they are. Getting this backwards is how a first run reported "no such table: moments":
// it had quietly connected to a leftover Turso database instead of the one the site runs on.
const urlArg = process.argv.find((a) => a.startsWith('--url='))?.slice('--url='.length);
const url = urlArg || process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error('No database. Set DATABASE_URL, or pass --url=file:/data/anvil.db');
  process.exit(1);
}

const client = createClient({
  url,
  authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
});

/**
 * Both markup forms. The `@` half is deliberately narrow — short and alphanumeric between the two
 * markers — so a lone `@` in ordinary text needs a second one close behind it to be touched at all.
 * Kept in step with src/lib/chatTags.ts, which does this at the door for everything arriving now.
 */
const CHAT_TAG = /<[^>]*>|@[A-Za-z0-9_]{1,20}@/g;
const strip = (v) => (typeof v === 'string' ? v.replace(CHAT_TAG, '') : v);
const dirtyText = (v) => typeof v === 'string' && v !== strip(v);

async function main() {
  // Say which database, always — a script that writes should never leave that to be guessed. A
  // libSQL URL can carry credentials; a file path can't, and is the interesting half either way.
  console.log(`Database: ${url.startsWith('file:') ? url : url.replace(/\/\/[^@/]*@/, '//')}`);
  console.log(apply ? 'Applying.\n' : 'Dry run — pass --apply to write.\n');

  // Fail on the wrong database rather than on the first query. A stack trace saying "no such table"
  // is a puzzle; naming what was expected and where it looked is an answer.
  const probe = await client.execute("select name from sqlite_master where type='table' and name='moments'");
  if (probe.rows.length === 0) {
    console.error('No `moments` table here — this is not an Anvil clan database, or not the one you meant.');
    console.error('A clan\'s rows live in its own container: docker exec clan-<slug> node /app/strip-chat-tags.mjs');
    process.exit(1);
  }

  let scanned = 0;
  let dirty = 0;

  // The highlight feed. `item_name` holds the CA task name, which is the column that matters;
  // `source` and `rsn` come along because the same client wrote them off the same lines.
  const rows = await client.execute('select id, item_name, source, rsn from moments');
  scanned += rows.rows.length;
  for (const row of rows.rows) {
    const updates = [];
    for (const column of ['item_name', 'source', 'rsn']) {
      const before = row[column];
      if (!dirtyText(before)) continue;
      const after = strip(before);
      console.log(`  moments#${row.id}.${column}: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
      updates.push([column, after]);
      dirty++;
    }
    if (!apply || updates.length === 0) continue;
    await client.execute({
      sql: `update moments set ${updates.map(([c]) => `${c} = ?`).join(', ')} where id = ?`,
      args: [...updates.map(([, v]) => v), row.id],
    });
  }

  // Personal bests are keyed BY activity name, so a styled one is its own orphan row rather than a
  // dirty field. Reported, never rewritten: cleaning it could collide with the real row for the same
  // activity, and which of the two times is the genuine best is a person's call, not a script's.
  const pbs = await client.execute('select id, activity from member_personal_bests');
  scanned += pbs.rows.length;
  for (const pb of pbs.rows) {
    if (!dirtyText(pb.activity)) continue;
    console.log(`  personal_bests#${pb.id}.activity: ${JSON.stringify(pb.activity)} — reported, NOT rewritten`);
    dirty++;
  }

  console.log(`\nScanned ${scanned} rows, ${dirty} field(s) carried chat styling.`);
  if (dirty > 0 && !apply) console.log('Re-run with --apply to write.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
