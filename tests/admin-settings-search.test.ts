// The admin settings search: one catalogue of where every setting lives, a ranked match over it, and
// a filter that hides what the viewer's role cannot open.
//
// Run: npx tsx --test tests/admin-settings-search.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  ADMIN_SETTINGS,
  GUIDE_ENTRIES,
  GUIDE_SECTIONS,
  NEW_SETTING_IDS,
  POPULAR_SETTING_IDS,
  pathOf,
  resolveHref,
  searchSettings,
  scoreSetting,
  startingPoints,
  visibleSettings,
  withinEdits,
} from '../src/lib/adminSettingsIndex.ts';
import { settingsViewer } from '../src/lib/adminSettingsViewer.ts';
import { ALL_SETTING_FIELDS, WEBHOOK_SECTIONS } from '../src/lib/webhookFields.ts';
import { FEATURES } from '../src/lib/features.ts';
import { DISCORD_FEEDS, FEED_TABS } from '../src/lib/discordFeeds.ts';
import { SETTINGS_INDEX } from '../src/lib/eventSettingsTabs.ts';
import { WORLD_MODES } from '../src/lib/worldModes.ts';
import { redirectFor, type AdminAccess } from '../src/lib/adminAccess.ts';
import { en } from '../src/app/guide/_i18n/en.ts';

const ROOT = join(import.meta.dirname, '..');
const APP = join(ROOT, 'src/app');

const viewerFor = (access: AdminAccess, features = FEATURES.map((f) => f.key), creator = false) => settingsViewer(access, features, creator);
const admin = viewerFor({ role: 'admin', canEditTiles: true, editorScope: 'all' });
const owner = viewerFor({ role: 'owner', canEditTiles: true, editorScope: 'all' });
const moderator = viewerFor({ role: 'moderator', canEditTiles: false, editorScope: 'all' });
const ids = (q: string, entries = ADMIN_SETTINGS) => searchSettings(q, entries).map((e) => e.id);
const adminIds = (q: string) => ids(q, visibleSettings(admin));
const top = (q: string) => searchSettings(q, visibleSettings(admin))[0];

// ── The catalogue ──────────────────────────────────────────────────────────────────────────────

test('ids are unique and every href is a bare site path', () => {
  const seen = new Set<string>();
  for (const e of [...ADMIN_SETTINGS, ...GUIDE_ENTRIES]) {
    assert.ok(!seen.has(e.id), `duplicate id ${e.id}`);
    seen.add(e.id);
    assert.match(e.href, /^\/(admin|settings|challenges|host|guide)(\/|#|$)/, e.id);
    assert.ok(e.label && e.description && e.section, e.id);
  }
  assert.ok(ADMIN_SETTINGS.length >= 240, `only ${ADMIN_SETTINGS.length} entries`);
});

/** Does a static path have a page in the App Router (a page.tsx under src/app at that path)? */
function hasPage(path: string): boolean {
  return existsSync(join(APP, path, 'page.tsx'));
}

test('every href points at a page that exists', () => {
  for (const e of [...ADMIN_SETTINGS, ...GUIDE_ENTRIES]) {
    assert.ok(hasPage(pathOf(e.href)), `${e.id}: no page at ${pathOf(e.href)}`);
    if (e.needsEvent) {
      assert.ok(e.eventPath !== undefined, `${e.id} needs an event but names no page in it`);
      const base = e.weekly ? 'admin/events/weekly/[weeklyId]' : 'admin/events/[eventId]';
      assert.ok(hasPage(join(base, pathOf(e.eventPath!))), `${e.id}: no event page at ${e.eventPath}`);
    }
  }
});

// Every id the site renders literally (id="x"), plus the generated families whose source is data.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? sourceFiles(p) : /\.tsx?$/.test(name) ? [p] : [];
  });
}
const SOURCE = sourceFiles(join(ROOT, 'src')).map((f) => readFileSync(f, 'utf8')).join('\n');
const LITERAL_IDS = new Set([...SOURCE.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const SETTING_KEYS = new Set([
  ...[...SOURCE.matchAll(/settingKey="([^"]+)"/g)].map((m) => m[1]),
  ...WEBHOOK_SECTIONS.flatMap((s) => s.fields.map((f) => f.key)),
]);

function anchorRenders(anchor: string): boolean {
  if (LITERAL_IDS.has(anchor)) return true;
  const setting = /^setting-(.+)$/.exec(anchor)?.[1];
  if (setting) return SETTING_KEYS.has(setting);
  const feedFilters = /^discord-feed-(\w+)-filters$/.exec(anchor)?.[1];
  if (feedFilters) return DISCORD_FEEDS.some((f) => f.id === feedFilters && f.filters);
  const feed = /^discord-feed-(\w+)$/.exec(anchor)?.[1];
  if (feed) return DISCORD_FEEDS.some((f) => f.id === feed);
  const tab = /^discord-feeds-(\w+)$/.exec(anchor)?.[1];
  if (tab) return FEED_TABS.some((t) => t.id === tab);
  const mode = /^discord-mode-(.+)$/.exec(anchor)?.[1];
  if (mode) return WORLD_MODES.some((m) => m.key === mode);
  const feature = /^feature-(.+)$/.exec(anchor)?.[1];
  if (feature) return FEATURES.some((f) => f.key === feature);
  // An event's Settings tabs: their anchors are the tabs' own index (lib/eventSettingsTabs).
  return SETTINGS_INDEX.some((s) => s.id === anchor);
}

test('every #anchor is an id the site renders', () => {
  // The generated families above are only trusted because their components render them.
  for (const marker of ['`setting-${settingKey}`', '`discord-feed-${f.id}`', '`discord-feed-${f.id}-filters`', '`discord-feeds-${t.id}`', '`discord-mode-${m.key}`', '`feature-${f.key}`']) {
    assert.ok(SOURCE.includes(marker), `nothing renders ${marker}`);
  }
  for (const e of ADMIN_SETTINGS) {
    for (const href of [e.href, e.eventPath ?? '']) {
      const anchor = href.split('#')[1];
      if (anchor) assert.ok(anchorRenders(anchor), `${e.id}: nothing renders #${anchor}`);
    }
    if (e.fallbackAnchor) assert.ok(anchorRenders(e.fallbackAnchor), `${e.id}: nothing renders fallback #${e.fallbackAnchor}`);
  }
});

test('every webhook field, feature switch, feed row, game mode and event setting is in the catalogue', () => {
  for (const f of ALL_SETTING_FIELDS) assert.ok(ids(f.key).includes(`webhook-${f.key}`), f.key);
  for (const f of FEATURES) assert.ok(ADMIN_SETTINGS.some((e) => e.id === `feature-${f.key}`), f.key);
  for (const f of DISCORD_FEEDS) {
    assert.ok(ADMIN_SETTINGS.some((e) => e.href.endsWith(`#discord-feed-${f.id}`)), `feed row ${f.id}`);
  }
  for (const m of WORLD_MODES) assert.ok(ADMIN_SETTINGS.some((e) => e.id === `discord-mode-${m.key}`), m.key);
  for (const s of SETTINGS_INDEX.filter((s) => !s.elsewhere)) {
    assert.ok(ADMIN_SETTINGS.some((e) => e.eventPath?.endsWith(`#${s.id}`)), `event setting ${s.id}`);
  }
});

test('guide sections exist under the title they are listed by', () => {
  const PAGE: Record<string, string> = {
    admin: 'AdminGuide', discord: 'DiscordGuide', moderator: 'ModeratorGuide', fees: 'FeesGuide', coffer: 'CofferGuide',
    clan: 'ClanGuide', commands: 'CommandsGuide', switching: 'SwitchingGuide', 'streaming-for-clans': 'StreamingClansGuide',
    creators: 'CreatorsGuide',
  };
  const dict = en as unknown as Record<string, Record<string, { title?: string }> & { title?: string }>;
  for (const g of GUIDE_SECTIONS) {
    assert.equal(dict[g.dict]?.[g.key]?.title, g.title, `${g.guide}#${g.anchor}: title`);
    assert.equal(dict[g.dict]?.title, g.guideTitle, `${g.guide}: guide title`);
    const page = readFileSync(join(APP, 'guide/_pages', `${PAGE[g.guide]}.tsx`), 'utf8');
    assert.ok(page.includes(`<Section id="${g.anchor}"`), `${g.guide}#${g.anchor}: no such section`);
  }
});

test('the module switches link to guide sections that exist', () => {
  for (const f of FEATURES) {
    const [path, anchor] = f.guide.split('#');
    assert.ok(hasPage(path), `${f.key}: ${path}`);
    if (anchor) {
      const pages = readdirSync(join(APP, 'guide/_pages')).map((n) => readFileSync(join(APP, 'guide/_pages', n), 'utf8'));
      assert.ok(pages.some((p) => p.includes(`<Section id="${anchor}"`)), `${f.key}: #${anchor}`);
    }
  }
});

// ── Matching ───────────────────────────────────────────────────────────────────────────────────

test('empty and unmatched queries find nothing', () => {
  assert.deepEqual(searchSettings(''), []);
  assert.deepEqual(searchSettings('   '), []);
  assert.deepEqual(searchSettings('zzzqqq'), []);
});

test('case- and accent-insensitive, every word must hit, plural finds singular', () => {
  assert.deepEqual(ids('DISCORD').slice(0, 1), ids('discord').slice(0, 1));
  assert.deepEqual(ids('Déaths'), ids('deaths'));
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

test('typos: one slip in a word of four letters or more, never in short words', () => {
  assert.ok(withinEdits('deth', 'death', 1), 'what "deths" stems to');
  assert.ok(withinEdits('boots', 'boost', 1), 'a swap is one slip');
  assert.ok(!withinEdits('fees', 'feeds', 0));
  assert.ok(adminIds('deths').includes('rules-feed-deaths'));
  assert.ok(adminIds('webhok').some((id) => id.startsWith('webhook-') || id === 'discord-by-hand'));
  assert.ok(adminIds('dinck').includes('discord-old-webhooks'));
  assert.ok(adminIds('recrutment').includes('boost-recruitment-post'));
  assert.ok(adminIds('boots').includes('boosts'));
  // "rka" is too short to forgive; and a clean match beats every forgiven one.
  assert.deepEqual(adminIds('rka'), []);
  assert.ok(!adminIds('rank').includes('coffer'), 'rank → bank is a typo, and rank has clean matches');
});

test('filler words do not have to match', () => {
  assert.equal(top('where do I turn off deaths in the feed')?.id, 'rules-feed-deaths');
  assert.equal(top('how to change the bot language')?.id, 'discord-language');
});

test('the things admins actually ask for land on the right setting', () => {
  assert.equal(top('billing')?.href, '/admin/plan');
  assert.equal(top('subscription')?.href, '/admin/plan');
  assert.equal(top('house rules')?.href, '/admin/rules#house-rules');
  assert.equal(top('keep deaths')?.id, 'rules-feed-deaths');
  for (const q of ['died', 'rip', 'death feed']) assert.ok(adminIds(q).slice(0, 5).includes('rules-feed-deaths'), q);
  assert.equal(top('dink')?.section.startsWith('Discord'), true);
  assert.ok(adminIds('old bot').includes('discord-old-webhooks'));
  assert.ok(adminIds('keep webhooks').slice(0, 3).includes('discord-old-webhooks'));
  assert.equal(top('nitro')?.id, 'boosts');
  assert.ok(adminIds('boost level').slice(0, 3).includes('boosts'));
  assert.ok(adminIds('hardcore threshold').slice(0, 2).includes('discord-mode-thresholds'));
  assert.ok(adminIds('1/128').slice(0, 3).includes('discord-drop-filters'));
  assert.ok(adminIds('leagues').includes('discord-mode-leagues'));
  assert.ok(adminIds('seasonal').includes('discord-mode-thresholds'));
  assert.ok(adminIds('gp floor').slice(0, 3).includes('rules-feed-loot'));
  assert.ok(adminIds('slow mode').includes('event-discord-chat'));
  assert.ok(adminIds('head to head').includes('challenges'));
  assert.ok(adminIds('friend events').includes('friends-events'));
  assert.ok(adminIds('overlay').some((id) => id.startsWith('event-setting-overlay')));
  assert.ok(adminIds('recruitment post').slice(0, 2).includes('boost-recruitment-post'));
  assert.ok(adminIds('post to discord').slice(0, 2).includes('announce'));
  const rank = adminIds('rank').slice(0, 3);
  assert.ok(rank.includes('people-staff') && rank.includes('discord-rank-rules'), rank.join());
  assert.equal(pathOf(top('webhook')!.href), '/admin/integrations');
  assert.equal(pathOf(top('coffer channel')!.href), '/admin/integrations');
  // There is no clan-side "Anvil updates" feed; the honest entry says so and points at the Discord.
  assert.equal(top('anvil updates')?.id, 'anvil-updates');
  assert.ok(adminIds('deploy').includes('anvil-updates'));
});

test('a breadcrumb names where it lives', () => {
  const deaths = ADMIN_SETTINGS.find((e) => e.id === 'rules-feed-deaths')!;
  assert.equal(deaths.section, 'Clan settings → Rules & scoring → Lately feed & luck');
  for (const e of ADMIN_SETTINGS) assert.ok(!e.section.includes('›'), `${e.id} uses the old separator`);
});

test('an event setting opens on the event you are in, or on the events list', () => {
  const reveal = ADMIN_SETTINGS.find((e) => e.id === 'event-setting-reveal')!;
  assert.equal(resolveHref(reveal, '/admin/dashboard'), '/admin/events');
  assert.equal(resolveHref(reveal, '/admin/events/12/tiles'), '/admin/events/12/settings/board#reveal');
  assert.equal(resolveHref(reveal, '/admin/events/weekly/3'), '/admin/events', 'a weekly is not a board');
  const chat = ADMIN_SETTINGS.find((e) => e.id === 'event-discord-chat')!;
  assert.equal(resolveHref(chat, '/admin/events/7'), '/admin/events/7/discord#event-chat');
  const repeat = ADMIN_SETTINGS.find((e) => e.id === 'weekly-repeat')!;
  assert.equal(resolveHref(repeat, '/admin/events/weekly/3/participants'), '/admin/events/weekly/3/settings#weekly-repeat');
  const prizes = ADMIN_SETTINGS.find((e) => e.id === 'weekly-prizes')!;
  assert.equal(resolveHref(prizes, '/admin/events/weekly/3'), '/admin/events/weekly/3#prizes');
  const shot = ADMIN_SETTINGS.find((e) => e.id === 'event-starting-shot')!;
  assert.equal(resolveHref(shot, '/admin/events/12/stats'), '/admin/events/12');
  // A plain setting goes where it goes.
  assert.equal(resolveHref(top('house rules')!, '/admin/events/12'), '/admin/rules#house-rules');
});

// ── Before anything is typed ───────────────────────────────────────────────────────────────────

test('New and Popular name real entries and never repeat each other', () => {
  const all = new Set(ADMIN_SETTINGS.map((e) => e.id));
  for (const id of [...NEW_SETTING_IDS, ...POPULAR_SETTING_IDS]) assert.ok(all.has(id), id);
  const { fresh, popular } = startingPoints(visibleSettings(admin));
  assert.ok(fresh.length >= 4 && popular.length >= 4);
  assert.ok(fresh.some((e) => e.id === 'boosts'));
  assert.ok(!popular.some((p) => fresh.includes(p)));
  // A moderator's lists only hold what they can open.
  const mod = startingPoints(visibleSettings(moderator));
  for (const e of [...mod.fresh, ...mod.popular]) assert.ok(visibleSettings(moderator).includes(e), e.id);
});

// ── Who sees what ──────────────────────────────────────────────────────────────────────────────

test('moderators only see what their role can open', () => {
  const mod = visibleSettings(moderator);
  const modIds = new Set(mod.map((e) => e.id));
  for (const hidden of ['discord', 'plan', 'features', 'rules-house', 'rules-feed-deaths', 'people-staff', 'access-guests', 'clan-name', 'boosts', 'events-new', 'events-all', 'event-tiles', 'event-setting-reveal', 'coffer', 'webhook-discord_webhook_url', 'discord-old-webhooks', 'announce']) {
    assert.ok(!modIds.has(hidden), `moderator should not see ${hidden}`);
  }
  for (const shown of ['dashboard', 'schedule', 'proofs', 'people-roster', 'people-review', 'activity-log', 'fees', 'profile-announcements', 'challenges']) {
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
  assert.ok(treasurer.has('coffer-prizes'));
  assert.ok(!new Set(visibleSettings(admin).map((e) => e.id)).has('clan-delete'));
  assert.ok(visibleSettings(owner).some((e) => e.id === 'clan-delete'));
});

test('a switched-off feature hides its settings', () => {
  const noCoffer = viewerFor({ role: 'admin', canEditTiles: true, editorScope: 'all' }, FEATURES.map((f) => f.key).filter((k) => k !== 'coffer' && k !== 'announce'));
  const seen = new Set(visibleSettings(noCoffer).map((e) => e.id));
  for (const id of ['coffer', 'coffer-ledger', 'webhook-discord_webhook_coffer', 'announce', 'announce-sent']) assert.ok(!seen.has(id), id);
  // The switch itself stays findable, or there would be no way back.
  assert.ok(seen.has('feature-coffer'));
  assert.ok(seen.has('feature-announce'));
});

test('a creator space finds only what its pages show; an ordinary clan is unchanged', () => {
  const access: AdminAccess = { role: 'owner', canEditTiles: true, editorScope: 'all' };
  const all = FEATURES.map((f) => f.key);
  const creatorEntries = visibleSettings(settingsViewer(access, all, true));
  const creator = new Set(creatorEntries.map((e) => e.id));
  const clan = new Set(visibleSettings(settingsViewer(access, all)).map((e) => e.id));
  // Clan-only pages, Discord sections and channels are gone…
  for (const id of ['setup', 'clan-events', 'people-review', 'access-guests', 'discord-roles', 'discord-commands',
    'discord-clan-hall', 'discord-game-modes', 'discord-mode-thresholds', 'clan-tags', 'rules-feeds', 'rules-feed-deaths',
    'boosts', 'clan-clan-twitch-channel', 'clan-delete', 'weekly-repeat', 'webhook-discord_webhook_weekly',
    'webhook-discord_webhook_roster', 'webhook-discord_webhook_cohost', 'webhook-discord_cohost_posts_enabled',
    'event-setting-cohosts']) {
    assert.ok(!creator.has(id), id);
    if (id !== 'clan-clan-twitch-channel') assert.ok(clan.has(id), `${id} still there for a clan`);
  }
  // …and what a creator runs its events with is still found, at the space's own addresses.
  for (const id of ['events-all', 'discord', 'discord-feeds', 'discord-event-posts', 'discord-team-channels',
    'webhook-discord_webhook_bingo', 'webhook-webhook_rare_drops', 'people-staff', 'plan', 'space-settings',
    'space-twitch-channel', 'space-page-panels', 'space-delete', 'event-setting-gate-space', 'event-setting-access-space']) {
    assert.ok(creator.has(id), id);
    assert.ok(!id.startsWith('space-') || !clan.has(id), `${id} is a space's, not a clan's`);
  }
  assert.ok(!creatorEntries.some((e) => pathOf(e.href) === '/admin/clan'), 'a space has no /admin/clan');
  // The access tab is "Viewers" for a space and "Entry & co-hosts" for a clan.
  assert.equal(creatorEntries.find((e) => e.id === 'event-setting-access-space')?.section, 'Event settings → Viewers');
  assert.equal(ADMIN_SETTINGS.find((e) => e.id === 'event-setting-access')?.section, 'Event settings → Entry & co-hosts');
});
