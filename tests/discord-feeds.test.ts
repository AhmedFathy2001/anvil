// "What goes where" (lib/discordFeeds): every feed resolves the same fallbacks the senders do, and
// the plugin feeds line up with the plugin's channels.
//
// Run: npx tsx --test tests/discord-feeds.test.ts

import { test, before } from 'node:test';
import assert from 'node:assert/strict';

import { DISCORD_FEEDS, effectiveKey, feedById, parseFeedsOff } from '../src/lib/discordFeeds.ts';

let notifyChannels: readonly string[];
before(async () => {
  process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1:5432/unused';
  ({ NOTIFY_CHANNELS: notifyChannels } = await import('../src/lib/pluginConfig.ts'));
});

test('every plugin channel but clips has a feed under its own name, so switching it off reaches the plugin', () => {
  const ids = new Set(DISCORD_FEEDS.filter((f) => f.tab === 'game').map((f) => f.id));
  for (const c of notifyChannels) if (c !== 'clips') assert.ok(ids.has(c), c);
});

test('a feed lands in its own channel, else the first fallback that is set, else nowhere', () => {
  const pets = feedById('pets')!;
  const set = (...keys: string[]) => (k: string) => keys.includes(k);
  assert.equal(effectiveKey(pets, set('webhook_pets', 'webhook_plugin_default')), 'webhook_pets');
  assert.equal(effectiveKey(pets, set('webhook_rare_drops')), 'webhook_rare_drops');
  assert.equal(effectiveKey(pets, set('webhook_plugin_default', 'webhook_rare_drops')), 'webhook_plugin_default');
  assert.equal(effectiveKey(feedById('coffer')!, set('discord_webhook_url')), null, 'the coffer never falls back');
});

test('the off list keeps only real feeds', () => {
  assert.deepEqual([...parseFeedsOff('["deaths","nope",3]')], ['deaths']);
  assert.deepEqual([...parseFeedsOff('garbage')], []);
});
