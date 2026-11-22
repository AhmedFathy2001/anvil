// The raid tile's typed box (lib/raidQuery): words → TileConditions, problems in plain words, the
// draft written back as words that read the same, and the tile a draft becomes. Pure — no database.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applySuggestion,
  conditionsEmpty,
  isPlainRaidTile,
  parseRaidQuery,
  picksFromSelection,
  raidConditionsTile,
  raidQueryText,
  raidQuerySuggestions,
} from '../src/lib/raidQuery.ts';
import { defaultRaidSelection, raidTileConfig } from '../src/lib/tileCreatorConfig.ts';
import type { TileConditions } from '../src/lib/tileConditions.ts';

const read = (s: string) => parseRaidQuery(s);
const picks = (s: string) => read(s).conditions.raids ?? [];
const ok = (s: string) => {
  const r = read(s);
  assert.deepEqual(r.problems, [], `problems for "${s}": ${r.problems.map((p) => p.why).join(' | ')}`);
  return r;
};

test('the mock’s main example', () => {
  const r = ok('5 cm challenge time, tob hm 4+ challenge time, toa 300 solo, deathless');
  assert.equal(r.clears, 5);
  assert.deepEqual(r.conditions, {
    v: 1,
    noDeaths: true,
    raids: [
      { raid: 'cox', modes: ['cm'], challenge: true },
      { raid: 'tob', modes: ['hard'], challenge: true, party: { op: 'gte', n: 4 } },
      { raid: 'toa', toa: { min: 300, entry: false }, party: { op: 'eq', n: 1 } },
    ],
  });
});

test('raid names and aliases', () => {
  for (const [s, raid] of [
    ['cox', 'cox'], ['chambers', 'cox'], ['chambers of xeric', 'cox'], ['olm', 'cox'],
    ['tob', 'tob'], ['theatre', 'tob'], ['theatre of blood', 'tob'], ['theater', 'tob'],
    ['toa', 'toa'], ['tombs', 'toa'], ['tombs of amascut', 'toa'],
    ['tfa', 'tfa'], ['fractured archive', 'tfa'], ['the fractured archive', 'tfa'], ['raids 4', 'tfa'],
  ] as const) {
    const p = ok(s).conditions.raids!;
    assert.equal(p.length, 1, s);
    assert.equal(p[0].raid, raid, s);
  }
});

test('a raid named alone: every mode but Entry (defaultRaidSelection)', () => {
  assert.deepEqual(picks('cox'), [{ raid: 'cox', modes: ['normal', 'cm'] }]);
  assert.deepEqual(picks('tob'), [{ raid: 'tob', modes: ['normal', 'hard'] }]);
  assert.deepEqual(picks('toa'), [{ raid: 'toa', toa: { min: 150, entry: false } }]);
  assert.deepEqual(picks('tfa'), [{ raid: 'tfa', modes: ['normal'] }]);
  // …and that is what the old picker selection means too.
  assert.deepEqual(picksFromSelection(defaultRaidSelection(['cox', 'tob', 'toa', 'tfa'])), picks('cox, tob, toa, tfa'));
});

test('modes: named ones narrow, Entry adds', () => {
  assert.deepEqual(picks('cm'), [{ raid: 'cox', modes: ['cm'] }]);
  assert.deepEqual(picks('cox cm'), [{ raid: 'cox', modes: ['cm'] }]);
  assert.deepEqual(picks('cox challenge mode'), [{ raid: 'cox', modes: ['cm'] }]);
  assert.deepEqual(picks('hm'), [{ raid: 'tob', modes: ['hard'] }]);
  assert.deepEqual(picks('hmt'), [{ raid: 'tob', modes: ['hard'] }]);
  assert.deepEqual(picks('tob hard mode'), [{ raid: 'tob', modes: ['hard'] }]);
  assert.deepEqual(picks('tob normal hm'), [{ raid: 'tob', modes: ['normal', 'hard'] }]);
  assert.deepEqual(picks('tob entry'), [{ raid: 'tob', modes: ['entry', 'normal', 'hard'] }]);
  assert.deepEqual(picks('tob hm entry'), [{ raid: 'tob', modes: ['entry', 'hard'] }]);
  assert.deepEqual(picks('cox normal'), [{ raid: 'cox', modes: ['normal'] }]);
  assert.deepEqual(picks('toa expert'), [{ raid: 'toa', toa: { min: 300, entry: false } }]);
  assert.deepEqual(picks('expert'), [{ raid: 'toa', toa: { min: 300, entry: false } }]);
  assert.deepEqual(picks('toa entry'), [{ raid: 'toa', toa: { min: 150, entry: true } }]);
});

test('ToA levels: at least, exactly, at most', () => {
  for (const s of ['toa 300', 'toa 300+', 'toa invo 300', 'toa level 300', 'toa raid level 300', 'toa 300 or higher', 'toa at least 300']) {
    assert.deepEqual(ok(s).conditions.raids, [{ raid: 'toa', toa: { min: 300, entry: false } }], s);
  }
  for (const s of ['toa exactly 300', 'toa 300 exact', 'toa 300 exactly']) {
    assert.deepEqual(ok(s).conditions.raids, [{ raid: 'toa', toa: { min: 300, entry: false, op: 'eq' } }], s);
  }
  for (const s of ['toa 300-', 'toa up to 300', 'toa 300 or lower', 'toa at most 300']) {
    assert.deepEqual(ok(s).conditions.raids, [{ raid: 'toa', toa: { min: 300, entry: false, op: 'lte' } }], s);
  }
  assert.deepEqual(picks('toa invo 400 entry'), [{ raid: 'toa', toa: { min: 400, entry: true } }]);
});

test('ToA: a small number is a party, a big one a level', () => {
  assert.deepEqual(picks('toa 4+'), [{ raid: 'toa', toa: { min: 150, entry: false }, party: { op: 'gte', n: 4 } }]);
  assert.deepEqual(picks('toa up to 3'), [{ raid: 'toa', toa: { min: 150, entry: false }, party: { op: 'lte', n: 3 } }]);
  assert.deepEqual(picks('toa 500+ duo'), [{ raid: 'toa', toa: { min: 500, entry: false }, party: { op: 'eq', n: 2 } }]);
});

test('ToA level problems', () => {
  const low = read('toa 100+');
  assert.equal(low.problems.length, 1);
  assert.match(low.problems[0].why, /Entry/);
  assert.match(read('toa 700').problems[0].why, /600/);
  assert.match(read('cox invo 300').problems[0].why, /only works on ToA/);
});

test('party sizes: words, N man, N+, up to N', () => {
  const party = (s: string) => ok(s).conditions.raids![0].party;
  assert.deepEqual(party('tob solo'), { op: 'eq', n: 1 });
  assert.deepEqual(party('tob duo'), { op: 'eq', n: 2 });
  assert.deepEqual(party('tob trio'), { op: 'eq', n: 3 });
  assert.deepEqual(party('tob quad'), { op: 'eq', n: 4 });
  assert.deepEqual(party('tob 4 man'), { op: 'eq', n: 4 });
  assert.deepEqual(party('tob 4-man'), { op: 'eq', n: 4 });
  assert.deepEqual(party('tob 4man'), { op: 'eq', n: 4 });
  assert.deepEqual(party('tob 4 players'), { op: 'eq', n: 4 });
  assert.deepEqual(party('tob exactly 4'), { op: 'eq', n: 4 });
  assert.deepEqual(party('tob 4+'), { op: 'gte', n: 4 });
  assert.deepEqual(party('tob 4+ players'), { op: 'gte', n: 4 });
  assert.deepEqual(party('tob 4 or more'), { op: 'gte', n: 4 });
  assert.deepEqual(party('tob at least 4'), { op: 'gte', n: 4 });
  assert.deepEqual(party('tob up to 3'), { op: 'lte', n: 3 });
  assert.deepEqual(party('tob 3-'), { op: 'lte', n: 3 });
  assert.deepEqual(party('tob at most 3 players'), { op: 'lte', n: 3 });
  assert.deepEqual(party('cox 20+'), { op: 'gte', n: 20 });
});

test('a party bigger than the raid takes is a problem', () => {
  const r = read('tob 6 man');
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0].why, /ToB takes at most 5 players/);
  assert.equal(r.problems[0].text, '6 man');
  assert.equal(r.conditions.raids![0].party, undefined);
  assert.match(read('toa 9 man').problems[0].why, /at most 8/);
  assert.match(read('cox 101+').problems[0].why, /at most 100/);
});

test('times: under, sub, minutes, clocks', () => {
  const under = (s: string) => ok(s).conditions.raids![0].under;
  assert.equal(under('cox under 25:00'), 1500);
  assert.equal(under('cox sub 30'), 1800);
  assert.equal(under('cox under 40 minutes'), 2400);
  assert.equal(under('cox in under 1:10:00'), 4200);
  assert.equal(under('cox faster than 20 min'), 1200);
  // Before the raid: waits for it.
  assert.equal(under('sub 30 cox'), 1800);
});

test('the challenge time: CoX CM and ToB HM only', () => {
  assert.deepEqual(picks('cm challenge time'), [{ raid: 'cox', modes: ['cm'], challenge: true }]);
  // A raid named alone narrows to its challenge mode: only that mode has the time.
  assert.deepEqual(picks('tob challenge time'), [{ raid: 'tob', modes: ['hard'], challenge: true }]);
  const normal = read('cox normal challenge time');
  assert.equal(normal.problems.length, 1);
  assert.match(normal.problems[0].why, /Normal CoX has none/);
  assert.equal(normal.conditions.raids![0].challenge, undefined);
  assert.match(read('toa challenge time').problems[0].why, /ToA has no challenge time/);
  assert.match(read('tob normal challenge time').problems[0].why, /Hard Mode thing/);
});

test('scaled: CoX only, never guessed onto another raid', () => {
  assert.deepEqual(picks('cox solo scaled 10'), [{ raid: 'cox', modes: ['normal', 'cm'], party: { op: 'eq', n: 1 }, scale: 10 }]);
  assert.equal(picks('cox scaled to 15')[0].scale, 15);
  const r = read('5 tob solo scaled 10');
  assert.equal(r.problems.length, 1);
  assert.equal(r.problems[0].text, 'scaled 10');
  assert.match(r.problems[0].why, /only works on CoX/);
  // ToB kept as a solo, without the scale.
  assert.deepEqual(r.conditions.raids, [{ raid: 'tob', modes: ['normal', 'hard'], party: { op: 'eq', n: 1 } }]);
  assert.equal(r.clears, 5);
});

test('tile-wide rules: deaths, teammates, counted once', () => {
  for (const s of ['tob deathless', 'tob no deaths', 'tob nobody dies', 'tob flawless', 'deathless tob', 'tob without dying']) {
    assert.equal(ok(s).conditions.noDeaths, true, s);
  }
  assert.deepEqual(ok('cox with 3 teammates').conditions.mates, { min: 4 });
  assert.deepEqual(ok('cox 2 teammates').conditions.mates, { min: 3 });
  assert.deepEqual(ok('cox whole team').conditions.mates, { all: true });
  assert.equal(ok('cox with 2 teammates counted once').conditions.shared, 'together');
  assert.equal(ok('cox together').conditions.shared, 'together');
});

test('first and start counts', () => {
  assert.deepEqual(ok('first cox').conditions.startCount, { op: 'lt', n: 1 });
  const five = ok('first 5 cox');
  assert.deepEqual(five.conditions.startCount, { op: 'lt', n: 5 });
  assert.equal(five.clears, 5);
  assert.deepEqual(ok('10 tob under 5 kc').conditions.startCount, { op: 'lt', n: 5 });
  assert.deepEqual(ok('tob fewer than 5 kc').conditions.startCount, { op: 'lt', n: 5 });
  assert.deepEqual(ok('tob over 50 kc').conditions.startCount, { op: 'gt', n: 50 });
  assert.deepEqual(ok('tob more than 50 kc').conditions.startCount, { op: 'gt', n: 50 });
  // "under 5 kc" is a count, "under 5" a time.
  assert.equal(ok('tob under 5').conditions.raids![0].under, 300);
});

test('clears: a leading number, or "N clears" anywhere', () => {
  assert.equal(ok('10 toa 300+').clears, 10);
  assert.equal(ok('toa 300+ 10 clears').clears, 10);
  assert.equal(ok('5 raids').clears, 5);
  assert.equal(ok('cox').clears, null);
});

test('any raid: all four, and a modifier only when every raid can take it', () => {
  const r = ok('5 any raid solo');
  assert.equal(r.conditions.raids!.length, 4);
  assert.ok(r.conditions.raids!.every((p) => p.party?.n === 1));
  assert.equal(ok('5 raids').conditions.raids!.length, 4);
  const scaled = read('any raid scaled 10');
  assert.equal(scaled.problems.length, 1);
  assert.ok(scaled.conditions.raids!.every((p) => p.scale == null));
});

test('a modifier per raid: each raid keeps its own bar', () => {
  const r = ok('cox solo under 40:00, tob trio, toa 400+ up to 4');
  assert.deepEqual(r.conditions.raids, [
    { raid: 'cox', modes: ['normal', 'cm'], under: 2400, party: { op: 'eq', n: 1 } },
    { raid: 'tob', modes: ['normal', 'hard'], party: { op: 'eq', n: 3 } },
    { raid: 'toa', toa: { min: 400, entry: false }, party: { op: 'lte', n: 4 } },
  ]);
});

test('words that make no sense: plain reasons, with where they are', () => {
  const r = read('tob purple');
  assert.equal(r.problems.length, 1);
  assert.equal(r.problems[0].text, 'purple');
  assert.equal(r.problems[0].start, 4);
  assert.equal(r.problems[0].end, 10);
  assert.match(r.problems[0].why, /drop/);
  assert.match(read('cox banana').problems[0].why, /isn’t a raid word/);
  assert.match(read('cox entry').problems[0].why, /CoX has no Entry Mode/);
  assert.match(read('entry').problems[0].why, /Say which raid/);
  assert.match(read('solo').problems[0].why, /Name a raid/);
  assert.match(read('tob 4').problems[0].why, /What is 4/);
});

test('written back, it reads the same', () => {
  for (const s of [
    '5 cm challenge time, tob hm 4+ challenge time, toa 300 solo, deathless',
    'cox solo scaled 10 under 40:00',
    'tob entry, toa exactly 350 entry, tfa duo',
    'toa up to 300, tob hm entry 3-',
    'first 5 cox',
    'tob with 3 teammates counted once',
    'tob whole team over 50 kc',
    'tob entry only',
    '3 any raid',
    'cox 4 man, tob up to 4',
  ]) {
    const a = read(s);
    assert.deepEqual(a.problems, [], s);
    const text = raidQueryText(a.conditions, a.clears);
    const b = read(text);
    assert.deepEqual(b.problems, [], `${s} → ${text}`);
    assert.deepEqual(b.conditions, a.conditions, `${s} → ${text}`);
    assert.equal(b.clears, a.clears, `${s} → ${text}`);
  }
});

test('no conditions and no Entry: exactly today’s hiscores raid tile', () => {
  for (const [s, raids] of [
    ['5 cox, tob', ['cox', 'tob']],
    ['5 any raid', ['cox', 'tob', 'toa', 'tfa']],
  ] as const) {
    const r = ok(s);
    assert.ok(isPlainRaidTile(r.conditions), s);
    const tile = raidConditionsTile(r.conditions, r.clears);
    assert.equal(tile.source, 'hiscores');
    assert.deepEqual(tile.config, raidTileConfig(defaultRaidSelection([...raids]), 5).config);
  }
  // A plain ToA expert or a CM-only tile is still the hiscores.
  const cm = raidConditionsTile(ok('cm').conditions, 3);
  assert.equal(cm.source, 'hiscores');
  assert.equal(cm.config.trackedStat, 'chambersOfXericChallengeMode');
  assert.equal(raidConditionsTile(ok('toa expert').conditions, 1).source, 'hiscores');
});

test('Entry with nothing else: today’s plugin count-line tile', () => {
  const tile = raidConditionsTile(ok('tob entry').conditions, 2);
  assert.equal(tile.source, 'plugin');
  assert.equal(tile.config.tileType, 'kill');
});

test('any condition: a raid tile carrying the conditions and the clears', () => {
  const r = ok('5 cm challenge time, toa 300 solo, deathless');
  const tile = raidConditionsTile(r.conditions, r.clears);
  assert.equal(tile.source, 'raid');
  assert.equal(tile.config.tileType, 'raid');
  assert.equal(tile.config.requiredAmount, 5);
  assert.deepEqual(tile.config.conditions, r.conditions);
  assert.match(tile.title, /^5 × CoX CM or Solo ToA 300\+/);
  // A ToA level the hiscores can't say is a condition too.
  assert.equal(raidConditionsTile(ok('toa 400').conditions, 1).source, 'raid');
  assert.equal(raidConditionsTile(ok('first cox').conditions, 1).source, 'raid');
  assert.equal(raidConditionsTile({ v: 1 }, 1).ok, false);
});

test('conditionsEmpty', () => {
  assert.equal(conditionsEmpty(null), true);
  assert.equal(conditionsEmpty({ v: 1 }), true);
  assert.equal(conditionsEmpty({ v: 1, noDeaths: false, mates: null } as TileConditions), true);
  assert.equal(conditionsEmpty({ v: 1, startCount: { op: 'lt', n: 1 } }), false);
});

test('suggestions: only what the raid can take', () => {
  const tobHm = raidQuerySuggestions('tob hm ch');
  assert.equal(tobHm[0].insert, 'challenge time');
  assert.equal(tobHm[0].note, '25:00 for 5 · 1:10:00 solo');
  assert.ok(!raidQuerySuggestions('tob sc').some((s) => s.insert.startsWith('scaled')));
  assert.ok(raidQuerySuggestions('cox sc').some((s) => s.insert.startsWith('scaled')));
  assert.deepEqual(raidQuerySuggestions('tob '), []);
  assert.equal(applySuggestion('tob hm ch', tobHm[0]), 'tob hm challenge time ');
  const noDe = raidQuerySuggestions('cox no de');
  assert.equal(noDe[0]?.insert, 'no deaths');
  assert.equal(applySuggestion('cox no de', noDe[0]), 'cox no deaths ');
});
