#!/usr/bin/env node
/**
 * Fill a test clan with the things the admin screens react to, so each one has something to show.
 *
 * Run AFTER scripts/seed-test-clan.mjs on the same --slug. Additive and safe to run twice: every row
 * it writes is found again by a natural key or a `[demo]` note before it is written.
 *
 *   a DRAFT board with all 25 tiles     → event home says "Open sign-ups"
 *   fees on the upcoming board          → some paid, some reported, some owed; two sign-ups waiting
 *   two FLAGGED proofs on the running board → "Check 2 proofs" and the Proofs to check list
 *   prizes on the finished board        → one paid, one not: "Pay 1 prize"
 *   a coffer                            → an approved donation, one waiting, a pool held for an event
 *
 * Run:
 *   DATABASE_URL=… node scripts/seed-admin-demo.mjs --slug anvil-demo
 */

import pg from 'pg';

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[demo] DATABASE_URL is required');
  process.exit(1);
}
const SLUG = flag('slug', 'anvil-demo');
const iso = (days) => new Date(Date.now() + days * 86_400_000).toISOString();
const DEMO = '[demo]';

const c = new pg.Client({ connectionString: url });
await c.connect();
const one = async (sql, params = []) => (await c.query(sql, params)).rows[0] ?? null;
const all = async (sql, params = []) => (await c.query(sql, params)).rows;

try {
  await c.query('BEGIN');
  const clan = await one('SELECT id FROM clans WHERE slug = $1', [SLUG]);
  if (!clan) throw new Error(`no clan '${SLUG}' — run seed-test-clan.mjs first`);
  const seats = await all(
    `SELECT m.id AS seat, a.id AS account, a.rsn FROM clan_memberships m JOIN accounts a ON a.id = m.account_id
     WHERE m.clan_id = $1 AND m.left_at IS NULL AND m.kind = 'member' ORDER BY m.id`,
    [clan.id],
  );
  if (seats.length < 4) throw new Error('need at least 4 members — pass more --members to seed-test-clan.mjs');
  const board = async (name) => one('SELECT id FROM events WHERE clan_id = $1 AND name = $2', [clan.id, name]);

  // ── A draft board, fully written, nobody signed up ───────────────────────────────────────────
  if (!(await board('November Bingo'))) {
    const ev = await one(
      `INSERT INTO events (clan_id, name, board_size, format, scoring_mode, visibility, entry, start_date, end_date, tiles_revealed)
       VALUES ($1,'November Bingo',5,'bingo','tiles','clan','open',$2,$3,0) RETURNING id`,
      [clan.id, iso(10), iso(24)],
    );
    const labels = ['Zenyte shard', 'Any pet', '50 CoX', 'Fire cape', 'Dragon pickaxe', 'Bandos piece', 'A 99', 'Infernal cape',
      'Torva piece', 'Voidwaker piece', 'Twisted bow', '1,000 kills', 'Free tile', 'Tanzanite fang', 'Vorkath head', 'Nex unique',
      'ToA 500 clear', 'Elder maul', 'Masori piece', 'Dragon hunter lance', 'Full Barrows set', 'Herb sack', 'Any jar', 'Unsired', 'Kraken tentacle'];
    for (const [i, label] of labels.entries()) {
      await c.query(`INSERT INTO tiles (event_id, position, label, tile_type) VALUES ($1,$2,$3,'standard')`, [ev.id, i, label]);
    }
    console.log(`[demo] draft board "November Bingo" (id ${ev.id}) — 25 tiles, no sign-ups`);
  }

  // ── Fees on the upcoming board ───────────────────────────────────────────────────────────────
  const upcoming = await board('Autumn Bingo (upcoming)');
  if (upcoming) {
    await c.query('UPDATE events SET signup_fee = 5000000, added_prize_pool = 20000000 WHERE id = $1', [upcoming.id]);
    const feeStates = ['confirmed', 'collected', 'reported', 'pending'];
    for (const [i, s] of seats.entries()) {
      const exists = await one('SELECT id FROM event_signups WHERE event_id = $1 AND clan_member_id = $2', [upcoming.id, s.seat]);
      if (exists) continue;
      // The last two are still waiting for a decision; everyone else is in and owes 5m.
      const waiting = i >= seats.length - 2;
      const signup = await one(
        `INSERT INTO event_signups (event_id, clan_member_id, status) VALUES ($1,$2,$3) RETURNING id`,
        [upcoming.id, s.seat, waiting ? 'pending' : 'approved'],
      );
      if (!waiting) {
        const status = feeStates[i % feeStates.length];
        await c.query(
          `INSERT INTO signup_fees (signup_id, amount, status, collected_at, notes) VALUES ($1, 5000000, $2, $3, $4)`,
          [signup.id, status, status === 'collected' || status === 'confirmed' ? iso(-1) : null, DEMO],
        );
      }
    }
    console.log(`[demo] fees on "Autumn Bingo (upcoming)": 5m entry, 20m added, ${seats.length} sign-ups`);
  }

  // ── Flagged proofs on the running board ──────────────────────────────────────────────────────
  const running = await board('Test Bingo (running)');
  if (running) {
    const team = await one('SELECT id FROM teams WHERE event_id = $1 ORDER BY id LIMIT 1', [running.id]);
    const tiles = await all('SELECT id FROM tiles WHERE event_id = $1 ORDER BY position', [running.id]);
    const part = await one('SELECT id FROM event_participants WHERE event_id = $1 ORDER BY id LIMIT 1', [running.id]);
    const already = await one(`SELECT id FROM submissions WHERE team_id = $1 AND note = $2`, [team?.id ?? -1, DEMO]);
    if (team && tiles.length >= 2 && !already) {
      for (const [tileId, reason] of [[tiles[0].id, 'inferred_duplicate_pet'], [tiles[tiles.length - 1].id, 'no_start_proof']]) {
        await c.query(
          `INSERT INTO submissions (tile_id, team_id, credit_player_id, amount, note, flagged_reason) VALUES ($1,$2,$3,1,$4,$5)`,
          [tileId, team.id, part?.id ?? null, DEMO, reason],
        );
      }
      console.log('[demo] two flagged proofs on "Test Bingo (running)"');
    }
  }

  // ── Prizes on the finished board ─────────────────────────────────────────────────────────────
  const finished = await board('Spring Bingo (finished)');
  if (finished && !(await one('SELECT id FROM payouts WHERE event_id = $1', [finished.id]))) {
    const team = await one('SELECT id, name FROM teams WHERE event_id = $1 ORDER BY id LIMIT 1', [finished.id]);
    for (const [i, status] of ['paid', 'pending'].entries()) {
      await c.query(
        `INSERT INTO payouts (event_id, clan_member_id, rsn, team_id, team_name, place, amount, status, paid_at, notes)
         VALUES ($1,$2,$3,$4,$5,1,10000000,$6,$7,$8)`,
        [finished.id, seats[i].seat, seats[i].rsn, team?.id ?? null, team?.name ?? null, status, status === 'paid' ? iso(-10) : null, DEMO],
      );
    }
    console.log('[demo] prizes on "Spring Bingo (finished)": one paid, one owed');
  }

  // ── A coffer ─────────────────────────────────────────────────────────────────────────────────
  if (!(await one('SELECT id FROM coffer_entries WHERE clan_id = $1 AND note = $2', [clan.id, DEMO]))) {
    await c.query(
      `INSERT INTO coffer_entries (clan_id, kind, amount, status, clan_member_id, rsn, note) VALUES ($1,'donation',150000000,'approved',$2,$3,$4)`,
      [clan.id, seats[0].seat, seats[0].rsn, DEMO],
    );
    await c.query(
      `INSERT INTO coffer_entries (clan_id, kind, amount, status, clan_member_id, rsn, note) VALUES ($1,'donation',25000000,'pending',$2,$3,$4)`,
      [clan.id, seats[1].seat, seats[1].rsn, DEMO],
    );
    if (upcoming) {
      await c.query(
        `INSERT INTO coffer_entries (clan_id, kind, amount, status, event_id, note) VALUES ($1,'pool',-30000000,'reserved',$2,$3)`,
        [clan.id, upcoming.id, DEMO],
      );
    }
    console.log('[demo] coffer: 150m donated, 25m waiting to be confirmed, 30m held for Autumn Bingo');
  }

  await c.query('COMMIT');
  console.log(`\n[demo] done. Admin at /c/${SLUG}/admin`);
} catch (e) {
  await c.query('ROLLBACK');
  console.error('[demo] failed, rolled back:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
