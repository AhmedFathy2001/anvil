#!/usr/bin/env node
/**
 * Players for k6 to be: a clan, a running board, and N linked characters with plugin tokens.
 *
 *   DATABASE_URL=… node loadtest/seed.mjs --slug load-test --players 200 [--out loadtest/.out/fixtures.json]
 *
 * Builds on scripts/seed-test-clan.mjs (the clan, roster, boards, weeklies — additive, safe to run
 * twice) and adds the part a load test needs that a human integrator must NOT be handed: each
 * character already claimed by a login that holds a plugin token. The tokens are written to the
 * fixtures file and nowhere else; the database keeps only their hash, as it does for real ones.
 *
 * Refuses a non-local database unless --allow-remote is given. The clan it makes has no Discord
 * configured, so plugin writes against it post nowhere.
 */

import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[load-seed] DATABASE_URL is required');
  process.exit(1);
}
const host = new URL(url).hostname;
if (!['localhost', '127.0.0.1', '::1'].includes(host) && !args.includes('--allow-remote')) {
  console.error(`[load-seed] ${host} is not local. Pass --allow-remote if this really is a throwaway target.`);
  process.exit(1);
}

const SLUG = flag('slug', 'load-test');
const N = Number(flag('players', '200'));
const OUT = flag('out', path.join(here, '.out', 'fixtures.json'));
// 12 is the RSN limit; "Load 0001" leaves room and sorts.
const rsns = Array.from({ length: N }, (_, i) => `Load ${String(i + 1).padStart(4, '0')}`);

execFileSync(
  process.execPath,
  [path.join(here, '..', 'scripts', 'seed-test-clan.mjs'), '--slug', SLUG, '--name', 'Load Test', '--members', rsns.join(',')],
  { stdio: ['ignore', 'ignore', 'inherit'], env: process.env },
);
console.log(`[load-seed] clan '${SLUG}' with ${N} member(s) seeded`);

const c = new pg.Client({ connectionString: url });
await c.connect();
const one = async (sql, params = []) => (await c.query(sql, params)).rows[0] ?? null;

// A fixtures file from an earlier run keeps its tokens, so re-seeding does not log k6 out.
const prior = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
const priorToken = new Map((prior?.players ?? []).map((p) => [p.rsn, p.token]));

try {
  await c.query('BEGIN');
  const clan = await one('SELECT id FROM clans WHERE slug = $1', [SLUG]);
  const players = [];
  for (const rsn of rsns) {
    const acct = await one('SELECT id, player_id FROM accounts WHERE rsn_normalized = $1', [rsn.toLowerCase()]);
    const token = priorToken.get(rsn) ?? `lt_${crypto.randomBytes(24).toString('hex')}`;
    const hash = crypto.createHash('sha256').update(token, 'utf8').digest('hex');
    const discordId = `loadtest-${rsn.replace(/\D/g, '')}`;
    await c.query(
      `INSERT INTO users (display_name, discord_id, plugin_token_hash, player_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (discord_id) DO UPDATE SET plugin_token_hash = EXCLUDED.plugin_token_hash, player_id = EXCLUDED.player_id`,
      [rsn, discordId, hash, acct.player_id],
    );
    await c.query(
      `UPDATE accounts SET claimed_at = COALESCE(claimed_at, now()::text), verified_at = COALESCE(verified_at, now()::text),
              verification_method = COALESCE(verification_method, 'loadtest'), is_primary = 1, provisional = 0
        WHERE id = $1`,
      [acct.id],
    );
    players.push({ rsn, token });
  }

  // The RUNNING board (seed-test-clan names it): what a seat's config and pushes resolve to. By name,
  // not by comparing dates — the date columns hold two text formats (lib/dbTime).
  const ev = await one(`SELECT id FROM events WHERE clan_id = $1 AND name = 'Test Bingo (running)'`, [clan.id]);
  const tiles = ev ? (await c.query('SELECT id FROM tiles WHERE event_id = $1 ORDER BY position', [ev.id])).rows.map((r) => r.id) : [];
  await c.query('COMMIT');

  const fixtures = { slug: SLUG, eventId: ev?.id ?? null, tileIds: tiles, players, seededAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(fixtures, null, 2), { mode: 0o600 });
  console.log(`[load-seed] ${players.length} token(s), running board ${ev?.id ?? 'NONE'} → ${OUT}`);
} catch (err) {
  await c.query('ROLLBACK');
  throw err;
} finally {
  await c.end();
}
