#!/usr/bin/env node
/**
 * A clan with something to look at, for somebody trying the system out.
 *
 * WHY IT EXISTS. `seed-preview.mjs` builds a whole database from nothing and TRUNCATES to do it,
 * which is right for a throwaway preview and catastrophic anywhere real. Handing a new integrator a
 * live clan needs the opposite: add a clan beside the ones already there, touch nothing else, and be
 * safe to run twice. Everything here is additive and keyed on natural identifiers, so a second run
 * finds what the first made instead of duplicating it.
 *
 * WHAT IT MAKES, and why each one is worth having when testing a client:
 *
 *   a clan          the thing a token resolves to
 *   accounts        one per RSN given, seated as members
 *   a FINISHED board    scored, in the past — proves history reads without needing to play
 *   a RUNNING board     started, open, tiles unlocked — the one a client actually pushes into
 *   an UPCOMING board   sign-ups open, not started — the pre-event surfaces
 *   SOTW / BOTW / EHP   one finished, one running, one upcoming — every weekly shape at once
 *
 * The running board carries tiles of the kinds a client has to detect differently — a drop, a kill
 * count, an XP goal, a collection-log slot — because a client that handles one and not the others
 * looks like it works right up until it doesn't.
 *
 * Run:
 *   DATABASE_URL=… node scripts/seed-test-clan.mjs \
 *     --slug afk-test --name "AFK Test" --ingame "AFK Test" \
 *     --members "bruh haram,Zezima,Woox"
 *
 *   --owner-discord <id>   give an existing Discord login the owner seat (optional)
 *   --dry                  print what it would do and change nothing
 */

import pg from 'pg';

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[seed] DATABASE_URL is required');
  process.exit(1);
}

const SLUG = flag('slug', 'afk-test');
const NAME = flag('name', 'AFK Test');
// NO IN-GAME NAME BY DEFAULT, which is the opposite of what a real clan wants and right for a test
// one. `clan-sync` refuses a roster whose reported clan name does not match this field — and that
// guard is what stops somebody else's member list landing on your site. A tester is by definition in
// some OTHER clan in game, so pinning a name here means every sync he runs comes back 409
// clanMismatch. Left null, the check is skipped entirely (see the gate: `if (expectedClanName && …)`)
// and whichever clan he is actually in feeds this one. Pass --ingame to pin it once that matters.
const INGAME = flag('ingame', null);
const MEMBERS = (flag('members', 'bruh haram') || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const OWNER_DISCORD = flag('owner-discord');
// Somebody who verified by XP is left `provisional` for a mod to confirm — right for a real clan,
// pure friction for the person being handed a test one. Naming them here clears it.
const CONFIRM = (flag('confirm', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const DRY = has('dry');

const normalize = (rsn) => rsn.trim().toLowerCase().replace(/[\s_]+/g, ' ');
const iso = (days, hours = 0) =>
  new Date(Date.now() + days * 86_400_000 + hours * 3_600_000).toISOString();

const c = new pg.Client({ connectionString: url });
await c.connect();

async function one(sql, params = []) {
  const { rows } = await c.query(sql, params);
  return rows[0] ?? null;
}

if (DRY) console.log('[seed] DRY RUN — nothing will be written');

try {
  await c.query('BEGIN');

  // ── The clan ────────────────────────────────────────────────────────────────────────────────
  let clan = await one('SELECT id, name FROM clans WHERE slug = $1', [SLUG]);
  if (clan) {
    console.log(`[seed] clan '${SLUG}' already exists (id ${clan.id}) — adding to it`);
  } else {
    clan = await one(
      `INSERT INTO clans (slug, name, in_game_name, ingame_name_verified_at, status)
       VALUES ($1, $2, $3, $4, 'active') RETURNING id, name`,
      [SLUG, NAME, INGAME, INGAME ? new Date().toISOString() : null],
    );
    console.log(
      `[seed] created clan '${SLUG}' (id ${clan.id})` +
        (INGAME ? ` — in-game "${INGAME}", verified` : ' — no in-game name: accepts a roster from any clan'),
    );
  }
  const clanId = clan.id;

  // ── The roster ──────────────────────────────────────────────────────────────────────────────
  //
  // A person per RSN, because an account with no person cannot be claimed later and the whole
  // identity model hangs off it. Left UNCLAIMED on purpose: claiming is what the integrator does
  // from their own client, and pre-claiming it would skip the step being tested.
  const seatIds = [];
  const accountIds = [];
  for (const rsn of MEMBERS) {
    const rsnNorm = normalize(rsn);
    let account = await one('SELECT id FROM accounts WHERE rsn_normalized = $1', [rsnNorm]);
    if (!account) {
      const person = await one('INSERT INTO players (display_name) VALUES ($1) RETURNING id', [rsn]);
      account = await one(
        `INSERT INTO accounts (player_id, rsn, rsn_normalized, status, is_primary, provisional)
         VALUES ($1, $2, $3, 'active', 0, 0) RETURNING id`,
        [person.id, rsn, rsnNorm],
      );
      console.log(`[seed]   account ${rsn} (id ${account.id})`);
    } else {
      console.log(`[seed]   account ${rsn} already exists (id ${account.id}) — reusing`);
    }
    const seat = await one(
      `INSERT INTO clan_memberships (clan_id, account_id, kind, source, joined_at, last_seen_in_clan)
       VALUES ($1, $2, 'member', 'roster', $3, $3)
       ON CONFLICT (clan_id, account_id) DO UPDATE SET kind = 'member', left_at = NULL
       RETURNING id`,
      [clanId, account.id, new Date().toISOString()],
    );
    seatIds.push(seat.id);
    accountIds.push(account.id);
  }
  console.log(`[seed] roster: ${seatIds.length} member seat(s)`);

  // ── Confirmed, where asked ──────────────────────────────────────────────────────────────────
  for (const rsn of CONFIRM) {
    const row = await one(
      `UPDATE accounts SET provisional = 0, verified_at = COALESCE(verified_at, $2)
       WHERE rsn_normalized = $1 RETURNING id, rsn, claimed_at`,
      [normalize(rsn), new Date().toISOString()],
    );
    if (!row) console.log(`[seed]   no account named "${rsn}" to confirm`);
    else if (!row.claimed_at) console.log(`[seed]   ${row.rsn}: confirmed, but nobody has claimed it yet — they still need to link it`);
    else console.log(`[seed]   ${row.rsn}: confirmed (no longer waiting on a mod)`);
  }

  // ── Owner, if a Discord login was named ─────────────────────────────────────────────────────
  if (OWNER_DISCORD) {
    const user = await one('SELECT id, display_name FROM users WHERE discord_id = $1', [OWNER_DISCORD]);
    if (!user) {
      console.log(`[seed] no login with discord_id ${OWNER_DISCORD} — skipping the owner grant`);
      console.log('[seed]   (they must sign in once before they can be given a seat)');
    } else {
      await c.query(
        `INSERT INTO clan_staff (clan_id, user_id, role, created_at)
         VALUES ($1, $2, 'owner', $3)
         ON CONFLICT (clan_id, user_id) DO UPDATE SET role = 'owner'`,
        [clanId, user.id, new Date().toISOString()],
      );
      console.log(`[seed] owner: ${user.display_name ?? user.id}`);
    }
  }

  // ── Boards ──────────────────────────────────────────────────────────────────────────────────
  //
  // Three windows, one of each, so every time-dependent surface has something in it. The tiles on
  // the running board are the four detection shapes a client has to tell apart.
  const BOARDS = [
    {
      name: 'Spring Bingo (finished)',
      size: 3,
      start: iso(-30),
      end: iso(-16),
      tiles: [
        { label: 'Abyssal whip', type: 'drop', stat: null },
        { label: 'Dragon warhammer', type: 'drop', stat: null },
        { label: '500 Vorkath kills', type: 'kill', stat: 'vorkath', amount: 500 },
      ],
    },
    {
      name: 'Test Bingo (running)',
      size: 3,
      start: iso(-2),
      end: iso(12),
      tiles: [
        // One of each kind a client detects by a different route: an item, a kill-count line, an
        // XP threshold, and a collection-log unlock.
        { label: 'Any Zulrah unique', type: 'drop', stat: null },
        { label: '100 Zulrah kills', type: 'kill', stat: 'zulrah', amount: 100 },
        { label: '1M Slayer XP', type: 'stat', stat: 'slayer', statType: 'xp', goal: 1_000_000 },
        { label: 'Curved bone (clog)', type: 'clog', stat: null },
      ],
    },
    {
      name: 'Autumn Bingo (upcoming)',
      size: 3,
      start: iso(14),
      end: iso(28),
      tiles: [
        { label: 'Twisted bow', type: 'drop', stat: null },
        { label: '50 Chambers of Xeric', type: 'kill', stat: 'chambersOfXeric', amount: 50 },
      ],
    },
  ];

  for (const b of BOARDS) {
    const existing = await one('SELECT id FROM events WHERE clan_id = $1 AND name = $2', [clanId, b.name]);
    if (existing) {
      console.log(`[seed] board "${b.name}" already exists (id ${existing.id}) — leaving it`);
      continue;
    }
    const ev = await one(
      `INSERT INTO events (clan_id, name, board_size, format, scoring_mode, visibility, entry,
                           start_date, end_date, tiles_revealed)
       VALUES ($1,$2,$3,'bingo','tiles','clan','open',$4,$5,1) RETURNING id`,
      [clanId, b.name, b.size, b.start, b.end],
    );
    for (const [i, t] of b.tiles.entries()) {
      await c.query(
        `INSERT INTO tiles (event_id, position, label, tile_type, tracked_stat, required_amount,
                            stat_type, stat_goal)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [ev.id, i, t.label, t.type, t.stat, t.amount ?? null, t.statType ?? null, t.goal ?? null],
      );
    }
    // One team, so the board has somewhere to put a completion.
    const team = await one(
      `INSERT INTO teams (event_id, name, color) VALUES ($1, 'Test Team', '#d4a24a') RETURNING id`,
      [ev.id],
    );
    for (const [i, seatId] of seatIds.entries()) {
      // `name` is the per-event display override and is NOT NULL; seed it from the RSN, which is
      // what the site does when nobody has typed anything else.
      await c.query(
        `INSERT INTO event_participants (event_id, team_id, clan_member_id, account_id, name)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [ev.id, team.id, seatId, accountIds[i], MEMBERS[i]],
      );
    }
    console.log(`[seed] board "${b.name}" (id ${ev.id}) — ${b.tiles.length} tiles, 1 team`);
  }

  // ── Weeklies ────────────────────────────────────────────────────────────────────────────────
  const WEEKLIES = [
    { title: 'SOTW: Slayer (finished)', type: 'skill', metric: 'slayer', start: iso(-21), end: iso(-14), status: 'completed' },
    { title: 'BOTW: Zulrah (running)', type: 'boss', metric: 'zulrah', start: iso(-3), end: iso(4), status: 'active' },
    { title: 'SOTW: Mining (upcoming)', type: 'skill', metric: 'mining', start: iso(7), end: iso(14), status: 'upcoming' },
    { title: 'Efficiency: EHB (running)', type: 'efficiency', metric: 'ehb', start: iso(-1), end: iso(6), status: 'active' },
  ];

  for (const w of WEEKLIES) {
    const existing = await one(
      'SELECT id FROM weekly_competitions WHERE clan_id = $1 AND title = $2',
      [clanId, w.title],
    );
    if (existing) {
      console.log(`[seed] weekly "${w.title}" already exists (id ${existing.id}) — leaving it`);
      continue;
    }
    const comp = await one(
      `INSERT INTO weekly_competitions (clan_id, type, metric, title, start_date, end_date, status, include_guests)
       VALUES ($1,$2,$3,$4,$5,$6,$7,1) RETURNING id`,
      [clanId, w.type, w.metric, w.title, w.start, w.end, w.status],
    );
    // Everyone enrolled, with no baseline: the sweep takes one on its next pass, which is the
    // behaviour worth watching rather than a number worth inventing.
    for (const [i, seatId] of seatIds.entries()) {
      await c.query(
        `INSERT INTO weekly_participants (competition_id, clan_member_id, rsn, rsn_normalized)
         VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [comp.id, seatId, MEMBERS[i], normalize(MEMBERS[i])],
      );
    }
    console.log(`[seed] weekly "${w.title}" (id ${comp.id}) — ${seatIds.length} entered`);
  }

  if (DRY) {
    await c.query('ROLLBACK');
    console.log('[seed] DRY RUN — rolled back, nothing written');
  } else {
    await c.query('COMMIT');
    console.log(`\n[seed] done. The clan is at /c/${SLUG}`);
    console.log('[seed] Baselines and stats fill in on the next stats-cron tick (15 min).');
  }
} catch (e) {
  await c.query('ROLLBACK');
  console.error('[seed] failed, rolled back:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
