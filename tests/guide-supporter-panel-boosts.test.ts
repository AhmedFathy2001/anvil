// The three player-side guides: /guide/supporter (tiers and perks), /guide/side-panel (the RuneLite
// panel, tab by tab) and /guide/clan-boosts (boosting a clan). Pinned here: each is a registered guide
// page (so the sitemap, the language switcher and hreflang pick it up), sits in the right index group
// with a card, is findable by the words people search with, walks the same sections as its /setup
// outline in Discord, links only to placeholders the page supplies, and the numbers it quotes agree
// with the rules they describe.
//
// Pure: reads source as text where importing would pull in the database (page components).
//
// Run: npx tsx --test tests/guide-supporter-panel-boosts.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { en } from '../src/app/guide/_i18n/en.ts';
import { GUIDE_PAGES, LOCALES, guideHref } from '../src/app/guide/_i18n/index.ts';
import { SEARCH_TERMS } from '../src/app/guide/_i18n/searchTerms.ts';
import { rank } from '../src/app/guide/_i18n/searchRank.ts';
import { DISPLAY_CASE_SLOTS } from '../src/lib/profileMediaRules.ts';
import { BOOST_SLOTS, LEVEL_AT } from '../src/lib/clanBoostRules.ts';
import { FRIENDS_CAPS } from '../src/lib/friendEventRules.ts';
import { TIER_GAP_MS } from '../src/lib/eventChatRules.ts';
import { SUPPORTER_TIERS, SUPPORTER_TIER_ORDER } from '../src/lib/supporterTiers.ts';

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), 'utf-8');

const PAGES = [
  { slug: 'supporter', ns: 'supporter', file: 'SupporterGuide', list: 'SUPPORTER_SECTIONS', topic: 'supporter', group: 'playing' },
  { slug: 'side-panel', ns: 'sidePanel', file: 'SidePanelGuide', list: 'PANEL_SECTIONS', topic: 'sidepanel', group: 'playing' },
  { slug: 'clan-boosts', ns: 'clanBoosts', file: 'ClanBoostsGuide', list: 'BOOSTS_SECTIONS', topic: 'boosts', group: 'clan' },
] as const;

type Section = { title?: string; body?: string[]; intro?: string };
const dict = en as unknown as Record<string, Record<string, unknown>>;
const cards = en.index.cards as unknown as Record<string, { title: string; blurb: string; eyebrow: string; minutes: string }>;

test('each is a registered page, with an English and a per-language route', () => {
  for (const p of PAGES) {
    assert.ok((GUIDE_PAGES as readonly string[]).includes(p.slug), `${p.slug} is in GUIDE_PAGES`);
    assert.ok(existsSync(join(ROOT, `src/app/guide/${p.slug}/page.tsx`)), `/guide/${p.slug} route exists`);
    assert.ok(existsSync(join(ROOT, `src/app/guide/[lang]/${p.slug}/page.tsx`)), `/guide/[lang]/${p.slug} route exists`);
  }
});

test('they are in the sitemap in every language', async () => {
  const { allGuideHrefs } = await import('../src/app/guide/_i18n/meta.ts');
  const hrefs = new Set(allGuideHrefs().map((h) => h.href));
  for (const p of PAGES) {
    for (const l of LOCALES) assert.ok(hrefs.has(guideHref(l.code, p.slug)), `${guideHref(l.code, p.slug)} in the sitemap`);
  }
});

test('the index lists each in its group, with a card that shares the page title', () => {
  const src = read('src/app/guide/_pages/GuideIndex.tsx');
  for (const p of PAGES) {
    const group = new RegExp(`key: '${p.group}', pages: \\[([^\\]]+)\\]`).exec(src)![1];
    assert.ok(group.includes(`'${p.slug}'`), `${p.slug} is in the ${p.group} group`);
    assert.ok(src.includes(`'${p.slug}': '${p.ns}'`) || src.includes(`${p.slug}: '${p.ns}'`), `${p.slug} has a CARD_KEY`);
    const card = cards[p.ns];
    assert.ok(card?.title && card.blurb && card.eyebrow && card.minutes, `${p.ns} card is filled in`);
    assert.equal(card.title, dict[p.ns].title, `${p.ns} card and page share a title`);
  }
});

test('search finds them by what people type', () => {
  const items = PAGES.map((p) => {
    const card = cards[p.ns];
    return { page: p.slug, title: card.title, eyebrow: card.eyebrow, blurb: card.blurb, terms: SEARCH_TERMS[p.slug] };
  });
  const top = (q: string) => rank(q, items)?.[0]?.page;
  assert.equal(top('patron'), 'supporter');
  assert.equal(top('gumroad'), 'supporter');
  assert.equal(top('event chat'), 'side-panel');
  assert.equal(top('feed tab'), 'side-panel');
  assert.equal(top('boost'), 'clan-boosts');
  assert.equal(top('spotlight'), 'clan-boosts');
});

test('each page walks the same sections as its Discord /setup outline, and every section has words', async () => {
  const { GUIDE_OUTLINES } = await import('../src/lib/discordGuides.ts');
  for (const p of PAGES) {
    const src = read(`src/app/guide/_pages/${p.file}.tsx`);
    const m = new RegExp(`${p.list} = \\[([^\\]]+)\\]`).exec(src);
    assert.ok(m, `${p.file} declares ${p.list}`);
    const ids = m![1].match(/'([a-z]+)'/g)!.map((s) => s.slice(1, -1));
    const outline = GUIDE_OUTLINES[p.topic];
    assert.ok(outline, `/setup has a ${p.topic} topic`);
    assert.equal(outline.page, p.slug);
    assert.equal(outline.ns, p.ns);
    assert.deepEqual(outline.sections, ids, `${p.topic} outline mirrors ${p.list}`);
    for (const id of ids) {
      assert.ok(src.includes(`<Section id="${id}"`), `${p.file} renders #${id}`);
      const section = dict[p.ns][id] as Section | undefined;
      assert.ok(section?.title, `${p.ns}.${id} has a title`);
      assert.ok(section?.body?.length || section?.intro, `${p.ns}.${id} has text`);
    }
  }
});

function strings(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(strings);
  if (node && typeof node === 'object') return Object.values(node).flatMap(strings);
  return [];
}

test('every {placeholder} is one the page supplies', () => {
  const supplied: Record<string, string[]> = {
    supporter: ['boostsGuide', 'panelGuide'],
    sidePanel: ['pluginGuide', 'supporterGuide'],
    clanBoosts: ['supporterGuide', 'peopleGuide'],
  };
  for (const p of PAGES) {
    for (const s of strings(dict[p.ns])) {
      for (const [, name] of s.matchAll(/\{(\w+)\}/g)) {
        assert.ok(supplied[p.ns].includes(name), `${p.ns}: {${name}} is not supplied by the page — "${s.slice(0, 60)}…"`);
      }
    }
  }
});

test('the Supporter compare table agrees with the tier rules', () => {
  const table = en.supporter.compare.table;
  assert.deepEqual(table.columns, ['Free', ...SUPPORTER_TIER_ORDER.map((id) => SUPPORTER_TIERS[id].name)]);
  for (const row of table.rows) assert.equal(row.cells.length, table.columns.length, `${row.area} has ${row.cells.length} cells`);
  const row = (area: string) => table.rows.find((r) => r.area.startsWith(area))!.cells.slice(1);
  assert.deepEqual(row('Display case'), SUPPORTER_TIER_ORDER.map((id) => `${DISPLAY_CASE_SLOTS[id]} slots`));
  assert.deepEqual(row('Clan boosts'), SUPPORTER_TIER_ORDER.map((id) => (BOOST_SLOTS[id] ? String(BOOST_SLOTS[id]) : '—')));
  assert.deepEqual(row('Friend events'), SUPPORTER_TIER_ORDER.map((id) => `${FRIENDS_CAPS[id].liveEvents} · ${FRIENDS_CAPS[id].playersPerEvent}`));
  assert.deepEqual(row('Event chat'), SUPPORTER_TIER_ORDER.map((id) => (TIER_GAP_MS[id] ? `${TIER_GAP_MS[id] / 1000} s` : 'None')));
  for (const id of SUPPORTER_TIER_ORDER) {
    const t = SUPPORTER_TIERS[id];
    const tierRow = en.supporter.tiers.rows.find((r) => r.term === t.name)!;
    assert.ok(tierRow.body.startsWith(`$${t.monthlyUsd} a month or $${t.yearlyUsd} a year`), `${t.name} price matches`);
  }
});

test('the boost levels in the guide match the rules', () => {
  const levels = en.clanBoosts.levels.rows.map((r) => Number(/^(\d+)/.exec(r.body)![1]));
  assert.deepEqual(levels, [...LEVEL_AT]);
});

test('/setup offers every topic', () => {
  // More guides than Discord's 25 static choices, so /setup type-aheads over SETUP_TOPICS.
  const src = read('src/lib/discordCommandDefs.ts');
  const list = src.slice(src.indexOf('export const SETUP_TOPICS'), src.indexOf('];', src.indexOf('export const SETUP_TOPICS')));
  const values = [...list.matchAll(/value: '([a-z]+)'/g)].map((m) => m[1]);
  for (const p of PAGES) assert.ok(values.includes(p.topic), `/setup offers ${p.topic}`);
});
