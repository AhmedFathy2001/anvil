import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outcomeLines } from '../src/lib/tileOutcome';

const fmt = (iso: string) => iso.slice(0, 10);
test('nobody completed it', () => {
  assert.deepEqual(outcomeLines([], fmt), ['Nobody completed this tile.']);
});
test('one line per team, earliest first, undated last', () => {
  const out = outcomeLines(
    [{ teamName: 'B', completedAt: '2026-11-12T10:00:00Z' }, { teamName: 'C' }, { teamName: 'A', completedAt: '2026-11-10T10:00:00Z' }],
    fmt,
  );
  assert.deepEqual(out, ['A completed it on 2026-11-10.', 'B completed it on 2026-11-12.', 'C completed it.']);
});
