// A pet shows once in the lists that mix drops and pets (lib/momentDupes).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { withoutPetDoubles } from '../src/lib/momentDupes';

const at = (min: number) => new Date(Date.UTC(2026, 10, 15, 12, min)).toISOString();

test('the drop that doubles a pet is left out; everything else stays, in order', () => {
  const rows = [
    { id: 1, kind: 'drop', rsn: 'Djole', itemId: 100, itemName: 'Maggot marquess', occurredAt: at(0) },
    { id: 2, kind: 'pet', rsn: 'Djole', itemId: null, itemName: 'Maggot Marquess', occurredAt: at(1) },
    { id: 3, kind: 'drop', rsn: 'Djole', itemId: 200, itemName: 'Dragon pickaxe', occurredAt: at(2) },
    { id: 4, kind: 'drop', rsn: 'Other', itemId: 100, itemName: 'Maggot marquess', occurredAt: at(3) },
    { id: 5, kind: 'drop', rsn: 'Djole', itemId: 100, itemName: 'Maggot marquess', occurredAt: at(55) },
  ];
  // Same player, same thing, minutes apart: one line, the pet. Another player's, or one an hour later, is its own.
  assert.deepEqual(withoutPetDoubles(rows).map((r) => r.id), [2, 3, 4, 5]);
  assert.equal(withoutPetDoubles(rows.filter((r) => r.kind !== 'pet')).length, 4);
});
