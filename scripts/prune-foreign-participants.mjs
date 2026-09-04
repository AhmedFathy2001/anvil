#!/usr/bin/env node
// Remove weekly-competition entries that belong to another clan's roster.
//
// enrollAllPlayers read the roster with no clan in the query. On one database per clan that was
// invisible — every seat in the database WAS the clan. The day two clans shared one, the catch-up
// enrolment on the weekly cron swept every active seat on the platform into whichever clan had a
// live competition: 272 of LFL's members landed on The AFK Spot's Boss of the Week, and the
// standings reported 412 participants for a clan of 286 as though it were the truth.
//
// The query is fixed (lib/weekly enrollAllPlayers). This clears what it already wrote, and is safe
// to keep around: it deletes only rows whose seat belongs to a clan OTHER than the one whose
// competition they are enrolled in, which is a state nothing legitimate produces.
//
// Dry-run by default, like every other script here:
//   node scripts/prune-foreign-participants.mjs
//   node scripts/prune-foreign-participants.mjs --apply

import pg from 'pg';

const APPLY = process.argv.includes('--apply');
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const FOREIGN = `
  select wp.id, wp.competition_id, wp.rsn, seat.clan_id as seat_clan, wc.clan_id as comp_clan,
         host.slug as host_slug, visitor.slug as visitor_slug
    from weekly_participants wp
    join weekly_competitions wc on wc.id = wp.competition_id
    join clan_roster seat on seat.id = wp.clan_member_id
    join clans host on host.id = wc.clan_id
    join clans visitor on visitor.id = seat.clan_id
   where seat.clan_id <> wc.clan_id
`;

const pool = new pg.Pool({ connectionString: url });
const client = await pool.connect();
try {
  await client.query('begin');
  const { rows } = await client.query(FOREIGN);

  if (rows.length === 0) {
    console.log('Nothing to prune — every participant sits on their own clan’s competition.');
  } else {
    const byPair = new Map();
    for (const r of rows) {
      const key = `${r.visitor_slug} → ${r.host_slug}'s competition ${r.competition_id}`;
      byPair.set(key, (byPair.get(key) ?? 0) + 1);
    }
    for (const [pair, n] of [...byPair].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(5)}  ${pair}`);
    }
    console.log(`\n${rows.length} row(s) belong to a clan that is not running the competition.`);
    await client.query(`delete from weekly_participants where id = any($1)`, [rows.map((r) => r.id)]);
  }

  if (APPLY) {
    await client.query('commit');
    console.log(rows.length ? '\nApplied.' : '');
  } else {
    await client.query('rollback');
    console.log('\nDRY RUN — nothing written. Re-run with --apply.');
  }
} catch (err) {
  await client.query('rollback');
  throw err;
} finally {
  client.release();
  await pool.end();
}
