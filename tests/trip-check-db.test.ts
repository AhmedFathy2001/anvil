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

test('own trip setups: several per trip, named by preset, one default, owner-only, forgotten', async () => {
  const store = await import('../src/lib/tripSetups.ts');
  const me = await user('SetupMe');
  const other = await user('SetupOther');
  const setup = { tier: 'advanced' as const, name: 'My ToA setup', gear: { weapon: 26219 }, style: 0, stats: { attack: 99, strength: 99, ranged: 99, magic: 99 }, inventory: [{ id: 13652 }] };
  assert.equal(await store.saveOwnTripSetup(other.userId, me.accountId, 'toa', setup), null, "can't save on somebody else's character");
  const first = await store.saveOwnTripSetup(me.userId, me.accountId, 'toa', setup, null, 'ToA');
  assert.ok(first);
  assert.equal((await store.ownTripSetup(me.userId, me.accountId, 'toa'))?.gear.weapon, 26219);
  assert.equal(await store.ownTripSetup(other.userId, me.accountId, 'toa'), null);
  // Saving again replaces the default's gear, its name kept.
  await store.saveOwnTripSetup(me.userId, me.accountId, 'toa', { ...setup, gear: { weapon: 4151 } });
  const [only] = await store.listOwnSetups(me.userId, me.accountId, 'toa');
  assert.deepEqual([only.name, only.tag, only.isDefault, only.setup.gear.weapon], ['ToA Solo', 'Solo', true, 4151]);
  // A second one takes the next preset and isn't the default; the default stays what the check uses.
  const second = await store.createTripSetup(me.userId, me.accountId, 'toa', 'ToA', { ...setup, gear: { weapon: 27275 } });
  assert.equal(second?.name, 'ToA Group');
  assert.equal((await store.ownTripSetup(me.userId, me.accountId, 'toa'))?.gear.weapon, 4151);
  assert.equal((await store.ownTripSetup(me.userId, me.accountId, 'toa', second!.id))?.gear.weapon, 27275, 'the panel pick');
  assert.equal(await store.createTripSetup(other.userId, me.accountId, 'toa', 'ToA', setup), null);
  // A trip with no presets: "Setup N".
  assert.equal((await store.createTripSetup(me.userId, me.accountId, 'vorkath', 'Vorkath', setup))?.name, 'Setup 1');
  assert.equal(await store.ownTripSetup(me.userId, me.accountId, 'tob'), null);

  // The site's actions: only the owner's setups, by id.
  assert.equal(await store.setupOfUser(other.userId, second!.id), null);
  assert.equal(await store.updateSetupOfUser(other.userId, second!.id, { name: 'x' }), 'Not one of your setups.');
  assert.equal(await store.deleteSetupOfUser(other.userId, second!.id), false);
  assert.equal(await store.shareTokenOfUser(other.userId, second!.id), null);
  assert.match((await store.updateSetupOfUser(me.userId, second!.id, { name: 'x'.repeat(25) })) ?? '', /1 to 24/);
  assert.match((await store.updateSetupOfUser(me.userId, second!.id, { tag: 'HM' })) ?? '', /tag/);
  assert.equal(await store.updateSetupOfUser(me.userId, second!.id, { name: 'Group tank', tag: 'Expert', isDefault: true, shareClan: true }), null);
  const after = await store.listOwnSetups(me.userId, me.accountId, 'toa');
  assert.deepEqual(after.map((s) => [s.name, s.tag, s.isDefault, s.shareClan]), [['Group tank', 'Expert', true, true], ['ToA Solo', 'Solo', false, false]]);
  const token = await store.shareTokenOfUser(me.userId, second!.id);
  assert.ok(token);
  assert.equal(await store.shareTokenOfUser(me.userId, second!.id), token, 'the same link again');
  assert.deepEqual(await store.sharedSetup(token!).then((x) => [x?.name, x?.content, x?.setup.gear.weapon]), ['Group tank', 'toa', 27275]);
  assert.equal(await store.stopShareOfUser(me.userId, second!.id), true);
  assert.equal(await store.sharedSetup(token!), null, 'a stopped link shows nothing');
  // Deleting the default hands it to the oldest left.
  assert.equal(await store.deleteSetupOfUser(me.userId, second!.id), true);
  assert.equal((await store.listOwnSetups(me.userId, me.accountId, 'toa'))[0].isDefault, true);
  await store.forgetOwnTripSetup(me.userId, me.accountId, 'toa');
  assert.equal(await store.ownTripSetup(me.userId, me.accountId, 'toa'), null);
});

test('trip lock: wins over picks and kills, survives a trip end, dropped by unlock or a change', async () => {
  const store = await import('../src/lib/tripTargetStore.ts');
  const me = await user('LockMe');
  const other = await user('LockOther');
  assert.equal(await store.lockTarget(other.userId, me.accountId, 'toa', []), false);
  assert.equal(await store.lockTarget(me.userId, me.accountId, 'toa', []), true);
  assert.deepEqual((await store.currentTarget(me.userId, me.accountId)).target, { key: 'toa', source: 'lock' });
  await pool.query(`UPDATE accounts SET live_stat_key_times = $1 WHERE id = $2`, [JSON.stringify({ vorkath: new Date(Date.now() + 60_000).toISOString() }), me.accountId]);
  await store.clearTarget(me.accountId);
  assert.deepEqual((await store.currentTarget(me.userId, me.accountId)).target, { key: 'toa', source: 'lock' }, 'a kill elsewhere and a trip end keep it');
  await store.unlockTarget(me.userId, me.accountId);
  assert.notEqual((await store.currentTarget(me.userId, me.accountId)).target?.source, 'lock');
  await store.lockTarget(me.userId, me.accountId, 'cox', []);
  await pool.query(`UPDATE accounts SET live_stat_key_times = '{}' WHERE id = $1`, [me.accountId]);
  await store.pickTarget(me.userId, me.accountId, 'tob', []);
  assert.deepEqual((await store.currentTarget(me.userId, me.accountId)).target, { key: 'tob', source: 'pick' }, 'a change drops the lock');
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
    assert.match(first.warn?.title ?? '', /^(ToA: \d+ problems?|✓ Ready for ToA)$/);
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

test('adjust: a slot lists what I own for it, a pick re-checks with it (no overlay), saving keeps the picks', async () => {
  const items = await import('../src/lib/playerItems.ts');
  const { tripView, tripAct } = await import('../src/lib/pluginUi/tripView.ts');
  const { ownTripSetup } = await import('../src/lib/tripSetups.ts');
  const { createHash } = await import('node:crypto');
  const me = await user('PickMe');
  await pool.query(`UPDATE users SET plugin_token_hash = $1 WHERE id = $2`, [createHash('sha256').update('pick-me').digest('hex'), me.userId]);
  const at = () => new Date().toISOString();
  // Abyssal whip worn; Ghrazi rapier and Dragon scimitar in the bank.
  await items.saveSnapshot(me.accountId, { bank: { items: [{ id: 22324 }, { id: 4587 }], readAt: at() }, equipment: { items: [{ id: 4151 }], readAt: at() }, inventory: { items: [{ id: 385 }], readAt: at() } });
  const req = () => new Request('https://example.test/api/plugin/ui', { headers: { Authorization: 'Bearer pick-me', 'X-RSN': 'PickMe' } });
  const args = { why: 'manual', content: 'vorkath' };
  const alt = JSON.stringify(await tripView(req(), { ...args, alt: 'weapon' }));
  assert.match(alt, /Weapon: your options/);
  assert.match(alt, /Ghrazi rapier/);
  assert.match(alt, /DPS/);
  const picked = (await tripView(req(), { ...args, swap: 'weapon:4587' })) as { warn: unknown };
  assert.equal(picked.warn, null, 'adjusting is no bank-close answer');
  assert.match(JSON.stringify(picked), /Your picks over/);
  assert.match(JSON.stringify(picked), /Reset to the setup/);
  await tripAct(req(), 'trip-save', { content: 'vorkath', swap: 'weapon:4587' });
  assert.equal((await ownTripSetup(me.userId, me.accountId, 'vorkath'))?.gear.weapon, 4587, 'the picks were kept');
});

test('items: an emptied container (everything banked) is stored as an empty list, replacing the last', async () => {
  const items = await import('../src/lib/playerItems.ts');
  const me = await user('EmptyMe');
  await items.saveSnapshot(me.accountId, { equipment: { items: [{ id: 4151 }], readAt: new Date().toISOString() }, inventory: { items: [{ id: 385 }], readAt: new Date().toISOString() } });
  const cleaned = items.cleanContainer('equipment', { items: [] });
  assert.deepEqual(cleaned?.items, [], 'an empty list is a reading, not a bad one');
  await items.saveSnapshot(me.accountId, { equipment: cleaned!, inventory: items.cleanContainer('inventory', { items: [] })! });
  const snap = await items.snapshotForViewer(me.userId, me.accountId);
  assert.deepEqual(snap?.equipment?.items, []);
  assert.deepEqual(snap?.inventory?.items, []);
});

test('reload after a push: worked out from that push even when it resent the same items; the plan and the raid level are kept side by side', async () => {
  const items = await import('../src/lib/playerItems.ts');
  const { tripView, tripAct } = await import('../src/lib/pluginUi/tripView.ts');
  const { raidLevelFor, saveRaidLevel, tripPlanFor } = await import('../src/lib/tripRaidLevel.ts');
  const { createHash } = await import('node:crypto');
  const me = await user('ReloadMe');
  await pool.query(`UPDATE users SET plugin_token_hash = $1 WHERE id = $2`, [createHash('sha256').update('reload-me').digest('hex'), me.userId]);
  const at = () => new Date().toISOString();
  const worn = [{ id: 27275 }, { id: 21018 }];
  await items.saveSnapshot(me.accountId, { bank: { items: [{ id: 20997 }, { id: 26219 }, { id: 385, q: 50 }], readAt: at() }, equipment: { items: worn, readAt: at() }, inventory: { items: [], readAt: at() } });
  const req = () => new Request('https://example.test/api/plugin/ui?v=trip', { headers: { Authorization: 'Bearer reload-me', 'X-RSN': 'ReloadMe' } });
  const args = { why: 'manual', content: 'toa' };
  const logs: unknown[][] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => void logs.push(a);
  process.env.TRIP_TIMING = '1';
  try {
    const first = JSON.stringify(await tripView(req(), args));
    assert.match(first, /"act":"trip-plan"/, 'ToA has a profile: the plan chooser');
    logs.length = 0;
    await tripView(req(), args);
    assert.ok(logs.some((l) => JSON.stringify(l).includes('"cached"')), 'nothing pushed: the same answer');
    logs.length = 0;
    await new Promise((r) => setTimeout(r, 5));
    await items.saveSnapshot(me.accountId, { equipment: { items: worn, readAt: at() } });
    await tripView(req(), args);
    assert.ok(!logs.some((l) => JSON.stringify(l).includes('"cached"')), 'a push came: worked out from it');
  } finally {
    console.log = orig;
    delete process.env.TRIP_TIMING;
  }
  await saveRaidLevel(me.accountId, 450);
  const after = JSON.stringify(await tripAct(req(), 'trip-plan', { content: 'toa', plan: 'max' }));
  assert.equal(await tripPlanFor(me.accountId, 'toa'), 'max');
  assert.equal(await raidLevelFor(me.accountId), 450, 'the plan did not wipe the raid level');
  assert.match(after, /"s":"Max DPS","color":"white"/, 'the Max DPS chip lit');
  await saveRaidLevel(me.accountId, 300);
  assert.equal(await tripPlanFor(me.accountId, 'toa'), 'max', 'nor the raid level the plan');
  await tripAct(req(), 'trip-plan', { content: 'toa', plan: 'junk' });
  assert.equal(await tripPlanFor(me.accountId, 'toa'), 'max', 'an unknown plan is ignored');
});

test('clan setups: shared ones show for clanmates of the same clan only, never your own, never by a guest seat; a CA pick is kept', async () => {
  const store = await import('../src/lib/tripSetups.ts');
  const prefs = await import('../src/lib/tripRaidLevel.ts');
  const c1 = (await pool.query(`INSERT INTO clans (name, slug, created_at) VALUES ('ClanOne', 'clan-one-ts', $1) RETURNING id`, [new Date().toISOString()])).rows[0].id as number;
  const c2 = (await pool.query(`INSERT INTO clans (name, slug, created_at) VALUES ('ClanTwo', 'clan-two-ts', $1) RETURNING id`, [new Date().toISOString()])).rows[0].id as number;
  const seat = (clanId: number, accountId: number, kind = 'member') => pool.query(`INSERT INTO clan_memberships (clan_id, account_id, kind) VALUES ($1, $2, $3)`, [clanId, accountId, kind]);
  const sharer = await user('ClanSharer');
  const mate = await user('ClanMate');
  const outsider = await user('ClanOutsider');
  const guest = await user('ClanGuest');
  await seat(c1, sharer.accountId);
  await seat(c1, mate.accountId);
  await seat(c2, outsider.accountId);
  await seat(c1, guest.accountId, 'guest');
  const setup = { tier: 'advanced' as const, name: 'x', gear: { weapon: 12926 }, style: 0, stats: { attack: 99, strength: 99, ranged: 99, magic: 99 } };
  const shared = (await store.createTripSetup(sharer.userId, sharer.accountId, 'zulrah', 'Zulrah', setup))!;
  const hidden = (await store.createTripSetup(sharer.userId, sharer.accountId, 'zulrah', 'Zulrah', setup))!;
  assert.equal(await store.updateSetupOfUser(sharer.userId, shared.id, { shareClan: true }), null);
  const seen = await store.clanSharedSetups(mate.userId, mate.accountId, ['zulrah']);
  assert.deepEqual(seen.map((s) => [s.id, s.rsn]), [[shared.id, 'ClanSharer']], 'only the shared one, with the sharer’s RSN');
  assert.ok(!seen.some((s) => s.id === hidden.id));
  assert.equal(JSON.stringify(seen).includes('bank'), false, 'the setup only');
  assert.deepEqual(await store.clanSharedSetups(sharer.userId, sharer.accountId, ['zulrah']), [], 'never your own');
  assert.deepEqual(await store.clanSharedSetups(outsider.userId, outsider.accountId, ['zulrah']), [], 'another clan sees nothing');
  assert.deepEqual(await store.clanSharedSetups(guest.userId, guest.accountId, ['zulrah']), [], 'a guest seat is no clan');
  assert.deepEqual(await store.clanSharedSetups(mate.userId, sharer.accountId, ['zulrah']), [], 'only on your own character');
  assert.deepEqual(await store.clanSharedSetups(mate.userId, mate.accountId, ['vorkath']), [], 'per trip');
  await pool.query(`UPDATE clan_memberships SET left_at = '2026-11-27' WHERE account_id = $1`, [sharer.accountId]);
  assert.deepEqual(await store.clanSharedSetups(mate.userId, mate.accountId, ['zulrah']), [], 'a sharer who left the clan is gone');
  await prefs.saveTripCa(mate.accountId, 'zulrah', 229);
  await prefs.saveTripSetupPick(mate.accountId, 'zulrah', `c:${shared.id}`);
  assert.equal(await prefs.tripCaFor(mate.accountId, 'zulrah'), 229);
  assert.equal(await prefs.tripSetupPickFor(mate.accountId, 'zulrah'), `c:${shared.id}`);
  await prefs.saveTripCa(mate.accountId, 'zulrah', null);
  assert.equal(await prefs.tripCaFor(mate.accountId, 'zulrah'), null);
});

test('start from Anvil’s loadout: only on your own character, only with a bank seen, only a profiled boss', async () => {
  const { startFromAnvil } = await import('../src/lib/tripLoadoutStart.ts');
  const me = await user('StartMe');
  const other = await user('StartOther');
  assert.deepEqual(await startFromAnvil(me, me.accountId, 'doom', 'max'), { ok: false, error: 'Pick a boss and a plan.' }, 'no profile');
  assert.deepEqual(await startFromAnvil(me, me.accountId, 'zulrah', 'junk'), { ok: false, error: 'Pick a boss and a plan.' });
  assert.deepEqual(await startFromAnvil(other, me.accountId, 'zulrah', 'max'), { ok: false, error: 'Not one of your characters.' });
  const r = await startFromAnvil(me, me.accountId, 'zulrah', 'max');
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /hasn’t seen this character’s bank/);
});
