import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUICK_SETUP_GROUPS,
  SPLIT_KEY_LABELS,
  isForeignWebhook,
  keysForChannelName,
  setupNotes,
  suggestReuse,
  webhookIdFromUrl,
  webhookIdsInText,
} from '../src/lib/discordQuickSetup.ts';

const hook = (channelId: string, channelName: string, name = 'Dink') => ({ channelId, channelName, name });

test('keysForChannelName: whole words, not substrings', () => {
  assert.deepEqual(keysForChannelName('💰│drops-and-pets'), ['webhook_rare_drops', 'webhook_pets']);
  assert.deepEqual(keysForChannelName('clan-loot'), ['webhook_rare_drops']);
  assert.deepEqual(keysForChannelName('deaths'), ['webhook_deaths']);
  assert.deepEqual(keysForChannelName('level-ups'), ['webhook_levels']);
  assert.deepEqual(keysForChannelName('clog'), ['webhook_collection_log']);
  assert.deepEqual(keysForChannelName('collection-log'), ['webhook_collection_log']);
  assert.deepEqual(keysForChannelName('pk-loot'), ['webhook_rare_drops', 'webhook_pvp_kills']);
  assert.deepEqual(keysForChannelName('quests-and-diaries'), ['webhook_combat_achievements']);
  assert.deepEqual(keysForChannelName('ca-tasks'), ['webhook_combat_achievements']);
  // "ca" inside a word is not a combat achievement.
  assert.deepEqual(keysForChannelName('vacation'), []);
  assert.deepEqual(keysForChannelName('general'), []);
});

test('suggestReuse one: the busiest channel takes everything, first seen wins a tie', () => {
  const foreign = [hook('1', 'dink'), hook('2', 'drops'), hook('2', 'drops'), hook('3', 'deaths')];
  assert.deepEqual(suggestReuse(foreign, 'one'), { webhook_plugin_default: '2' });
  assert.deepEqual(suggestReuse([hook('1', 'a'), hook('2', 'b')], 'one'), { webhook_plugin_default: '1' });
  assert.deepEqual(suggestReuse([], 'one'), {});
});

test('suggestReuse few: only the keys the layout writes', () => {
  const foreign = [hook('1', 'drops'), hook('2', 'pets'), hook('3', 'deaths'), hook('4', 'levels'), hook('5', 'achievements')];
  assert.deepEqual(suggestReuse(foreign, 'few'), {
    webhook_rare_drops: '1',
    webhook_deaths: '3',
    webhook_combat_achievements: '5',
  });
});

test('suggestReuse all: every matching key, and a shared channel serves both', () => {
  const foreign = [hook('1', 'drops-pets'), hook('3', 'deaths'), hook('4', 'level-ups'), hook('6', 'pvp')];
  assert.deepEqual(suggestReuse(foreign, 'all'), {
    webhook_rare_drops: '1',
    webhook_pets: '1',
    webhook_deaths: '3',
    webhook_levels: '4',
    webhook_pvp_kills: '6',
  });
});

test('suggestReuse: two channels for one key, the one with more webhooks wins', () => {
  const foreign = [hook('1', 'old-drops'), hook('2', 'drops'), hook('2', 'drops')];
  assert.deepEqual(suggestReuse(foreign, 'few'), { webhook_rare_drops: '2' });
});

test('setupNotes: only split keys the layout does not write keep overriding', () => {
  assert.deepEqual(setupNotes('few', {}), []);
  const one = setupNotes('one', { webhook_deaths: 'https://x', webhook_pets: '' });
  assert.equal(one.length, 1);
  assert.match(one[0], /^Deaths still goes/);
  // "few" writes pets with drops explicitly, so a leftover catch-all or an old pets channel can't
  // pull them away; only clips (never written) is reported.
  const few = setupNotes('few', { webhook_pets: 'https://y', webhook_plugin_default: 'https://z', webhook_clips: 'https://c' });
  assert.equal(few.length, 1);
  assert.match(few[0], /^Clips still goes/);
});

test('split layouts route every post kind explicitly', () => {
  for (const layout of ['few', 'all'] as const) {
    const keys = new Set(QUICK_SETUP_GROUPS[layout].flatMap((t) => [t.settingKey, ...(t.alsoKeys ?? [])]));
    for (const k of Object.keys(SPLIT_KEY_LABELS)) if (k !== 'webhook_clips') assert.ok(keys.has(k), `${layout} misses ${k}`);
  }
});

test('webhook ids from URLs', () => {
  assert.equal(webhookIdFromUrl('https://discord.com/api/webhooks/123/abc'), '123');
  assert.equal(webhookIdFromUrl('https://discord.com/api/v10/webhooks/456/abc'), '456');
  assert.equal(webhookIdFromUrl('nope'), null);
  assert.deepEqual(
    webhookIdsInText('https://discord.com/api/webhooks/1/a https://canary.discord.com/api/webhooks/2/b'),
    ['1', '2'],
  );
  assert.deepEqual(webhookIdsInText(null), []);
});

test('isForeignWebhook: ours by creator, app, or a URL Anvil uses; only incoming hooks count', () => {
  const bot = new Set(['99']);
  const used = new Set(['7']);
  assert.equal(isForeignWebhook({ id: '1', type: 1, user: { id: '5' } }, bot, used), true);
  assert.equal(isForeignWebhook({ id: '2', type: 1, user: { id: '99' } }, bot, used), false);
  assert.equal(isForeignWebhook({ id: '3', type: 1, application_id: '99' }, bot, used), false);
  assert.equal(isForeignWebhook({ id: '7', type: 1, user: { id: '5' } }, bot, used), false);
  assert.equal(isForeignWebhook({ id: '8', type: 2 }, bot, used), false);
});
