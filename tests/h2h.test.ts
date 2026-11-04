// Head-to-head challenges: the pure rules (lib/h2hRules). Caps by tier, input validation, winner
// calls for every kind (ties included), the "only after the start" window, and the record.
//
// Run: npx tsx --test tests/h2h.test.ts

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decideByDrop,
  decideByScore,
  describe as describeChallenge,
  dropCounts,
  h2hCap,
  isPublic,
  parseTarget,
  recordFor,
  recordLabel,
  resultSentence,
  underCap,
} from '../src/lib/h2hRules.ts';

const items = {
  nameOf: (id: number) => ({ 11920: 'Dragon pickaxe', 12073: 'Clue scroll (elite)', 995: 'Coins' } as Record<number, string>)[id] ?? null,
  isDrop: (id: number) => id !== 995,
};

test('caps: Free 1, Supporter 5, Champion and Patron unlimited', () => {
  assert.equal(h2hCap(null), 1);
  assert.equal(h2hCap('supporter'), 5);
  assert.equal(h2hCap('champion'), null);
  assert.equal(h2hCap('patron'), null);
  assert.equal(underCap(0, 1), true);
  assert.equal(underCap(1, 1), false);
  assert.equal(underCap(999, null), true);
});

test('parseTarget: kinds, durations, bosses, skills, items', () => {
  assert.equal(parseTarget({ kind: 'wager', durationMin: 60 }, items).ok, false);
  assert.equal(parseTarget({ kind: 'kc', statKey: 'zulrah', durationMin: 45 }, items).ok, false);
  const kc = parseTarget({ kind: 'kc', statKey: 'zulrah', durationMin: 1440 }, items);
  assert.ok(kc.ok && kc.target.label === 'Zulrah' && kc.target.statKey === 'zulrah');
  assert.equal(parseTarget({ kind: 'kc', statKey: 'attack', durationMin: 60 }, items).ok, false);
  const xp = parseTarget({ kind: 'xp', statKey: 'slayer', durationMin: 10080 }, items);
  assert.ok(xp.ok && xp.target.label === 'Slayer');
  assert.equal(parseTarget({ kind: 'xp', statKey: '<script>', durationMin: 60 }, items).ok, false);
  const drop = parseTarget({ kind: 'drop', itemIds: [11920, '11920'], durationMin: 60 }, items);
  assert.ok(drop.ok && drop.target.itemIds.length === 1 && drop.target.label === 'Dragon pickaxe');
  assert.equal(parseTarget({ kind: 'drop', itemIds: [995], durationMin: 60 }, items).ok, false, 'not a monster drop');
  assert.equal(parseTarget({ kind: 'drop', itemIds: [424242], durationMin: 60 }, items).ok, false, 'unknown item');
  assert.equal(parseTarget({ kind: 'drop', itemIds: [1, 2, 3, 4, 5, 6], durationMin: 60 }, items).ok, false, 'too many');
  assert.equal(parseTarget({ kind: 'drop', itemIds: [], durationMin: 60 }, items).ok, false);
});

test('score races: bigger gain wins, equal is a tie (0–0 too)', () => {
  assert.equal(decideByScore(12, 9), 'challenger');
  assert.equal(decideByScore(3, 40), 'opponent');
  assert.equal(decideByScore(7, 7), 'tie');
  assert.equal(decideByScore(0, 0), 'tie');
  assert.equal(decideByScore(-5, 0), 'tie', 'never below zero');
});

test('drop races: first landing wins, same instant ties, nobody by the end draws', () => {
  assert.equal(decideByDrop(null, null, false), null);
  assert.equal(decideByDrop(null, null, true), 'tie');
  assert.equal(decideByDrop(100, null, false), 'challenger');
  assert.equal(decideByDrop(null, 100, false), 'opponent');
  assert.equal(decideByDrop(100, 50, false), 'opponent');
  assert.equal(decideByDrop(100, 100, false), 'tie');
});

test('only activity inside the window counts', () => {
  assert.equal(dropCounts(999, 1000, 2000), false, 'before the start');
  assert.equal(dropCounts(1000, 1000, 2000), true);
  assert.equal(dropCounts(2000, 1000, 2000), true);
  assert.equal(dropCounts(2001, 1000, 2000), false, 'after the end');
  assert.equal(dropCounts(1500, null, 2000), false, 'not started');
  assert.equal(dropCounts(NaN, 1000, 2000), false);
});

test('record and sentences', () => {
  const rows = [
    { result: 'challenger' as const, challengerPlayerId: 1, opponentPlayerId: 2 },
    { result: 'opponent' as const, challengerPlayerId: 2, opponentPlayerId: 1 },
    { result: 'opponent' as const, challengerPlayerId: 1, opponentPlayerId: 3 },
    { result: 'tie' as const, challengerPlayerId: 3, opponentPlayerId: 1 },
    { result: null, challengerPlayerId: 1, opponentPlayerId: 2 },
  ];
  const r = recordFor(rows, 1);
  assert.deepEqual(r, { wins: 2, losses: 1, ties: 1 });
  assert.equal(recordLabel(r), '2W · 1L · 1T');
  assert.equal(recordLabel({ wins: 1, losses: 0, ties: 0 }), '1W · 0L');
  assert.equal(
    resultSentence('drop', 'Dragon pickaxe', 'opponent', { challenger: 'Zezima', opponent: 'Lynx' }),
    'Lynx beat Zezima to a Dragon pickaxe',
  );
  assert.equal(
    resultSentence('kc', 'Zulrah', 'challenger', { challenger: 'Zezima', opponent: 'Lynx' }, { challenger: 12, opponent: 9 }),
    'Zezima beat Lynx on Zulrah kills (12 to 9)',
  );
  assert.match(resultSentence('xp', 'Slayer', 'tie', { challenger: 'A', opponent: 'B' }, { challenger: 5, opponent: 5 }), /tied/);
  assert.equal(describeChallenge('drop', 'Abyssal whip', 60), 'First to an Abyssal whip within 1 hour');
  assert.equal(describeChallenge('kc', 'Zulrah', 1440), 'Most Zulrah kills in 24 hours');
  assert.equal(isPublic({ challengerPublic: true, opponentPublic: false }), false, 'public takes both');
  assert.equal(isPublic({ challengerPublic: true, opponentPublic: true }), true);
});
