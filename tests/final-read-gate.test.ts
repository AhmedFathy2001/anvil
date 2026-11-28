import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FINAL_READ_WAIT_MS, LATE_READ_MS, eventReadsDone, finalReadsDone, liveBefore, takeLateRead } from '@/lib/finalReadGate';

const END = Date.parse('2026-12-07T00:00:00Z');

test('a competition settles once everyone is read after the end, or after 2 hours', () => {
  assert.equal(finalReadsDone(0, END, END + 60_000), true);
  assert.equal(finalReadsDone(3, END, END + 60_000), false);
  assert.equal(finalReadsDone(3, END, END + FINAL_READ_WAIT_MS - 1), false);
  assert.equal(finalReadsDone(3, END, END + FINAL_READ_WAIT_MS), true);
});

test('a board without stat tiles ends at once; one with them waits for its reads or 2 hours', () => {
  assert.equal(eventReadsDone(false, END, END + 1), true);
  assert.equal(eventReadsDone(true, END, END + 60_000), false);
  assert.equal(eventReadsDone(true, END, END + FINAL_READ_WAIT_MS), true);
  assert.equal(FINAL_READ_WAIT_MS, 2 * 60 * 60 * 1000);
});

test('only plugin readings from before the end count beside a final read', () => {
  const live = { zulrah: 510, vorkath: 40, attack: 13_000_000 };
  const times = { zulrah: '2026-12-06T23:50:00Z', vorkath: '2026-12-07T00:20:00Z' };
  // Vorkath rose after the end; attack has no time at all: both left to the hiscores.
  assert.deepEqual(liveBefore(live, times, END), { zulrah: 510 });
});

test('a late read gives way to a pre-end plugin reading; a prompt one, or one with nothing to prefer, is taken', () => {
  assert.equal(takeLateRead(60_000, true), true);
  assert.equal(takeLateRead(LATE_READ_MS + 1, true), false);
  assert.equal(takeLateRead(LATE_READ_MS + 1, false), true);
});
