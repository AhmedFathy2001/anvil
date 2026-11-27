// The pre-trip card and Dizana's quiver: the arrows in a quiver are in no container (the plugin reads
// them as state.quiver), so they count as held with the quiver, on every path the card can take (the
// calc, a saved or guide setup, the loadout engine), on the doll and in the "Take N" count; and the
// card's bank filters show exactly what the card counts (one stack per supply kind). Real gear data,
// no database.
//
// Run: npx tsx --test tests/trip-quiver.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkTrip, heldQuiverAmmo, type TripInput } from '../src/lib/tripCheck.ts';
import { tripContent } from '../src/lib/tripContent.ts';
import { layoutBanks, tripLayout } from '../src/lib/tripLayout.ts';
import { loadoutFor } from '../src/lib/tripLoadout.ts';
import { cleanTripState, keepBankedQuiver, type TripState } from '../src/lib/tripState.ts';
import { equivalentsFor } from '../src/lib/itemFamilies.ts';
import { indexGear, type GearData } from '../src/lib/dps/summary.ts';
import type { Monster } from '../src/lib/dps/engine.ts';
import type { GearSetup, InvItem } from '../src/lib/guideTiers.ts';
import itemsJson from '../src/data/gearItems.json' with { type: 'json' };
import monstersJson from '../src/data/gearMonsters.json' with { type: 'json' };

const idx = indexGear({ items: (itemsJson as unknown as GearData).items, monsters: (monstersJson as unknown as GearData).monsters });
const id = (name: string) => {
  const it = idx.items.find((i) => i.n === name);
  assert.ok(it, `dataset has ${name}`);
  return it!.id;
};

const SEEKING_DRAGON = 33595;
const RUNE_ARROW = 892;
const QUIVER = 28951;
const DIVINE_POUCH = 27281;
const NAMES: Record<number, string> = {
  6685: 'Saradomin brew(4)', 6687: 'Saradomin brew(3)', 6689: 'Saradomin brew(2)', 3024: 'Super restore(4)', 3026: 'Super restore(3)', 3028: 'Super restore(2)',
  385: 'Shark', 13441: 'Anglerfish', 391: 'Manta ray', 23733: 'Divine ranging potion(4)', 23736: 'Divine ranging potion(3)', [DIVINE_POUCH]: 'Divine rune pouch',
  554: 'Fire rune', 565: 'Blood rune', 560: 'Death rune', 564: 'Cosmic rune', 566: 'Soul rune',
};
const nameOf = (x: number) => idx.item(x)?.n ?? NAMES[x] ?? `Item ${x}`;
const LEVELS = { attack: 99, strength: 99, defence: 99, ranged: 99, magic: 99, prayer: 99, hitpoints: 99 };
const KIT = ['Twisted bow', 'Masori mask (f)', 'Masori body (f)', 'Masori chaps (f)', 'Necklace of anguish', 'Zaryte vambraces', 'Avernic treads (max)', 'Venator ring'];
const SUPPLIES: InvItem[] = [
  { id: 6685, q: 50 }, { id: 6687, q: 20 }, { id: 6689, q: 4 }, { id: 3024, q: 40 }, { id: 3026, q: 10 }, { id: 3028, q: 3 },
  { id: 385, q: 100 }, { id: 13441, q: 100 }, { id: 391, q: 30 }, { id: 23733, q: 10 }, { id: 23736, q: 5 },
];
const QUIVER_STATE: TripState = cleanTripState({ book: 0, pray: ['rigour', 'augury'], quiver: [SEEKING_DRAGON, 2000] })!;

/** The card's own steps (pluginUi/tripView runCheck): the check, the layout, the bank filters. */
function card(over: Partial<TripInput> & { worn: InvItem[]; bank: InvItem[] }) {
  const inventory = over.inventory ?? [];
  const all = [...over.worn, ...inventory, ...over.bank].map((x) => x.id);
  const setupIds = over.setup ? [...Object.values(over.setup.gear), ...(over.setup.inventory ?? []).filter(Boolean).map((x) => x!.id)] : [];
  const needs = equivalentsFor([...all, ...setupIds], 'needs');
  const holds = equivalentsFor(all, 'holds');
  const content = over.content ?? tripContent('doom')!;
  const input: TripInput = {
    content,
    setup: null,
    source: over.setup ? 'own' : 'calc',
    monsters: content.targets.map((t) => idx.monster(t) as Monster),
    inventory,
    state: QUIVER_STATE,
    levels: LEVELS,
    idx,
    needs,
    holds,
    nameOf,
    isRunePouch: (x) => x === DIVINE_POUCH,
    ...over,
  };
  const check = checkTrip(input);
  const wide = (list: readonly InvItem[]) => {
    const raw = new Set(list.map((i) => i.id));
    const s = new Set<number>();
    for (const x of raw) for (const y of [x, ...holds(x)]) s.add(y);
    return (x: number) => s.has(x) || needs(x).some((y) => raw.has(y));
  };
  const slotOf = (x: number) => {
    const it = idx.item(x) ?? holds(x).map((y) => idx.item(y)).find(Boolean);
    return it ? (it.s === '2h' ? 'weapon' : it.s) : null;
  };
  const isSpec = (x: number) => /elder maul|dragon claws|voidwaker/i.test(nameOf(x));
  const quiverAmmo = heldQuiverAmmo(input);
  const layout = tripLayout({ setup: input.setup, rows: check.rows, worn: over.worn, inventory, bank: over.bank, state: input.state, carries: wide([...over.worn, ...inventory]), owns: wide([...over.worn, ...inventory, ...over.bank]), slotOf, nameOf, isRunePouch: input.isRunePouch, isSpec, quiverAmmo });
  const banks = layoutBanks(layout, { bank: over.bank, holds, needs, nameOf, isRunePouch: input.isRunePouch, isSpec, slotOf, isQuiver: (x) => x === QUIVER || holds(x).includes(QUIVER) });
  return { check, layout, banks };
}

test("Ahmed's Doom card: the kit banked, Seeking dragon arrows in the banked quiver; never Rune arrows, never counted apart", () => {
  const bank: InvItem[] = [...KIT.map((n) => ({ id: id(n) })), { id: QUIVER }, { id: RUNE_ARROW, q: 7915 }, { id: id('Elder maul') }, { id: id('Lightbearer') }, ...SUPPLIES];
  const { check, layout, banks } = card({ worn: [], bank });
  const gear = check.rows.find((r) => r.group === 'gear' && !r.ok)!;
  assert.ok(gear.swaps?.includes(SEEKING_DRAGON), `the quiver's arrows are picked: ${gear.swaps?.map(nameOf).join(', ')}`);
  assert.ok(!gear.swaps?.includes(RUNE_ARROW), 'never the bank Rune arrows');
  // The doll: the arrows sit in the quiver slot, taken with the quiver; the ammo slot never asks for them.
  assert.equal(layout.worn.ammo, undefined, 'no ammo slot item to take');
  assert.equal(layout.quiver?.id, SEEKING_DRAGON);
  assert.equal(layout.quiver?.q, 2000);
  assert.equal(layout.quiver?.have, 'bank', 'in the banked quiver');
  assert.equal(layout.notOwned, 0, 'nothing "not owned"');
  // "Take N" counts each distinct thing once: the kit, the quiver, the spec, Lightbearer, the potion,
  // one food and one restore (the "No food packed" / "No prayer restore packed" rows).
  const kit = KIT.length + 1; // + the quiver (cape)
  assert.equal(layout.inBank, kit + 2 + 1 + 2, `the count: ${layout.inBank}`);
  // "Show the N in my bank": exactly those N, laid out.
  assert.equal(banks.missing.ids.length, layout.inBank, banks.missing.ids.map(nameOf).join(', '));
  for (const n of KIT) assert.ok(banks.missing.ids.includes(id(n)), `${n} in the filter`);
  assert.ok(banks.missing.ids.includes(QUIVER), 'the quiver in the filter');
  assert.ok(!banks.missing.ids.includes(RUNE_ARROW));
  const supplies = banks.missing.ids.filter((x) => NAMES[x]);
  assert.deepEqual(supplies.map(nameOf).sort(), ['Anglerfish', 'Divine ranging potion(4)', 'Super restore(4)'], 'one stack a kind, the highest dose, one food');
  // The basics rows name the one stack they want, so the filter and the count agree with them.
  assert.equal(check.rows.find((r) => r.line === 'No food packed')?.bank?.length, 1);
  assert.equal(check.rows.find((r) => r.line === 'No prayer restore packed')?.bank?.length, 1);
  // "Show my setup": the whole setup, the gear on the doll.
  assert.ok(banks.setup.layout[16] === id('Twisted bow') && banks.setup.layout[8] === QUIVER, 'weapon and quiver on the doll');
});

test('the quiver worn with the arrows in it: the arrows are held (green), not a thing to take', () => {
  const worn = [...KIT.map((n) => ({ id: id(n) })), { id: QUIVER }];
  const { check, layout, banks } = card({ worn, bank: [{ id: RUNE_ARROW, q: 7915 }, ...SUPPLIES] });
  assert.ok(check.rows.filter((r) => r.group === 'gear').every((r) => r.ok), check.rows.map((r) => r.line).join(' | '));
  assert.equal(layout.quiver?.id, SEEKING_DRAGON);
  assert.equal(layout.quiver?.have, 'here');
  assert.ok(Object.values(layout.worn).every((w) => w.have === 'here'));
  assert.ok(!banks.missing.ids.some((x) => idx.item(x)), 'no gear in the filter');
});

test('a saved setup wanting Dragon arrows: the quiver holding Seeking dragon arrows serves the ammo slot', () => {
  const tbow = id('Twisted bow');
  const setup: GearSetup = { tier: 'advanced', name: 'Mine', style: 0, stats: { attack: 99, strength: 99, ranged: 99, magic: 99 }, gear: { weapon: tbow, ammo: id('Dragon arrow'), cape: QUIVER, body: id('Masori body (f)') }, inventory: [] };
  const worn = [{ id: tbow }, { id: QUIVER }, { id: id('Masori body (f)') }];
  const { check, layout } = card({ worn, bank: [{ id: RUNE_ARROW, q: 7915 }], setup, source: 'own' });
  const ammo = check.rows.find((r) => r.slot === 'ammo');
  assert.ok(ammo?.ok, check.rows.map((r) => r.line).join(' | '));
  assert.equal(ammo!.line, 'Ammo: Seeking dragon arrow in your quiver');
  assert.ok(!check.rows.some((r) => !r.ok && /arrow/i.test(r.line)), check.rows.filter((r) => !r.ok).map((r) => r.line).join(' | '));
  assert.equal(layout.worn.ammo, undefined);
  assert.equal(layout.quiver?.have, 'here', 'the quiver slot green');
  assert.equal(layout.inBank + layout.notOwned, 0);
  // The quiver banked: one row, take the quiver.
  const banked = card({ worn: [{ id: tbow }, { id: id('Masori body (f)') }], bank: [{ id: QUIVER }], setup, source: 'own' });
  const r = banked.check.rows.find((x) => x.slot === 'ammo')!;
  assert.equal(r.line, 'Seeking dragon arrow (in your quiver): take the quiver');
  assert.deepEqual(r.bank, [QUIVER]);
  assert.equal(banked.layout.notOwned, 0);
  assert.equal(banked.layout.inBank, 1, 'the quiver, its arrows with it');
});

test("the loadout engine picks the quiver's arrows over the bank's", () => {
  const bank: InvItem[] = [...KIT.map((n) => ({ id: id(n) })), { id: QUIVER }, { id: RUNE_ARROW, q: 7915 }, ...SUPPLIES];
  const holds = equivalentsFor(bank.map((x) => x.id), 'holds');
  const run = (state: TripState | null) => loadoutFor({ contentKey: 'vorkath', preset: 'experienced', idx, worn: [], inventory: [], bank, state, levels: LEVELS, raidLevel: null, nameOf, holds, isRunePouch: () => false })!;
  assert.equal(run(null).setup.gear.ammo, RUNE_ARROW, 'without the quiver read, the bank arrows');
  const withQuiver = run(QUIVER_STATE).setup;
  assert.equal(withQuiver.gear.weapon, id('Twisted bow'));
  assert.equal(withQuiver.gear.ammo, SEEKING_DRAGON, 'the quiver\'s Seeking dragon arrows, not the bank Rune arrows');
});

test('a banked quiver keeps its last ammo; worn and read empty, it is empty', () => {
  const empty = cleanTripState({ book: 0, quiver: [-1, 0] })!;
  assert.equal(empty.quiver, null);
  assert.deepEqual(keepBankedQuiver(empty, QUIVER_STATE, false).quiver, { id: SEEKING_DRAGON, q: 2000 }, 'banked: the arrows stay in it');
  assert.equal(keepBankedQuiver(empty, QUIVER_STATE, true).quiver, null, 'worn and empty: empty');
  assert.equal(keepBankedQuiver(empty, null, false).quiver, null, 'never read: unknown stays empty');
  const older = cleanTripState({ book: 0 })!;
  assert.equal(keepBankedQuiver(older, QUIVER_STATE, false).quiver, undefined, 'an older plugin sends none: untouched');
});
