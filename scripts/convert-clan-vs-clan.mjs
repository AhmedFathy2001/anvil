// Convert an OLD-style clan-vs-clan event into the co-host structure.
//
// The old world had no cross-clan concept, so a clan-vs-clan event is one clan's event with a team
// drawn by hand per clan — the players are already there, on teams that just aren't tagged. This is
// the cutover: tag each team to its clan, register the visiting clans as accepted co-hosts, delegate
// team_staff to their staff, and flip the event to `per_clan`. It mirrors lib/coHost.adoptTeamAsCoHost
// exactly (which is tested) but speaks raw pg, so it can run against a migrated DB with no app build.
//
// USAGE:
//   node scripts/convert-clan-vs-clan.mjs \
//     --event 8 --pairs 13:theafkspot,14:lfl [--policy host-holds] [--apply]
//
//   --pairs   teamId:clanSlug,…  every team on the board mapped to the clan it stands for. The pair
//             whose clan IS the event's host clan is tagged only; the others become co-hosts.
//   --policy  host-holds (default) | each-settles | clans-collect-host-pays
//   --apply   without it, prints the plan and rolls back.
//
// Idempotent: re-running tags what is untagged, upserts the co-host rows, and never double-grants a
// team_staff seat.

import pg from 'pg';

const args = process.argv.slice(2);
function opt(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}
const APPLY = args.includes('--apply');
const EVENT = Number(opt('event'));
const POLICY = opt('policy') || 'host-holds';
const PAIRS = (opt('pairs') || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    const [teamId, slug] = s.split(':');
    return { teamId: Number(teamId), slug: slug?.trim() };
  });

if (!EVENT || PAIRS.length === 0 || PAIRS.some((p) => !p.teamId || !p.slug)) {
  console.error('Need --event <id> and --pairs teamId:clanSlug,…');
  process.exit(1);
}
if (!['host-holds', 'each-settles', 'clans-collect-host-pays'].includes(POLICY)) {
  console.error(`Bad --policy ${POLICY}`);
  process.exit(1);
}

const STAFF_TIER = ['moderator', 'treasurer', 'admin', 'owner']; // atLeast('moderator')

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
let failed = false;
try {
  await client.query('BEGIN');

  const ev = (await client.query('SELECT id, clan_id, name FROM events WHERE id = $1', [EVENT])).rows[0];
  if (!ev) throw new Error(`No event ${EVENT}`);
  console.log(`[convert] event ${EVENT} "${ev.name}", host clan ${ev.clan_id}`);

  // Resolve each pair's clan, and check the team is on this event and not already another clan's.
  for (const p of PAIRS) {
    const clan = (await client.query('SELECT id, name FROM clans WHERE slug = $1', [p.slug])).rows[0];
    if (!clan) throw new Error(`No clan '${p.slug}'`);
    p.clanId = clan.id;
    p.clanName = clan.name;
    const team = (await client.query('SELECT id, event_id, clan_id FROM teams WHERE id = $1', [p.teamId])).rows[0];
    if (!team || team.event_id !== EVENT) throw new Error(`Team ${p.teamId} is not on event ${EVENT}`);
    if (team.clan_id != null && team.clan_id !== clan.id) throw new Error(`Team ${p.teamId} already belongs to clan ${team.clan_id}`);
    p.isHost = clan.id === ev.clan_id;
  }
  // No two pairs may name the same clan (would collide on teams_event_clan_unique).
  const seen = new Set();
  for (const p of PAIRS) {
    if (seen.has(p.clanId)) throw new Error(`Two teams mapped to clan ${p.clanId}`);
    seen.add(p.clanId);
  }

  // An owner/admin of the host clan is the actor for the grants.
  const actor = (
    await client.query(
      `SELECT user_id FROM clan_staff WHERE clan_id = $1 AND role IN ('owner','admin') ORDER BY role='owner' DESC LIMIT 1`,
      [ev.clan_id],
    )
  ).rows[0];
  const byUserId = actor?.user_id ?? null;

  for (const p of PAIRS) {
    // 1) Tag the existing team (keeps its players).
    await client.query('UPDATE teams SET clan_id = $1 WHERE id = $2 AND clan_id IS NULL', [p.clanId, p.teamId]);
    console.log(`[convert] team ${p.teamId} → ${p.slug}${p.isHost ? ' (host)' : ' (co-host)'}`);

    if (p.isHost) continue; // the host already has full authority; no co-host row, no delegated staff.

    // 2) Delegate team_staff to the co-host clan's moderator-and-up, skipping anyone already seated.
    const staff = (
      await client.query('SELECT user_id FROM clan_staff WHERE clan_id = $1 AND role = ANY($2)', [p.clanId, STAFF_TIER])
    ).rows.map((r) => r.user_id);
    if (staff.length) {
      const already = new Set(
        (await client.query('SELECT user_id FROM team_staff WHERE team_id = $1 AND user_id = ANY($2)', [p.teamId, staff])).rows.map(
          (r) => r.user_id,
        ),
      );
      const toGrant = staff.filter((u) => !already.has(u));
      for (const userId of toGrant) {
        await client.query(
          `INSERT INTO team_staff (team_id, user_id, granted_by_user_id, note) VALUES ($1, $2, $3, $4)`,
          [p.teamId, userId, byUserId, `${p.clanName} staff (co-host)`],
        );
      }
      console.log(`[convert]   delegated ${toGrant.length} new team_staff seat(s) (${already.size} already held)`);
    }

    // 3) Upsert an accepted co-host row pointing at this team.
    const existing = (await client.query('SELECT id FROM event_cohosts WHERE event_id = $1 AND clan_id = $2', [EVENT, p.clanId])).rows[0];
    if (existing) {
      await client.query(
        `UPDATE event_cohosts SET status='accepted', team_id=$1, accepted_by_user_id=$2, decided_at=now()::text WHERE id=$3`,
        [p.teamId, byUserId, existing.id],
      );
    } else {
      await client.query(
        `INSERT INTO event_cohosts (event_id, clan_id, status, team_id, invited_by_user_id, accepted_by_user_id, decided_at)
         VALUES ($1, $2, 'accepted', $3, $4, $4, now()::text)`,
        [EVENT, p.clanId, p.teamId, byUserId],
      );
    }
    console.log(`[convert]   ${p.slug} recorded as an accepted co-host`);
  }

  // 4) The event itself: per-clan formation + the chosen cash policy.
  await client.query('UPDATE events SET team_formation = $1, cash_policy = $2 WHERE id = $3', ['per_clan', POLICY, EVENT]);
  console.log(`[convert] event set to team_formation='per_clan', cash_policy='${POLICY}'`);

  // Report the final board.
  const board = (
    await client.query(
      `SELECT t.id, t.name, t.clan_id, c.slug, (SELECT count(*) FROM event_participants p WHERE p.team_id = t.id) AS players
       FROM teams t LEFT JOIN clans c ON c.id = t.clan_id WHERE t.event_id = $1 ORDER BY t.id`,
      [EVENT],
    )
  ).rows;
  console.log('[convert] board now:');
  for (const r of board) console.log(`  team ${r.id} "${r.name}" → ${r.slug ?? '(untagged)'} · ${r.players} players`);

  if (APPLY) {
    await client.query('COMMIT');
    console.log('[convert] committed.');
  } else {
    await client.query('ROLLBACK');
    console.log('[convert] DRY RUN — rolled back. Re-run with --apply to keep it.');
  }
} catch (e) {
  failed = true;
  await client.query('ROLLBACK').catch(() => {});
  console.error('[convert] failed, rolled back:', e.message);
} finally {
  client.release();
  await pool.end();
  process.exit(failed ? 1 : 0);
}
