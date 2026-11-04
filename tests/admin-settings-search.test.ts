// The admin settings search: one catalogue of where every setting lives, a ranked match over it, and
// a filter that hides what the viewer's role cannot open.
//
// Run: npx tsx --test tests/admin-settings-search.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ADMIN_SETTINGS,
  pathOf,
  searchSettings,
  scoreSetting,
  visibleSettings,
} from '../src/lib/adminSettingsIndex.ts';
import { settingsViewer } from '../src/lib/adminSettingsViewer.ts';
import { ALL_SETTING_FIELDS } from '../src/lib/webhookFields.ts';
import { FEATURES } from '../src/lib/features.ts';
import { redirectFor, type AdminAccess } from '../src/lib/adminAccess.ts';

const viewerFor = (access: AdminAccess, features = FEATURES.map((f) => f.key)) => settingsViewer(access, features);
const admin = viewerFor({ role: 'admin', canEditTiles: true, editorScope: 'all' });
const moderator = viewerFor({ role: 'moderator', canEditTiles: false, editorScope: 'all' });
const ids = (q: string, entries = ADMIN_SETTINGS) => searchSettings(q, entries).map((e) => e.id);

test('ids are unique and every href is a bare site path', () => {
  const seen = new Set<string>();
  for (const e of ADMIN_SETTINGS) {
    assert.ok(!seen.has(e.id), `duplicate id ${e.id}`);
    seen.add(e.id);
    assert.match(e.href, /^\/(admin|profile|settings)(\/|#|$)/, e.id);
    assert.ok(e.label && e.description && e.section, e.id);
  }
});

test('every webhook field and every feature switch is in the catalogue', () => {
  for (const f of ALL_SETTING_FIELDS) assert.ok(ids(f.key).includes(`webhook-${f.key}`), f.key);
  for (const f of FEATURES) assert.ok(ADMIN_SETTINGS.some((e) => e.id === `feature-${f.key}`), f.key);
});

test('empty and unmatched queries find nothing', () => {
  assert.deepEqual(searchSettings(''), []);
  assert.deepEqual(searchSettings('   '), []);
  assert.deepEqual(searchSettings('zzzqqq'), []);
});

test('case-insensitive, every word must hit, plural finds singular', () => {
  assert.deepEqual(ids('DISCORD').slice(0, 1), ids('discord').slice(0, 1));
  assert.ok(ids('webhooks').length > 0);
  assert.ok(ids('rare drops').includes('webhook-webhook_rare_drops'));
  assert.ok(!ids('rare drops billing').length);
});

test('ranking: label prefix beats label word beats keyword beats description', () => {
  const entry = (label: string, keywords: string[], description: string) =>
    ({ id: label, label, keywords, description, href: '/admin', section: 'x' });
  const prefix = entry('Roles & nicknames', [], '');
  const word = entry('Staff roles', [], '');
  const kw = entry('People', ['roles'], '');
  const desc = entry('Other', [], 'Change roles here');
  assert.ok(scoreSetting(prefix, 'roles') > scoreSetting(word, 'roles'));
  assert.ok(scoreSetting(word, 'roles') > scoreSetting(kw, 'roles'));
  assert.ok(scoreSetting(kw, 'roles') > scoreSetting(desc, 'roles'));
  assert.deepEqual(searchSettings('roles', [desc, kw, word, prefix]).map((e) => e.id), [
    'Roles & nicknames',
    'Staff roles',
    'People',
    'Other',
  ]);
});

test('the things admins actually ask for land on the right page', () => {
  const top = (q: string) => searchSettings(q, visibleSettings(admin))[0];
  assert.equal(top('billing')?.href, '/admin/plan');
  assert.equal(top('subscription')?.href, '/admin/plan');
  assert.equal(top('house rules')?.href, '/admin/rules#house-rules');
  const rank = searchSettings('rank', visibleSettings(admin)).slice(0, 2).map((e) => e.id);
  assert.deepEqual(new Set(rank), new Set(['people-staff', 'discord-roles']));
  assert.equal(pathOf(top('webhook')!.href), '/admin/integrations');
  assert.equal(pathOf(top('coffer channel')!.href), '/admin/integrations');
  // There is no clan-side "Anvil updates" feed; the honest entry says so and points at the Discord.
  assert.equal(top('anvil updates')?.id, 'anvil-updates');
  assert.ok(ids('deploy').includes('anvil-updates'));
});

test('moderators only see what their role can open', () => {
  const mod = visibleSettings(moderator);
  const modIds = new Set(mod.map((e) => e.id));
  for (const hidden of ['discord', 'plan', 'features', 'rules-house', 'people-staff', 'access-guests', 'clan-name', 'events-new', 'events-all', 'event-tiles', 'coffer', 'webhook-discord_webhook_url']) {
    assert.ok(!modIds.has(hidden), `moderator should not see ${hidden}`);
  }
  for (const shown of ['dashboard', 'schedule', 'proofs', 'people-roster', 'people-review', 'activity-log', 'fees', 'profile-announcements']) {
    assert.ok(modIds.has(shown), `moderator should see ${shown}`);
  }
  // Everything a moderator sees really is reachable by the admin gate.
  for (const e of mod) {
    const p = pathOf(e.href);
    if (p.startsWith('/admin')) assert.equal(redirectFor(p, { role: 'moderator', canEditTiles: false, editorScope: 'all' }), null, e.id);
  }
});

test('treasurers reach the coffer; only the owner sees delete', () => {
  const treasurer = new Set(visibleSettings(viewerFor({ role: 'treasurer', canEditTiles: false, editorScope: 'all' })).map((e) => e.id));
  assert.ok(treasurer.has('coffer'));
  assert.ok(!new Set(visibleSettings(admin).map((e) => e.id)).has('clan-delete'));
  const owner = viewerFor({ role: 'owner', canEditTiles: true, editorScope: 'all' });
  assert.ok(visibleSettings(owner).some((e) => e.id === 'clan-delete'));
});

test('a switched-off feature hides its settings', () => {
  const noCoffer = viewerFor({ role: 'admin', canEditTiles: true, editorScope: 'all' }, FEATURES.map((f) => f.key).filter((k) => k !== 'coffer'));
  const seen = new Set(visibleSettings(noCoffer).map((e) => e.id));
  assert.ok(!seen.has('coffer'));
  assert.ok(!seen.has('webhook-discord_webhook_coffer'));
  // The switch itself stays findable, or there would be no way back.
  assert.ok(seen.has('feature-coffer'));
});

test('a creator space finds only what its pages show; an ordinary clan is unchanged', () => {
  const access: AdminAccess = { role: 'admin', canEditTiles: true, editorScope: 'all' };
  const all = FEATURES.map((f) => f.key);
  const creator = new Set(visibleSettings(settingsViewer(access, all, true)).map((e) => e.id));
  const clan = new Set(visibleSettings(settingsViewer(access, all)).map((e) => e.id));
  // Clan-only pages, Discord sections and channels are gone…
  for (const id of ['setup', 'clan-events', 'people-review', 'access-guests', 'discord-roles', 'discord-commands',
    'discord-clan-hall', 'discord-game-modes', 'clan-tags', 'rules-feeds', 'webhook-discord_webhook_weekly',
    'webhook-discord_webhook_roster', 'webhook-discord_webhook_cohost', 'webhook-discord_cohost_posts_enabled']) {
    assert.ok(!creator.has(id), id);
    assert.ok(clan.has(id), `${id} still there for a clan`);
  }
  // …and what a creator runs its events with is still found.
  for (const id of ['events-all', 'discord', 'discord-feeds', 'discord-event-posts', 'discord-team-channels',
    'webhook-discord_webhook_bingo', 'webhook-webhook_rare_drops', 'people-staff', 'plan']) {
    assert.ok(creator.has(id), id);
  }
});
