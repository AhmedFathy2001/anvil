// Where the pre-trip check spends its time: the ToA calc (five bosses, one setup) against a large,
// realistic bank. Pure: the bundled gear data, no database.
//
// Run: npx tsx scripts/bench-trip-check.ts [bankSize=800] [runs=5]

import { checkTrip, type TripInput } from '../src/lib/tripCheck.ts';
import { tripContent } from '../src/lib/tripContent.ts';
import { equivalentsFor } from '../src/lib/itemFamilies.ts';
import { indexGear, type GearData } from '../src/lib/dps/summary.ts';
import type { Monster } from '../src/lib/dps/engine.ts';
import type { InvItem } from '../src/lib/guideTiers.ts';
import itemsJson from '../src/data/gearItems.json' with { type: 'json' };
import monstersJson from '../src/data/gearMonsters.json' with { type: 'json' };

const size = Number(process.argv[2] ?? 800);
const runs = Number(process.argv[3] ?? 5);
const t0 = performance.now();
const idx = indexGear({ items: (itemsJson as unknown as GearData).items, monsters: (monstersJson as unknown as GearData).monsters });
console.log(`gear index: ${(performance.now() - t0).toFixed(0)}ms (once per process)`);

const byName = (n: string) => idx.items.find((i) => i.n === n)?.id;
// An end-game bank: the usual raid kit, then filler gear (deterministic) up to `size`.
const kit = ["Osmumten's fang", "Tumeken's shadow", 'Twisted bow', 'Scythe of vitur', 'Dragon claws', 'Zaryte crossbow', 'Torva full helm', 'Torva platebody', 'Torva platelegs', 'Masori mask (f)', 'Masori body (f)', 'Masori chaps (f)', 'Ancestral hat', 'Ancestral robe top', 'Ancestral robe bottom', 'Amulet of torture', 'Necklace of anguish', 'Occult necklace', 'Infernal cape', "Dizana's quiver", 'Primordial boots', 'Pegasian boots', 'Ferocious gloves', 'Zaryte vambraces', 'Ultor ring', 'Venator ring', 'Magus ring', 'Avernic defender', 'Elidinis\' ward (f)', 'Dragon arrow', 'Toxic blowpipe', 'Bandos godsword', 'Ghrazi rapier', 'Abyssal whip', 'Bow of faerdhinen (c)', 'Crystal helm', 'Crystal body', 'Crystal legs']
  .map(byName)
  .filter((x): x is number => x != null);
const filler = idx.items.filter((i, n) => !i.hid && n % 2 === 0).map((i) => i.id);
const bankIds = [...new Set([...kit, ...filler])].slice(0, size);
const bank: InvItem[] = [...bankIds.map((id) => ({ id })), ...[6685, 3024, 385, 391, 12791, 560, 565, 555].map((id) => ({ id, q: 500 }))];
const worn: InvItem[] = [byName('Abyssal whip'), byName('Dragon defender')].filter((x): x is number => x != null).map((id) => ({ id }));
const inventory: InvItem[] = [{ id: 6685, q: 1 }, { id: 385, q: 1 }];

const content = tripContent('toa')!;
const monsters = content.targets.map((t) => idx.monster(t)).filter((m): m is Monster => !!m);
const LEVELS = { attack: 99, strength: 99, ranged: 99, magic: 99, defence: 99, prayer: 99, hitpoints: 99 };

let t = performance.now();
const all = [...worn, ...inventory, ...bank].map((i) => i.id);
const needs = equivalentsFor(all, 'needs');
const holds = equivalentsFor(all, 'holds');
console.log(`equivalents: ${(performance.now() - t).toFixed(0)}ms`);

const inp = (ms: Monster[]): TripInput => ({ content, setup: null, source: 'calc', monsters: ms, worn, inventory, bank, state: null, levels: LEVELS, idx, needs, holds, nameOf: (id) => idx.item(id)?.n ?? `Item ${id}`, isRunePouch: (id) => id === 12791 });

console.log(`bank: ${bank.length} stacks, ${bankIds.filter((id) => idx.item(id)).length} gear pieces; ${monsters.length} bosses`);
for (const m of monsters) {
  t = performance.now();
  checkTrip(inp([m]));
  console.log(`  one boss ${m.n}${m.v ? ` (${m.v})` : ''}: ${(performance.now() - t).toFixed(0)}ms`);
}
const times: number[] = [];
for (let r = 0; r < runs; r++) {
  t = performance.now();
  checkTrip(inp(monsters));
  times.push(performance.now() - t);
}
times.sort((a, b) => a - b);
console.log(`ToA raid calc: first ${times[times.length - 1].toFixed(0)}ms, median ${times[Math.floor(times.length / 2)].toFixed(0)}ms over ${runs} runs`);
