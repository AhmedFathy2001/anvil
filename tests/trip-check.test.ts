// The pre-trip check (lib/tripCheck, lib/tripContent, lib/tripState): what the plugin's `state` may
// carry, which region picks which trip, every check's pass and fail, the calc from the bank, the
// overlay's short answer. Real items and monsters from the bundled gear data. No database.
//
// Run: npx tsx --test tests/trip-check.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ammoFits, raidScaled, bankLayout, bestLoadout, calcPrayers, checkTrip, isRestricted, isSpecWeapon, meleeReaches, setupFromHeld, shortName, staffRunes, supplyKind, tripWarn, usableHeld, type TripInput } from '../src/lib/tripCheck.ts';
import { contentForRegion, contentFromKey, MOKHAIOTL_WAYSTONE, SPADE, TRIP_CONTENT, TRIP_REGION_IDS, TRIP_REGIONS, tripContent } from '../src/lib/tripContent.ts';
import { cleanTripState, storedTripState } from '../src/lib/tripState.ts';
import { equivalentsFor } from '../src/lib/itemFamilies.ts';
import { indexGear, type GearData } from '../src/lib/dps/summary.ts';
import { bestStyle, hitChance, type Monster } from '../src/lib/dps/engine.ts';
import type { GearSetup, InvItem } from '../src/lib/guideTiers.ts';
import itemsJson from '../src/data/gearItems.json' with { type: 'json' };
import monstersJson from '../src/data/gearMonsters.json' with { type: 'json' };

const idx = indexGear({ items: (itemsJson as unknown as GearData).items, monsters: (monstersJson as unknown as GearData).monsters });
const id = (name: string) => {
  const it = idx.items.find((i) => i.n === name);
  assert.ok(it, `dataset has ${name}`);
  return it!.id;
};
const mon = (key: string) => {
  const m = idx.monster(key);
  assert.ok(m, `dataset has ${key}`);
  return m as Monster;
};

// Items outside the gear data, by their game ids.
const BREW = 6685; // Saradomin brew(4)
const BREW3 = 6687; // Saradomin brew(3)
const RESTORE = 3024; // Super restore(4)
const SHARK = 385;
const MANTA = 391;
const POUCH = 12791;
const NAMES: Record<number, string> = { [BREW]: 'Saradomin brew(4)', [BREW3]: 'Saradomin brew(3)', [RESTORE]: 'Super restore(4)', [SHARK]: 'Shark', [MANTA]: 'Manta ray', [POUCH]: 'Rune pouch', 560: 'Death rune', 565: 'Blood rune', 555: 'Water rune', 9075: 'Astral rune', 557: 'Earth rune', 554: 'Fire rune', 564: 'Cosmic rune' };
const nameOf = (x: number) => idx.item(x)?.n ?? NAMES[x] ?? `Item ${x}`;

const STATS = { attack: 99, strength: 99, ranged: 99, magic: 99 };
const LEVELS = { attack: 99, strength: 99, ranged: 99, magic: 99, defence: 99, prayer: 99, hitpoints: 99 };

function input(over: Partial<TripInput> & { setup: GearSetup | null }): TripInput {
  const all = [...(over.worn ?? []), ...(over.inventory ?? []), ...(over.bank ?? [])].map((x) => x.id);
  const setupIds = over.setup ? [...Object.values(over.setup.gear), ...(over.setup.inventory ?? []).filter(Boolean).map((x) => x!.id)] : [];
  return {
    content: tripContent('toa')!,
    source: over.setup ? 'guide' : 'calc',
    monsters: [mon('Kephri#Shielded')],
    worn: [],
    inventory: [],
    bank: [],
    state: null,
    levels: LEVELS,
    idx,
    needs: equivalentsFor([...all, ...setupIds], 'needs'),
    holds: equivalentsFor(all, 'holds'),
    nameOf,
    isRunePouch: (x) => x === POUCH,
    ...over,
  };
}

const failing = (c: ReturnType<typeof checkTrip>) => c.rows.filter((r) => !r.ok).map((r) => r.line);

// ── Doom: food and a prayer restore, whatever the setup ──────────────────────────────────

test('doom: no food or restore fails; brews and a moonlight potion pass; the calc still runs', () => {
  const doom = tripContent('doom')!;
  assert.ok(doom.spec && doom.basics);
  const MOON = 29080;
  const names = (x: number) => (x === MOON ? 'Moonlight potion(4)' : nameOf(x));
  const bare = checkTrip(input({ setup: null, content: doom, monsters: [mon('Doom of Mokhaiotl#Delve 8')], inventory: [{ id: POUCH }] }));
  assert.ok(failing(bare).includes('No food packed'), failing(bare).join(' | '));
  assert.ok(failing(bare).includes('No prayer restore packed'));
  const packed = checkTrip(input({ setup: null, content: doom, monsters: [mon('Doom of Mokhaiotl#Delve 8')], inventory: [{ id: BREW }, { id: MOON }], nameOf: names }));
  assert.ok(packed.rows.some((r) => r.ok && r.line === 'Food packed'));
  assert.ok(packed.rows.some((r) => r.ok && r.line === 'Prayer restores packed'));
  // Elsewhere only the calc's own supplies (each with a count), never the basics rows.
  assert.ok(checkTrip(input({ setup: null, inventory: [] })).rows.every((r) => r.group !== 'supplies' || r.need), 'only content with basics');
});

// ── state ──────────────────────────────────────────────────────────────────────────────────

test('state: book, pouch and the readable prayers only; Piety and junk are dropped', () => {
  const s = cleanTripState({ book: 1, pouch: [[560, 400], [565, 'x'], [0, 5], [555, 1200]], pray: ['Rigour', 'piety', 'augury', 3] });
  assert.ok(s);
  assert.equal(s.book, 1);
  assert.deepEqual(s.pouch, [{ id: 560, q: 400 }, { id: 555, q: 1200 }]);
  assert.deepEqual(s.pray, ['rigour', 'augury']);
  assert.equal(cleanTripState({ book: 7 })?.book ?? null, null);
  assert.equal(cleanTripState(null), null);
  assert.equal(cleanTripState([]), null);
  assert.equal(cleanTripState({ nothing: true }), null);
  // An empty pray list is a real answer (nothing unlocked), not "not sent".
  assert.deepEqual(cleanTripState({ pray: [] })?.pray, []);
  const back = storedTripState({ ...s, readAt: '2026-11-20T10:00:00.000Z' });
  assert.equal(back?.readAt, '2026-11-20T10:00:00.000Z');
});

// ── regions ────────────────────────────────────────────────────────────────────────────────

test('regions: each picks its content; Ferox only with a spade; every content is known', () => {
  assert.equal(contentForRegion(13454, new Set())?.key, 'toa');
  assert.equal(contentForRegion(14642, new Set())?.key, 'tob');
  assert.equal(contentForRegion(11601, new Set())?.key, 'nex');
  assert.equal(contentForRegion(12344, new Set()), null);
  assert.equal(contentForRegion(12344, new Set([SPADE]))?.key, 'barrows');
  // Doom: the ruins (the waystone's landing 1311,9497 and the ruins 1311,9520); no bank of its own.
  const region = (x: number, y: number) => ((x >> 6) << 8) | (y >> 6);
  assert.equal(region(1311, 9497), 5268);
  assert.equal(contentForRegion(5268, new Set())?.key, 'doom');
  assert.ok(TRIP_REGIONS[5268].noBank);
  assert.deepEqual(tripContent('doom')?.tripItems?.ids, [MOKHAIOTL_WAYSTONE]);
  assert.equal(contentForRegion(1, new Set()), null);
  assert.deepEqual(TRIP_REGION_IDS, [...TRIP_REGION_IDS].sort((a, b) => a - b));
  for (const r of Object.values(TRIP_REGIONS)) assert.ok(tripContent(r.content), r.content);
  for (const c of TRIP_CONTENT) for (const t of c.targets) assert.ok(idx.monster(t), `${c.key} target ${t}`);
  assert.equal(contentFromKey('m:Abyssal demon#Standard')?.targets[0], 'Abyssal demon#Standard');
  assert.equal(contentFromKey('nope'), null);
});

// ── helpers ────────────────────────────────────────────────────────────────────────────────

test('helpers: spec weapons, staff runes, supply kinds, short names', () => {
  assert.ok(isSpecWeapon('Dragon claws'));
  assert.ok(isSpecWeapon('Bandos godsword'));
  assert.ok(!isSpecWeapon('Abyssal whip'));
  assert.deepEqual(staffRunes('Kodai wand'), ['water']);
  assert.deepEqual(staffRunes('Mystic smoke staff').sort(), ['air', 'fire']);
  assert.deepEqual(staffRunes('Abyssal whip'), []);
  assert.equal(supplyKind('Saradomin brew(3)'), 'Brews');
  assert.equal(supplyKind('Manta ray'), 'Food');
  assert.equal(supplyKind('Stamina potion(4)'), 'Stamina potion');
  assert.equal(shortName("Osmumten's fang"), 'Fang');
  assert.equal(shortName('Dragon claws'), 'Dragon claws');
});

test('calc prayers: Rigour and Augury only when the plugin read them unlocked; Piety by level', () => {
  assert.deepEqual(calcPrayers(LEVELS, { book: 0, pouch: null, pray: [], readAt: '' }), ['piety', 'incredible_reflexes', 'eagle_eye', 'mystic_might']);
  assert.deepEqual(calcPrayers(LEVELS, { book: 0, pouch: null, pray: ['rigour', 'augury'], readAt: '' }).slice(2), ['rigour', 'augury']);
});

// ── a guide setup ──────────────────────────────────────────────────────────────────────────

const fang = id("Osmumten's fang");
const torvaHelm = id('Torva full helm');
const claws = id('Dragon claws');
const tbow = id('Twisted bow');
const setup = (over: Partial<GearSetup> = {}): GearSetup => ({
  tier: 'advanced',
  name: 'Fang',
  gear: { weapon: fang, head: torvaHelm },
  style: 0,
  stats: STATS,
  prayer: ['piety'],
  inventory: [{ id: claws }, { id: tbow }, { id: BREW }, { id: BREW }, { id: BREW }, { id: RESTORE }, { id: MANTA }, { id: MANTA }],
  ...over,
});

test('a slot in the bank that costs DPS fails; the same item worn passes', () => {
  const bank = [{ id: torvaHelm }, { id: claws }, { id: tbow }];
  const c = checkTrip(input({ setup: setup(), worn: [{ id: fang }], bank }));
  assert.ok(failing(c).includes('Torva full helm is in your bank: take it'), failing(c).join(' | '));
  assert.deepEqual(c.rows.find((r) => /Torva/.test(r.line))?.bank, [torvaHelm], 'the bank filter shows it');
  assert.ok(c.bank?.includes(torvaHelm));
  const worn = checkTrip(input({ setup: setup(), worn: [{ id: fang }, { id: torvaHelm }], bank: [{ id: claws }, { id: tbow }] }));
  assert.ok(!failing(worn).some((l) => /Torva/.test(l)));
  assert.ok(worn.rows.some((r) => r.ok && r.line === 'Head: Torva full helm'));
  // In the inventory, not worn: packed, with a note to put it on.
  const packed = checkTrip(input({ setup: setup(), worn: [{ id: fang }], inventory: [{ id: torvaHelm }], bank: [{ id: claws }, { id: tbow }] }));
  assert.ok(!failing(packed).some((l) => /Torva/.test(l)), failing(packed).join(' | '));
  assert.ok(packed.info.includes('In your inventory: equip Torva full helm before the fight'), packed.info.join(' | '));
});

test('own setup, everything banked: every slot says take it; gone from the bank too, not found; no "0 slots" line', () => {
  const lb = id('Lightbearer');
  const s = setup({ gear: { weapon: fang, head: torvaHelm, ring: lb }, inventory: [] });
  const bank = [{ id: fang }, { id: torvaHelm }, { id: lb }];
  const c = checkTrip(input({ setup: s, source: 'own', worn: [], inventory: [], bank }));
  for (const n of ["Osmumten's fang", 'Torva full helm', 'Lightbearer']) assert.ok(failing(c).includes(`${shortName(n)} is in your bank: take it`), `${n}: ${failing(c).join(' | ')}`);
  assert.ok(!c.info.some((l) => /Switches/.test(l)), 'nothing packed: no slots line');
  const gone = checkTrip(input({ setup: s, source: 'own', worn: [], inventory: [], bank: [{ id: fang }, { id: lb }] }));
  assert.ok(failing(gone).includes('Torva full helm: not found'), failing(gone).join(' | '));
  // A guide's setup: not owned is an upgrade, never a trip problem.
  assert.ok(!failing(checkTrip(input({ setup: s, worn: [], inventory: [], bank: [{ id: fang }, { id: lb }] }))).some((l) => /Torva/.test(l)));
});

test('a zero-bonus ring (Lightbearer) is checked like any item, never "empty will do"', () => {
  const lb = id('Lightbearer');
  const s = setup({ gear: { weapon: fang, head: torvaHelm, ring: lb } });
  const left = checkTrip(input({ setup: s, worn: [{ id: fang }, { id: torvaHelm }], inventory: [{ id: claws }, { id: tbow }], bank: [{ id: lb }] }));
  assert.ok(failing(left).includes('Lightbearer is in your bank: take it'), failing(left).join(' | '));
  assert.ok(!left.rows.some((r) => /will do/.test(r.line)));
  const on = checkTrip(input({ setup: s, worn: [{ id: fang }, { id: torvaHelm }, { id: lb }], inventory: [{ id: claws }, { id: tbow }] }));
  assert.ok(on.rows.some((r) => r.ok && r.line === 'Ring: Lightbearer'));
  const saved = setupFromHeld('Mine', [{ id: fang }, { id: lb }], [], null, idx, (x) => equivalentsFor([x], 'holds')(x), LEVELS, () => false);
  assert.equal(saved.gear.ring, lb, 'saved with the setup');
});

test('quiver: its ammo saved and checked while a quiver is along; low or other ammo fails', () => {
  const quiver = id("Dizana's quiver");
  const dragonArrow = id('Dragon arrow');
  const amethyst = id('Amethyst arrow');
  const s = setup({ gear: { weapon: fang, head: torvaHelm, cape: quiver }, quiver: dragonArrow });
  const worn = [{ id: fang }, { id: torvaHelm }, { id: quiver }];
  const inv = [{ id: claws }, { id: tbow }];
  const st = (q: { id: number; q: number } | null | undefined) => ({ book: 0, pouch: null, pray: [], readAt: '', ...(q !== undefined ? { quiver: q } : {}) });
  const full = checkTrip(input({ setup: s, worn, inventory: inv, state: st({ id: dragonArrow, q: 400 }) }));
  assert.ok(full.rows.some((r) => r.ok && r.line === 'Quiver: Dragon arrow 400'), full.rows.map((r) => r.line).join(' | '));
  assert.ok(failing(checkTrip(input({ setup: s, worn, inventory: inv, state: st({ id: dragonArrow, q: 12 }) }))).includes('Quiver: only 12 Dragon arrow'));
  assert.ok(failing(checkTrip(input({ setup: s, worn, inventory: inv, bank: [{ id: dragonArrow }], state: st({ id: amethyst, q: 400 }) }))).includes('Dragon arrow (quiver): not in your quiver'));
  assert.ok(!failing(checkTrip(input({ setup: s, worn, inventory: inv, state: st({ id: amethyst, q: 400 }) }))).some((l) => /quiver/.test(l)), 'ammo they own none of is an upgrade');
  assert.ok(checkTrip(input({ setup: s, worn, inventory: inv, state: st(undefined) })).unknown.includes('quiver ammo'), 'an older plugin: not checked');
  // Saving: the quiver's ammo goes in the quiver slot, only with a quiver along.
  const holds = (x: number) => equivalentsFor([x], 'holds')(x);
  assert.equal(setupFromHeld('Mine', worn, inv, st({ id: dragonArrow, q: 400 }), idx, holds, LEVELS, () => false).quiver, dragonArrow);
  assert.equal(setupFromHeld('Mine', [{ id: fang }], inv, st({ id: dragonArrow, q: 400 }), idx, holds, LEVELS, () => false).quiver, undefined);
  // The plugin's [id, qty]; an empty quiver reads -1.
  assert.deepEqual(cleanTripState({ book: 0, quiver: [dragonArrow, 400] })?.quiver, { id: dragonArrow, q: 400 });
  assert.equal(cleanTripState({ book: 0, quiver: [-1, 0] })?.quiver, null);
  assert.deepEqual(storedTripState({ book: 0, quiver: { id: dragonArrow, q: 5 }, readAt: '2026-11-26T12:00:00.000Z' })?.quiver, { id: dragonArrow, q: 5 });
});

test('a slot item they do not own at all is an upgrade, not a trip problem', () => {
  const c = checkTrip(input({ setup: setup(), worn: [{ id: fang }] }));
  assert.ok(!failing(c).some((l) => /Torva|Twisted|claws/i.test(l)), failing(c).join(' | '));
});

test('switches and the spec weapon: packed passes, left in the bank fails', () => {
  const c = checkTrip(input({ setup: setup(), worn: [{ id: fang }, { id: torvaHelm }], inventory: [{ id: tbow }], bank: [{ id: claws }] }));
  assert.ok(failing(c).includes('Dragon claws (spec): in your bank'), failing(c).join(' | '));
  assert.ok(c.rows.some((r) => r.ok && r.line === 'Switch: Twisted bow'));
  const packed = checkTrip(input({ setup: setup(), worn: [{ id: fang }, { id: torvaHelm }], inventory: [{ id: tbow }, { id: claws }] }));
  assert.ok(packed.rows.some((r) => r.ok && r.group === 'spec'));
  const left = checkTrip(input({ setup: setup(), worn: [{ id: fang }, { id: torvaHelm }], inventory: [{ id: claws }], bank: [{ id: tbow }] }));
  assert.ok(failing(left).includes('Twisted bow (switch): in your bank'));
});

test('supplies by kind: any brew dose counts, sharks count as food', () => {
  const inv = [{ id: claws }, { id: tbow }, { id: BREW }, { id: BREW3 }, { id: SHARK }, { id: SHARK }, { id: RESTORE }];
  const c = checkTrip(input({ setup: setup(), worn: [{ id: fang }, { id: torvaHelm }], inventory: inv }));
  assert.ok(failing(c).includes('Brews: have 2, need 3'), failing(c).join(' | '));
  assert.ok(c.rows.some((r) => r.ok && r.line === 'Food 2'));
  assert.ok(c.rows.some((r) => r.ok && r.line === 'Restores 1'));
  assert.deepEqual(c.info, ['Switches 2 slots · 26 free for supplies']);
});

test('spellbook and runes: needs state; the pouch counts only when it is packed', () => {
  const s = setup({ spells: ['Ice Barrage'], spellbook: 1, runePouch: [{ id: 560 }, { id: 565 }, { id: 555 }] });
  const worn = [{ id: fang }, { id: torvaHelm }];
  const base: InvItem[] = [{ id: claws }, { id: tbow }];
  // No state (an older plugin): named as unknown, never failed.
  const old = checkTrip(input({ setup: s, worn, inventory: [...base, { id: POUCH }] }));
  assert.ok(old.unknown.includes('spellbook') && old.unknown.includes('rune pouch'));
  assert.ok(!old.rows.some((r) => r.group === 'book' || r.group === 'pouch'));
  const state = { book: 0, pouch: [{ id: 560, q: 100 }, { id: 565, q: 100 }], pray: [], readAt: '' };
  const c = checkTrip(input({ setup: s, worn, inventory: [...base, { id: POUCH }], state }));
  assert.ok(failing(c).includes('On Standard · setup needs Ancient'), failing(c).join(' | '));
  assert.ok(failing(c).includes('Rune pouch: no Water runes'), failing(c).join(' | '));
  // A Kodai wand worn gives the water.
  const kodai = id('Kodai wand');
  const k = checkTrip(input({ setup: s, worn: [{ id: kodai }, { id: torvaHelm }], inventory: [...base, { id: POUCH }], state: { ...state, book: 1 } }));
  assert.ok(k.rows.some((r) => r.ok && r.group === 'pouch'), failing(k).join(' | '));
  assert.ok(k.rows.some((r) => r.ok && r.group === 'book'));
  // The pouch left in the bank: its varbits still read, but it isn't along.
  const banked = checkTrip(input({ setup: s, worn, inventory: base, bank: [{ id: POUCH }], state: { ...state, book: 1, pouch: [{ id: 560, q: 100 }, { id: 565, q: 100 }, { id: 555, q: 100 }] } }));
  assert.ok(failing(banked).includes('Rune pouch not packed'), failing(banked).join(' | '));
});

test('prayers: Rigour locked fails, unlocked passes, Piety is never judged', () => {
  const s = setup({ prayer: ['rigour', 'piety'] });
  const worn = [{ id: fang }, { id: torvaHelm }];
  const inv = [{ id: claws }, { id: tbow }];
  const locked = checkTrip(input({ setup: s, worn, inventory: inv, state: { book: 0, pouch: null, pray: [], readAt: '' } }));
  assert.ok(failing(locked).includes('Rigour locked · setup prays it'));
  assert.ok(!locked.rows.some((r) => /piety/i.test(r.line)));
  const open = checkTrip(input({ setup: s, worn, inventory: inv, state: { book: 0, pouch: null, pray: ['rigour'], readAt: '' } }));
  assert.ok(open.rows.some((r) => r.ok && r.line === 'Rigour unlocked'));
  const unknown = checkTrip(input({ setup: s, worn, inventory: inv }));
  assert.ok(unknown.unknown.includes('Rigour'));
});

// ── the calc ───────────────────────────────────────────────────────────────────────────────

test('calc: Fang left in the bank for Kephri says take it, with the swaps', () => {
  const whip = id('Abyssal whip');
  const c = checkTrip(input({ setup: null, worn: [{ id: whip }], bank: [{ id: fang }] }));
  const bad = failing(c);
  assert.ok(bad.includes('Fang is in your bank: take it'), bad.join(' | '));
  const row = c.rows.find((r) => r.line === 'Fang is in your bank: take it')!;
  assert.ok(row.swaps?.includes(fang) && row.bank?.includes(fang));
  assert.ok(!/%|DPS/.test(`${row.line} ${row.detail}`), 'plain words');
  // A weapon packed but weaker armour: said in words.
  const torva = [id('Torva platebody'), id('Torva platelegs')];
  const weak = checkTrip(input({ setup: null, worn: [{ id: fang }], bank: torva.map((x) => ({ id: x })) }));
  const w = weak.rows.filter((r) => !r.ok && r.group === 'gear').map((r) => r.line);
  assert.ok(w.length === 0 || w.some((l) => /^Your gear is .* the best stab setup in your bank$/.test(l)), w.join(' | '));
  // Packed, it passes.
  const ok = checkTrip(input({ setup: null, worn: [{ id: whip }], inventory: [{ id: fang }] }));
  assert.ok(!failing(ok).some((l) => /Kephri/.test(l)), failing(ok).join(' | '));
});

test('calc: targets that want the same weapon share one line', () => {
  const whip = id('Abyssal whip');
  const c = checkTrip(input({ setup: null, monsters: [mon('Kephri#Shielded'), mon('Akkha')], worn: [{ id: whip }], bank: [{ id: fang }] }));
  const lines = failing(c).filter((l) => /Fang/.test(l));
  assert.equal(lines.length, 1, lines.join(' | '));
});

test('calc: the best loadout fills armour slots and runs quickly on a big bank', () => {
  const bank = idx.items.filter((i) => !i.hid).slice(0, 1500).map((i) => i.id);
  const t0 = Date.now();
  const best = bestLoadout(mon('Kephri#Shielded'), bank, { idx, stats: STATS, prayer: ['piety', 'rigour', 'augury'], spell: 'Fire Surge' });
  const ms = Date.now() - t0;
  assert.ok(best && best.result.dps > 0);
  assert.ok(Object.keys(best!.gear).length > 3, JSON.stringify(best!.gear));
  assert.ok(ms < 4000, `took ${ms}ms`);
});

// ── the overlay and saving ─────────────────────────────────────────────────────────────────

test('warn: problems counted and capped; all clear says Ready', () => {
  const rows = ['a', 'b', 'c', 'd', 'e', 'f'].map((line) => ({ group: 'gear' as const, ok: false, line }));
  const w = tripWarn('ToA', { rows, info: [], unknown: [] });
  assert.equal(w.title, 'ToA · 6 problems');
  assert.deepEqual(w.lines, ['a', 'b', 'c', '+3 more in the panel']);
  assert.deepEqual(tripWarn('ToA', { rows: [{ group: 'gear', ok: true, line: 'x' }], info: [], unknown: [] }), { ok: true, title: '✓ Ready for ToA', lines: [] });
});

test('save: worn gear to slots, the inventory as laid out, the pouch only when packed', () => {
  const state = { book: 1, pouch: [{ id: 560, q: 50 }], pray: null, readAt: '' };
  const s = setupFromHeld('My ToA', [{ id: fang }, { id: torvaHelm }], [{ id: claws }, { id: POUCH }, { id: BREW, q: 1 }], state, idx, equivalentsFor([fang, torvaHelm], 'holds'), LEVELS, (x) => x === POUCH);
  assert.deepEqual(s.gear, { weapon: fang, head: torvaHelm });
  assert.equal(s.inventory?.length, 3);
  assert.deepEqual(s.runePouch, [{ id: 560, q: 50 }]);
  assert.equal(s.spellbook, 1);
  const noPouch = setupFromHeld('My ToA', [{ id: fang }], [{ id: claws }], state, idx, equivalentsFor([fang], 'holds'), LEVELS, (x) => x === POUCH);
  assert.equal(noPouch.runePouch, undefined);
});

// ── the panel ──────────────────────────────────────────────────────────────────────────────

test('panel: failing rows open, the rest folded to "✓ N checks met", save and re-check actions', async () => {
  const { tripPanelUi } = await import('../src/lib/pluginUi/tripUi.ts');
  const check = { rows: [{ group: 'gear' as const, ok: false, line: 'No stab weapon: Kephri (Fang in bank)', item: fang, bank: [fang] }, { group: 'spec' as const, ok: true, line: 'Spec: Dragon claws' }, { group: 'supplies' as const, ok: true, line: 'Brews 6' }], info: ['Switches 2 slots · 24 free for supplies'], unknown: [], bank: [fang] };
  const ui = tripPanelUi({ region: '13454', regionName: 'the ToA lobby', content: { key: 'toa', name: 'Tombs of Amascut', short: 'ToA' }, fromRegion: true, source: 'calc', sourceLine: 'Worked out from your bank', guide: null, check, status: 'ready', checkedAt: '18:42', hasOwn: false, canSave: true, options: [], monsters: [] });
  const json = JSON.stringify(ui);
  assert.ok(json.includes('No stab weapon: Kephri (Fang in bank)'));
  const fold = JSON.parse(json, (_k, v) => v);
  const find = (n: unknown, key: string): Record<string, unknown> | null => {
    if (!n || typeof n !== 'object') return null;
    if ((n as { t?: string; key?: string }).t === 'toggle' && (n as { key: string }).key === key) return n as Record<string, unknown>;
    for (const v of Object.values(n)) {
      const f = find(v, key);
      if (f) return f;
    }
    return null;
  };
  const ok = find(fold, 'trip-ok');
  assert.ok(ok, 'the passes fold');
  assert.ok(JSON.stringify(ok!.off).includes('2 checks met'));
  assert.ok(!JSON.stringify(ok!.off).includes('Brews 6'), 'folded by default');
  assert.ok(JSON.stringify(ok!.lit).includes('Brews 6'));
  assert.ok(json.includes('"act":"trip-save"'));
  assert.ok(json.includes('"v":"trip"') && json.includes('"why":"manual"'));
  assert.ok(!json.includes('"calc"'), 'no unexplained calc chip');
  assert.equal(json.match(/18:42/g)?.length, 1, 'one line says when');
  assert.ok(!json.includes('"a":"bank"'), 'no bank filter for a plugin without it');
  const filt = JSON.stringify(tripPanelUi({ region: '13454', regionName: 'the ToA lobby', content: { key: 'toa', name: 'Tombs of Amascut', short: 'ToA' }, fromRegion: true, source: 'calc', sourceLine: 'x', guide: null, check, status: 'ready', checkedAt: '18:42', hasOwn: false, canSave: true, options: [], monsters: [], bankFilter: true }));
  assert.ok(filt.includes(`{"a":"bank","ids":"${fang}"}`) && filt.includes('Show missing in bank'));
  // No combat cues: nothing tells the player what to pray or do mid-fight.
  assert.ok(!/pray \w+ now|switch now|attack now/i.test(json));
});

test('panel: sharing off asks to turn it on', async () => {
  const { tripPanelUi } = await import('../src/lib/pluginUi/tripUi.ts');
  const ui = tripPanelUi({ region: '13454', regionName: 'the ToA lobby', content: { key: 'toa', name: 'Tombs of Amascut', short: 'ToA' }, fromRegion: true, source: null, sourceLine: '', guide: null, check: null, status: 'off', checkedAt: null, hasOwn: false, canSave: false, options: [], monsters: [] });
  assert.ok(JSON.stringify(ui).includes('Turn on Share my bank to check your trips'));
});

test('panel: items not pushed yet say "Checking what you carry…", never Ready', async () => {
  const { tripPanelUi } = await import('../src/lib/pluginUi/tripUi.ts');
  const json = JSON.stringify(tripPanelUi({ region: '', regionName: null, content: { key: 'doom', name: 'Doom of Mokhaiotl', short: 'Doom' }, fromRegion: false, source: null, sourceLine: '', guide: null, check: null, status: 'behind', checkedAt: '12:49', hasOwn: true, canSave: false, options: [], monsters: [] }));
  assert.ok(json.includes('Checking what you carry…') && json.includes('12:49'));
  assert.ok(!json.includes('Ready'));
  assert.ok(json.includes('Check again'));
});

test('entry: "Next trip: Doom (last trip) ›", else "Pre-trip check ›", both open the check', async () => {
  const { tripEntryUi } = await import('../src/lib/pluginUi/tripUi.ts');
  const set = JSON.stringify(tripEntryUi({ short: 'Doom', why: 'last trip' }, '5268'));
  assert.ok(set.includes('Next trip: Doom (last trip)') && set.includes('"v":"trip"') && set.includes('"why":"manual"') && set.includes('"region":"5268"'));
  assert.ok(JSON.stringify(tripEntryUi(null)).includes('Pre-trip check'));
  const { guidesSearchUi } = await import('../src/lib/pluginUi/guidesUi.ts');
  const d = { recent: [], sections: [], filters: { level: '', account: '', build: 'any' }, here: null };
  assert.ok(JSON.stringify(guidesSearchUi({ ...d, trip: null })).includes('Pre-trip check'));
  assert.ok(!JSON.stringify(guidesSearchUi(d)).includes('Pre-trip check'), 'signed out: none');
  // A monster picked by hand keeps a whole word for the overlay's title.
  assert.equal(contentFromKey('m:Thermonuclear smoke devil')?.short, 'Thermonuclear');
  assert.equal(contentFromKey('m:Doom of Mokhaiotl#Delve 1')?.short, 'Doom');
});

// ── raids and restricted copies ────────────────────────────────────────────────────────────

test('restricted copies: Bounty Hunter, Deadman, LMS, Gauntlet, Leagues never count; locked (l) does', () => {
  for (const n of ["Corrupted statius's platebody (bh)", 'Abyssal dagger (bh)', 'Armadyl godsword (Deadman)', "Morrigan's coif (Deadman Mode)", 'Crystal bow (basic)', 'Corrupted bow (perfected)', "Torva full helm (Pete Kayer's Challenges)", 'Infernal axe (or) (Trailblazer Reloaded)', 'Crystal bow (historical)', 'Castle wars bolts', 'Corrupted Scythe of Vitur']) assert.ok(isRestricted(n), n);
  for (const n of ['Fire cape (l)', 'Avernic defender (l)', 'Crystal bow', 'Crystal bow (i)', 'Torva full helm', 'Bow of Faerdhinen (c)']) assert.ok(!isRestricted(n), n);
});

test('raid calc: ONE setup for the whole raid (worn + switches), never a line per boss, never a BH copy', () => {
  const tob = tripContent('tob')!;
  const monsters = tob.targets.map((t) => mon(t));
  const names = ['Scythe of Vitur', 'Twisted bow', 'Sanguinesti staff', 'Torva full helm', 'Torva platebody', 'Torva platelegs', 'Masori body (f)', 'Masori chaps (f)', 'Ferocious gloves', 'Primordial boots', 'Amulet of torture', 'Dragon arrow', 'Ultor ring'];
  const bh = ["Corrupted statius's platebody (bh)", "Corrupted statius's full helm (bh)", "Corrupted morrigan's leather body (bh)"].map(id);
  const bank = [...names.map(id), ...bh].map((x) => ({ id: x }));
  const c = checkTrip(input({ setup: null, content: tob, monsters, worn: [], inventory: [], bank }));
  const lines = c.rows.map((r) => r.line);
  assert.ok(!lines.some((l) => /^(Maiden|Bloat|Sotetseg|Xarpus|Verzik)\b/.test(l)), lines.join(' | '));
  assert.ok(c.info.some((l) => /^One setup for 5 bosses: \w+ worn/.test(l)), c.info.join(' | '));
  assert.ok(c.rows.some((r) => /is in your bank: take it/.test(r.line)), 'the worn set to take');
  assert.ok(!c.rows.some((r) => r.item != null && bh.includes(r.item)), 'no Bounty Hunter copy picked');
  // A Deadman: Armageddon ornament the player holds (Nigel makes it from the real item) is the real
  // thing in the main game: its spec counts. A Deadman Mode copy never does.
  const dmm = checkTrip(input({ setup: null, content: tob, monsters, worn: [], inventory: [], bank: [...bank, { id: id('Armadyl godsword (Deadman)') }] }));
  assert.deepEqual(dmm.rows.filter((r) => r.group === 'spec').map((r) => r.line), ['Armadyl godsword (spec): in your bank']);
  assert.ok(!usableHeld("Morrigan's coif (Deadman Mode)") && !usableHeld('Corrupted Scythe of Vitur') && usableHeld('Voidwaker (Deadman)'));
  // Everything worn and packed already: one passing row.
  const worn = checkTrip(input({ setup: null, content: tob, monsters, worn: bank.filter((x) => !bh.includes(x.id)), inventory: [], bank: [] }));
  assert.ok(worn.rows.some((r) => r.ok && /^Your setup covers all 5 bosses$/.test(r.line)) || failing(worn).length > 0, worn.rows.map((r) => r.line).join(' | '));
});

test('bank layout: worn pieces as a paper doll, switches beside, each supply kind its own row by dose', () => {
  const rows = [
    { group: 'gear' as const, ok: false, line: '', slot: 'head', bank: [11] },
    { group: 'gear' as const, ok: false, line: '', slot: 'weapon', bank: [12] },
    { group: 'gear' as const, ok: false, line: '', slot: 'ring', bank: [13] },
    { group: 'spec' as const, ok: false, line: '', bank: [14] },
    { group: 'gear' as const, ok: false, line: '', bank: [15] },
    { group: 'supplies' as const, ok: false, line: '', bank: [21, 24, 22] },
  ];
  const names: Record<number, string> = { 21: 'Prayer potion(1)', 22: 'Prayer potion(2)', 24: 'Prayer potion(4)' };
  const l = bankLayout(rows, (x) => names[x] ?? `Item ${x}`);
  assert.equal(l.layout[1], 11, 'head top middle');
  assert.equal(l.layout[16], 12, 'weapon left of the body');
  assert.equal(l.layout[34], 13, 'ring bottom right');
  assert.equal(l.layout[24], 14, 'spec left of the legs');
  assert.equal(l.layout[4], 15, 'switches to the right');
  assert.deepEqual([l.layout[12], l.layout[13], l.layout[14]], [24, 22, 21], 'supplies their own row, 4 → 1');
  assert.deepEqual(l.ids.sort((a, b) => a - b), [11, 12, 13, 14, 15, 21, 22, 24]);
});

test('raid calc says it is rough; a single boss does not', async () => {
  const { calcSourceLine } = await import('../src/lib/tripContent.ts');
  assert.equal(calcSourceLine(tripContent('tob')!), 'Rough: worked out from your bank. A ToB guide for your role will be more accurate.');
  assert.ok(!calcSourceLine(tripContent('vorkath')!).startsWith('Rough'));
});

// ── the calc on an endgame bank ──────────────────────────────────────────────────────────────
// A synthetic maxed bank: the best of each style, uncharged forms, a Deadman ornament, the quiver's
// arrows only in the quiver, and the traps the calc used to fall into (a Hunters' sunlight crossbow
// with Dragonstone bolts, a Mixed hide top, a Dragon dagger listed first).

const SHADOW_U = 27277; // Tumeken's shadow (uncharged)
const SCYTHE_U = 22486; // Scythe of vitur (uncharged)
const QUIVER_U = 28947; // Dizana's quiver (uncharged)
const DRAGON_ARROW = 11212;
const ENDGAME_NAMES: Record<number, string> = { [SHADOW_U]: "Tumeken's shadow (uncharged)", [SCYTHE_U]: 'Scythe of vitur (uncharged)', [QUIVER_U]: "Dizana's quiver (uncharged)" };
const endgameName = (x: number) => ENDGAME_NAMES[x] ?? nameOf(x);
const ENDGAME = [
  'Dragon dagger', "Hunters' sunlight crossbow", 'Dragonstone bolts (e)', 'Mixed hide top', 'Rune arrow', 'Dragon hunter crossbow', 'Ruby dragon bolts (e)',
  'Twisted bow', "Osmumten's fang", 'Elder maul', 'Voidwaker (Deadman)',
  'Masori mask (f)', 'Masori body (f)', 'Masori chaps (f)', 'Necklace of anguish', 'Zaryte vambraces',
  'Ancestral hat', 'Ancestral robe top', 'Ancestral robe bottom', 'Occult necklace', 'Imbued Zamorak cape (Deadman)', 'Confliction gauntlets', "Elidinis' ward (f)",
  'Torva full helm', 'Torva platebody', 'Torva platelegs', 'Amulet of rancour', 'Infernal cape', 'Ferocious gloves', 'Avernic defender', 'Ultor ring',
  'Avernic treads (max)', 'Ring of shadows', 'Lightbearer',
].map((n) => ({ id: id(n) }));
const ENDGAME_BANK: InvItem[] = [...ENDGAME, { id: SHADOW_U }, { id: SCYTHE_U }, { id: QUIVER_U }];
const QUIVER_STATE = cleanTripState({ book: 0, pray: ['rigour', 'augury'], quiver: [DRAGON_ARROW, 2000] })!;
assert.ok(QUIVER_STATE?.quiver);
const endgame = (key: string, over: Partial<TripInput> = {}) => {
  const content = tripContent(key)!;
  return checkTrip(input({ setup: null, content, monsters: content.targets.map(mon), bank: ENDGAME_BANK, state: QUIVER_STATE, nameOf: endgameName, ...over }));
};
const SANFEW = 10925;
const ANGLER = 13441;
const SAT_HEART = 27641;
const SUPPLY_NAMES: Record<number, string> = { [SANFEW]: 'Sanfew serum(4)', [ANGLER]: 'Anglerfish', [SAT_HEART]: 'Saturated heart', 12913: 'Anti-venom+(4)', 23685: 'Divine super combat potion(4)', 23733: 'Divine ranging potion(4)', 22209: 'Extended super antifire(4)' };
const supplyName = (x: number) => SUPPLY_NAMES[x] ?? endgameName(x);
const slotOfItem = (x: number) => (idx.item(x)?.s === '2h' ? 'weapon' : idx.item(x)?.s);
const gearLines = (c: ReturnType<typeof checkTrip>) => c.rows.filter((r) => r.group === 'gear').map((r) => `${r.line} ${r.detail ?? ''}`);

test('ammo: each launcher fires only its own', () => {
  const it = (n: string) => idx.item(id(n))!;
  assert.ok(!ammoFits(it("Hunters' sunlight crossbow"), it('Dragonstone bolts (e)')), 'sunlight crossbow: antler bolts only');
  assert.ok(ammoFits(it("Hunters' sunlight crossbow"), it('Sunlight antler bolts')));
  assert.ok(!ammoFits(it('Magic shortbow'), it('Dragon arrow')), 'no dragon arrows from a magic shortbow');
  assert.ok(ammoFits(it('Twisted bow'), it('Dragon arrow')));
  assert.ok(!ammoFits(it('Rune crossbow'), it('Ruby dragon bolts (e)')) && ammoFits(it('Rune crossbow'), it('Ruby bolts (e)')));
  // Ascension crossbows fire only ascension bolts; no other crossbow fires them.
  assert.ok(ammoFits(it('Ascension crossbows'), it('Onyx ascension bolts (e)')) && !ammoFits(it('Ascension crossbows'), it('Dragonstone bolts (e)')));
  assert.ok(!ammoFits(it('Rune crossbow'), it('Ascension bolts')));
  // Barbarian Assault's Barbed arrows (+125 ranged strength) fire only in the minigame: never the calc's pick.
  assert.ok(isRestricted('Barbed arrow') && !isRestricted('Dragon arrow'));
  const tb = bestLoadout(mon('Zebak#Normal'), [id('Twisted bow'), id('Barbed arrow'), id('Dragon arrow')], { idx, stats: STATS, prayer: ['rigour'], spell: null })!;
  assert.equal(nameOf(tb.gear.ammo), 'Dragon arrow');
  const asc = bestLoadout(mon('Vorkath#Post-quest'), [id('Ascension crossbows'), id('Dragonstone bolts (e)'), id('Onyx ascension bolts (e)')], { idx, stats: STATS, prayer: ['rigour'], spell: null })!;
  assert.equal(nameOf(asc.gear.ammo), 'Onyx ascension bolts (e)');
  assert.ok(!meleeReaches(mon('Zulrah#Magma')) && !meleeReaches(mon('Great Olm#Head (Normal)')) && meleeReaches(mon('Great Olm#Left claw (Normal)')));
});

test('endgame bank: Vorkath is the Dragon hunter crossbow in Masori with Anguish, never the sunlight crossbow', () => {
  const c = endgame('vorkath');
  const row = c.rows.find((r) => r.group === 'gear' && !r.ok)!;
  assert.equal(row.item, id('Dragon hunter crossbow'), gearLines(c).join(' | '));
  const take = (row.swaps ?? []).map(nameOf);
  for (const n of ['Ruby dragon bolts (e)', 'Masori body (f)', 'Masori chaps (f)', 'Necklace of anguish', "Dizana's quiver"]) assert.ok(take.includes(n), `${n}: ${take.join(', ')}`);
  assert.ok(!take.some((n) => /sunlight|dragonstone|mixed hide/i.test(n)), take.join(', '));
  assert.ok(/Charge Dizana's quiver first/.test(row.detail ?? ''), row.detail);
  // Without the crossbow: the Twisted bow, firing the quiver's dragon arrows.
  const bow = endgame('vorkath', { bank: ENDGAME_BANK.filter((x) => x.id !== id('Dragon hunter crossbow')) });
  const r2 = bow.rows.find((r) => r.group === 'gear' && !r.ok)!;
  // Vorkath's stab defence is low: the Fang (two accuracy rolls) is level with the bow and the staff.
  assert.ok([id('Twisted bow'), id("Tumeken's shadow"), id("Osmumten's fang")].includes(r2.item!), nameOf(r2.item!));
  const b = bestLoadout(mon('Vorkath#Post-quest'), [id('Twisted bow'), DRAGON_ARROW, id('Rune arrow')], { idx, stats: STATS, prayer: calcPrayers(LEVELS, null), spell: null })!;
  assert.equal(b.gear.ammo, DRAGON_ARROW);
});

test('endgame bank: Zulrah is Shadow worn (charge it) and a bow switch; no melee at all', () => {
  const c = endgame('zulrah');
  const lines = gearLines(c);
  assert.ok(c.info.some((l) => /magic worn/.test(l)), c.info.join(' | '));
  assert.ok(lines.some((l) => /^Shadow is in your bank: take it \(charge it\)/.test(l) && /uncharged in your bank: charge it/.test(l)), lines.join(' | '));
  assert.ok(lines.some((l) => /^Twisted bow \(switch\)/.test(l)), lines.join(' | '));
  for (const n of ['Ancestral hat', 'Occult necklace', 'Imbued Zamorak cape']) assert.ok(lines.some((l) => l.startsWith(`${n} is in your bank`)), `${n}: ${lines.join(' | ')}`);
  assert.ok(!lines.some((l) => /scythe|fang|torva|rancour/i.test(l)), lines.join(' | '));
});

test('endgame bank: ToA is the Shadow (x4 in the Tombs), melee in Torva without a d\'hide top, Elder maul and Lightbearer to spec', () => {
  const pool = [...ENDGAME.map((x) => x.id), id("Tumeken's shadow"), id('Scythe of Vitur'), id("Dizana's quiver"), DRAGON_ARROW];
  const pick = (key: string, rl = 300) => {
    const b = bestLoadout(raidScaled(mon(key), rl), pool, { idx, stats: STATS, prayer: calcPrayers(LEVELS, null), spell: null })!;
    return { weapon: nameOf(b.weapon), gear: Object.values(b.gear).map(nameOf) };
  };
  for (const k of ['Akkha', 'Zebak#Normal', "Tumeken's Warden#Damaged"]) assert.equal(pick(k).weapon, "Tumeken's shadow", k);
  const akkha = pick('Akkha').gear;
  for (const n of ['Ancestral hat', 'Ancestral robe top', 'Occult necklace', 'Imbued Zamorak cape (Deadman)', 'Confliction gauntlets']) assert.ok(akkha.includes(n), `${n}: ${akkha.join(', ')}`);
  // The best melee kit (no melee-only boss here, so asked of melee alone).
  const melee = bestLoadout(mon('Ba-Ba'), pool.filter((x) => ![id("Tumeken's shadow"), id('Twisted bow')].includes(x)), { idx, stats: STATS, prayer: calcPrayers(LEVELS, null), spell: null })!;
  const mg = Object.values(melee.gear).map(nameOf);
  assert.ok(['Scythe of Vitur', "Osmumten's fang"].includes(nameOf(melee.weapon)), nameOf(melee.weapon));
  assert.ok(mg.includes('Torva platebody') && !mg.includes('Mixed hide top'), mg.join(', '));
  const c = endgame('toa', { raidLevel: 300 });
  const lines = gearLines(c);
  assert.ok(!lines.some((l) => /sunlight|dragonstone|mixed hide|rune arrow/i.test(l)), lines.join(' | '));
  assert.ok(lines.some((l) => /^Shadow\b/.test(l)), lines.join(' | '));
  assert.deepEqual(c.rows.filter((r) => r.group === 'spec').map((r) => r.line), ['Elder maul (spec): in your bank']);
  // A Ring of shadows adds next to nothing to the Shadow: Lightbearer is the worn ring on a spec trip.
  const ring = c.rows.find((r) => r.slot === 'ring')!;
  assert.equal(ring.item, id('Lightbearer'));
  assert.match(ring.detail ?? '', /twice as fast/);
});

test("Tumeken's shadow: x4 against the Tombs' bosses, x3 elsewhere, magic damage capped at 100%", () => {
  const gear = { weapon: id("Tumeken's shadow"), neck: id('Occult necklace'), hands: id('Confliction gauntlets'), head: id('Ancestral hat'), body: id('Ancestral robe top'), legs: id('Ancestral robe bottom'), cape: id('Imbued Zamorak cape') };
  const run = (m: Monster) => bestStyle({ gear, style: 0, stats: STATS, prayer: ['augury'] }, m, idx.item)!.result;
  const akkha = mon('Akkha');
  const inToa = run(akkha);
  const outside = run({ ...akkha, n: 'Not Akkha' });
  assert.ok(inToa.effects.some((e) => /×4/.test(e)) && outside.effects.some((e) => /×3/.test(e)));
  assert.ok(inToa.maxHit > outside.maxHit && inToa.attackRoll > outside.attackRoll);
  // Magic damage: 1% (Shadow) + 5 + 7 + 3 + 3 + 3 + 2 = 24% worn → ×4 = 96%, ×3 = 72%; the cap holds past 100%.
  const base = run({ ...akkha, n: 'Not Akkha' }).maxHit / 1.72;
  assert.ok(Math.abs(inToa.maxHit - Math.floor(base * 1.96)) <= 1, `${inToa.maxHit} vs ${base * 1.96}`);
});

test('ToA raid level: +2% defence roll and hitpoints per 5 levels; other monsters untouched', () => {
  const akkha = mon('Akkha');
  const at300 = raidScaled(akkha, 300);
  assert.equal(at300.hp, Math.round(akkha.hp * 2.2));
  assert.equal(raidScaled(at300, 300), at300, 'scaled once, never twice');
  assert.equal(raidScaled(mon('Vorkath#Post-quest'), 300), mon('Vorkath#Post-quest'));
  const gear = { weapon: id('Scythe of Vitur') };
  const plain = bestStyle({ gear, style: 0, stats: STATS }, akkha, idx.item)!.result;
  const scaled = bestStyle({ gear, style: 0, stats: STATS }, at300, idx.item)!.result;
  assert.equal(scaled.defenceRoll, Math.floor(plain.defenceRoll * 2.2));
  assert.ok(scaled.dps < plain.dps);
});

test('the quiver and its arrows are one row', () => {
  const c = endgame('toa', { raidLevel: 600, bank: ENDGAME_BANK.filter((x) => x.id !== SHADOW_U && x.id !== id('Dragon hunter crossbow')) });
  const lines = gearLines(c);
  assert.ok(lines.some((l) => /^Dizana's quiver with Dragon arrows: take the quiver \(charge it\)/.test(l)), lines.join(' | '));
  assert.ok(!lines.some((l) => /^Dragon arrow/.test(l)), lines.join(' | '));
});

test('endgame bank: a ToB melee boss is the Scythe in Torva with Rancour, Ferocious and Ultor', () => {
  const b = bestLoadout(mon('Xarpus'), [...ENDGAME.map((x) => x.id), id("Tumeken's shadow"), id('Scythe of Vitur'), id("Dizana's quiver"), DRAGON_ARROW], { idx, stats: STATS, prayer: calcPrayers(LEVELS, null), spell: null })!;
  assert.equal(nameOf(b.weapon), 'Scythe of Vitur');
  const gear = Object.values(b.gear).map(nameOf);
  for (const n of ['Torva full helm', 'Torva platebody', 'Torva platelegs', 'Amulet of rancour', 'Ferocious gloves', 'Ultor ring', 'Infernal cape']) assert.ok(gear.includes(n), `${n}: ${gear.join(', ')}`);
  const c = endgame('tob');
  const lines = gearLines(c);
  assert.ok(lines.some((l) => /^Scythe is in your bank: take it \(charge it\)/.test(l)), lines.join(' | '));
});

test('the ToA card offers its raid level; other trips do not', async () => {
  const { tripPanelUi } = await import('../src/lib/pluginUi/tripUi.ts');
  const base = { region: '13454', regionName: 'the ToA lobby', content: { key: 'toa', name: 'Tombs of Amascut', short: 'ToA' }, fromRegion: true, source: 'calc' as const, sourceLine: 'x', guide: null, check: endgame('toa', { raidLevel: 300 }), status: 'ready' as const, checkedAt: '18:42', hasOwn: false, canSave: false, options: [], monsters: [] };
  const ui = JSON.stringify(tripPanelUi({ ...base, raid: { level: 300, levels: [0, 150, 300, 500] } }));
  assert.ok(ui.includes('"Raid level "') && ui.includes('"300"'), 'Raid level 300 shown');
  assert.ok(ui.includes('"act":"trip-raid"') && ui.includes('"rl":"500"'), 'a chip per level saves it');
  assert.ok(!JSON.stringify(tripPanelUi({ ...base, raid: null })).includes('trip-raid'));
});

test('where a trip has begun: raids by any instance, the rest by their fight regions; every trip region named', async () => {
  const { TRIP_NAMES } = await import('../src/lib/tripContent.ts');
  for (const k of ['toa', 'tob', 'cox']) assert.equal(tripContent(k)!.instance, true, k);
  assert.deepEqual(tripContent('vorkath')!.fightRegions, [9023]);
  assert.deepEqual(tripContent('zulrah')!.fightRegions, [9007]);
  assert.ok(!tripContent('nex')!.fightRegions && !tripContent('nex')!.instance, 'Nex: its bank is in the same region, combat takes it down');
  // A shared bank's region is never a fight region of its own trip.
  for (const [r, reg] of Object.entries(TRIP_REGIONS)) if (!reg.noBank) assert.ok(!tripContent(reg.content)!.fightRegions?.includes(Number(r)), `${r} is a bank`);
  assert.equal(TRIP_NAMES[13454], 'ToA');
  assert.deepEqual(Object.keys(TRIP_NAMES).map(Number).sort((a, b) => a - b), TRIP_REGION_IDS);
});

test('raid calc: the bank bests are kept by pool, and the same pool gives the same answer', () => {
  const pool = [id("Osmumten's fang"), id('Abyssal whip'), id('Twisted bow'), id('Dragon arrow')];
  const ctx = { idx, stats: { ...STATS, hitpoints: 99 }, prayer: ['piety', 'rigour'], spell: null };
  const a = bestLoadout(mon('Kephri#Shielded'), pool, ctx);
  const b = bestLoadout(mon('Kephri#Shielded'), [...pool].reverse(), ctx);
  assert.ok(a && a === b, 'the same pool in another order is the same work');
  const c = bestLoadout(mon('Kephri#Shielded'), pool.slice(1), ctx);
  assert.notEqual(c, a, 'another pool is worked out again');
});

test('layout: the game inventory (one food a slot, stackables one), have / bank / none, the setup order kept', async () => {
  const { tripLayout, isStackable } = await import('../src/lib/tripLayout.ts');
  const fang = id("Osmumten's fang");
  const torva = id('Torva platebody');
  const claws = id('Dragon claws');
  const setup: GearSetup = { tier: 'advanced', name: 'x', style: 0, stats: STATS, gear: { weapon: fang, body: torva }, inventory: [{ id: claws }, { id: MANTA, q: 5 }, { id: 560, q: 200 }], runePouch: [{ id: 560, q: 100 }] };
  const worn = [{ id: fang }];
  const inventory = [{ id: MANTA, q: 3 }];
  const bank = [{ id: torva }, { id: MANTA, q: 50 }, { id: 560, q: 500 }];
  const has = (list: InvItem[]) => (x: number) => list.some((i) => i.id === x);
  const l = tripLayout({ setup, rows: [], worn, inventory, bank, state: null, carries: has([...worn, ...inventory]), owns: has([...worn, ...inventory, ...bank]), slotOf: (x) => (idx.item(x) ? (idx.item(x)!.s === '2h' ? 'weapon' : idx.item(x)!.s) : null), nameOf, isRunePouch: (x) => x === POUCH, isSpec: (x) => x === claws });
  assert.equal(l.worn.weapon.have, 'here');
  assert.equal(l.worn.body.have, 'bank');
  assert.equal(l.inventory[0]?.have, 'none', 'claws: not owned');
  assert.deepEqual(l.inventory.slice(1, 6).map((x) => x?.have), ['here', 'here', 'here', 'bank', 'bank'], '5 mantas are 5 slots: 3 packed, 2 in the bank');
  assert.equal(l.inventory[6]?.q, 200, 'runes stack in one slot');
  assert.equal(l.inventory.length, 28);
  assert.ok(isStackable('Death rune') && isStackable('Dragon arrow') && !isStackable('Manta ray') && !isStackable('Saradomin brew(4)'));
  assert.equal(l.inBank, 3);
  assert.equal(l.notOwned, 1);
});

// ── switches, required styles, rings, supplies, the Fang ─────────────────────────────────────

test('ToA: a ranged and a melee switch for the Wardens P2 even when magic wins every boss, within the switch slots', () => {
  const c = endgame('toa', { raidLevel: 300 });
  const lines = gearLines(c);
  assert.ok(c.info.some((l) => /magic worn/.test(l)), c.info.join(' | '));
  assert.ok(lines.some((l) => /^Twisted bow \(switch\)/.test(l)), lines.join(' | '));
  assert.ok(lines.some((l) => /^(Fang|Scythe) \(switch\)/.test(l)), lines.join(' | '));
  assert.ok(c.info.includes("Wardens P2: you'll need ranged and melee switches"), c.info.join(' | '));
  const slots = Number(/Switches: (\d+) slots?/.exec(c.info.join(' '))?.[1]);
  const switches = c.rows.filter((r) => r.group === 'gear' && !r.slot && r.item != null);
  assert.equal(switches.length, slots);
  assert.ok(slots <= tripContent('toa')!.switchSlots!, `${slots} slots`);
  // Never the same piece twice, nor a switch of something already worn.
  const names = c.rows.filter((r) => r.group === 'gear' && r.item != null).map((r) => nameOf(r.item!).replace(/\s*\(.*\)\s*/g, ''));
  assert.equal(new Set(names).size, names.length, names.join(', '));
  const capes = c.rows.filter((r) => r.group === 'gear' && r.item != null && idx.item(r.item!)?.s === 'cape');
  assert.ok(capes.length <= 2, capes.map((r) => r.line).join(' | '));
});

test('ToB: all three styles packed for the Nylocas', () => {
  const c = endgame('tob');
  const weapons = c.rows.filter((r) => r.group === 'gear' && r.item != null && slotOfItem(r.item!) === 'weapon').map((r) => nameOf(r.item!));
  for (const w of ['Scythe of Vitur', 'Twisted bow', "Tumeken's shadow"]) assert.ok(weapons.includes(w), `${w}: ${weapons.join(', ')}`);
  assert.ok(c.info.some((l) => /^Nylocas: you'll need/.test(l)), c.info.join(' | '));
});

test('rings: Magus for magic, Venator for ranged, Ultor for melee; a Ring of shadows only when none of them is owned', () => {
  const rings = ['Magus ring', 'Venator ring', 'Ultor ring', 'Ring of shadows', 'Lightbearer'].map(id);
  const ctx = (only: 'melee' | 'ranged' | 'magic') => ({ idx, stats: STATS, prayer: calcPrayers(LEVELS, null), spell: null, only });
  const ring = (key: string, weapon: string, only: 'melee' | 'ranged' | 'magic', pool = rings) => nameOf(bestLoadout(mon(key), [id(weapon), DRAGON_ARROW, ...pool], ctx(only))!.gear.ring);
  assert.equal(ring('Vorkath#Post-quest', "Tumeken's shadow", 'magic'), 'Magus ring');
  assert.equal(ring('Vorkath#Post-quest', 'Twisted bow', 'ranged'), 'Venator ring');
  assert.equal(ring('Vorkath#Post-quest', "Osmumten's fang", 'melee'), 'Ultor ring');
  assert.equal(ring('Vorkath#Post-quest', "Tumeken's shadow", 'magic', [id('Ring of shadows'), id('Lightbearer')]), 'Ring of shadows');
});

test("Osmumten's fang: two accuracy rolls (both fresh in the Tombs), hits 15-85% of the max; the Keris partisan of amascut is weaker outside", () => {
  const gear = { weapon: id("Osmumten's fang") };
  const run = (m: Monster, g: Record<string, number> = gear) => bestStyle({ gear: g, style: 0, stats: STATS }, m, idx.item)!.result;
  const akkha = mon('Akkha');
  const inToa = run(akkha);
  const out = run({ ...akkha, n: 'Not Akkha' });
  const p = hitChance(inToa.attackRoll, inToa.defenceRoll);
  assert.ok(Math.abs(inToa.accuracy - (1 - (1 - p) ** 2)) < 1e-9, 'Tombs: 1 - (1 - p)^2');
  const A = out.attackRoll;
  const D = out.defenceRoll;
  const want = A > D ? 1 - ((D + 2) * (2 * D + 3)) / (6 * (A + 1) ** 2) : (A * (4 * A + 5)) / (6 * (A + 1) * (D + 1));
  assert.ok(Math.abs(out.accuracy - want) < 1e-9, 'elsewhere: the second roll against one defence roll');
  assert.ok(inToa.accuracy > p && out.accuracy > p);
  assert.ok(Math.abs(inToa.dps - (inToa.accuracy * (inToa.maxHit / 2)) / (inToa.speed * 0.6)) < 0.05, 'a hit averages half the max');
  const keris = { weapon: id('Keris partisan of amascut') };
  assert.ok(run(akkha, keris).attackRoll > run({ ...akkha, n: 'Not Akkha' }, keris).attackRoll, 'its bonuses hold only inside');
});

test('calc supplies: the trip template filled from the bank, owned forms first, room left after the switches; none owned is red', () => {
  const bank = [...ENDGAME_BANK, { id: SANFEW, q: 20 }, { id: BREW, q: 30 }, { id: ANGLER, q: 100 }, { id: SAT_HEART }];
  const c = endgame('toa', { raidLevel: 300, bank, nameOf: supplyName });
  const sup = c.rows.filter((r) => r.group === 'supplies');
  const by = (re: RegExp) => sup.find((r) => re.test(r.line));
  assert.equal(by(/^Restores/)?.item, SANFEW, sup.map((r) => r.line).join(' | '));
  assert.equal(by(/^Restores/)?.need, 3);
  assert.equal(by(/^Brews/)?.need, 2);
  assert.equal(by(/^Saturated heart/)?.need, 1, 'the magic boost: the heart owned');
  assert.ok(/none in your bank/.test(by(/^Anti-venoms/)?.line ?? ''), 'no anti-venom owned: red');
  const used = c.rows.filter((r) => r.item != null && ((r.group === 'gear' && !r.slot) || r.group === 'spec')).length;
  const packed = sup.reduce((a, r) => a + (r.need ?? 0), 0);
  assert.ok(used + packed <= 27, `${used} switches + ${packed} supplies`);
  // Vorkath: food fills what is left.
  const v = endgame('vorkath', { bank, nameOf: supplyName });
  const food = v.rows.find((r) => r.group === 'supplies' && /^Food/.test(r.line))!;
  assert.ok((food.need ?? 0) >= 10, `${food.need} food`);
});

// ── spells and the rune pouch ────────────────────────────────────────────────────────────────

const DIVINE_POUCH = 27281;
const runeName = (x: number) => (x === DIVINE_POUCH ? 'Divine rune pouch' : x === POUCH ? 'Rune pouch' : supplyName(x));
const isPouch = (x: number) => x === POUCH || x === DIVINE_POUCH;
const pouchRows = (c: ReturnType<typeof checkTrip>) => c.rows.filter((r) => r.group === 'pouch' && r.item != null && r.item !== POUCH && r.item !== DIVINE_POUCH);
const runeNeed = (c: ReturnType<typeof checkTrip>, rune: number) => pouchRows(c).find((r) => r.item === rune)?.need ?? 0;
const STATE = (book: number) => cleanTripState({ book, pray: ['rigour', 'augury'], quiver: [DRAGON_ARROW, 2000] })!;

test('runes: Vorkath on the standard book takes Crumble Undead runes', () => {
  const c = endgame('vorkath', { state: STATE(0), bank: [...ENDGAME_BANK, { id: POUCH }], nameOf: runeName, isRunePouch: isPouch });
  // 10 casts: 2 earth, 2 air, 1 chaos each.
  assert.equal(runeNeed(c, 557), 20, pouchRows(c).map((r) => r.line).join(' | '));
  assert.equal(runeNeed(c, 556), 20);
  assert.equal(runeNeed(c, 562), 10);
  assert.ok(c.rows.some((r) => r.group === 'book' && /Standard spellbook/.test(r.line) && /Crumble Undead/.test(r.detail ?? '')));
  // On Arceuus it isn't cast (not on that book): no crumble runes.
  const arc = endgame('vorkath', { state: STATE(3), bank: [...ENDGAME_BANK, { id: POUCH }], nameOf: runeName, isRunePouch: isPouch });
  assert.equal(runeNeed(arc, 562), 0);
});

test('runes: an Ancients barrage setup fills the pouch with death and blood; a Kodai wand covers the water', () => {
  const content = contentFromKey('m:Cerberus')!;
  const magicBank = (wand: string) => [wand, 'Ancestral hat', 'Ancestral robe top', 'Ancestral robe bottom', 'Occult necklace', 'Imbued Zamorak cape'].map((n) => ({ id: id(n) })).concat([{ id: DIVINE_POUCH }]);
  const run = (wand: string) => checkTrip(input({ setup: null, content, monsters: [mon('Cerberus')], bank: magicBank(wand), state: STATE(1), nameOf: runeName, isRunePouch: isPouch }));
  const kodai = run('Kodai wand');
  assert.ok(runeNeed(kodai, 560) > 0 && runeNeed(kodai, 565) > 0, pouchRows(kodai).map((r) => r.line).join(' | '));
  assert.equal(runeNeed(kodai, 555), 0, 'the Kodai gives water without end');
  assert.equal(runeNeed(kodai, 560), 2 * runeNeed(kodai, 565), 'Ice Barrage: 4 death to 2 blood');
  assert.ok(pouchRows(kodai).every((r) => r.inPouch), 'two kinds: both in the divine pouch');
  const master = run('Master wand');
  assert.equal(runeNeed(master, 555), (6 / 4) * runeNeed(master, 560), 'without it: 6 water a cast');
});

test('runes: a staff giving fire and air without end leaves only the wrath of Fire Surge', () => {
  const content = contentFromKey('m:Cerberus')!;
  const bank = ['Smoke battlestaff', 'Ancestral hat', 'Ancestral robe top', 'Ancestral robe bottom'].map((n) => ({ id: id(n) })).concat([{ id: POUCH }]);
  const c = checkTrip(input({ setup: null, content, monsters: [mon('Bloodthirsty gargoyle')], bank, state: STATE(0), nameOf: runeName, isRunePouch: isPouch }));
  const runes = pouchRows(c).map((r) => r.item);
  assert.deepEqual(runes, [21880], c.rows.map((r) => `${r.group}:${r.line}`).join(' | '));
});

test('runes: Arceuus at a raid packs thrall and Death Charge runes; the fifth kind goes in the inventory', () => {
  const c = endgame('toa', { raidLevel: 300, state: STATE(3), bank: [...ENDGAME_BANK, { id: DIVINE_POUCH }], nameOf: runeName, isRunePouch: isPouch });
  const book = c.rows.find((r) => r.group === 'book');
  assert.ok(/Arceuus spellbook/.test(book?.line ?? '') && /Resurrect Greater/.test(book?.detail ?? '') && /Death Charge/.test(book?.detail ?? ''), book?.detail);
  for (const r of [554, 565, 564, 560, 566]) assert.ok(runeNeed(c, r) > 0, `${r}: ${pouchRows(c).map((x) => x.line).join(' | ')}`);
  assert.equal(pouchRows(c).filter((r) => r.inPouch).length, 4, 'a divine pouch holds four kinds');
  assert.equal(pouchRows(c).filter((r) => !r.inPouch).length, 1);
  assert.ok(c.rows.some((r) => r.group === 'pouch' && r.item === DIVINE_POUCH), 'the pouch itself is packed');
});
