import assert from 'node:assert/strict';
import test from 'node:test';

import { firstDropWord, itemLuck, luckWord, pageBestRows } from '../src/lib/logPageFacts.ts';
import { assessLuckAt } from '../src/lib/clogLuck.ts';

const src = (denominator: number, bossKey = 'brutus') => ({ source: 'Brutus', bossKey, denominator, rolls: 1, bundle: 1 });

test('item luck: drops held against what the rate owed, with a word for the lean', () => {
  assert.deepEqual(itemLuck({ quantity: 8 }, [src(125)], { brutus: 1378 }), { text: '8 in 1,378 kc · expected 11 · a bit dry', tone: 'dry' });
  assert.deepEqual(itemLuck({ quantity: 11 }, [src(125)], { brutus: 1378 }), { text: '11 in 1,378 kc · expected 11 · on rate', tone: 'muted' });
  // Not had yet: a line once the rate owed two drops, none before.
  assert.deepEqual(itemLuck({ quantity: 0 }, [src(1000)], { brutus: 5832 }), { text: '0 in 5,832 kc · expected 5.8 · very dry', tone: 'dry' });
  assert.equal(itemLuck({ quantity: 0 }, [src(1000)], { brutus: 600 }), null);
  assert.equal(itemLuck({ quantity: 30 }, [src(125)], { brutus: 1378 })?.tone, 'green');
  assert.match(itemLuck({ quantity: 2 }, [src(400)], { brutus: 200 })!.text, /^2 in 200 kc · expected 0\.5 · /);
});

test('item luck: a first drop with its kill reads against the rate; nothing when rate or kills are unknown', () => {
  assert.deepEqual(itemLuck({ quantity: 1, kcAtUnlock: 22 }, [src(500)], { brutus: 1378 }), { text: '1st at 22 kc · rate 1/500 · spooned', tone: 'green' });
  assert.equal(itemLuck({ quantity: 1, kcAtUnlock: 1104 }, [src(1000)], {})!.text, '1st at 1,104 kc · rate 1/1,000 · a bit dry');
  assert.equal(itemLuck({ quantity: 3 }, [], { brutus: 100 }), null, 'no rate');
  assert.equal(itemLuck({ quantity: 3 }, [src(100)], {}), null, 'no kills');
  assert.equal(itemLuck({ quantity: 0 }, [src(100)], { brutus: 100 }), null, 'not owned, and not owed two drops yet');
});

test('item luck: under a tenth of a drop owed it says the rate, never "expected 0.0"', () => {
  // Spectral sigil: 1/1,365 from the Corporeal Beast, shared by up to five.
  const sigil = { source: 'Corporeal Beast', bossKey: 'corporealBeast', denominator: 1365, rolls: 1, bundle: 1, partyMax: 5 };
  const line = itemLuck({ quantity: 1 }, [sigil], { corporealBeast: 135 })!;
  assert.match(line.text, /^1 in 135 kc · rate 1\/1,365 · /);
  assert.doesNotMatch(line.text, /0\.0/);
  // Owed a little more, still under 0.1 at the low end: the rate again.
  assert.doesNotMatch(itemLuck({ quantity: 1 }, [{ ...sigil, partyMax: 1 }], { corporealBeast: 120 })!.text, /0\.0/);
});

test('luck words: the tails, then the lean of the middle', () => {
  assert.equal(luckWord(assessLuckAt(10, 1000, 30)).text, 'mega spooned');
  assert.equal(luckWord(assessLuckAt(10, 1000, 0)).text, 'very dry');
  assert.equal(luckWord(assessLuckAt(10, 1000, 10)).text, 'on rate');
  assert.equal(firstDropWord(0.5).text, 'on rate');
  assert.equal(firstDropWord(0.9).tone, 'dry');
});

test('page bests: one row per mode, the time and the kills it counts', () => {
  const rows = pageBestRows('Brutus', [{ activity: 'Brutus', time: '0:41.20' }, { activity: 'Demonic Brutus', time: '1:12.80' }], [], { brutus: 1378 });
  assert.deepEqual(rows, [
    { name: 'Brutus', time: '0:41.20', kc: 1378 },
    { name: 'Demonic Brutus', time: '1:12.80', kc: null },
  ]);
  // The game's own lines win, and a mode with kills and no time is still listed.
  const tob = pageBestRows(
    'Theatre of Blood',
    [{ activity: 'Theatre of Blood Hard Mode 4 players', time: '19:02.00' }, { activity: 'Theatre of Blood 5 players', time: '15:30.00' }],
    [{ label: 'Theatre of Blood completions', count: 105 }, { label: 'Theatre of Blood (Entry) completions', count: 11 }, { label: 'Theatre of Blood (Hard) completions', count: 81 }],
    {},
  );
  assert.deepEqual(tob.map((r) => [r.name, r.time, r.kc]), [
    ['Theatre of Blood', '15:30.00', 105],
    ['Theatre of Blood: Hard Mode', '19:02.00', 81],
    ['Theatre of Blood (Entry)', null, 11],
  ]);
  // Hiscores only: each key goes to its own mode.
  const cg = pageBestRows('The Gauntlet', [{ activity: 'Corrupted Gauntlet', time: '6:40.00' }], [], { gauntlet: 30, corruptedGauntlet: 400 });
  assert.deepEqual(cg.map((r) => [r.name, r.time, r.kc]), [['Corrupted Gauntlet', '6:40.00', 400], ['The Gauntlet', null, 30]]);
});
