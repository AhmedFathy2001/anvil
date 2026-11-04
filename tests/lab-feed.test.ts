// A lab board's Feed from its quarantined moments pushes (lib/labFeed). Pure — no database.
//
// Run: npx tsx --test tests/lab-feed.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { labMomentRows } from '../src/lib/labFeed';

const push = (logId: number, moments: unknown[]) => ({ logId, rsn: 'Drenvox', teamId: 7, payload: { moments } });

test('a logged death becomes a board row, newest first, with negative ids', () => {
  const rows = labMomentRows(
    [
      push(268, [{ at: '2026-11-04T11:25:59.642Z', key: 'death|||1', kind: 'death', quantity: 1, sourceKind: 'npc' }]),
      push(300, [{ at: '2026-11-04T12:00:00.000Z', key: 'd', kind: 'drop', itemId: 4151, itemName: 'Abyssal whip', valueGp: 1_500_000, source: 'Abyssal demon' }]),
    ],
    9,
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].kind, 'loot');
  assert.equal(rows[1].kind, 'death');
  assert.equal(rows[1].occurredAt, '2026-11-04 11:25:59');
  assert.equal(rows[1].teamId, 7);
  assert.ok(rows.every((r) => r.id < 0 && r.eventId === 9));
  assert.notEqual(rows[0].id, rows[1].id);
});

test('a fought boss is named, a fought non-boss is not', () => {
  const rows = labMomentRows(
    [push(1, [
      { at: '2026-11-04T11:00:00Z', kind: 'death', source: 'Alchemical Hydra', sourceKind: 'fought' },
      { at: '2026-11-04T11:01:00Z', kind: 'death', source: 'Jug', sourceKind: 'fought' },
    ])],
    9,
  );
  const [jug, hydra] = rows;
  assert.equal(jug.source, null);
  assert.ok(hydra.source && /hydra/i.test(hydra.source));
});

test('clan-only kinds, junk and bad dates are skipped', () => {
  const rows = labMomentRows(
    [push(2, [{ at: '2026-11-04T11:00:00Z', kind: 'clog', itemName: 'x' }, { kind: 'death', at: 'nope' }, null, 5]), { logId: 3, rsn: 'x', teamId: null, payload: null }],
    9,
  );
  assert.equal(rows.length, 0);
});
