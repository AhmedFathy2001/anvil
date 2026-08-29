// Stat tiles must never count PRE-EVENT gains. Two independent ways that leaks, and the two guards
// that close it — tested as pure functions (no db, no network), the way board-scoring is.
//
//   1. A baseline captured before the event started is trusted forever → gains since it count.
//      needsBaselineRecapture forces a recapture of any baseline older than startDate.
//   2. Hiscores lag: a player mid-session at the start has a stale hiscores baseline while the live
//      overlay already shows the session → the pre-start portion counts. baselineWithOverlay folds
//      the overlay INTO the baseline at capture so the gain starts at 0.
//
// Run: npx tsx --test tests/stat-baseline-preevent.test.ts
// (tsx for the `@/` alias; the module is pure and touches no database.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { needsBaselineRecapture, baselineWithOverlay, computeGain } from '../src/lib/statTracking.ts';

/** A minimal hiscores snapshot: one skill, one boss. */
function snap(attackXp: number, zulrahKc: number) {
  return {
    skills: { attack: { rank: 1, level: 50, xp: attackXp } },
    bosses: { zulrah: { rank: 1, score: zulrahKc } },
  };
}

// ── Guard 1: a baseline from before the start is not trusted ────────────────────────────────────

test('no baseline yet always recaptures', () => {
  assert.equal(needsBaselineRecapture(null, null, '2026-08-29T02:00:00Z'), true);
  assert.equal(needsBaselineRecapture(undefined, '2026-08-29T02:00:00Z', '2026-08-29T02:00:00Z'), true);
});

test('a baseline captured BEFORE the start is recaptured; one at/after it is kept', () => {
  const start = '2026-08-29T02:00:00Z';
  const before = '2026-08-29T01:00:00Z';
  const after = '2026-08-29T02:30:00Z';
  assert.equal(needsBaselineRecapture(JSON.stringify(snap(1000, 10)), before, start), true, 'pre-start → recapture');
  assert.equal(needsBaselineRecapture(JSON.stringify(snap(1000, 10)), after, start), false, 'post-start → keep');
  assert.equal(needsBaselineRecapture(JSON.stringify(snap(1000, 10)), start, start), false, 'exactly at start → keep');
});

test('a present baseline with unknown capture time is recaptured, to be safe', () => {
  assert.equal(needsBaselineRecapture(JSON.stringify(snap(1000, 10)), null, '2026-08-29T02:00:00Z'), true);
});

test('with no start date there is nothing to anchor to, so a present baseline is left alone', () => {
  assert.equal(needsBaselineRecapture(JSON.stringify(snap(1000, 10)), '2026-08-29T01:00:00Z', null), false);
});

test('the before/after comparison survives BOTH stored time formats (space vs ISO)', () => {
  // parseStamp reads either; a raw string compare would get "…T…" vs "… …" wrong (T > space).
  const startIso = '2026-08-29T02:00:00Z';
  assert.equal(needsBaselineRecapture(JSON.stringify(snap(1, 1)), '2026-08-29 01:00:00', startIso), true, 'space-before < ISO-start');
  assert.equal(needsBaselineRecapture(JSON.stringify(snap(1, 1)), '2026-08-29 03:00:00', startIso), false, 'space-after > ISO-start');
  // And with the start in space format.
  assert.equal(needsBaselineRecapture(JSON.stringify(snap(1, 1)), '2026-08-29T01:00:00Z', '2026-08-29 02:00:00'), true);
});

// ── Guard 2: a session in progress at the start is baked into the baseline, not counted ──────────

test('folding the overlay into the baseline means the in-progress session scores zero at capture', () => {
  // Player is mid-session at the whistle: hiscores still say 95 (last logout), overlay already 110.
  const hiscores = JSON.stringify(snap(1000, 95));
  const overlay = { zulrah: 110 };

  const baselineJson = baselineWithOverlay(hiscores, overlay);
  const baseline = JSON.parse(baselineJson);

  // Capture tick: current is the fetched hiscores (95), effective current folds the overlay (110).
  const gainAtCapture = computeGain(baseline, snap(1000, 95), overlay, ['zulrah'], 'kc');
  assert.equal(gainAtCapture, 0, 'the 15 pre-start session kills are baked into the baseline, not credited');

  // The bug this closes: a RAW baseline would credit the whole session immediately.
  const rawGain = computeGain(snap(1000, 95), snap(1000, 95), overlay, ['zulrah'], 'kc');
  assert.equal(rawGain, 15, 'without absorption those 15 pre-event kills would count');
});

test('only kills AFTER the start count once the baseline has absorbed the session', () => {
  const baseline = JSON.parse(baselineWithOverlay(JSON.stringify(snap(1000, 95)), { zulrah: 110 }));
  // Five more kills after the start: overlay now 115.
  const gain = computeGain(baseline, snap(1000, 95), { zulrah: 115 }, ['zulrah'], 'kc');
  assert.equal(gain, 5, 'post-start gain only');
});

test('a logged-out player (no overlay) baselines cleanly off honest hiscores', () => {
  // Nothing to absorb — hiscores is current because they logged out.
  const baselineJson = baselineWithOverlay(JSON.stringify(snap(1000, 100)), {});
  const baseline = JSON.parse(baselineJson);
  assert.equal(baseline.bosses.zulrah.score, 100);
  assert.equal(computeGain(baseline, snap(1000, 103), {}, ['zulrah'], 'kc'), 3);
});
