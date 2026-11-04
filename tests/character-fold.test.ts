// The /profile card's folded character list (lib/characterFold): seat labels, level/XP fallback, order.
// Run: npx tsx --test tests/character-fold.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { compactXp, levelAndXp, seatLabel, sortFold } from '../src/lib/characterFold.ts';

test('a seat is named, and having none is said out loud', () => {
  assert.equal(seatLabel('member', false), 'member here');
  assert.equal(seatLabel('guest', false), 'guest here');
  assert.equal(seatLabel('event', true), 'entered an event');
  assert.equal(seatLabel(null, false), 'no seat');
  assert.equal(seatLabel(null, true), 'no seat');
});

test('total level and XP: the hiscores snapshot, else the plugin push, else the sweep total', () => {
  const snap = JSON.stringify({ skills: { overall: { rank: 1, level: 2100, xp: 300_000_000 } }, bosses: {} });
  assert.deepEqual(levelAndXp({ statsLastSnapshot: snap, liveStats: null, statsOverallXp: 1 }), { totalLevel: 2100, totalXp: 300_000_000 });

  const live = JSON.stringify({ attack: 13_034_431, strength: 13_034_431 });
  const fromLive = levelAndXp({ statsLastSnapshot: null, liveStats: live, statsOverallXp: null });
  assert.equal(fromLive.totalXp, 26_068_862);
  assert.equal(fromLive.totalLevel, 198);

  assert.deepEqual(levelAndXp({ statsLastSnapshot: 'not json', liveStats: null, statsOverallXp: 5_000 }), { totalLevel: null, totalXp: 5_000 });
  assert.deepEqual(levelAndXp({ statsLastSnapshot: null, liveStats: null, statsOverallXp: null }), { totalLevel: null, totalXp: null });
});

test('the main leads, the rest by name', () => {
  const rows = sortFold([
    { rsn: 'Zed', isPrimary: false },
    { rsn: 'Main', isPrimary: true },
    { rsn: 'Alt', isPrimary: false },
  ]);
  assert.deepEqual(rows.map((r) => r.rsn), ['Main', 'Alt', 'Zed']);
});

test('XP reads at a glance', () => {
  assert.equal(compactXp(1_234_567_890), '1.2B');
  assert.equal(compactXp(250_400_000), '250M');
  assert.equal(compactXp(4_500_000), '4.5M');
  assert.equal(compactXp(12_300), '12K');
});

test('?account= picks one of theirs, any spelling, and falls back to the main for anything else', async () => {
  const { pickFoldCharacter } = await import('../src/lib/characterFold.ts');
  const seated = [{ rsn: 'Drenvox' }, { rsn: 'Iron Dren' }];
  const unseated = [{ rsn: 'Pk Dren' }];
  // The locker resolves ?account= among the seated, so this layer only has to honour its answer.
  assert.deepEqual(pickFoldCharacter('Iron Dren', seated, 'Iron Dren', unseated), { row: seated[1], seated: true });
  // A character this clan doesn't seat, by any spelling of its name.
  assert.deepEqual(pickFoldCharacter('pk_dren', seated, 'Drenvox', unseated), { row: unseated[0], seated: false });
  assert.deepEqual(pickFoldCharacter('  PK DREN ', seated, 'Drenvox', unseated), { row: unseated[0], seated: false });
  // Not theirs, a typo, empty: the default, no error.
  assert.deepEqual(pickFoldCharacter('Zezima', seated, 'Drenvox', unseated), { row: seated[0], seated: true });
  assert.deepEqual(pickFoldCharacter('', seated, 'Drenvox', unseated), { row: seated[0], seated: true });
  assert.deepEqual(pickFoldCharacter(undefined, seated, null, unseated), { row: seated[0], seated: true });
  // Nothing seated (a clan that holds none of them): an unseated pick still works, else nothing.
  assert.deepEqual(pickFoldCharacter('Pk Dren', [], null, unseated), { row: unseated[0], seated: false });
  assert.equal(pickFoldCharacter('Zezima', [], null, unseated), null);
});

test('a row keeps the tab and drops the picks inside it', async () => {
  const { foldHref } = await import('../src/lib/characterFold.ts');
  const here = new URLSearchParams('account=Drenvox&tab=records&stat=bosses&page=Zulrah&progress=quests');
  assert.equal(foldHref('Iron Dren', here), '/profile?account=Iron%20Dren&tab=records');
  assert.equal(foldHref('Iron Dren', new URLSearchParams('')), '/profile?account=Iron%20Dren');
  assert.equal(foldHref('A&B', null), '/profile?account=A%26B');
});
