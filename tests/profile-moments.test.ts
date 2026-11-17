import test from 'node:test';
import assert from 'node:assert/strict';
import { tidyProfileMoments, type TidyRow } from '../src/lib/profileMoments.ts';

let id = 0;
const row = (o: Partial<TidyRow>): TidyRow => ({ id: ++id, kind: 'loot', itemId: null, itemName: null, quantity: 1, valueGp: 0, source: null, kc: null, occurredAt: '2026-11-16T10:00:00Z', ...o });

test('a common stack that is no log slot and worth little is left out', () => {
  const out = tidyProfileMoments([row({ itemId: 12934, itemName: "Zulrah's scales", quantity: 138, valueGp: 30_000, source: 'Zulrah', kc: 22 })]);
  assert.equal(out.length, 0);
});

test('one drop filed as loot and as a log line is one row: the one with the kill count', () => {
  const out = tidyProfileMoments([
    row({ kind: 'clog', itemId: 12938, itemName: 'Zul-andra teleport', occurredAt: '2026-11-16T10:00:20Z' }),
    row({ kind: 'loot', itemId: 12938, itemName: 'Zul-andra teleport', source: 'Zulrah', kc: 22, occurredAt: '2026-11-16T10:00:00Z' }),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].kc, 22);
  assert.equal(out[0].source, 'Zulrah');
});

test('the same item an hour later is another drop', () => {
  const out = tidyProfileMoments([
    row({ kind: 'clog', itemId: 12938, itemName: 'Zul-andra teleport', occurredAt: '2026-11-16T11:30:00Z' }),
    row({ kind: 'clog', itemId: 12938, itemName: 'Zul-andra teleport', occurredAt: '2026-11-16T10:00:00Z' }),
  ]);
  assert.equal(out.length, 2);
});

test('one chest opening is one row naming its items, led by the dearest', () => {
  const out = tidyProfileMoments([
    row({ kind: 'unique', itemId: 27690, itemName: 'Voidwaker', valueGp: 60_000_000, source: 'Loot Chest', occurredAt: '2026-11-16T10:00:02Z' }),
    row({ kind: 'unique', itemId: 6737, itemName: 'Berserker ring', valueGp: 3_000_000, source: 'Loot Chest', occurredAt: '2026-11-16T10:00:01Z' }),
    row({ kind: 'unique', itemId: 22983, itemName: 'Hydra leather', valueGp: 6_000_000, source: 'Loot Chest', occurredAt: '2026-11-16T10:00:00Z' }),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].itemName, 'Voidwaker, Berserker ring and Hydra leather');
  assert.equal(out[0].itemId, 27690);
});

test('two openings minutes apart stay two rows; deaths and tasks pass through', () => {
  const out = tidyProfileMoments([
    row({ kind: 'death', source: 'Zulrah' }),
    row({ kind: 'unique', itemId: 1, itemName: 'A', valueGp: 2_000_000, source: 'Loot Chest', occurredAt: '2026-11-16T10:10:00Z' }),
    row({ kind: 'unique', itemId: 2, itemName: 'B', valueGp: 2_000_000, source: 'Loot Chest', occurredAt: '2026-11-16T10:00:00Z' }),
  ]);
  assert.equal(out.length, 3);
});
