// "Your version (from what you own)": lib/yourVersion over lib/gearOwnership. PURE — the bundled gear
// data, a hand-built bank, names and prices. Run: npx tsx --test tests/your-version.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { personalSetup, resolveSetup, type Snapshot } from '../src/lib/gearOwnership.ts';
import { ownedPool, yourSupplies, yourVersion, type YourVersionCtx } from '../src/lib/yourVersion.ts';
import { isRestricted } from '../src/lib/restrictedItems.ts';
import { equivalentsFor } from '../src/lib/itemFamilies.ts';
import { setupResult } from '../src/lib/gearNow.ts';
import { indexGear, type GearData } from '../src/lib/dps/summary.ts';
import type { GearSetup, InvItem } from '../src/lib/guideTiers.ts';
import itemsJson from '../src/data/gearItems.json' with { type: 'json' };
import monstersJson from '../src/data/gearMonsters.json' with { type: 'json' };

const idx = indexGear({ items: (itemsJson as unknown as GearData).items, monsters: (monstersJson as unknown as GearData).monsters });
const id = (name: string) => {
  const it = idx.items.find((i) => i.n === name);
  assert.ok(it, `dataset has ${name}`);
  return it!.id;
};
const vorkath = idx.monster('Vorkath#Post-quest')!;

// Supplies the gear data doesn't hold: their names, as the item mapping gives them.
const SUPPLY: Record<number, string> = {
  391: 'Manta ray', 385: 'Shark', 13441: 'Anglerfish', 23733: 'Divine ranging potion(4)', 23736: 'Divine ranging potion(3)',
  2444: 'Ranging potion(4)', 2434: 'Prayer potion(4)', 3024: 'Super restore(4)', 8013: 'Teleport to house', 22209: 'Extended super antifire(4)',
  12913: 'Anti-venom+(4)', 27281: 'Divine rune pouch', 12791: 'Rune pouch', 2452: 'Antifire potion(4)',
};
const name = (i: number) => SUPPLY[i] ?? idx.item(i)?.n;
const PRICES: Record<number, number> = {};
const price = (i: number) => PRICES[i];

/** The live Vorkath guide's "Ranged · Twisted bow" Advanced setup. */
const TBOW: GearSetup = {
  tier: 'advanced',
  name: 'Ranged · Twisted bow',
  style: 1,
  stats: { attack: 99, strength: 99, ranged: 99, magic: 99 },
  prayer: 'rigour',
  boost: 'ranging',
  gear: { weapon: 20997, ammo: 11212, head: 27235, body: 27238, legs: 27241, hands: 26235, feet: 13237, cape: 28951, neck: 19547, ring: 28310 },
  alts: { cape: [22109], ring: [25260] },
  inventory: [{ id: 23733 }, { id: 22209 }, { id: 12913 }, { id: 27281 }, { id: 2434 }, { id: 2434 }, { id: 8013, q: 10 }, ...Array.from({ length: 21 }, () => ({ id: 391 }))],
} as GearSetup;

const bank = (names: (string | number)[], extra: InvItem[] = []): Snapshot => ({
  bank: { items: [...names.map((n) => ({ id: typeof n === 'number' ? n : id(n), q: 1 })), ...extra], readAt: '2026-11-26T00:00:00Z' },
});

/** An endgame bank without the guide's neck, arrows, boots or ring (or Dizana's quiver). */
const ENDGAME = bank(
  [
    'Twisted bow', 'Masori mask (f)', 'Masori body (f)', 'Masori chaps (f)', 'Zaryte vambraces', "Ava's assembler",
    'Amulet of fury', 'Amulet of torture', 'Occult necklace', 'Amethyst arrow', 'Rune arrow', 'Avernic treads',
    'Lightbearer', 'Berserker ring (i)', 'Ring of suffering (i)', 'Dragon hunter crossbow', 'Ruby dragon bolts (e)', 'Abyssal whip',
    // Restricted copies: never picked.
    'Bow of Faerdhinen (c) (deadman)',
  ],
  [{ id: 385, q: 400 }, { id: 23736, q: 30 }, { id: 3024, q: 50 }, { id: 22209, q: 10 }, { id: 12913, q: 10 }, { id: 12791, q: 1 }, { id: 8013, q: 100 }],
);

function run(setup: GearSetup, snap: Snapshot) {
  const ids = [...Object.values(setup.gear), ...Object.values(setup.alts ?? {}).flat(), ...(setup.inventory ?? []).map((x) => x!.id)].filter((x): x is number => typeof x === 'number');
  const needs = equivalentsFor(ids);
  const owned = [...(snap.bank?.items ?? [])].map((x) => x.id);
  const holds = equivalentsFor(owned, 'holds');
  const resolved = resolveSetup(setup, snap, needs);
  const ctx: YourVersionCtx = { idx, monster: vorkath, pool: ownedPool(snap, idx, holds, name), snapshot: snap, needs, name, price };
  return { before: resolved, after: yourVersion(setup, resolved, ctx) };
}

const dpsOf = (s: GearSetup) => setupResult(s, vorkath, idx)?.dps ?? 0;

test('Vorkath Twisted bow, endgame bank: every slot is theirs, nothing missing that they can fill', () => {
  const { before, after } = run(TBOW, ENDGAME);
  // Before: only the cape fell back; neck, ammo, feet and ring were empty and missing.
  assert.deepEqual(before.missing.map((s) => s.slot).sort(), ['ammo', 'feet', 'neck', 'ring']);
  assert.deepEqual(before.fallbacks.map((s) => s.slot), ['cape']);

  const pick = (slot: string) => after.slots.find((s) => s.slot === slot)!;
  assert.equal(after.missing.length, 0, 'nothing missing');
  assert.equal(pick('weapon').kind, 'guide');
  assert.equal(pick('cape').kind, 'fallback');
  assert.equal(after.gear.cape, id("Ava's assembler"));
  // Arrows for the bow: the best of theirs (Amethyst over Rune), never the crossbow's bolts.
  assert.equal(after.gear.ammo, id('Amethyst arrow'));
  assert.equal(pick('ammo').kind, 'owned');
  assert.ok((pick('ammo').delta ?? 0) < 0, 'Amethyst arrows cost a little DPS against Dragon arrows');
  // Avernic treads give more ranged than Pegasian boots: an upgrade.
  assert.equal(after.gear.feet, id('Avernic treads'));
  assert.equal(pick('feet').kind, 'upgrade');
  // A ranged neck: Amulet of fury (ranged attack) over torture (melee) and occult (magic).
  assert.equal(after.gear.neck, id('Amulet of fury'));
  // No ring of theirs adds ranged DPS: one of them stands in (the cheapest on a tie).
  assert.ok([id('Lightbearer'), id('Berserker ring (i)'), id('Ring of suffering (i)')].includes(after.gear.ring));
  // Never a shield beside the two-handed bow, and no quiver ammo without the quiver.
  assert.equal(after.gear.shield, undefined);
  assert.equal(after.quiver, null);
  // The DPS is the substituted set's: above zero, below the guide's.
  const mine = dpsOf(personalSetup(TBOW, after));
  const guide = dpsOf(TBOW);
  assert.ok(mine > 0 && mine < guide, `${mine} vs ${guide}`);
  // Before, the "your version" DPS still counted the unowned items in the missing slots; with those
  // slots empty it was lower still. Filling them from the bank beats the empty slots.
  const emptied = Object.fromEntries(Object.entries(before.gear).filter(([k]) => !before.missing.some((m) => m.slot === k)));
  assert.ok(mine > dpsOf({ ...TBOW, gear: emptied }), 'filling the empty slots raises their DPS');
});

test('Vorkath Twisted bow, endgame bank: supplies take owned stand-ins, else stay missing', () => {
  const { after } = run(TBOW, ENDGAME);
  const sup = new Map(after.supplies!.map((s) => [s.id, s]));
  assert.deepEqual(sup.get(391), { id: 391, use: 385, kind: 'swap' }, 'Sharks for Manta rays');
  assert.deepEqual(sup.get(23733), { id: 23733, use: 23736, kind: 'swap' }, 'another dose');
  assert.deepEqual(sup.get(2434), { id: 2434, use: 3024, kind: 'swap' }, 'Super restore for Prayer potion');
  assert.deepEqual(sup.get(27281), { id: 27281, use: 12791, kind: 'swap' }, 'a Rune pouch for the Divine one');
  assert.equal(sup.get(22209)!.kind, 'have');
  assert.equal(sup.get(8013)!.kind, 'have');
  assert.equal(after.missingSupplies.length, 0);
  // The setup as they'd run it carries their items.
  const inv = personalSetup(TBOW, after).inventory!.map((x) => x!.id);
  assert.ok(inv.includes(385) && !inv.includes(391));
});

test('supplies: no stand-in for a super antifire from a plain antifire; nothing owned stays missing', () => {
  const s = yourSupplies([{ id: 22209 }, { id: 391 }], bank([], [{ id: 2452, q: 5 }]), (x) => [x], name);
  assert.deepEqual(s, [
    { id: 22209, use: 22209, kind: 'missing' },
    { id: 391, use: 391, kind: 'missing' },
  ]);
});

test('a missing weapon takes their best of the same kind, with ammo it fires, and the shield it frees', () => {
  const snap = bank(['Dragon hunter crossbow', 'Ruby dragon bolts (e)', 'Amethyst arrow', 'Twisted buckler', 'Abyssal whip', 'Masori mask (f)']);
  const { after } = run(TBOW, snap);
  assert.equal(after.gear.weapon, id('Dragon hunter crossbow'), 'ranged, not the whip');
  assert.equal(after.gear.ammo, id('Ruby dragon bolts (e)'), 'bolts for a crossbow');
  assert.equal(after.gear.shield, id('Twisted buckler'), 'a one-handed weapon frees the shield');
  const w = after.slots.find((s) => s.slot === 'weapon')!;
  assert.equal(w.guide, 20997);
  assert.equal(typeof w.delta, 'number');
});

test('restricted copies never stand in', () => {
  for (const n of ["Corrupted statius's platebody (bh)", 'Abyssal dagger (bh)', 'Armadyl godsword (Deadman)', 'Crystal bow (basic)', 'Corrupted bow (perfected)', 'Castle wars bolts', 'Bow of Faerdhinen (c) (deadman)']) assert.ok(isRestricted(n), n);
  for (const n of ['Fighter torso (l)', 'Abyssal dagger', 'Twisted bow']) assert.ok(!isRestricted(n), n);
  const { after } = run(TBOW, bank(['Bow of Faerdhinen (c) (deadman)', 'Masori mask (f)']));
  assert.notEqual(after.gear.weapon, id('Bow of Faerdhinen (c) (deadman)'));
});

test('no snapshot evidence: the guide stands, nothing substituted', () => {
  const r = resolveSetup(TBOW, null, (x) => [x]);
  assert.equal(r.missing.length, 0);
  assert.deepEqual(r.gear, TBOW.gear);
});
