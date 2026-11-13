// The member settings hub and search on /settings: every card and entry points at a /settings page
// that exists and an #anchor that page renders, and the words people type find the right setting.
//
// Run: npx tsx --test tests/member-settings-index.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  MEMBER_SETTINGS,
  MEMBER_SETTINGS_CARDS,
  memberPathOf,
  resolveMemberHref,
  searchMemberSettings,
} from '../src/lib/memberSettingsIndex.ts';

const ROOT = join(import.meta.dirname, '..');
const SETTINGS = join(ROOT, 'src/app/settings');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? filesUnder(p) : p.endsWith('.tsx') ? [p] : [];
  });
}

/** Every literal id="…" rendered under app/settings, by the page directory it sits in. */
const SOURCES = filesUnder(SETTINGS).map((f) => ({ file: f, text: readFileSync(f, 'utf8') }));

/** The source a page renders: its page.tsx plus the shared settings components it uses. */
function pageSource(path: string): string {
  const dir = join(SETTINGS, path.replace(/^\/settings\/?/, ''));
  const own = SOURCES.filter((s) => s.file.startsWith(dir + '/') || s.file === join(dir, 'page.tsx')).map((s) => s.text);
  // Panels shared by several pages (EmissionPanels, ChatFeedPanel) live beside the pages, and the
  // sections the five pages are built from live in _parts.
  const shared = SOURCES.filter((s) => {
    const rel = s.file.slice(SETTINGS.length + 1);
    return !rel.includes('/') || rel.startsWith('_parts/');
  }).map((s) => s.text);
  return [...own, ...shared].join('\n');
}

const all = [...MEMBER_SETTINGS, ...MEMBER_SETTINGS_CARDS];

test('ids are unique and every entry has a label, description, keywords and section', () => {
  const seen = new Set<string>();
  for (const e of MEMBER_SETTINGS) {
    assert.ok(!seen.has(e.id), `duplicate id ${e.id}`);
    seen.add(e.id);
    assert.ok(e.label && e.description && e.section, e.id);
    assert.ok(e.keywords.length > 0, `${e.id}: no keywords`);
  }
  const cards = new Set<string>();
  for (const c of MEMBER_SETTINGS_CARDS) {
    assert.ok(!cards.has(c.id), `duplicate card ${c.id}`);
    cards.add(c.id);
    assert.ok(c.title && c.blurb && c.icon, c.id);
  }
});

test('every href is a /settings page that exists', () => {
  for (const e of all) {
    assert.match(e.href, /^\/settings(\/|#|$)/, e.id);
    const path = memberPathOf(e.href);
    const dir = path === '/settings/characters/main' ? 'characters/[accountId]' : path.replace(/^\/settings\/?/, '');
    assert.ok(existsSync(join(SETTINGS, dir, 'page.tsx')), `${e.id}: no page at ${path}`);
  }
});

test('every #anchor is an id its page renders', () => {
  for (const e of all) {
    const anchor = e.href.split('#')[1];
    if (!anchor) continue;
    const path = memberPathOf(e.href);
    // The characters stand-in resolves to a character's page, which is where its anchors live.
    const src = pageSource(path === '/settings/characters/main' ? '/settings/characters/[accountId]' : path);
    assert.ok(src.includes(`id="${anchor}"`), `${e.id}: ${path} renders no id="${anchor}"`);
  }
});

test('the characters stand-in resolves to the main character, keeping the anchor', () => {
  assert.equal(resolveMemberHref('/settings/characters/main#clans', 42), '/settings/characters/42#clans');
  assert.equal(resolveMemberHref('/settings/characters/main', 42), '/settings/characters/42');
  assert.equal(resolveMemberHref('/settings/characters/main#clans', null), '/settings/characters#link-account');
  assert.equal(resolveMemberHref('/settings/characters#add', 42), '/settings/characters#add');
  assert.equal(resolveMemberHref('/settings/in-game#plugin-token', 42), '/settings/in-game#plugin-token');
});

test('the hub has one card per page, and every old address redirects to a section its new page renders', async () => {
  assert.deepEqual(
    MEMBER_SETTINGS_CARDS.map((c) => memberPathOf(c.href)),
    ['/settings/profile', '/settings/characters', '/settings/in-game', '/settings/posts', '/settings/account'],
  );
  const { LEGACY_SETTINGS } = await import('../src/app/settings/_legacy.ts');
  const old = ['look', 'chat', 'supporter', 'boosts', 'add', 'claims', 'plugin', 'notifications', 'announcements', 'webhooks', 'connections', 'privacy'];
  for (const name of old) {
    const to = LEGACY_SETTINGS[name];
    assert.ok(to, `${name}: no redirect`);
    const page = readFileSync(join(SETTINGS, name, 'page.tsx'), 'utf8');
    assert.ok(page.includes(`LEGACY_SETTINGS['${name}']`), `${name}/page.tsx does not redirect`);
    assert.ok(pageSource(to.page).includes(`id="${to.at}"`), `${name}: ${to.page} renders no id="${to.at}"`);
  }
  // The old pages' section ids still render on the new pages, so old #deep-links keep landing.
  const kept: [string, string[]][] = [
    ['/settings/profile', ['avatar-banner', 'look-per-character', 'display-case', 'perks', 'name-colours', 'your-boosts', 'boostable-clans']],
    ['/settings/in-game', ['plugin-token', 'chat-feed']],
    ['/settings/characters', ['detected', 'link-account', 'claims-on-yours', 'your-claims']],
    ['/settings/posts', ['plugin-posts', 'where-posts-go', 'per-character', 'posts-drops', 'screenshot-privacy', 'your-webhooks']],
    ['/settings/account', ['plugin-sign-ins', 'sessions', 'clan-billing', 'twitch', 'youtube', 'kick', 'medal', 'character-visibility', 'across-anvil']],
  ];
  for (const [page, ids] of kept) for (const id of ids) assert.ok(pageSource(page).includes(`id="${id}"`), `${page}: no id="${id}"`);
});

const top = (q: string) => searchMemberSettings(q)[0]?.id;

test('screenshot privacy words find screenshot privacy', () => {
  for (const q of ['private messages', 'pms', 'hide chat', 'screenshot', 'clan chat', 'public chat']) {
    assert.equal(top(q), 'screenshot-privacy', q);
  }
});

test('Discord post words find the right post settings', () => {
  const cases: [string, string][] = [
    ['drops', 'posts-drops'],
    ['rare drop value', 'posts-drops'],
    ['rarity', 'posts-drops'],
    ['loot key', 'posts-drops'],
    ['deaths', 'posts-deaths'],
    ['death message', 'posts-deaths'],
    ['pets', 'posts-pets'],
    ['pvp', 'posts-pvp'],
    ['combat achievements', 'posts-achievements'],
    ['quests', 'posts-achievements'],
    ['levels', 'posts-achievements'],
    ['diaries', 'posts-achievements'],
    ['clog', 'posts-achievements'],
  ];
  for (const [q, id] of cases) assert.equal(top(q), id, q);
});

test('Supporter, characters, plugin and chat feed words resolve', () => {
  const cases: [string, string][] = [
    ['name colour', 'name-colours'],
    ['supporter', 'supporter'],
    ['patron', 'supporter'],
    ['add character', 'add-character'],
    ['plugin token', 'plugin-token'],
    ['sign out', 'sign-out'],
    ['chat feed', 'chat-feed'],
    ['webhook', 'webhooks'],
  ];
  for (const [q, id] of cases) assert.equal(top(q), id, q);
  assert.ok(searchMemberSettings('accounts').some((e) => e.section === 'Characters'), 'accounts');
  assert.ok(searchMemberSettings('characters').length > 0, 'characters');
});

test('every keyword finds its own entry', () => {
  for (const e of MEMBER_SETTINGS) {
    for (const k of e.keywords) {
      assert.ok(
        searchMemberSettings(k, MEMBER_SETTINGS.length).some((r) => r.id === e.id),
        `${e.id}: keyword "${k}" does not find it`,
      );
    }
  }
});

test('nothing typed, nothing found', () => {
  assert.deepEqual(searchMemberSettings(''), []);
  assert.deepEqual(searchMemberSettings('zzzzqqq'), []);
});
