// The two clan-staff guides about people and authority: /guide/people (roster, guests, who can join)
// and /guide/staff-roles (who can do what). Pinned here: each is a registered guide page (so the
// sitemap, the language switcher and hreflang pick it up), sits in the index's "Running the clan"
// group, is findable by the words people search with, walks the same sections as its /setup outline
// in Discord, links only to placeholders the page supplies, and the access table has one cell per
// role on every row.
//
// Pure: reads source as text where importing would pull in the database (page components).
//
// Run: npx tsx --test tests/guide-people-staff.test.ts

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
  { slug: 'people', ns: 'people', file: 'PeopleGuide', list: 'PEOPLE_SECTIONS', topic: 'people', card: 'people' },
  { slug: 'staff-roles', ns: 'staffRoles', file: 'StaffRolesGuide', list: 'STAFF_SECTIONS', topic: 'staffroles', card: 'staffRoles' },
] as const;

type Section = { title?: string; body?: string[]; intro?: string };
const dict = en as unknown as Record<string, Record<string, unknown>>;

test('both are registered pages, with an English and a per-language route', () => {
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

test('the index lists them under Running the clan, each with a card', () => {
  const src = read('src/app/guide/_pages/GuideIndex.tsx');
  const clanGroup = /key: 'clan', pages: \[([^\]]+)\]/.exec(src)![1];
  for (const p of PAGES) {
    assert.ok(clanGroup.includes(`'${p.slug}'`), `${p.slug} is in the clan group`);
    const card = en.index.cards[p.card];
    assert.ok(card.title && card.blurb && card.eyebrow && card.minutes, `${p.card} card is filled in`);
    assert.equal(card.title, dict[p.ns].title, `${p.card} card and page share a title`);
  }
});

test('search finds them by what people type', () => {
  const items = PAGES.map((p) => {
    const card = en.index.cards[p.card];
    return { page: p.slug, title: card.title, eyebrow: card.eyebrow, blurb: card.blurb, terms: SEARCH_TERMS[p.slug] };
  });
  const top = (q: string) => rank(q, items)?.[0]?.page;
  assert.equal(top('who can join'), 'people');
  assert.equal(top('guests'), 'people');
  assert.equal(top('treasurer permissions'), 'staff-roles');
  assert.equal(top('make moderator'), 'staff-roles');
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
    people: ['staffGuide'],
    staffRoles: ['peopleGuide', 'moderatorGuide'],
  };
  for (const p of PAGES) {
    for (const s of strings(dict[p.ns])) {
      for (const [, name] of s.matchAll(/\{(\w+)\}/g)) {
        assert.ok(supplied[p.ns].includes(name), `${p.ns}: {${name}} is not supplied by the page — "${s.slice(0, 60)}…"`);
      }
    }
  }
});

test('the access table has a cell for every role on every row', () => {
  const table = en.staffRoles.table;
  assert.deepEqual(table.columns, ['Owner', 'Admin', 'Treasurer', 'Moderator', 'Member']);
  for (const row of table.rows) assert.equal(row.cells.length, table.columns.length, `${row.area} has ${row.cells.length} cells`);
});
