// The pre-trip check (lib/tripCheck, lib/tripContent, lib/tripState): what the plugin's `state` may
// carry, which region picks which trip, every check's pass and fail, the calc from the bank, the
// overlay's short answer. Real items and monsters from the bundled gear data. No database.
//
// Run: npx tsx --test tests/trip-check.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bestLoadout, calcPrayers, checkTrip, isSpecWeapon, setupFromHeld, shortName, staffRunes, supplyKind, tripWarn, type TripInput } from '../src/lib/tripCheck.ts';
import { contentForRegion, contentFromKey, SPADE, TRIP_CONTENT, TRIP_REGION_IDS, TRIP_REGIONS, tripContent } from '../src/lib/tripContent.ts';
import { cleanTripState, storedTripState } from '../src/lib/tripState.ts';
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
  assert.ok(failing(c).includes('No Torva full helm (in bank)'), failing(c).join(' | '));
  const worn = checkTrip(input({ setup: setup(), worn: [{ id: fang }, { id: torvaHelm }], bank: [{ id: claws }, { id: tbow }] }));
  assert.ok(!failing(worn).some((l) => /Torva/.test(l)));
  assert.ok(worn.rows.some((r) => r.ok && r.line === 'Head: Torva full helm'));
});

test('a slot item they do not own at all is an upgrade, not a trip problem', () => {
  const c = checkTrip(input({ setup: setup(), worn: [{ id: fang }] }));
  assert.ok(!failing(c).some((l) => /Torva|Twisted|claws/i.test(l)), failing(c).join(' | '));
});

test('switches and the spec weapon: packed passes, left in the bank fails', () => {
  const c = checkTrip(input({ setup: setup(), worn: [{ id: fang }, { id: torvaHelm }], inventory: [{ id: tbow }], bank: [{ id: claws }] }));
  assert.ok(failing(c).includes('No spec weapon (Dragon claws in bank)'), failing(c).join(' | '));
  assert.ok(c.rows.some((r) => r.ok && r.line === 'Switch: Twisted bow'));
  const packed = checkTrip(input({ setup: setup(), worn: [{ id: fang }, { id: torvaHelm }], inventory: [{ id: tbow }, { id: claws }] }));
  assert.ok(packed.rows.some((r) => r.ok && r.group === 'spec'));
  const left = checkTrip(input({ setup: setup(), worn: [{ id: fang }, { id: torvaHelm }], inventory: [{ id: claws }], bank: [{ id: tbow }] }));
  assert.ok(failing(left).includes('Switch not packed: Twisted bow'));
});

test('supplies by kind: any brew dose counts, sharks count as food', () => {
  const inv = [{ id: claws }, { id: tbow }, { id: BREW }, { id: BREW3 }, { id: SHARK }, { id: SHARK }, { id: RESTORE }];
  const c = checkTrip(input({ setup: setup(), worn: [{ id: fang }, { id: torvaHelm }], inventory: inv }));
  assert.ok(failing(c).includes('Brews 2 · setup has 3'), failing(c).join(' | '));
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

test('calc: Fang left in the bank for Kephri is "No stab weapon"', () => {
  const whip = id('Abyssal whip');
  const c = checkTrip(input({ setup: null, worn: [{ id: whip }], bank: [{ id: fang }] }));
  const bad = failing(c);
  assert.ok(bad.includes('No stab weapon: Kephri (Fang in bank)'), bad.join(' | '));
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
  const check = { rows: [{ group: 'gear' as const, ok: false, line: 'No stab weapon: Kephri (Fang in bank)', item: fang }, { group: 'spec' as const, ok: true, line: 'Spec: Dragon claws' }, { group: 'supplies' as const, ok: true, line: 'Brews 6' }], info: ['Switches 2 slots · 24 free for supplies'], unknown: [] };
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
  assert.ok(json.includes('"calc"'), 'the calc is tagged');
  // No combat cues: nothing tells the player what to pray or do mid-fight.
  assert.ok(!/pray \w+ now|switch now|attack now/i.test(json));
});

test('panel: sharing off asks to turn it on', async () => {
  const { tripPanelUi } = await import('../src/lib/pluginUi/tripUi.ts');
  const ui = tripPanelUi({ region: '13454', regionName: 'the ToA lobby', content: { key: 'toa', name: 'Tombs of Amascut', short: 'ToA' }, fromRegion: true, source: null, sourceLine: '', guide: null, check: null, status: 'off', checkedAt: null, hasOwn: false, canSave: false, options: [], monsters: [] });
  assert.ok(JSON.stringify(ui).includes('Turn on Share my bank to check your trips'));
});
