// What a collection log page counts, and from where.
//
// Run: npm run test:clogkc

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bossKeysForPage, killcountsForPage } from '../src/lib/clogKillcounts.ts';

test('a raid page counts each tier separately, not as one total', () => {
  // The game prints "Theatre of Blood completions: 105" and "(Hard) completions: 81" as two lines.
  // They share a log page because they share a drop table, but they are different content — adding
  // them would answer a question nobody asked.
  assert.deepEqual(bossKeysForPage('Theatre of Blood'), ['theatreOfBlood', 'theatreOfBloodHardMode']);
  assert.deepEqual(bossKeysForPage('Chambers of Xeric'), [
    'chambersOfXeric',
    'chambersOfXericChallengeMode',
  ]);
  assert.deepEqual(bossKeysForPage('Tombs of Amascut'), ['tombsOfAmascut', 'tombsOfAmascutExpertMode']);
});

test('a page covering several bosses counts all of them', () => {
  assert.deepEqual(bossKeysForPage('Dagannoth Kings'), [
    'dagannothRex',
    'dagannothPrime',
    'dagannothSupreme',
  ]);
  assert.deepEqual(bossKeysForPage('Callisto and Artio'), ['callisto', 'artio']);
});

test('a page named for its boss needs no mapping, article or not', () => {
  assert.deepEqual(bossKeysForPage('Abyssal Sire'), ['abyssalSire']);
  assert.deepEqual(bossKeysForPage('The Whisperer'), ['whisperer']);
});

test('pages with nothing to count stay silent', () => {
  // Slayer, clues, minigames and the skilling pages have no killcount. Showing 0 would read as
  // "never killed it" rather than "there is nothing here to count".
  for (const page of ['Slayer', 'Easy Treasure Trails', 'Pest Control', 'Shooting Stars']) {
    assert.deepEqual(bossKeysForPage(page), [], page);
  }
  assert.deepEqual(killcountsForPage('Slayer', [], { abyssalSire: 500 }), []);
});

test('the plugin\'s own reading wins, and keeps the game\'s wording', () => {
  // It covers Entry mode, which the hiscores do not publish at all.
  const lines = killcountsForPage(
    'Theatre of Blood',
    [
      { label: 'Theatre of Blood completions', count: 105 },
      { label: 'Theatre of Blood (Entry) completions', count: 11 },
      { label: 'Theatre of Blood (Hard) completions', count: 81 },
    ],
    { theatreOfBlood: 999 },
  );
  assert.equal(lines.length, 3);
  assert.ok(lines.every((l) => l.exact));
  assert.equal(lines[1].count, 11);
});

test('without the plugin, the hiscores fill in every tier they track', () => {
  const lines = killcountsForPage('Chambers of Xeric', [], {
    chambersOfXeric: 1306,
    chambersOfXericChallengeMode: 42,
  });
  assert.deepEqual(
    lines.map((l) => [l.label, l.count, l.exact]),
    [
      ['Chambers of Xeric', 1306, false],
      ['CoX: CM', 42, false],
    ],
  );
});

test('a boss you have never killed is omitted, not shown as zero', () => {
  const lines = killcountsForPage('Chambers of Xeric', [], { chambersOfXeric: 12 });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].label, 'Chambers of Xeric');
});
