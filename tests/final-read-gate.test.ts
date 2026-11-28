import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FINAL_READ_WAIT_MS, eventReadsDone, finalReadsDone } from '@/lib/finalReadGate';

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
