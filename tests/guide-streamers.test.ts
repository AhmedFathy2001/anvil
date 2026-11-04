// The streamer guides: /guide/creators (host), /guide/joining-a-streamer-event (viewer) and
// /guide/streaming-for-clans. Pinned here: each is a registered guide page (so the sitemap, the
// language switcher and hreflang pick it up), sits in the index's Streamers group, is findable by the
// words people search with, walks the same sections as its /setup outline in Discord, links only to
// pages that exist, and is what a creator space's "Admin guide" link opens.
//
// Pure: reads source as text where importing would pull in the database (page components, layout).
//
// Run: npm run test:guidestreamers

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { en } from '../src/app/guide/_i18n/en.ts';
import { GUIDE_PAGES, LOCALES, guideHref } from '../src/app/guide/_i18n/index.ts';
import { SEARCH_TERMS } from '../src/app/guide/_i18n/searchTerms.ts';
import { rank } from '../src/app/guide/_i18n/searchRank.ts';

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), 'utf-8');

const PAGES = [
  { slug: 'creators', ns: 'creators', file: 'CreatorsGuide', list: 'CREATORS_SECTIONS', topic: 'creators' },
  { slug: 'joining-a-streamer-event', ns: 'joiningStream', file: 'JoiningStreamGuide', list: 'JOINING_SECTIONS', topic: 'joining' },
  { slug: 'streaming-for-clans', ns: 'streamingClans', file: 'StreamingClansGuide', list: 'STREAMING_SECTIONS', topic: 'streamingclans' },
] as const;

type Section = { title?: string; body?: string[]; intro?: string };
const dict = en as unknown as Record<string, Record<string, unknown>>;

test('the three streamer guides are registered pages, with an English and a per-language route', () => {
  for (const p of PAGES) {
    assert.ok((GUIDE_PAGES as readonly string[]).includes(p.slug), `${p.slug} is in GUIDE_PAGES`);
    assert.ok(existsSync(join(ROOT, `src/app/guide/${p.slug}/page.tsx`)), `/guide/${p.slug} route exists`);
    assert.ok(existsSync(join(ROOT, `src/app/guide/[lang]/${p.slug}/page.tsx`)), `/guide/[lang]/${p.slug} route exists`);
  }
});

test('they are in the sitemap in every language', async () => {
  // meta.ts is what the sitemap walks (allGuideHrefs); it reaches lib/seo, so import it late.
  const { allGuideHrefs } = await import('../src/app/guide/_i18n/meta.ts');
  const hrefs = new Set(allGuideHrefs().map((h) => h.href));
  for (const p of PAGES) {
    for (const l of LOCALES) assert.ok(hrefs.has(guideHref(l.code, p.slug)), `${guideHref(l.code, p.slug)} in the sitemap`);
  }
  assert.ok(hrefs.has('/guide/creators'));
  assert.ok(hrefs.has('/guide/de/joining-a-streamer-event'));
});

test('the index lists them under Streamers, each with a card', () => {
  const src = read('src/app/guide/_pages/GuideIndex.tsx');
  assert.match(src, /key: 'streamers', pages: \['creators', 'joining-a-streamer-event', 'streaming-for-clans'\]/);
  assert.equal(en.index.groups.streamers, 'Streamers');
  for (const key of ['creators', 'joiningStream', 'streamingClans'] as const) {
    const card = en.index.cards[key];
    assert.ok(card.title && card.blurb && card.eyebrow && card.minutes, `${key} card is filled in`);
  }
});

test('search finds them by what people type', () => {
  const cardKey = { creators: 'creators', 'joining-a-streamer-event': 'joiningStream', 'streaming-for-clans': 'streamingClans' } as const;
  for (const p of PAGES) assert.ok(SEARCH_TERMS[p.slug]?.length > 0, `${p.slug} has search terms`);
  const items = PAGES.map((p) => {
    const card = en.index.cards[cardKey[p.slug]];
    return { page: p.slug, title: card.title, eyebrow: card.eyebrow, blurb: card.blurb, terms: SEARCH_TERMS[p.slug] };
  });
  const top = (q: string) => rank(q, items)?.[0]?.page;
  assert.equal(top('obs'), 'creators');
  assert.equal(top('twitch subs'), 'creators');
  assert.equal(top('kick code'), 'joining-a-streamer-event');
  assert.equal(top('event is full'), 'joining-a-streamer-event');
  assert.equal(top('past viewers'), 'streaming-for-clans');
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
      // Every id is rendered as a <Section id=…> on the page, in the same order.
      assert.ok(src.includes(`<Section id="${id}"`), `${p.file} renders #${id}`);
      const section = dict[p.ns][id] as Section | undefined;
      assert.ok(section?.title, `${p.ns}.${id} has a title`);
      assert.ok(section?.body?.length || section?.intro, `${p.ns}.${id} has text`);
    }
  }
});

/** Every string in a dictionary subtree. */
function strings(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(strings);
  if (node && typeof node === 'object') return Object.values(node).flatMap(strings);
  return [];
}

test('their links go to pages that exist, and every {placeholder} is one the page supplies', () => {
  const supplied: Record<string, string[]> = {
    creators: ['apex', 'pluginGuide', 'joiningGuide', 'streamingGuide'],
    joiningStream: ['pluginGuide'],
    streamingClans: ['creatorsGuide'],
  };
  for (const p of PAGES) {
    const all = strings(dict[p.ns]);
    for (const s of all) {
      for (const [, name] of s.matchAll(/\{(\w+)\}/g)) {
        assert.ok(supplied[p.ns].includes(name), `${p.ns}: {${name}} is not supplied by the page — "${s.slice(0, 60)}…"`);
      }
      for (const [, href] of s.matchAll(/\]\(([^)]+)\)/g)) {
        if (href.startsWith('{')) continue; // a guide link, checked above
        assert.ok(href.startsWith('/'), `${p.ns}: internal links only — ${href}`);
        const path = href.split(/[#?]/)[0];
        assert.ok(existsSync(join(ROOT, 'src/app', path, 'page.tsx')), `${p.ns}: ${href} is a real page`);
      }
    }
  }
});

test('a creator space’s "Admin guide" opens the creators guide; /host and the empty dashboard link to it', () => {
  assert.match(read('src/app/admin/layout.tsx'), /guideHref=\{creator \? '\/guide\/creators' : '\/guide\/admin'\}/);
  assert.match(read('src/app/host/page.tsx'), /href="\/guide\/creators"/);
  assert.match(read('src/app/admin/dashboard/CreatorDashboard.tsx'), /href="\/guide\/creators"/);
  assert.match(read('src/app/admin/clan/StreamSettings.tsx'), /href="\/guide\/streaming-for-clans"/);
});
