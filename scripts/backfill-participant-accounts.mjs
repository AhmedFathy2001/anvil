#!/usr/bin/env node
// Put `event_participants.account_id` back on the account the row actually tracks.
//
// WHAT WENT WRONG. Admins can change which character a board follows (Teams → a player → Edit →
// Tracked account). That route re-pointed `clan_member_id` and wiped the stat baseline, but never
// moved `account_id` — harmless while a seat and an account were the same fact, and wrong from the
// moment cross-clan play separated them and `account_id` became the de-duplication key.
//
// So a swapped row claims to be the account it was swapped AWAY from while tracking the new one:
//
//   - lib/participants' enrolParticipant keys PURELY on account with no seat fallback, so the next
//     time the swapped-in account came through an ordinary door — a captain adding them to a
//     roster, a team request approved, their own sign-up approved — the partial unique index saw no
//     conflict and inserted a SECOND row for the same human on that board.
//   - the account swapped away from went on counting as present, so nobody could enrol it there.
//
// The code is fixed; this repairs rows already written.
//
// Dry-run by default, like every other script here:
//   DATABASE_URL=… node scripts/backfill-participant-accounts.mjs
//   DATABASE_URL=… node scripts/backfill-participant-accounts.mjs --apply
//
// SAFE TO RUN TWICE, and worth it. It only writes rows whose account_id disagrees with the seat
// they point at, so a clean database reports nothing — but collisions can CHAIN: row A wrongly
// holding the account row B needs blocks B, and correcting A frees it. Each pass fixes what it can
// and re-reports the rest, so run it until it says nothing is left but the true duplicates.

import pg from 'pg';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const URL = process.env.DATABASE_URL;

if (!URL) {
  console.error('DATABASE_URL must point at the site database');
  process.exit(2);
}

const pool = new pg.Pool({ connectionString: URL });

/**
 * Every row whose account_id is not the account of the seat it points at.
 *
 * `is distinct from` rather than `<>`, so a row with a NULL account_id and a seat that HAS one is
 * caught too — that is the same drift, arrived at from the other side.
 */
const DRIFTED = `
  select p.id,
         p.event_id,
         p.name,
         p.account_id            as row_account,
         r.account_id            as seat_account,
         e.name                  as event_name,
         c.slug                  as clan_slug
    from event_participants p
    join clan_roster r on r.id = p.clan_member_id
    join events e      on e.id = p.event_id
    join clans c       on c.id = e.clan_id
   where p.account_id is distinct from r.account_id
   order by p.event_id, p.id
`;

/**
 * Rows that CANNOT simply be corrected: the account they should carry is already held by a
 * different participant on the same board, so writing it would violate the partial unique index
 * (event_id, account_id). That is the duplicate this bug was capable of producing, and it needs a
 * person — one of the two rows holds the scores somebody actually played for.
 */
const COLLIDING = `
  select p.id,
         p.event_id,
         p.name       as swapped_row,
         other.id     as other_id,
         other.name   as other_row
    from event_participants p
    join clan_roster r      on r.id = p.clan_member_id
    join event_participants other
      on other.event_id = p.event_id
     and other.account_id = r.account_id
     and other.id <> p.id
   where p.account_id is distinct from r.account_id
`;

async function main() {
  const drifted = (await pool.query(DRIFTED)).rows;
  const colliding = (await pool.query(COLLIDING)).rows;
  const blocked = new Set(colliding.map((r) => r.id));
  const fixable = drifted.filter((r) => !blocked.has(r.id));

  if (drifted.length === 0) {
    console.log('Nothing drifted — every participant carries the account of the seat it points at.');
    await pool.end();
    return;
  }

  console.log(`${drifted.length} participant row(s) carry the wrong account.\n`);
  for (const r of fixable) {
    console.log(
      `  #${r.id}  ${r.clan_slug}/${r.event_name}  ${r.name}  ` +
        `account ${r.row_account ?? 'null'} -> ${r.seat_account ?? 'null'}`,
    );
  }

  if (colliding.length > 0) {
    console.log(
      `\n${colliding.length} row(s) CANNOT be corrected automatically — the account they should ` +
        `carry is already on that board under another row. These are the duplicates the bug could\n` +
        `produce; decide which one keeps the scores, remove the other, then re-run.\n`,
    );
    for (const r of colliding) {
      console.log(`  event ${r.event_id}: #${r.id} "${r.swapped_row}" collides with #${r.other_id} "${r.other_row}"`);
    }
  }

  if (!APPLY) {
    console.log(`\n(dry run — nothing written. Re-run with --apply to correct ${fixable.length} row(s).)`);
    await pool.end();
    return;
  }

  // One statement, one transaction. The same predicate as the report, so nothing can be corrected
  // that the report did not name — and rows that would collide are excluded by the NOT EXISTS
  // rather than by the id list, so a row that became a collision between the report and the write
  // is skipped instead of raising 23505 and rolling the whole thing back.
  const client = await pool.connect();
  try {
    await client.query('begin');
    const res = await client.query(`
      update event_participants p
         set account_id = r.account_id
        from clan_roster r
       where r.id = p.clan_member_id
         and p.account_id is distinct from r.account_id
         and not exists (
               select 1 from event_participants other
                where other.event_id = p.event_id
                  and other.account_id = r.account_id
                  and other.id <> p.id
             )
      returning p.id
    `);
    await client.query('commit');
    console.log(`\nCorrected ${res.rowCount} row(s).`);
    if (colliding.length > 0) {
      console.log(`${colliding.length} left for a human, listed above.`);
    }
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
