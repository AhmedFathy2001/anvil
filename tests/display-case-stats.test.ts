// The display case's kill-count and personal-best pins, the pure half (lib/displayCaseStats): the pin
// body parser, the stat keys, the labels and the kill counts read off a snapshot + live push. No
// database; the DB half is tests/supporter-media-db.test.ts.
//
// Run: npx tsx --test tests/display-case-stats.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bossKillcounts,
  formatPersonalBest,
  kcHeadline,
  kcLabel,
  parsePbStatKey,
  parsePinInput,
  pbLabel,
  pbStatKey,
} from '../src/lib/displayCaseStats.ts';
import { retryIconUrl } from '../src/components/CaseIcon.tsx';

test('parsePinInput: items as before, kc and pb need an account and a well-formed key', () => {
  assert.deepEqual(parsePinInput({ kind: 'clog', accountId: 3, itemId: 4151 }), { kind: 'clog', accountId: 3, itemId: 4151 });
  assert.deepEqual(parsePinInput({ kind: 'drop', momentId: 9 }), { kind: 'drop', momentId: 9 });
  assert.deepEqual(parsePinInput({ kind: 'kc', accountId: 3, statKey: 'tzKalZuk' }), { kind: 'kc', accountId: 3, statKey: 'tzKalZuk' });
  assert.deepEqual(parsePinInput({ kind: 'pb', accountId: 3, statKey: '3:chambers of xeric' }), {
    kind: 'pb',
    accountId: 3,
    statKey: '3:chambers of xeric',
  });
  for (const bad of [
    null,
    'kc',
    { kind: 'kc', statKey: 'zulrah' }, // no account
    { kind: 'kc', accountId: 3 }, // no key
    { kind: 'kc', accountId: 3, statKey: 'zul rah' },
    { kind: 'kc', accountId: 3, statKey: "'; drop table" },
    { kind: 'kc', accountId: -1, statKey: 'zulrah' },
    { kind: 'pb', accountId: 3, statKey: 'chambers of xeric' }, // no team size
    { kind: 'pb', accountId: 3, statKey: '3:Chambers of Xeric' }, // stored lowercase only
    { kind: 'pb', accountId: 3, statKey: '500:inferno' },
    { kind: 'pb', accountId: 3, statKey: `0:${'x'.repeat(81)}` },
    { kind: 'xp', accountId: 3, statKey: 'attack' },
  ]) {
    assert.equal(parsePinInput(bad), null, JSON.stringify(bad));
  }
});

test('pb stat keys round-trip, team size first', () => {
  assert.equal(pbStatKey('tombs of amascut: expert mode', 0), '0:tombs of amascut: expert mode');
  assert.deepEqual(parsePbStatKey(pbStatKey('vardorvis (awakened)', 0)), { activity: 'vardorvis (awakened)', teamSize: 0 });
  // An activity may itself contain a colon.
  assert.deepEqual(parsePbStatKey('4:theatre of blood: hard mode'), { activity: 'theatre of blood: hard mode', teamSize: 4 });
});

test('labels and the main text', () => {
  assert.equal(kcLabel('tzKalZuk'), 'TzKal-Zuk');
  assert.equal(kcLabel('chambersOfXeric'), 'Chambers of Xeric');
  assert.equal(kcLabel('someNewBoss'), 'Some New Boss');
  assert.equal(kcHeadline(12), '12 KC');
  assert.equal(kcHeadline(1350), '1,350 KC');
  assert.equal(pbLabel('vardorvis (awakened)', 0), 'Vardorvis (Awakened)');
  assert.equal(pbLabel('chambers of xeric', 1), 'Chambers of Xeric (Solo)');
  assert.equal(pbLabel('theatre of blood', 4), 'Theatre of Blood (4 players)');
  assert.equal(formatPersonalBest(11240), '1:52.40');
  assert.equal(formatPersonalBest(360_000 + 1234), '1:00:12.34');
});

test('kill counts: hiscores raised by the live push, above zero only', () => {
  const snapshot = JSON.stringify({ skills: {}, bosses: { zulrah: { rank: 5, score: 100 }, tzKalZuk: { rank: 9, score: 12 }, kreeArra: { rank: -1, score: -1 } } });
  const live = JSON.stringify({ zulrah: 104, vorkath: 3, notABoss: 50, tzKalZuk: 2 });
  const kc = bossKillcounts(snapshot, live);
  assert.equal(kc.get('zulrah'), 104); // the plugin saw kills the sweep has not
  assert.equal(kc.get('tzKalZuk'), 12); // a lower live number never lowers it
  assert.equal(kc.get('vorkath'), 3); // live only, a boss we know
  assert.equal(kc.has('kreeArra'), false); // unranked
  assert.equal(kc.has('notABoss'), false);
  assert.equal(bossKillcounts('not json', null).size, 0);
  assert.equal(bossKillcounts(null, null).size, 0);
});

test('a failed icon retries with a cache-busting query once', () => {
  assert.equal(retryIconUrl('/img/item/21387.png'), '/img/item/21387.png?r=1');
  assert.equal(retryIconUrl('/img/wiki?f=Zuk.png'), '/img/wiki?f=Zuk.png&r=1');
});

test('pb labels read like the profile list: mode spelled out, team size from either place', () => {
  assert.equal(pbLabel('tombs of amascut: expert mode', 4), 'Tombs of Amascut: Expert Mode (4 players)');
  assert.equal(pbLabel('chambers of xeric challenge mode 3 players', 0), 'Chambers of Xeric: Challenge Mode (3 players)');
  assert.equal(pbLabel('tzkal-zuk', 0), 'TzKal-Zuk');
  assert.equal(pbLabel('fortis colosseum', 0), 'Fortis Colosseum');
});
