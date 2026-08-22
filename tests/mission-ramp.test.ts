import test from 'node:test';
import assert from 'node:assert/strict';
import { eventProgressPct, missionPool, phaseAt, phaseWindow } from '../src/lib/missionRamp.ts';

const EVENT = { startDate: '2026-09-01T00:00:00.000Z', endDate: '2026-09-11T00:00:00.000Z' };
const at = (iso: string) => Date.parse(iso);

// Points map onto the default bands: troll 0, easy 11, medium 100, hard 350, ultra 700.
const tile = (id: number, points: number) => ({ id, points });
const HIDDEN = [tile(1, 5), tile(2, 50), tile(3, 200), tile(4, 400), tile(5, 900)];

const RAMP = [
  { throughPct: 30, tiers: ['troll', 'easy'] },
  { throughPct: 70, tiers: ['medium', 'hard'] },
  { throughPct: 100, tiers: ['ultra'] },
];

test('eventProgressPct: shares of the run, clamped at both ends', () => {
  assert.equal(eventProgressPct(EVENT, at('2026-09-06T00:00:00.000Z')), 50);
  assert.equal(eventProgressPct(EVENT, at('2026-08-30T00:00:00.000Z')), 0);
  assert.equal(eventProgressPct(EVENT, at('2026-09-20T00:00:00.000Z')), 100);
  // A board with no end has no "through" to be a share of.
  assert.equal(eventProgressPct({ startDate: EVENT.startDate, endDate: null }, at('2026-09-06T00:00:00.000Z')), null);
});

test('phaseAt: the phase whose window you are inside, and the last one keeps running', () => {
  assert.deepEqual(phaseAt(RAMP, 10)?.tiers, ['troll', 'easy']);
  assert.deepEqual(phaseAt(RAMP, 30)?.tiers, ['troll', 'easy']);
  assert.deepEqual(phaseAt(RAMP, 31)?.tiers, ['medium', 'hard']);
  // A ramp that stops short doesn't hand the closing stretch back to everything.
  assert.deepEqual(phaseAt([{ throughPct: 80, tiers: ['ultra'] }], 95)?.tiers, ['ultra']);
  assert.equal(phaseAt([], 50), null);
});

test('missionPool: draws from the phase in force', () => {
  const early = missionPool(HIDDEN, RAMP, EVENT, at('2026-09-02T00:00:00.000Z'));
  assert.deepEqual(early.pool.map((t) => t.id), [1, 2]);
  assert.equal(early.fellBack, false);

  const late = missionPool(HIDDEN, RAMP, EVENT, at('2026-09-10T00:00:00.000Z'));
  assert.deepEqual(late.pool.map((t) => t.id), [5]);
});

test('missionPool: an exhausted phase falls back rather than stalling the feature', () => {
  // Every easy mission already announced: the early phase has nothing left to draw.
  const onlyHard = [tile(4, 400), tile(5, 900)];
  const choice = missionPool(onlyHard, RAMP, EVENT, at('2026-09-02T00:00:00.000Z'));
  assert.deepEqual(choice.pool.map((t) => t.id), [4, 5]);
  assert.equal(choice.fellBack, true);
  // The tiers it wanted are still reported, so the log can say why it fell back.
  assert.deepEqual(choice.tiers, ['troll', 'easy']);
});

test('missionPool: no ramp, no dates, or an empty phase all mean "everything"', () => {
  assert.equal(missionPool(HIDDEN, [], EVENT, at('2026-09-02T00:00:00.000Z')).pool.length, 5);
  assert.equal(missionPool(HIDDEN, RAMP, { startDate: null, endDate: null }, Date.now()).pool.length, 5);
  assert.equal(missionPool(HIDDEN, [{ throughPct: 100, tiers: [] }], EVENT, at('2026-09-02T00:00:00.000Z')).pool.length, 5);
});

test('phaseWindow: the same phase, said in dates for the host', () => {
  assert.deepEqual(phaseWindow(EVENT, 0, 30), {
    from: '2026-09-01T00:00:00.000Z',
    to: '2026-09-04T00:00:00.000Z',
  });
  assert.equal(phaseWindow({ startDate: null, endDate: null }, 0, 30), null);
});
