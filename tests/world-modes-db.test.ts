// Game-mode routing per clan (lib/worldModeStore): the master switch, a mode switched off, the kinds a
// mode drops, Leagues' old settings, and modes the site names itself the first time it sees them.
//
// Run: npx tsx --test tests/world-modes-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('world-modes');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let clanId: number;
let settings: typeof import('../src/lib/settings.ts');
let pluginConfig: typeof import('../src/lib/pluginConfig.ts');
let store: typeof import('../src/lib/worldModeStore.ts');
let modes: typeof import('../src/lib/worldModes.ts');

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  settings = await import('../src/lib/settings.ts');
  pluginConfig = await import('../src/lib/pluginConfig.ts');
  store = await import('../src/lib/worldModeStore.ts');
  modes = await import('../src/lib/worldModes.ts');
  const [clan] = await db.insert(s.clans).values({ slug: 'modes', name: 'Modes Clan' }).returning();
  clanId = clan.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const HOOK = (n: string) => `https://discord.com/api/webhooks/${n}`;

/** Where one post goes, the way the notify route asks. */
async function route(modeKey: string, channel: 'rareDrops' | 'deaths') {
  const w = await pluginConfig.getNotificationWebhooks(clanId);
  const r = await store.getModeRouting(clanId, modeKey, w.leagues);
  return modes.routeModePost(channel, { ...r, normalHook: w[channel] });
}

test('a fresh clan: modes post to the normal channels', async () => {
  await settings.setSetting(clanId, 'webhook_rare_drops', HOOK('drops'));
  assert.equal(await route('deadman', 'rareDrops'), HOOK('drops'));
});

test('a mode channel takes its posts while the master switch is on', async () => {
  await settings.setSetting(clanId, 'webhook_mode_deadman', HOOK('dmm'));
  assert.equal(await route('deadman', 'rareDrops'), HOOK('dmm'));
  assert.equal(await route('hardcore', 'rareDrops'), HOOK('drops'), 'other modes are untouched');
  await settings.setSetting(clanId, modes.WORLD_MODES_SPLIT_KEY, 'off');
  assert.equal(await route('deadman', 'rareDrops'), HOOK('drops'), 'switch off: back to normal');
  await settings.setSetting(clanId, modes.WORLD_MODES_SPLIT_KEY, 'on');
});

test('a mode or one kind of its posts switched off posts nowhere', async () => {
  await settings.setSetting(clanId, modes.modeKindsOffKey('deadman'), JSON.stringify(['deaths']));
  assert.equal(await route('deadman', 'deaths'), null);
  assert.equal(await route('deadman', 'rareDrops'), HOOK('dmm'));
  await settings.setSetting(clanId, modes.WORLD_MODES_OFF_KEY, JSON.stringify(['deadman']));
  assert.equal(await route('deadman', 'rareDrops'), null);
  await settings.setSetting(clanId, modes.WORLD_MODES_OFF_KEY, '[]');
});

test("Leagues keeps its old channel, and its old 'off' still means 'keep them in the normal channels'", async () => {
  await settings.setSetting(clanId, 'webhook_leagues', HOOK('leagues'));
  assert.equal(await route('leagues', 'rareDrops'), HOOK('leagues'));
  await settings.setSetting(clanId, 'discord_feeds_off', JSON.stringify(['leagues']));
  assert.equal(await route('leagues', 'rareDrops'), HOOK('drops'));
  await settings.setSetting(clanId, 'discord_feeds_off', '[]');
});

test('a mode nobody catalogued is remembered once and listed after the catalogue', async () => {
  const echo = modes.resolveWorldMode('MEMBERS,SEASONAL', 'Echo Rush')!;
  await store.rememberSeenMode(clanId, echo);
  await store.rememberSeenMode(clanId, echo);
  await store.rememberSeenMode(clanId, modes.resolveWorldMode('DEADMAN', null)!);
  const rows = await store.clanModeRows(clanId);
  assert.equal(rows.length, modes.WORLD_MODES.length + 1);
  assert.deepEqual(rows.at(-1), { key: 'echo-rush', label: 'Echo Rush', known: false });
  await settings.setSetting(clanId, 'webhook_mode_echo-rush', HOOK('echo'));
  assert.equal(await route('echo-rush', 'rareDrops'), HOOK('echo'));
});

test('easy tasks stay quiet until a clan turns them on; a saved list is the whole answer', async () => {
  const fresh = await store.getModeRouting(clanId, 'grid-master', null);
  assert.ok(fresh.kindsOff.has('modeTaskMinor'), 'default: easy tasks off');
  assert.ok(!fresh.kindsOff.has('modeRelic'));
  await settings.setSetting(clanId, modes.modeKindsOffKey('grid-master'), JSON.stringify([]));
  assert.equal((await store.getModeRouting(clanId, 'grid-master', null)).kindsOff.size, 0, 'turned on');
});

test("a mode's own filters: unset follows the main game, saved values read back, a cleared one is gone", async () => {
  assert.deepEqual(await store.getModeFilters(clanId, 'hardcore'), { dropFloor: null, levels: null });
  const levels = { ninetyNines: true, skillStep: 0, skillFrom: 1, totalStep: 0, totalFrom: 0, maxTotal: true };
  await settings.setSetting(clanId, modes.modeDropFloorKey('hardcore'), '5000');
  await settings.setSetting(clanId, modes.modeLevelsKey('hardcore'), JSON.stringify(levels));
  assert.deepEqual(await store.getModeFilters(clanId, 'hardcore'), { dropFloor: 5000, levels });
  assert.deepEqual(await store.getModeFilters(clanId, 'deadman'), { dropFloor: null, levels: null }, 'per mode');
  await settings.setSetting(clanId, modes.modeDropFloorKey('hardcore'), null);
  await settings.setSetting(clanId, modes.modeLevelsKey('hardcore'), null);
  assert.deepEqual(await store.getModeFilters(clanId, 'hardcore'), { dropFloor: null, levels: null });
});

test('the review queue counts a wording once, newest line kept, capped per mode', async () => {
  const lines = await import('../src/lib/modeLineStore.ts');
  const LG = { key: 'leagues', known: true };
  const DMM = { key: 'deadman', known: true };
  const BETA = { key: 'beta', known: true };
  await lines.recordSample(LG, 'You have 12 of 40 echoes.', false);
  await lines.recordSample(LG, 'You have 13 of 40 echoes.', true);
  await lines.recordSample(DMM, 'You have 13 of 40 echoes.', false);
  const rows = await lines.listSamples();
  const lg = rows.find((r) => r.modeKey === 'leagues')!;
  assert.equal(lg.count, 2);
  assert.equal(lg.sample, 'You have 13 of 40 echoes.');
  assert.equal(lg.autoPosted, true);
  assert.equal(rows.filter((r) => r.modeKey === 'deadman').length, 1, 'modes queue separately');

  const { db, schema: s } = await loadDb();
  // Digit-free names: the queue blanks numbers, so "t3" would be queued as "t#".
  const name = (i: number) => [...i.toString(26)].map((c) => String.fromCharCode(97 + parseInt(c, 26))).join('');
  await db.insert(s.modeLineSamples).values(
    Array.from({ length: lines.MAX_SAMPLES_PER_MODE }, (_, i) => ({ modeKey: 'beta', template: name(i), sample: name(i) })),
  );
  await lines.recordSample(BETA, 'A brand new line', false);
  assert.equal((await lines.listSamples(5000)).filter((r) => r.modeKey === 'beta').length, lines.MAX_SAMPLES_PER_MODE);
  await lines.recordSample(BETA, name(3), false);
  assert.equal((await lines.listSamples(5000)).find((r) => r.template === name(3))!.count, 2, 'a queued one still counts');

  // A client inventing a new mode name per request is bounded by the total for unknown modes…
  await db.insert(s.modeLineSamples).values(
    Array.from({ length: lines.MAX_SAMPLES_TOTAL }, (_, i) => ({ modeKey: `junk-${name(i)}`, template: 'x', sample: 'x' })),
  );
  await lines.recordSample({ key: 'yet-another-mode', known: false }, 'Another line', false);
  const all = await lines.listSamples(20000);
  assert.ok(!all.some((r) => r.modeKey === 'yet-another-mode'), 'unknown modes share one capped pool');
  // …and that pool never crowds out a catalogued mode.
  await lines.recordSample({ key: 'deadman', known: true }, 'A real Deadman line', false);
  assert.ok((await lines.listSamples(20000)).some((r) => r.sample === 'A real Deadman line'));
});
