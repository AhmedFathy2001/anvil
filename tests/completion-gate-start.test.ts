// An event that hasn't started can't be scored.
//
// Run: DATABASE_URL=file:./.test-gate.db npx tsx --test tests/completion-gate-start.test.ts
//
// This is the rule the starting shot exists to enforce — what you did before the whistle isn't the
// event — and until now only the SUBMISSION route enforced it. The plugin's live stat push resolved
// "the member's active event" as any board that hadn't ENDED, which a board starting in two months
// satisfies, and then credited its stat tiles off a kill made today. A team was handed a tile on a
// bingo that doesn't run for another two months.
//
// The pick is tested here rather than through the route because that's where the bug was: the gate
// alone would have turned a wrong-credit into a MISSING credit for anyone in both a live board and a
// future one.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const NOW = Date.parse('2026-08-26T12:00:00.000Z');
const iso = (d: string) => new Date(d).toISOString();

/** The pick from api/plugin/stats: started boards first, then the freshest. */
function pickCreditableEvent<T extends { teamId: number | null; startDate: string | null; endDate: string | null; forceEndedAt: string | null }>(
  rows: T[],
  nowIso: string,
): T | undefined {
  const candidates = rows.filter((p) => p.teamId && !p.forceEndedAt && (!p.endDate || p.endDate > nowIso));
  const started = (p: T) => !!p.startDate && p.startDate <= nowIso;
  candidates.sort((a, b) => {
    if (started(a) !== started(b)) return started(a) ? -1 : 1;
    return (b.startDate ?? '').localeCompare(a.startDate ?? '');
  });
  return candidates.find(started);
}

const nowIso = new Date(NOW).toISOString();
const row = (name: string, start: string | null, end: string | null, over: Partial<{ teamId: number | null; forceEndedAt: string | null }> = {}) => ({
  name,
  teamId: 7 as number | null,
  startDate: start ? iso(start) : null,
  endDate: end ? iso(end) : null,
  forceEndedAt: null as string | null,
  ...over,
});

test('a board two months out never takes credit, even when it is the only one', () => {
  // The reported bug, exactly: drafted early into an October bingo, kills something in August.
  const future = row('October bingo', '2026-10-20T00:00:00Z', '2026-11-01T00:00:00Z');
  assert.equal(pickCreditableEvent([future], nowIso), undefined);
});

test('a running board wins over a future one the member is merely pre-drafted into', () => {
  // Without the sort this depended on row order — and the gate alone would have blocked the future
  // board while never reaching the live one, silently losing credit that was genuinely earned.
  const future = row('October bingo', '2026-10-20T00:00:00Z', '2026-11-01T00:00:00Z');
  const running = row('August bingo', '2026-08-20T00:00:00Z', '2026-09-05T00:00:00Z');
  assert.equal(pickCreditableEvent([future, running], nowIso)?.name, 'August bingo');
  assert.equal(pickCreditableEvent([running, future], nowIso)?.name, 'August bingo', 'row order must not decide');
});

test('among running boards the freshest start wins', () => {
  const older = row('Spring bingo', '2026-05-01T00:00:00Z', '2026-12-01T00:00:00Z');
  const newer = row('August bingo', '2026-08-20T00:00:00Z', '2026-12-01T00:00:00Z');
  assert.equal(pickCreditableEvent([older, newer], nowIso)?.name, 'August bingo');
});

test('ended, force-ended and benched rows are never candidates', () => {
  const ended = row('July bingo', '2026-07-01T00:00:00Z', '2026-07-20T00:00:00Z');
  const forced = row('Cancelled', '2026-08-01T00:00:00Z', '2026-12-01T00:00:00Z', { forceEndedAt: nowIso });
  const noTeam = row('Unassigned', '2026-08-01T00:00:00Z', '2026-12-01T00:00:00Z', { teamId: null });
  assert.equal(pickCreditableEvent([ended, forced, noTeam], nowIso), undefined);
});

test('an open-ended board that has started still counts', () => {
  // No endDate is normal for a board the host hasn't scheduled an end for.
  const open = row('Open bingo', '2026-08-20T00:00:00Z', null);
  assert.equal(pickCreditableEvent([open], nowIso)?.name, 'Open bingo');
});

test('a board with no start date at all is a draft, and drafts do not score', () => {
  const draft = row('Unscheduled', null, null);
  assert.equal(pickCreditableEvent([draft], nowIso), undefined);
});
