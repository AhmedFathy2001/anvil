// RuneLite import formats and multi-target encounters. Pure.
//
// Run: npx tsx --test tests/runelite-export.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bankTagString, cleanTagName, inventorySetupJson, EQUIPMENT_INDEX } from '../src/lib/runeliteExport.ts';
import { encounter } from '../src/lib/dps/encounter.ts';
import { blockTargets, setupTargets } from '../src/lib/guideTiers.ts';
import type { GearItem, Monster } from '../src/lib/dps/engine.ts';

const SETUP = {
  name: 'Vorkath: rapid, ruby',
  gear: { head: 11, weapon: 22, ammo: 33 },
  inventory: [{ id: 385, q: 1 }, null, { id: 2434 }],
  runePouch: [{ id: 560, q: 1000 }],
  spellbook: 1,
};

test('bank tag: RuneLite importTag format — header, cleaned name, icon, then layout pairs', () => {
  const s = bankTagString(SETUP);
  const parts = s.split(',');
  assert.deepEqual(parts.slice(0, 5), ['banktags', '1', 'Vorkath rapid ruby', '22', 'layout']);
  // head at (0,1)=1, ammo (1,2)=10, weapon (2,0)=16, inventory slot 0 → col 4 = 4, slot 2 → col 6 = 6, pouch → row 6 = 48
  const pairs = new Map<number, number>();
  for (let i = 5; i < parts.length; i += 2) pairs.set(Number(parts[i]), Number(parts[i + 1]));
  assert.deepEqual([...pairs.entries()].sort((a, b) => a[0] - b[0]), [[1, 11], [4, 385], [6, 2434], [10, 33], [16, 22], [48, 560]]);
  assert.equal(cleanTagName('a<b>/c:d,e'), 'abcde');
});

test('inventory setups: portable JSON the plugin imports', () => {
  const j = JSON.parse(inventorySetupJson(SETUP));
  assert.equal(j.setup.inv.length, 28);
  assert.deepEqual(j.setup.inv.slice(0, 3), [{ id: 385 }, null, { id: 2434 }], 'q omitted when 1, empty = null');
  assert.equal(j.setup.eq.length, 14);
  assert.deepEqual(j.setup.eq[EQUIPMENT_INDEX.weapon], { id: 22 });
  assert.equal(j.setup.eq[6], null, 'arms slot never holds an item');
  assert.deepEqual(j.setup.rp, [{ id: 560, q: 1000 }]);
  assert.equal(j.setup.hc, '#FFFF0000', "RuneLite's Color adapter reads #AARRGGBB");
  assert.equal(j.setup.sb, 1);
  assert.ok(Array.isArray(j.layout) && j.layout[1] === 11 && j.layout[0] === -1);
});

test('encounters: each target takes the best setup allowed against it; run time sums', () => {
  const SWORD: GearItem = { id: 1, n: 'Sword', s: 'weapon', b: [60, 60, 0, 0, 0, 70, 0, 0, 0], sp: 4, c: 'Stab Sword' };
  const lookup = (id: number | null | undefined) => (id === 1 ? SWORD : null);
  const a: Monster = { n: 'A', hp: 100, lv: [50, 1], d: [0, 0, 0, 0, 0, 0, 0] };
  const b: Monster = { n: 'B', hp: 300, lv: [200, 1], d: [200, 200, 200, 0, 0, 0, 0] };
  const stats = { attack: 99, strength: 99, ranged: 1, magic: 1 };
  const strong = { gear: { weapon: 1 }, style: 0, stats };
  const weak = { gear: {}, style: 0, stats };
  const r = encounter([{ loadout: weak, targets: [0] }, { loadout: strong, targets: [1] }], [a, b], lookup);
  assert.equal(r.targets[0].setup, 0);
  assert.equal(r.targets[1].setup, 1);
  const time = a.hp / r.targets[0].result!.dps + b.hp / r.targets[1].result!.dps;
  assert.ok(Math.abs(r.time - time) < 1e-9);
  assert.ok(Math.abs(r.dps - 400 / time) < 1e-9);
  // A setup limited to A can't cover B: no setup → unkillable run.
  assert.equal(encounter([{ loadout: strong, targets: [0] }], [a, b], lookup).time, Infinity);
});

test('block targets: several monsters, and setups limited to some of them', () => {
  const block = { monster: 'Ahrim the Blighted', monsters: ['Ahrim the Blighted', 'Dharok the Wretched'], setups: [] };
  assert.deepEqual(blockTargets(block), ['Ahrim the Blighted', 'Dharok the Wretched']);
  const setup = { tier: 'beginner' as const, name: 'x', gear: {}, style: 0, stats: { attack: 1, strength: 1, ranged: 1, magic: 1 }, targets: ['Dharok the Wretched', 'Nobody'] };
  assert.deepEqual(setupTargets(setup, block), ['Dharok the Wretched']);
  assert.deepEqual(setupTargets({ ...setup, targets: [] }, block), block.monsters);
  assert.deepEqual(blockTargets({ monster: 'Zulrah', setups: [] }), ['Zulrah']);
});
