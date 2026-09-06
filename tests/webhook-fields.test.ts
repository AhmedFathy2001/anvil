// The Discord destinations page: one catalogue, three consumers.
//
// The bug this suite exists for: `discord_webhook_coffer` was added to the page and to the settings
// route, but not to the third list — the keys /api/admin/discord/webhooks will create INTO — so the
// field rendered, a pasted URL saved, and pressing "Create webhook" answered "Unknown webhook
// setting." Both routes derive from lib/webhookFields now; what remains testable is that the
// catalogue itself stays whole, and that the search over it actually finds things.
//
// Run: npx tsx --test tests/webhook-fields.test.ts

import { test, before } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALL_SETTING_FIELDS,
  WEBHOOK_GROUPS,
  WEBHOOK_PAGE_SETTING_KEYS,
  WEBHOOK_SECTIONS,
  WEBHOOK_URL_KEYS,
  searchFields,
  searchTokens,
} from '../src/lib/webhookFields.ts';

// lib/pluginConfig reads settings and so pulls in `@/db`, which throws at module scope without a
// connection string. Nothing here opens one — the import is for a list of key names.
let pluginWebhookKeys: readonly string[];
before(async () => {
  process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1:5432/unused';
  ({ WEBHOOK_SETTING_KEYS: pluginWebhookKeys } = await import('../src/lib/pluginConfig.ts'));
});

const keyOf = (name: string) => ALL_SETTING_FIELDS.find((f) => f.key === name);

test('every plugin destination has a field on the page', () => {
  // The drift that broke the coffer channel, in the other direction: a channel added to the plugin
  // config with no field is one no clan can point anywhere.
  const missing = pluginWebhookKeys.filter((k) => !WEBHOOK_PAGE_SETTING_KEYS.includes(k as never));
  assert.deepEqual(missing, [], `plugin webhook keys with no field: ${missing.join(', ')}`);
});

test('the coffer channel is a webhook the bot may create into', () => {
  assert.ok(WEBHOOK_URL_KEYS.includes('discord_webhook_coffer'));
});

test('no key appears twice', () => {
  const seen = new Set<string>();
  const dupes = WEBHOOK_PAGE_SETTING_KEYS.filter((k) => (seen.has(k) ? true : (seen.add(k), false)));
  assert.deepEqual(dupes, []);
});

test('every section belongs to a tab that exists, and every tab has sections', () => {
  const ids = WEBHOOK_GROUPS.map((g) => g.id);
  for (const section of WEBHOOK_SECTIONS) assert.ok(ids.includes(section.group), section.id);
  for (const id of ids) assert.ok(WEBHOOK_SECTIONS.some((s) => s.group === id), `empty tab: ${id}`);
});

test('only webhook fields are offered to the bot creator', () => {
  // A toggle or a plain URL is not a webhook. Writing a Discord webhook URL into `leagues_icon_url`
  // would leak the token onto every seasonal post as an image source.
  assert.ok(!WEBHOOK_URL_KEYS.includes('leagues_icon_url'));
  assert.ok(!WEBHOOK_URL_KEYS.includes('members_count_guests'));
  assert.equal(keyOf('leagues_icon_url')?.kind, 'plain');
  assert.equal(keyOf('members_count_guests')?.kind, 'toggle');
});

test('a plain field is the only kind that carries a placeholder', () => {
  for (const f of ALL_SETTING_FIELDS) {
    if (f.placeholder) assert.equal(f.kind, 'plain', f.key);
  }
});

// ── Search ──────────────────────────────────────────────────────────────────────────────────────

const keysFor = (q: string) => searchFields(q).map((m) => m.field.key);

test('searching finds a channel by its own name', () => {
  assert.deepEqual(keysFor('coffer'), ['discord_webhook_coffer']);
});

test('a prefix is enough — the list is useful while still being typed', () => {
  assert.ok(keysFor('coff').includes('discord_webhook_coffer'));
  assert.ok(keysFor('quest').includes('webhook_quests'));
});

test('punctuation does not have to be reproduced', () => {
  assert.ok(keysFor('sign-up').includes('discord_webhook_signups'));
  assert.ok(keysFor('sign up').includes('discord_webhook_signups'));
  assert.ok(keysFor('sotw/botw').includes('discord_webhook_weekly'));
});

test('the settings key itself is searchable — the docs and the wire format use it', () => {
  // Not the only hit: the pets field's help mentions the rare-drops channel, and being found by a
  // cross-reference is worth keeping. The field the query NAMES has to come first, though.
  assert.equal(keysFor('webhook_rare_drops')[0], 'webhook_rare_drops');
});

test('the field a query names outranks the ones that merely mention it', () => {
  assert.equal(keysFor('pets')[0], 'webhook_pets');
  assert.equal(keysFor('deaths')[0], 'webhook_deaths');
});

test('more words narrow, they do not widen', () => {
  const broad = keysFor('leagues');
  const narrow = keysFor('leagues icon');
  assert.ok(broad.length > narrow.length);
  assert.deepEqual(narrow, ['leagues_icon_url']);
});

test('search crosses tabs, so you need not know which one holds it', () => {
  // "guests" lives on the audience tab; "drops" on the plugin one. One query reaches both.
  assert.ok(keysFor('guests').includes('members_count_guests'));
  assert.ok(keysFor('drops').includes('webhook_rare_drops'));
});

test('an empty query matches nothing — the caller shows its tabs instead', () => {
  assert.deepEqual(searchFields(''), []);
  assert.deepEqual(searchFields('   '), []);
  assert.deepEqual(searchTokens('  '), []);
});

test('a query nothing matches comes back empty rather than unfiltered', () => {
  assert.deepEqual(keysFor('zamorak'), []);
});
