// The /guide tabs: what `?tab=` means, and that the in-game tab only ever lists the Anvil library.
//
// Run: node --import tsx --test tests/guide-tabs.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { groupLibraryCards, guideTabParam, libraryCards, parseGuideTab, type LibraryGuideLike } from '../src/app/guide/_i18n/guideTabs.ts';
import { rank } from '../src/app/guide/_i18n/searchRank.ts';

test('parseGuideTab: only "ingame" selects the in-game tab', () => {
  assert.equal(parseGuideTab('ingame'), 'ingame');
  assert.equal(parseGuideTab(' InGame '), 'ingame');
  assert.equal(parseGuideTab(['ingame', 'anvil']), 'ingame');
  for (const raw of [undefined, null, '', 'anvil', 'in-game', 'nonsense', []]) {
    assert.equal(parseGuideTab(raw as string | undefined), 'anvil');
  }
});

test('guideTabParam: the default tab keeps the bare URL', () => {
  assert.equal(guideTabParam('anvil'), null);
  assert.equal(guideTabParam('ingame'), 'ingame');
});

const guide = (over: Partial<LibraryGuideLike>): LibraryGuideLike => ({
  id: 1,
  slug: 'zulrah-basics',
  title: 'Zulrah basics',
  summary: 'Rotations and gear.',
  category: 'bossing',
  clanId: null,
  status: 'published',
  minutes: 4,
  ...over,
});

const opts = {
  category: (key: string) => ({ label: key === 'bossing' ? 'Bossing' : key, icon: '*' }),
  href: (slug: string) => `/guides/${slug}`,
  readTime: '{n} min read',
};

test('libraryCards: never a clan guide or a draft', () => {
  const cards = libraryCards(
    [
      guide({ id: 1 }),
      guide({ id: 2, slug: 'clan-copy', clanId: 7 }),
      guide({ id: 3, slug: 'draft', status: 'draft' }),
    ],
    opts,
  );
  assert.deepEqual(cards.map((c) => c.page), ['zulrah-basics']);
  assert.equal(cards[0].href, '/guides/zulrah-basics');
  assert.equal(cards[0].eyebrow, '* Bossing');
  assert.equal(cards[0].minutes, '4 min read');
});

test('libraryCards: searchable by slug words and category', () => {
  const cards = libraryCards(
    [guide({ id: 1, slug: 'cox-solo', title: 'Chambers of Xeric, solo', summary: '', category: 'raids' }), guide({ id: 2 })],
    opts,
  );
  assert.deepEqual(rank('cox', cards)?.map((c) => c.page), ['cox-solo']);
  assert.deepEqual(rank('zulrah', cards)?.map((c) => c.page), ['zulrah-basics']);
  assert.equal(rank('', cards), null);
});

test('groupLibraryCards: follows the category order, unknown categories last', () => {
  const cards = libraryCards(
    [
      guide({ id: 1, slug: 'a', category: 'mystery' }),
      guide({ id: 2, slug: 'b', category: 'skilling' }),
      guide({ id: 3, slug: 'c', category: 'raids' }),
      guide({ id: 4, slug: 'd', category: 'raids' }),
    ],
    opts,
  );
  const groups = groupLibraryCards(cards, ['raids', 'bossing', 'skilling']);
  assert.deepEqual(groups.map((g) => g.category), ['raids', 'skilling', 'mystery']);
  assert.deepEqual(groups[0].cards.map((c) => c.page), ['c', 'd']);
});
