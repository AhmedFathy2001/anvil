// The guide search has to answer the question people actually ask.
//
// The point of it is that a substring filter over titles answers almost nothing: nobody looking for
// the board guide types "Building a board that tracks itself", they type "tiles", "csv", or "drops
// not showing". So what is pinned here is the general matching — jargon, symptoms, typos, and the
// AND across words — rather than the exact scores, which are free to move.
//
// Run: npm run test:guidesearch

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rank } from '../src/app/guide/_i18n/searchRank.ts';
import { SEARCH_TERMS } from '../src/app/guide/_i18n/searchTerms.ts';
import { en } from '../src/app/guide/_i18n/en.ts';

const CARD_KEY = {
  clan: 'clan',
  discord: 'discord',
  plugin: 'plugin',
  captain: 'captain',
  admin: 'admin',
  formats: 'formats',
  board: 'board',
  'clan-vs-clan': 'clanVsClan',
  moderator: 'moderator',
  fees: 'fees',
} as const;

const ITEMS = (Object.keys(SEARCH_TERMS) as (keyof typeof SEARCH_TERMS)[]).map((page) => {
  const card = en.index.cards[CARD_KEY[page]];
  return { page, title: card.title, eyebrow: card.eyebrow, blurb: card.blurb, terms: SEARCH_TERMS[page] };
});

/** The page a query should put first. */
function top(query: string): string | undefined {
  return rank(query, ITEMS)?.[0]?.page;
}

test('an empty query means "no search", not "no results"', () => {
  assert.equal(rank('', ITEMS), null);
  assert.equal(rank('   ', ITEMS), null);
});

test('jargon finds the page that never uses the word in its title', () => {
  assert.equal(top('webhook'), 'discord');
  assert.equal(top('csv'), 'board');
  assert.equal(top('payout'), 'fees');
  assert.equal(top('draft'), 'captain');
  assert.equal(top('runelite'), 'plugin');
});

test('a symptom finds the page, not just the name of the thing', () => {
  assert.equal(top('drops not showing'), 'plugin');
  assert.equal(top('bot not posting'), 'discord');
});

test('one typo is forgiven on a word long enough for it to be a typo', () => {
  assert.equal(top('webhok'), 'discord');
  assert.equal(top('payout'), 'fees');
  assert.equal(top('rosterr'), 'plugin');
});

test('words AND rather than OR — a second word narrows, it does not widen', () => {
  const broad = rank('discord', ITEMS)!;
  const narrow = rank('discord nickname', ITEMS)!;
  assert.ok(narrow.length < broad.length, 'adding a word should not return more guides');
  assert.equal(narrow[0].page, 'discord');
});

test('a word nothing knows returns nothing rather than everything', () => {
  assert.deepEqual(rank('zulrah', ITEMS), []);
  // ...and it drops the whole query, even when the other word matches well.
  assert.deepEqual(rank('webhook zulrah', ITEMS), []);
});

test('case and punctuation do not matter', () => {
  assert.equal(top('Webhook'), 'discord');
  assert.equal(top('clan-vs-clan'), 'clan-vs-clan');
  assert.equal(top('CSV!'), 'board');
});

test('every guide is reachable by at least one of its own terms', () => {
  for (const item of ITEMS) {
    const hit = rank(item.terms[0], ITEMS);
    assert.ok(hit && hit.some((r) => r.page === item.page), `${item.page} unreachable by "${item.terms[0]}"`);
  }
});
