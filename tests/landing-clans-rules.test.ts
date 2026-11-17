import { test } from 'node:test';
import assert from 'node:assert/strict';

import { countWord, heroCounts, pickShowcaseClans } from '../src/lib/landingClansRules.ts';

const clan = (name: string, activeThisWeek: number, members = 10, kind = 'clan') => ({
  slug: name.toLowerCase(),
  name,
  kind,
  members,
  activeThisWeek,
});

test('only real clans with play this week are shown, busiest first', () => {
  const rows = [clan('Quiet', 0), clan('Busy', 20), clan('Some', 5), clan('Streamer', 50, 3, 'creator')];
  assert.deepEqual(pickShowcaseClans(rows).map((c) => c.name), ['Busy', 'Some']);
  assert.equal(pickShowcaseClans([clan('A', 1), clan('B', 2), clan('C', 3)], 2).length, 2);
});

test('small counts are left out instead of dressed up', () => {
  assert.deepEqual(heroCounts({ clans: 3, members: 40, eventsRun: 5 }), []);
  assert.deepEqual(
    heroCounts({ clans: 12, members: 409, eventsRun: 7 }).map((c) => `${c.n} ${c.label}`),
    ['12 clans', '409 members'],
  );
});

test('countWord spells small numbers and falls back to digits', () => {
  assert.equal(countWord(7), 'seven');
  assert.equal(countWord(40), '40');
});
