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

test('?account= opens one of theirs, any spelling; anything else is the overview', async () => {
  const { pickViewedCharacter } = await import('../src/lib/characterFold.ts');
  const seated = [{ rsn: 'Drenvox' }, { rsn: 'Iron Dren' }];
  const unseated = [{ rsn: 'Pk Dren' }];
  assert.deepEqual(pickViewedCharacter('Iron Dren', seated, unseated), { row: seated[1], seated: true });
  assert.deepEqual(pickViewedCharacter('iron_dren', seated, unseated), { row: seated[1], seated: true });
  assert.deepEqual(pickViewedCharacter('pk_dren', seated, unseated), { row: unseated[0], seated: false });
  assert.deepEqual(pickViewedCharacter('  PK DREN ', seated, unseated), { row: unseated[0], seated: false });
  // No param, empty, a typo, somebody else: the overview — not the main.
  assert.equal(pickViewedCharacter(undefined, seated, unseated), null);
  assert.equal(pickViewedCharacter('', seated, unseated), null);
  assert.equal(pickViewedCharacter('Zezima', seated, unseated), null);
  // Nothing seated here (a creator space lists them all as seated; a clan may seat none).
  assert.deepEqual(pickViewedCharacter('Pk Dren', [], unseated), { row: unseated[0], seated: false });
});

test('the full profile is the member page for a seat on a clan tab, else /p/', async () => {
  const { fullProfileHref } = await import('../src/lib/characterFold.ts');
  assert.equal(fullProfileHref({ rsn: 'Iron Dren', seat: 'member' }, false), '/members/Iron%20Dren');
  assert.equal(fullProfileHref({ rsn: 'Iron Dren', seat: 'guest' }, false), '/members/Iron%20Dren');
  assert.equal(fullProfileHref({ rsn: 'Iron Dren', seat: null }, false), '/p/Iron%20Dren');
  assert.equal(fullProfileHref({ rsn: 'Iron Dren', seat: 'event' }, true), '/p/Iron%20Dren');
  assert.equal(fullProfileHref({ rsn: 'Iron Dren', seat: 'member' }, true), '/p/Iron%20Dren');
});

test('a row keeps the tab and drops the picks inside it', async () => {
  const { foldHref } = await import('../src/lib/characterFold.ts');
  const here = new URLSearchParams('account=Drenvox&tab=records&stat=bosses&page=Zulrah&progress=quests');
  assert.equal(foldHref('Iron Dren', here), '/profile?account=Iron%20Dren&tab=records');
  assert.equal(foldHref('Iron Dren', new URLSearchParams('')), '/profile?account=Iron%20Dren');
  assert.equal(foldHref('A&B', null), '/profile?account=A%26B');
});
