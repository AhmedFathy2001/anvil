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
