// Item families (lib/itemFamilies): a kit, recolour, imbued or fortified form counts as its base for
// ownership ("Missing from your bank") and for the worn-gear match (the automatic "used it").
//
// Run: npx tsx --test tests/item-families.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { baseItem, equivalentsFor, itemFamilies, type GearEntry } from '../src/lib/itemFamilies.ts';
import { resolveSetup } from '../src/lib/gearOwnership.ts';
import { matchWornSetup } from '../src/lib/guideSetupMatch.ts';
import type { GearSetup } from '../src/lib/guideTiers.ts';

const ANCESTRAL_TOP = 21021;
const TWISTED_TOP = 24666;
const ANCESTRAL_HAT = 21018;
const TWISTED_HAT = 24664;
const ANCESTRAL_BOTTOM = 21024;
const TWISTED_BOTTOM = 24668;
const TORTURE = 19553;
const TORTURE_OR = 20366;
const BERSERKER = 6737;
const BERSERKER_I = 25264;
const DEFENDER = 12954;
const DEFENDER_T = 19722;
const MASORI_BODY = 27229;
const MASORI_BODY_F = 27238;

const setup = (gear: Record<string, number>): GearSetup => ({ tier: 'advanced', name: 'Setup', gear, style: 0, stats: { attack: 99, strength: 99, ranged: 99, magic: 99 } });
const bank = (ids: number[]) => ({ bank: { items: ids.map((id) => ({ id })), readAt: '2026-11-24T10:00:00Z' } });
const own = (s: GearSetup, held: number[]) => resolveSetup(s, bank(held), equivalentsFor([...Object.values(s.gear), ...held]));

test('twisted ancestral counts as ancestral: nothing missing', () => {
  const s = setup({ head: ANCESTRAL_HAT, body: ANCESTRAL_TOP, legs: ANCESTRAL_BOTTOM });
  const r = own(s, [TWISTED_HAT, TWISTED_TOP, TWISTED_BOTTOM]);
  assert.deepEqual(r.missing, []);
  assert.ok(r.slots.every((x) => x.kind === 'guide'));
});

test('an ornament-kitted item counts as its base, and the base as the kitted one a guide names', () => {
  assert.deepEqual(own(setup({ neck: TORTURE, shield: DEFENDER }), [TORTURE_OR, DEFENDER_T]).missing, []);
  // The guide shows the (or) version; the plain one is never something to buy.
  assert.deepEqual(own(setup({ neck: TORTURE_OR }), [TORTURE]).missing, []);
});

test('an imbued ring and a fortified body count as the base the guide asks for, and the other way round', () => {
  assert.deepEqual(own(setup({ ring: BERSERKER }), [BERSERKER_I]).missing, []);
  assert.deepEqual(own(setup({ ring: BERSERKER_I }), [BERSERKER]).missing, []);
  assert.deepEqual(own(setup({ body: MASORI_BODY }), [MASORI_BODY_F]).missing, []);
});

test('the families stay tight: different items with similar names are not joined', () => {
  // Air battlestaff is not a Battlestaff, a Magic shortbow (i) is not a Shortbow, wrapped gloves are an upgrade.
  assert.equal(equivalentsFor([1397])(1397).includes(1391), false);
  assert.equal(equivalentsFor([12788])(12788).includes(841), false);
  assert.equal(equivalentsFor([7462])(7462).includes(27112), false);
  // Without the item, it is still missing.
  assert.equal(own(setup({ body: ANCESTRAL_TOP }), [ANCESTRAL_HAT]).missing.length, 1);
});

test('the Missing list names the base item', () => {
  assert.equal(baseItem(TWISTED_TOP)?.name, 'Ancestral robe top');
  assert.equal(baseItem(TORTURE_OR)?.name, 'Amulet of torture');
  assert.equal(baseItem(ANCESTRAL_TOP)?.name, 'Ancestral robe top');
});

test('the worn-gear match uses the same families', () => {
  const s = { key: 'adv-0', gear: { head: ANCESTRAL_HAT, body: ANCESTRAL_TOP, legs: ANCESTRAL_BOTTOM, neck: TORTURE } };
  const worn = [TWISTED_HAT, TWISTED_TOP, TWISTED_BOTTOM, TORTURE_OR];
  assert.equal(matchWornSetup(worn, [s], equivalentsFor(worn)), 'adv-0');
});

test('the rule from names and bonuses alone', () => {
  const items: GearEntry[] = [
    { id: 1, n: 'Helm', s: 'head', b: [1, 1] },
    { id: 2, n: 'Gilded helm', s: 'head', b: [1, 1] }, // a recolour: same bonuses
    { id: 3, n: 'Helm (i)', s: 'head', b: [2, 1] }, // imbued: better is fine
    { id: 4, n: 'Spiked helm', s: 'head', b: [3, 1] }, // a different item: other bonuses
    { id: 5, n: 'Helm (wrapped)', s: 'head', b: [2, 2] }, // an upgrade with another tag: its own item
    { id: 6, n: 'Ruby bolts (e)', s: 'ammo', b: [0, 0] },
    { id: 7, n: 'Ruby bolts', s: 'ammo', b: [0, 0] }, // ammo is never joined
  ];
  assert.deepEqual(itemFamilies(items).map((g) => [...g].sort()), [[1, 2, 3]]);
});
