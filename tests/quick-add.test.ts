// Quick add keeps the amount that was typed and flags repeats; a tile's title follows its amount.
// Pure — no database.
//
// Run: npm run test:quickadd

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configAmount, dupKey, findDuplicates, reconcileTypedAmount } from '../src/lib/quickAdd.ts';
import { libraryCandidate } from '../src/lib/taskMatch.ts';
import { mentionsAmount, retitleForAmount } from '../src/lib/tileAmountText.ts';

const barrows = libraryCandidate({
  key: 'library-1',
  label: '20 Barrows chests',
  category: null,
  points: null,
  config: { tileType: 'standard', requiredAmount: 20 } as never,
});

test('a typed amount beats the library entry, and the title follows it', () => {
  const r = reconcileTypedAmount('30 Barrows chests', barrows);
  assert.equal((r.candidate.config as { requiredAmount?: number }).requiredAmount, 30);
  assert.equal(r.candidate.title, '30 Barrows chests');
  assert.match(r.note ?? '', /20/);
  assert.match(r.note ?? '', /30/);
});

test('same amount, or no amount typed, changes nothing and says nothing', () => {
  assert.equal(reconcileTypedAmount('20 Barrows chests', barrows).note, null);
  assert.equal(reconcileTypedAmount('Barrows chests', barrows).note, null);
  assert.equal(reconcileTypedAmount('Barrows chests', barrows).candidate, barrows);
});

test('configAmount prefers the hiscores goal for a stat tile', () => {
  assert.deepEqual(configAmount({ statType: 'skill', statGoal: 1_000_000 } as never), { field: 'statGoal', value: 1_000_000 });
  assert.deepEqual(configAmount({ requiredAmount: 5 } as never), { field: 'requiredAmount', value: 5 });
  assert.equal(configAmount({} as never), null);
});

test('repeats are flagged inside the paste and against the board', () => {
  const flags = findDuplicates(['25 Zulrah kills', '30 Barrows chests', '25 zulrah KILLS', null, '10 Fishing'], ['10 fishing']);
  assert.equal(flags[0], null);
  assert.equal(flags[1], null);
  assert.deepEqual(flags[2], { where: 'list', line: 1 });
  assert.equal(flags[3], null);
  assert.deepEqual(flags[4], { where: 'board' });
  assert.equal(dupKey('  25  Zulrah, kills! '), '25 zulrah kills');
});

test('changing the amount rewrites generated titles and descriptions', () => {
  assert.equal(retitleForAmount('50 Kraken KC', 50, 75), '75 Kraken KC');
  assert.equal(retitleForAmount('Reach 50 Kraken kill count', 50, 75), 'Reach 75 Kraken kill count');
  assert.equal(retitleForAmount('5M Fishing XP', 5_000_000, 7_500_000), '7.5M Fishing XP');
  assert.equal(retitleForAmount('1,000 Zulrah kills', 1000, 2500), '2,500 Zulrah kills');
});

test('hand-written text that never carried the amount is left alone', () => {
  assert.equal(retitleForAmount('Slay the Kraken', 50, 75), null);
  assert.equal(retitleForAmount('Top 5 finish at Kraken', 50, 75), null);
  assert.equal(mentionsAmount('Tier 50x', 50), false);
  assert.equal(retitleForAmount('50 Kraken KC', 50, 50), null);
});
