/**
 * List — and optionally delete — completions on boards that hadn't started yet.
 *
 * WHY THIS EXISTS. Until the start gate landed, a live stat push could resolve to a board the
 * member had merely been pre-drafted into, and credit its tiles. Combined with a missing baseline
 * (no starting stats captured, because the event hadn't started), the "gain" was the player's whole
 * account: someone completed "2m Woodcutting XP" on 4.5m of lifetime XP without cutting a log.
 *
 * Both bugs are fixed, but neither retracts a row that already exists — and a completed stat tile
 * FREEZES its per-member split onto the completion, so the admin standings keep displaying the bad
 * number from that snapshot no matter how the live maths changes. The only cure is deleting the row.
 *
 * DRY RUN BY DEFAULT. It prints what it would remove and exits. Pass --delete to actually do it.
 *
 *   node scripts/prune-premature-completions.mjs                 # look
 *   node scripts/prune-premature-completions.mjs --delete        # act
 *   node scripts/prune-premature-completions.mjs --event 11      # one board
 *
 * Only ever touches completions whose event START is still in the future, which is the one case
 * that cannot be legitimate: nothing on an unstarted board can have been earned.
 */

import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';

for (const envFile of ['.env', '.env.local']) {
  try {
    for (const line of readFileSync(envFile, 'utf-8').split('\n')) {
      const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
      if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2];
    }
  } catch { /* no env file is fine — the URL can come from the environment */ }
}

const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL (e.g. file:/data/anvil.db).');
  process.exit(1);
}

const args = process.argv.slice(2);
const doDelete = args.includes('--delete');
const eventArg = args.indexOf('--event');
const onlyEvent = eventArg >= 0 ? Number(args[eventArg + 1]) : null;

const db = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN });

// Timestamps live in two formats in these columns (SQLite "YYYY-MM-DD HH:MM:SS" and JS ISO), and
// they don't sort against each other — space sorts below T. Compare in JS rather than SQL.
const nowMs = Date.now();
const startsInFuture = (value) => {
  if (!value) return false; // no start date = a draft, not a scheduled board; left alone
  const trimmed = String(value).trim();
  const iso = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(trimmed) ? trimmed : `${trimmed.replace(' ', 'T')}Z`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) && ms > nowMs;
};

const { rows } = await db.execute(`
  SELECT c.id, c.team_id, c.tile_id, c.completed_at, c.stat_contributions,
         e.id AS event_id, e.name AS event_name, e.start_date,
         t.label AS tile_label, tm.name AS team_name
  FROM completions c
  JOIN tiles t  ON t.id  = c.tile_id
  JOIN events e ON e.id  = t.event_id
  LEFT JOIN teams tm ON tm.id = c.team_id
  ORDER BY e.id, t.position
`);

const premature = rows
  .filter((r) => startsInFuture(r.start_date))
  .filter((r) => onlyEvent == null || Number(r.event_id) === onlyEvent);

if (premature.length === 0) {
  console.log('Nothing to do — no completions on boards that have yet to start.');
  process.exit(0);
}

const byEvent = new Map();
for (const r of premature) {
  if (!byEvent.has(r.event_id)) byEvent.set(r.event_id, []);
  byEvent.get(r.event_id).push(r);
}

for (const [eventId, list] of byEvent) {
  const { event_name, start_date } = list[0];
  console.log(`\n#${eventId} ${event_name} — starts ${start_date} (${list.length} completion(s))`);
  for (const r of list) {
    // The frozen split is the number the admin standings actually display, so print it: it's the
    // difference between "a tile got ticked" and "somebody was credited 4.5m XP they never gained".
    let frozen = '';
    try {
      const snap = r.stat_contributions ? JSON.parse(r.stat_contributions) : null;
      if (snap?.total != null) frozen = `  frozen total ${Number(snap.total).toLocaleString()}`;
    } catch { /* a malformed split is still a row worth removing */ }
    console.log(`   [${r.id}] ${r.tile_label} — ${r.team_name ?? 'team ' + r.team_id} @ ${r.completed_at}${frozen}`);
  }
}

if (!doDelete) {
  console.log(`\n${premature.length} completion(s) would be removed. Re-run with --delete to do it.`);
  process.exit(0);
}

for (const r of premature) {
  await db.execute({ sql: 'DELETE FROM completions WHERE id = ?', args: [r.id] });
}
console.log(`\nRemoved ${premature.length} completion(s).`);
