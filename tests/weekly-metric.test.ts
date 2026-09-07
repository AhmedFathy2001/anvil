// The hiscores' two kinds of absence.
//
// Pure — lib/weeklyMetric takes a snapshot and returns a tagged result, which is why it was split
// out of lib/weekly. The rule it encodes is a convention of the OSRS hiscores that is invisible in
// the types (`xp` and `score` are just numbers) and wrong in a way nothing notices until a whole
// competition sits at zero for a week.
//
// Run: npm run test:weeklymetric

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readMetricFromSnapshot } from '../src/lib/weeklyMetric.ts';
import type { HiscoresSnapshot } from '../src/lib/hiscores.ts';

/** Just enough snapshot for the metric reader; it looks at one field. */
function snap(over: Partial<HiscoresSnapshot> = {}): HiscoresSnapshot {
  return { skills: {}, bosses: {}, ...over } as HiscoresSnapshot;
}

test('unranked in a skill is a real zero, not a failed read', () => {
  // THE BUG THIS PINS. -1 is the hiscores' way of saying "on the hiscores, unranked here". It is a
  // number, so it passed every check and would land in the database as if it were an XP total —
  // becoming a frozen baseline of -1 that adds one to every gain measured against it ever after.
  const result = readMetricFromSnapshot(
    snap({ skills: { sailing: { rank: -1, level: 1, xp: -1 } } }),
    'skill',
    'sailing',
  );
  assert.deepEqual(
    { kind: result.kind, value: result.kind === 'value' ? result.value : null },
    { kind: 'value', value: 0 },
  );
});

test('a skill the parser has never heard of is a failed read, not a zero', () => {
  // The other kind of absence, and it must NOT write a value: nothing can be concluded, so the
  // competition waits rather than freezing at a number we invented. This is the shape that froze
  // whole competitions when Maggot King predated the boss list.
  assert.equal(readMetricFromSnapshot(snap(), 'skill', 'sailing').kind, 'transient');
  assert.equal(readMetricFromSnapshot(snap({ skills: {} }), 'skill', 'mining').kind, 'transient');
});

test('a real skill XP passes through untouched', () => {
  const result = readMetricFromSnapshot(
    snap({ skills: { mining: { rank: 50_000, level: 99, xp: 13_034_431 } } }),
    'skill',
    'mining',
  );
  assert.equal(result.kind === 'value' && result.value, 13_034_431);
});

test('skills and bosses answer the same way, which is the point', () => {
  // The asymmetry this closes: the boss branch had both guards and the skill branch had neither,
  // and only survived because every caller happened to floor -1 downstream.
  const unrankedSkill = readMetricFromSnapshot(
    snap({ skills: { sailing: { rank: -1, level: 1, xp: -1 } } }),
    'skill',
    'sailing',
  );
  const unrankedBoss = readMetricFromSnapshot(
    snap({ bosses: { zulrah: { rank: -1, score: -1 } } }),
    'boss',
    'zulrah',
  );
  // Compared field by field rather than whole: a 'value' result also carries the snapshot it came
  // from, which is different for the two by construction.
  const shape = (r: typeof unrankedSkill) => ({
    kind: r.kind,
    value: r.kind === 'value' ? r.value : null,
  });
  assert.deepEqual(shape(unrankedSkill), shape(unrankedBoss));
  assert.deepEqual(shape(unrankedSkill), { kind: 'value', value: 0 });

  // …and both refuse to answer for a key they do not know.
  assert.equal(readMetricFromSnapshot(snap(), 'skill', 'nonesuch').kind, 'transient');
  assert.equal(readMetricFromSnapshot(snap(), 'boss', 'nonesuch').kind, 'transient');
});

test('an efficiency comp needs both halves of the snapshot', () => {
  // It condenses the WHOLE snapshot to hours, so a half-parsed one is a failed read rather than a
  // small number.
  assert.equal(readMetricFromSnapshot(snap({ skills: undefined }), 'efficiency', 'ehp').kind, 'transient');
  assert.equal(readMetricFromSnapshot(snap({ bosses: undefined }), 'efficiency', 'ehb').kind, 'transient');
});
