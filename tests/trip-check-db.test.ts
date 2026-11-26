// The pre-trip check's storage against a real database: the plugin's `state` row beside the item
// snapshots (owner-only, gone with sharing off and with the person), and own trip setups.
//
// Run: TESTS_OK=1 npx tsx --test tests/trip-check-db.test.ts

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';

import { dropDatabase, loadDb, resetDatabase, useTestDatabase } from './helpers/testDb.ts';

const DB = useTestDatabase('trip-check');
let pool: Pool;

before(async () => {
  await resetDatabase(DB);
  pool = (await loadDb()).pool;
});
after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

async function user(name: string): Promise<{ userId: number; playerId: number; accountId: number }> {
  const p = await pool.query(`INSERT INTO players (display_name) VALUES ($1) RETURNING id`, [name]);
  const playerId = p.rows[0].id as number;
  const u = await pool.query(`INSERT INTO users (discord_id, display_name, player_id) VALUES ($1, $2, $3) RETURNING id`, [`d${name}${Math.floor(Math.random() * 1e9)}`, name, playerId]);
  const a = await pool.query(`INSERT INTO accounts (rsn, rsn_normalized, player_id, is_primary) VALUES ($1, $2, $3, 1) RETURNING id`, [name, name.toLowerCase(), playerId]);
  return { userId: u.rows[0].id, playerId, accountId: a.rows[0].id };
}

test('state: stored on its own row, read only by the owner, kept apart from the containers, gone with sharing off', async () => {
  const items = await import('../src/lib/playerItems.ts');
  const { cleanTripState } = await import('../src/lib/tripState.ts');
  const me = await user('TripMe');
  const other = await user('TripOther');
  await items.saveSnapshot(me.accountId, { inventory: { items: [{ id: 12791 }], readAt: new Date().toISOString() } });
  await items.saveTripState(me.accountId, cleanTripState({ book: 1, pouch: [[560, 300]], pray: ['rigour'] })!);
  const s = await items.tripStateForViewer(me.userId, me.accountId);
  assert.equal(s?.book, 1);
  assert.deepEqual(s?.pouch, [{ id: 560, q: 300 }]);
  assert.deepEqual(s?.pray, ['rigour']);
  assert.equal(await items.tripStateForViewer(other.userId, me.accountId), null, 'nobody else reads it');
  // The containers read as before: the state row is not a container.
  const snap = await items.snapshotForViewer(me.userId, me.accountId);
  assert.deepEqual(Object.keys(snap ?? {}), ['inventory']);
  // A state-only push updates it in place.
  await items.saveTripState(me.accountId, cleanTripState({ book: 0 })!);
  assert.equal((await items.tripStateForViewer(me.userId, me.accountId))?.book, 0);
  assert.equal((await items.tripStateForViewer(me.userId, me.accountId))?.pouch, null);
  await items.deleteSnapshotsForUser(me.userId);
  assert.equal(await items.tripStateForViewer(me.userId, me.accountId), null, 'sharing off takes the state too');
});

test('own trip setups: saved, replaced, owner-only, forgotten', async () => {
  const store = await import('../src/lib/tripSetups.ts');
  const me = await user('SetupMe');
  const other = await user('SetupOther');
  const setup = { tier: 'advanced' as const, name: 'My ToA setup', gear: { weapon: 26219 }, style: 0, stats: { attack: 99, strength: 99, ranged: 99, magic: 99 }, inventory: [{ id: 13652 }] };
  assert.equal(await store.saveOwnTripSetup(other.userId, me.accountId, 'toa', setup), false, "can't save on somebody else's character");
  assert.equal(await store.saveOwnTripSetup(me.userId, me.accountId, 'toa', setup), true);
  assert.equal((await store.ownTripSetup(me.userId, me.accountId, 'toa'))?.gear.weapon, 26219);
  assert.equal(await store.ownTripSetup(other.userId, me.accountId, 'toa'), null);
  await store.saveOwnTripSetup(me.userId, me.accountId, 'toa', { ...setup, gear: { weapon: 4151 } });
  assert.equal((await store.ownTripSetup(me.userId, me.accountId, 'toa'))?.gear.weapon, 4151);
  assert.equal(await store.ownTripSetup(me.userId, me.accountId, 'tob'), null);
  await store.forgetOwnTripSetup(me.userId, me.accountId, 'toa');
  assert.equal(await store.ownTripSetup(me.userId, me.accountId, 'toa'), null);
});

test('next-trip target: picked, owner-only, ended by a kc or a clear, beside the containers', async () => {
  const items = await import('../src/lib/playerItems.ts');
  const store = await import('../src/lib/tripTargetStore.ts');
  const setups = await import('../src/lib/tripSetups.ts');
  const me = await user('TargetMe');
  const other = await user('TargetOther');
  assert.equal((await store.currentTarget(me.userId, me.accountId)).target, null);
  // A kill is the default: the last trip.
  await pool.query(`UPDATE accounts SET live_stat_key_times = $1 WHERE id = $2`, [JSON.stringify({ vorkath: new Date(Date.now() - 60_000).toISOString(), fishing: new Date().toISOString() }), me.accountId]);
  assert.deepEqual((await store.currentTarget(me.userId, me.accountId)).target, { key: 'vorkath', source: 'last' });
  assert.equal((await store.currentTarget(other.userId, me.accountId)).target, null, 'nobody else reads it');
  // Any monster can be picked; Doom picked by hand is stored as the Doom trip (one key per trip).
  assert.equal(await store.pickTarget(me.userId, me.accountId, 'nope', []), false);
  const setup = { tier: 'advanced' as const, name: 'My Doom setup', gear: { weapon: 26219 }, style: 0, stats: { attack: 99, strength: 99, ranged: 99, magic: 99 } };
  await setups.saveOwnTripSetup(me.userId, me.accountId, 'm:Vardorvis', setup);
  const own = await store.ownTripKeys(me.accountId);
  assert.equal(await store.pickTarget(other.userId, me.accountId, 'toa', own), false, "not on somebody else's character");
  assert.equal(await store.pickTarget(me.userId, me.accountId, 'm:Doom of Mokhaiotl', own), true);
  assert.deepEqual((await store.currentTarget(me.userId, me.accountId)).target, { key: 'doom', source: 'pick' });
  // The target row is not a container.
  await items.saveSnapshot(me.accountId, { inventory: { items: [{ id: 385 }], readAt: new Date().toISOString() } });
  assert.deepEqual(Object.keys((await items.snapshotForViewer(me.userId, me.accountId)) ?? {}), ['inventory']);
  // A Vardorvis kill ends the pick; with the saved setup the last trip is Vardorvis.
  await pool.query(`UPDATE accounts SET live_stat_key_times = $1 WHERE id = $2`, [JSON.stringify({ vardorvis: new Date(Date.now() + 60_000).toISOString() }), me.accountId]);
  assert.deepEqual((await store.currentTarget(me.userId, me.accountId)).target, { key: 'm:Vardorvis', source: 'last' });
  // A death / logout (the plugin's tripEnd) or "clear": nothing until the next kill.
  await new Promise((r) => setTimeout(r, 5));
  await store.clearTarget(me.accountId);
  await pool.query(`UPDATE accounts SET live_stat_key_times = $1 WHERE id = $2`, [JSON.stringify({ doomOfMokhaiotl: new Date(Date.now() - 1000).toISOString() }), me.accountId]);
  assert.equal((await store.currentTarget(me.userId, me.accountId)).target, null);
  await items.deleteSnapshotsForUser(me.userId);
  const left = await pool.query(`SELECT count(*)::int AS n FROM player_item_snapshots WHERE account_id = $1`, [me.accountId]);
  assert.equal(left.rows[0].n, 0, 'sharing off takes the target too');
});

test('carried: a waystone in the pushed inventory makes Doom the target, wherever the bank; banked, it falls back', async () => {
  const items = await import('../src/lib/playerItems.ts');
  const store = await import('../src/lib/tripTargetStore.ts');
  const me = await user('CarryMe');
  await pool.query(`UPDATE accounts SET live_stat_key_times = $1 WHERE id = $2`, [JSON.stringify({ vorkath: new Date(Date.now() - 60_000).toISOString() }), me.accountId]);
  await items.saveSnapshot(me.accountId, { inventory: { items: [{ id: 6685 }, { id: 31099 }], readAt: new Date().toISOString() } });
  assert.deepEqual((await store.currentTarget(me.userId, me.accountId)).target, { key: 'doom', source: 'carried' });
  assert.deepEqual(await store.targetLabel(me.userId, me.accountId), { short: 'Doom', why: 'carrying a waystone' });
  await items.saveSnapshot(me.accountId, { inventory: { items: [{ id: 6685 }], readAt: new Date().toISOString() } });
  assert.deepEqual((await store.currentTarget(me.userId, me.accountId)).target, { key: 'vorkath', source: 'last' });
});

test('warm: an items push with the bank works the check out; the bank-close ask reuses it, a change does not, another person never', async () => {
  const items = await import('../src/lib/playerItems.ts');
  const { tripView, warmTrip } = await import('../src/lib/pluginUi/tripView.ts');
  const { createHash } = await import('node:crypto');
  const me = await user('WarmMe');
  const other = await user('WarmOther');
  for (const [u, tok] of [[me, 'warm-me'], [other, 'warm-other']] as const) await pool.query(`UPDATE users SET plugin_token_hash = $1 WHERE id = $2`, [createHash('sha256').update(tok).digest('hex'), u.userId]);
  const at = () => new Date().toISOString();
  await items.saveSnapshot(me.accountId, { bank: { items: [{ id: 26219 }, { id: 4151 }, { id: 20997 }], readAt: at() }, equipment: { items: [{ id: 4151 }], readAt: at() }, inventory: { items: [{ id: 385 }], readAt: at() } });
  const req = (tok: string, rsn: string) => new Request('https://example.test/api/plugin/ui?v=trip', { headers: { Authorization: `Bearer ${tok}`, 'X-RSN': rsn } });
  type W = { warn: { title: string; instance?: true } | null; ui: unknown };
  const logs: unknown[][] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => void logs.push(a);
  process.env.TRIP_TIMING = '1';
  try {
    await warmTrip(req('warm-me', 'WarmMe'), 13454);
    const first = (await tripView(req('warm-me', 'WarmMe'), { region: '13454', why: 'bank-close' })) as W;
    assert.match(first.warn?.title ?? '', /^(ToA · \d+ problems?|✓ Ready for ToA)$/);
    assert.equal(first.warn?.instance, true, 'a raid: any instance is the fight area');
    assert.ok(logs.some((l) => JSON.stringify(l).includes('"cached"')), 'the ask found the warm');
    logs.length = 0;
    await items.saveSnapshot(me.accountId, { inventory: { items: [{ id: 385 }, { id: 385 }], readAt: at() } });
    await tripView(req('warm-me', 'WarmMe'), { region: '13454', why: 'bank-close' });
    assert.ok(!logs.some((l) => JSON.stringify(l).includes('"cached"')), 'the inventory changed: worked out again');
    // Someone else's token on my character gets nothing of mine, warm or not.
    await warmTrip(req('warm-other', 'WarmMe'), 13454);
    const theirs = (await tripView(req('warm-other', 'WarmMe'), { region: '13454', why: 'bank-close' })) as W;
    assert.equal(theirs.warn, null);
  } finally {
    console.log = orig;
    delete process.env.TRIP_TIMING;
  }
});
