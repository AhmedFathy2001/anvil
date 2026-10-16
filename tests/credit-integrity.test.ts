// Run: npx tsx --test tests/credit-integrity.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { bossKeysOf, busiestHour, checkCreditIntegrity, kcOf } from '../src/lib/creditIntegrity.ts';

const vork = { id: 1, title: 'Kill Vorkath 50 times', targetNpcs: '["Vorkath"]' };
const snap = (kc: number) => JSON.stringify({ skills: {}, bosses: { vorkath: { rank: 1, score: kc } } });
const at = (min: number) => new Date(Date.UTC(2026, 9, 10, 12, 0) + min * 60_000).toISOString();

test('only tiles whose every NPC is a hiscores boss are checked', () => {
  assert.deepEqual(bossKeysOf(vork), ['vorkath']);
  assert.equal(bossKeysOf({ id: 2, title: 'Chickens', targetNpcs: '["Chicken"]' }), null);
  assert.equal(bossKeysOf({ id: 3, title: 'Mixed', targetNpcs: '["Vorkath","Chicken"]' }), null);
});

test('an unranked or missing boss is unknown, never zero', () => {
  assert.equal(kcOf(JSON.stringify({ bosses: { vorkath: { rank: -1, score: -1 } } }), ['vorkath']), null);
  assert.equal(kcOf(JSON.stringify({ bosses: {} }), ['vorkath']), null);
  assert.equal(kcOf(snap(40), ['vorkath']), 40);
});

test('busiestHour finds the densest 60-minute window', () => {
  const rows = [0, 10, 20, 70, 75].map((m) => ({ amount: 2, at: Date.parse(at(m)) }));
  assert.equal(busiestHour(rows), 6); // 0,10,20 or 20,70,75 -> three rows of 2
});

test('credits beyond the hiscores gain are flagged; honest ones are not', () => {
  const players = [
    { playerId: 7, rsn: 'Honest', baseline: snap(100), current: snap(130), polledAt: at(600) },
    { playerId: 8, rsn: 'Forger', baseline: snap(100), current: snap(102), polledAt: at(600) },
  ];
  const credits = [
    // Spread over hours so the clock check stays quiet; all well before the poll.
    ...Array.from({ length: 30 }, (_, i) => ({ playerId: 7, tileId: 1, amount: 1, createdAt: at(i * 6) })),
    ...Array.from({ length: 20 }, (_, i) => ({ playerId: 8, tileId: 1, amount: 1, createdAt: at(i * 6) })),
  ];
  const flags = checkCreditIntegrity({ tiles: [vork], credits, players });
  assert.equal(flags.length, 1);
  assert.equal(flags[0].rsn, 'Forger');
  assert.equal(flags[0].kind, 'hiscores');
  assert.equal(flags[0].credited, 20);
  assert.equal(flags[0].allowed, 2);
});

test('kills too recent for the last poll are not held against anyone', () => {
  const players = [{ playerId: 7, rsn: 'Grinding', baseline: snap(100), current: snap(100), polledAt: at(30) }];
  const credits = [{ playerId: 7, tileId: 1, amount: 10, createdAt: at(20) }];
  assert.equal(checkCreditIntegrity({ tiles: [vork], credits, players }).filter((f) => f.kind === 'hiscores').length, 0);
});

test('an impossible hour of kills is flagged', () => {
  // Vorkath's fastest is ~90s: ~40/h, ~80/h with headroom. 200 in ten minutes is not a good hour.
  const credits = [{ playerId: 9, tileId: 1, amount: 200, createdAt: at(0) }];
  const flags = checkCreditIntegrity({ tiles: [vork], credits, players: [] });
  assert.equal(flags.length, 1);
  assert.equal(flags[0].kind, 'rate');
});
