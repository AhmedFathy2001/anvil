// The plugin Lookup "CAs" tab payload (lib/combatTasks caLookup). Pure: no database.
// Run: npx tsx --test tests/ca-lookup.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CA_TIERS, caLookup, combatTasks } from '@/lib/combatTasks';

test('caLookup: tiers counted, bosses grouped, unfinished bosses and missing tasks first', () => {
  const all = combatTasks([]);
  const firstMonster = all.find((t) => t.monster)!.monster!;
  const mine = all.filter((t) => t.monster === firstMonster);
  const doneName = mine[0].name;
  const out = caLookup(combatTasks([{ id: 0, name: doneName, state: 2 }]));

  assert.deepEqual(out.tiers, CA_TIERS);
  assert.equal(out.perTier.reduce((n, t) => n + t.total, 0), all.length);
  assert.equal(out.perTier.reduce((n, t) => n + t.done, 0), 1);
  assert.equal(out.monsters.reduce((n, m) => n + m.total, 0), all.length);

  const row = out.monsters.find((m) => m.name === firstMonster)!;
  assert.equal(row.done, 1);
  assert.equal(row.tasks[row.tasks.length - 1].n, doneName, 'done tasks sink below missing ones');
  assert.ok(out.earned > 0);
  assert.ok(out.nextTier);
});

test('caLookup: a boss with everything done goes below the unfinished ones', () => {
  const all = combatTasks([]);
  const boss = all.find((t) => t.monster)!.monster!;
  const doneAll = all.filter((t) => t.monster === boss).map((t) => ({ id: 0, name: t.name, state: 2 as const }));
  const out = caLookup(combatTasks(doneAll));
  const idx = out.monsters.findIndex((m) => m.name === boss);
  const firstFinished = out.monsters.findIndex((m) => m.done === m.total);
  assert.equal(idx, firstFinished);
  assert.ok(out.monsters.slice(0, idx).every((m) => m.done < m.total));
});
