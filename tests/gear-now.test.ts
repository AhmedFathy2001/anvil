// "Your gear now vs this setup" (lib/gearNow + the guide panel's card): worn gear to slots, one row
// per target, the change's sign, the biggest single-slot gap, and no card without a worn reading.
// Real items and monsters from the bundled gear data. No database.
//
// Run: npx tsx --test tests/gear-now.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gearNow, otherTargets, unreadWorn, withSlot, wornGear } from '../src/lib/gearNow.ts';
import { equivalentsFor } from '../src/lib/itemFamilies.ts';
import { indexGear, type GearData } from '../src/lib/dps/summary.ts';
import type { GearBlock, GearSetup } from '../src/lib/guideTiers.ts';
import { guidePanelUi, type GuidePanelData } from '../src/lib/pluginUi/guidesUi.ts';
import itemsJson from '../src/data/gearItems.json' with { type: 'json' };
import monstersJson from '../src/data/gearMonsters.json' with { type: 'json' };

const idx = indexGear({ items: (itemsJson as unknown as GearData).items, monsters: (monstersJson as unknown as GearData).monsters });
const id = (name: string) => {
  const it = idx.items.find((i) => i.n === name);
  assert.ok(it, `dataset has ${name}`);
  return it!.id;
};

const STATS = { attack: 75, strength: 75, ranged: 75, magic: 75 };
const BROTHERS = ['Ahrim the Blighted', 'Dharok the Wretched', 'Guthan the Infested', 'Karil the Tainted', 'Torag the Corrupted', 'Verac the Defiled'];
const melee = (gear: Record<string, number>): GearSetup => ({ tier: 'beginner', name: 'Melee', gear, style: 0, stats: STATS, prayer: 'piety' });
const barrows = (s: GearSetup): GearBlock => ({ monster: BROTHERS[0], monsters: BROTHERS, setups: [s] });
const vorkath = (s: GearSetup): GearBlock => ({ monster: 'Vorkath#Post-quest', setups: [s] });

test('worn items go to their slots: a two-handed weapon to the weapon slot, an unknown id through its equivalent', () => {
  const pipe = id('Toxic blowpipe');
  const body = id('Rune platebody');
  assert.deepEqual(wornGear([{ id: pipe }, { id: body }], idx), { weapon: pipe, body });
  // 999999 isn't in the gear data; its equivalent is.
  assert.deepEqual(wornGear([{ id: 999_999 }], idx, (x) => (x === 999_999 ? [999_999, body] : [x])), { body });
  assert.deepEqual(wornGear([], idx), {});
});

test('one row per target the setup is for, in the block order', () => {
  const guide = melee({ weapon: id('Abyssal whip'), body: id('Bandos chestplate') });
  const now = gearNow(guide, barrows(guide), { weapon: id('Abyssal whip'), body: id('Rune platebody') }, idx);
  assert.ok(now);
  assert.deepEqual(now!.rows.map((r) => r.monster.n), BROTHERS);
  // A weaker body: behind the guide on every brother.
  for (const r of now!.rows) assert.ok(r.you < r.guide, r.monster.n);
  // A setup for some of the targets only gets rows for those.
  const some = { ...guide, targets: ['Dharok the Wretched', 'Verac the Defiled'] };
  assert.equal(gearNow(some, barrows(some), { weapon: id('Abyssal whip') }, idx)!.rows.length, 2);
  // A single boss: one row with its kill times.
  const one = gearNow(guide, vorkath(guide), { weapon: id('Abyssal whip') }, idx)!;
  assert.equal(one.rows.length, 1);
  assert.ok(one.rows[0].youTtk && one.rows[0].guideTtk);
});

test('the biggest gap is the one slot from the setup that raises the worn DPS most', () => {
  const guide = melee({ weapon: id('Abyssal whip'), body: id('Bandos chestplate') });
  // Same whip, a weaker body: the body is the gap.
  const body = gearNow(guide, barrows(guide), { weapon: id('Abyssal whip'), body: id('Rune platebody') }, idx)!;
  assert.equal(body.gap?.slot, 'body');
  assert.equal(body.gap?.guide, id('Bandos chestplate'));
  assert.equal(body.gap?.worn, id('Rune platebody'));
  assert.ok(body.gap!.gainPct > 0);
  // No weapon at all: the whip is worth more than the chestplate.
  const weapon = gearNow(guide, barrows(guide), { body: id('Rune platebody') }, idx)!;
  assert.equal(weapon.gap?.slot, 'weapon');
  assert.equal(weapon.gap?.worn, null);
  // Wearing the setup: no gap, and every row even.
  const same = gearNow(guide, barrows(guide), { ...guide.gear }, idx)!;
  assert.equal(same.gap, null);
  for (const r of same.rows) assert.equal(r.you, r.guide);
  // A form of the guide's item counts as it (no swap offered).
  const formed = gearNow(guide, barrows(guide), { weapon: 777_777, body: id('Bandos chestplate') }, { ...idx, item: (x) => idx.item(x === 777_777 ? id('Abyssal whip') : x) }, (x) => (x === 777_777 ? [777_777, id('Abyssal whip')] : [x]));
  assert.equal(formed!.gap, null);
});

test("'You' is the character: its own combat levels where known, the setup's elsewhere; 'Guide' keeps the setup's", () => {
  const guide = melee({ weapon: id('Abyssal whip'), body: id('Bandos chestplate') });
  const worn = { ...guide.gear };
  const plain = gearNow(guide, barrows(guide), worn, idx)!;
  assert.equal(plain.ownLevels, false);
  // Lower real Attack and Strength: lower "You", the same "Guide".
  const low = gearNow(guide, barrows(guide), worn, idx, undefined, { attack: 40, strength: 40, hitpoints: 50 })!;
  assert.equal(low.ownLevels, true);
  for (const [i, r] of low.rows.entries()) {
    assert.ok(r.you < plain.rows[i].you, r.monster.n);
    assert.equal(r.guide, plain.rows[i].guide);
  }
  // Only Ranged known: melee "You" is unchanged (Attack and Strength fall back to the setup's).
  const rangedOnly = gearNow(guide, barrows(guide), worn, idx, undefined, { ranged: 1 })!;
  assert.deepEqual(rangedOnly.rows.map((r) => r.you), plain.rows.map((r) => r.you));
});

test('the swap step drops the shield for a two-handed weapon (the Upgrades ladder takes the same step)', () => {
  const s = melee({ weapon: id('Abyssal whip'), shield: id('Dragon defender') });
  assert.equal(withSlot(s, 'weapon', id('Toxic blowpipe'), idx).gear.shield, undefined);
  assert.equal(withSlot(s, 'weapon', id('Ghrazi rapier'), idx).gear.shield, id('Dragon defender'));
});

test('nothing to compare: no worn items, or no target the gear data knows', () => {
  const guide = melee({ weapon: id('Abyssal whip') });
  assert.equal(gearNow(guide, barrows(guide), {}, idx), null);
  assert.equal(gearNow(guide, { monster: 'Not a monster', setups: [guide] }, { weapon: id('Abyssal whip') }, idx), null);
});

// ── The panel card ─────────────────────────────────────────────────────────────────────────

const PANEL: GuidePanelData = {
  id: 3, slug: 'barrows-beginners', title: 'Barrows', kind: 'Bossing', tier: 'beginner', tiers: [{ key: 'beginner', label: 'Beginner' }],
  byline: '', rankGlyph: null, setups: [{ key: 'beginner-magic', name: 'Magic', sub: '', weapon: 12899, blocked: null }], current: 'beginner-magic',
  dps: '4.2 DPS', usingFallbacks: null, slots: [], inventory: [], pouch: [], spellbook: 'Standard', spellbookId: 0, spells: [], hasMarkers: 0,
  missing: null, checkedAt: null, checklist: [], setupSteps: [], body: [], tips: [], mistakes: [], upgrades: [], community: [], phase2: true,
  alternatives: null, route: null,
};
function walk(n: unknown, f: (o: Record<string, unknown>) => void) {
  if (!n || typeof n !== 'object') return;
  if (Array.isArray(n)) return n.forEach((x) => walk(x, f));
  const o = n as Record<string, unknown>;
  if (typeof o.t === 'string') f(o);
  for (const v of Object.values(o)) walk(v, f);
}
const texts = (n: unknown) => {
  const out: string[] = [];
  walk(n, (o) => {
    if (o.t === 'text' && typeof o.s === 'string' && o.s) out.push(o.s);
    if (o.t === 'text' && Array.isArray(o.runs)) out.push((o.runs as { s: string }[]).map((r) => r.s).join(''));
  });
  return out;
};
const glyphs = (n: unknown) => {
  const out: string[] = [];
  walk(n, (o) => {
    if (o.t === 'icon' && (o.glyph === 'up' || o.glyph === 'down')) out.push(o.glyph as string);
  });
  return out;
};

const KEY = 'gear-now';
/** The fold's two faces: `shut` (the default) and `open` (flipped). */
function fold(ui: unknown): { shut: unknown; open: unknown } | null {
  let out: { shut: unknown; open: unknown } | null = null;
  walk(ui, (o) => {
    if (o.t === 'toggle' && o.key === KEY) out = { shut: o.off, open: o.lit };
  });
  return out;
}

test('the card: hidden with no worn reading, one shut line by default under one fixed key', () => {
  assert.equal(fold(guidePanelUi(PANEL)), null, 'no reading, no card');
  assert.equal(fold(guidePanelUi({ ...PANEL, gearNow: null })), null);
  const rows = [
    { name: 'Dharok', you: 8.0, guide: 10.0 },
    { name: 'Karil', you: 8.6, guide: 10.0 },
  ];
  const f = fold(guidePanelUi({ ...PANEL, gearNow: { rows } }))!;
  assert.ok(f, 'a fold keyed gear-now');
  // Shut: the title and the overall change (17% behind), no table.
  const shut = texts(f.shut);
  assert.ok(shut.includes('Your gear now') && shut.includes('17%') && shut.includes('vs guide'), shut.join(' | '));
  assert.ok(!shut.includes('Dharok'));
  assert.deepEqual(glyphs(f.shut), ['down']);
  // The head flips the same key, shut or open.
  let flips = 0;
  walk(f.shut, (o) => {
    if ((o.on as { a?: string; key?: string } | undefined)?.key === KEY) flips++;
  });
  assert.equal(flips, 1);
});

test('the card with nothing worn: still there, the shut line says so', () => {
  const f = fold(guidePanelUi({ ...PANEL, gearNow: { empty: true, rows: [] } }))!;
  assert.ok(f, 'banked gear keeps the card');
  assert.ok(texts(f.shut).includes('Your gear now') && texts(f.shut).includes('nothing worn'));
  assert.ok(texts(f.open).some((t) => t.startsWith('Nothing worn right now')));
});

test('the card open: one row per target, the change ▲ or ▼, the other targets, the note and ↻', () => {
  const rows = [
    { name: 'Dharok', you: 3.1, guide: 4.2 },
    { name: 'Guthan', you: 6.6, guide: 6.0 },
    { name: 'Karil', you: 5.0, guide: 5.0 },
  ];
  const others = [{ name: 'Ahrim', setup: 'advanced-toxic-blowpipe-5', setupName: 'Toxic blowpipe' }];
  const open = fold(guidePanelUi({ ...PANEL, gearNow: { rows, others } }))!.open;
  const t = texts(open);
  for (const r of rows) assert.ok(t.some((x) => x.endsWith(r.name)), r.name);
  // Behind on Dharok (▼ 26%), ahead on Guthan (▲ 10%), even on Karil.
  assert.ok(t.includes('26%') && t.includes('10%') && t.includes('even'));
  // Ahrim has his own setup: a row that opens it.
  assert.ok(t.includes('Ahrim') && t.includes('own setup ›'));
  let toAhrim: Record<string, unknown> | null = null;
  walk(open, (o) => {
    if (o.s === 'own setup ›') toAhrim = o.on as Record<string, unknown>;
  });
  assert.equal((toAhrim as { args?: Record<string, string> } | null)?.args?.setup, 'advanced-toxic-blowpipe-5');
  assert.ok(t.includes("Assumes the guide's prayers, boosts and levels."), 'no levels known');
  assert.ok(texts(fold(guidePanelUi({ ...PANEL, gearNow: { rows, ownLevels: true } }))!.open).includes("Your levels; the guide's prayers and boosts."));
  // ↻ loads this guide again, on this setup.
  let again: Record<string, unknown> | null = null;
  walk(open, (o) => {
    if (o.t === 'text' && o.s === '↻') again = o.on as Record<string, unknown>;
  });
  assert.deepEqual(again, { a: 'load', v: 'guide', args: { id: '3', tier: 'beginner', setup: 'beginner-magic' } });
});

test('the card open: max hit, accuracy, speed and time per kill, You against Guide', () => {
  const mine = { maxHit: 38, accuracy: 0.72, speed: 4, ttk: 32 };
  const theirs = { maxHit: 41, accuracy: 0.8, speed: 4, ttk: 24 };
  const open = fold(guidePanelUi({ ...PANEL, gearNow: { rows: [{ name: 'Vorkath', you: 3, guide: 4, mine, theirs }] } }))!.open;
  const t = texts(open);
  for (const s of ['Max hit', '38', '41', 'Accuracy', '72%', '80%', 'Speed', '2.4s', 'Per kill', '0:32', '0:24']) assert.ok(t.includes(s), s);
});

test('the card open: slot by slot, worse first in the dry tone, better in green, the same on one line', () => {
  const it = (id: number, name: string) => ({ id, name });
  const slots = [
    { slot: 'cape', worn: it(29613, 'Imbued Zamorak cape (Deadman)'), guide: it(21791, 'Imbued Saradomin cape'), pct: null },
    { slot: 'weapon', worn: it(27275, "Tumeken's shadow"), guide: it(22323, 'Sanguinesti staff'), pct: 38.2 },
    { slot: 'body', worn: it(24666, 'Twisted ancestral robe top'), guide: it(21021, 'Ancestral robe top'), pct: null },
    { slot: 'hands', worn: null, guide: it(31106, 'Confliction gauntlets'), pct: -12.4 },
    { slot: 'ring', worn: it(25975, 'Lightbearer'), guide: it(28313, 'Magus ring'), pct: -2 },
  ];
  const open = fold(guidePanelUi({ ...PANEL, gearNow: { rows: [{ name: 'Dharok', you: 3, guide: 4 }], slots, unknown: ['Mystery ring'] } }))!.open;
  const t = texts(open);
  const signs: { s: string; color: unknown }[] = [];
  walk(open, (o) => {
    if (o.t === 'text' && typeof o.s === 'string' && /^[+−]\d+%$/.test(o.s)) signs.push({ s: o.s, color: o.color });
  });
  assert.deepEqual(signs.map((x) => x.s), ['−12%', '−2%', '+38%']);
  assert.equal(signs[2].color, '#6fdc6f', 'yours better: green');
  assert.notEqual(signs[0].color, '#6fdc6f', 'yours worse: not green');
  assert.ok(t.includes('Same or even: Cape, Body'));
  assert.ok(t.includes('Also worn: Mystery ring (unknown stats, not counted)'));
});

test('per slot: the sign is that one slot swapped, averaged over the targets', () => {
  const guide = melee({ weapon: id('Abyssal whip'), body: id('Bandos chestplate'), cape: id('Fire cape') });
  const now = gearNow(guide, barrows(guide), { weapon: id('Abyssal whip'), body: id('Rune platebody'), cape: id('Fire cape'), ring: id('Berserker ring') }, idx)!;
  const by = Object.fromEntries(now.slots.map((x) => [x.slot, x.pct]));
  assert.equal(by.weapon, null, 'same weapon');
  assert.equal(by.cape, null, 'same cape');
  assert.ok(by.body! < 0, 'a weaker body: worse');
  assert.ok(by.ring! > 0, 'a ring where the guide wears none: better');
  assert.equal(now.gap?.slot, 'body');
});

test('max hit and accuracy come with every row, from the same best-style result', () => {
  const guide = melee({ weapon: id('Abyssal whip'), body: id('Bandos chestplate') });
  const now = gearNow(guide, barrows(guide), { weapon: id('Abyssal whip') }, idx)!;
  for (const r of now.rows) {
    assert.ok(r.mine && r.theirs, r.monster.n);
    assert.equal(r.mine!.dps, r.you);
    assert.ok(r.mine!.maxHit > 0 && r.theirs!.maxHit >= r.mine!.maxHit);
    assert.ok(r.mine!.accuracy > 0 && r.mine!.accuracy <= 1);
    assert.equal(r.mine!.speed, 4);
  }
});

test("his real worn gear is read: the Deadman cape and the Lightbearer are known, none of it reads as empty", () => {
  const ids = [12002, 21018, 21024, 24666, 25975, 27275, 29613, 31097, 31106];
  const eq = equivalentsFor(ids, 'holds');
  const worn = wornGear(ids.map((x) => ({ id: x })), idx, eq);
  assert.deepEqual(unreadWorn(ids.map((x) => ({ id: x })), idx, eq), []);
  assert.equal(worn.cape, 29613);
  assert.equal(worn.ring, 25975);
  assert.equal(Object.keys(worn).length, ids.length);
  // The Deadman copy is the imbued god cape: the guide's Imbued Saradomin cape is the same.
  const sara = id('Imbued Saradomin cape');
  assert.ok(eq(29613).includes(sara), 'Deadman Zamorak counts as the Saradomin one');
  assert.ok(equivalentsFor([sara])(sara).includes(29617), 'Imbued Saradomin cape (Deadman) in the bank counts');
  // An id nothing knows stays unread (named by the panel), not an empty slot.
  assert.deepEqual(unreadWorn([{ id: 999_998 }, { id: 25975 }], idx), [999_998]);
});

test("Ahrim's row: the Barrows magic setup is for the other five, so Ahrim shows as another setup's", () => {
  const magic: GearSetup = { tier: 'advanced', name: 'Sanguinesti staff', gear: { weapon: id('Sanguinesti staff') }, style: 0, stats: STATS, targets: BROTHERS.slice(1) };
  const pipe: GearSetup = { tier: 'advanced', name: 'Toxic blowpipe', gear: { weapon: id('Toxic blowpipe') }, style: 0, stats: STATS, targets: [BROTHERS[0]] };
  const block: GearBlock = { monster: BROTHERS[0], monsters: BROTHERS, setups: [magic, pipe] };
  const now = gearNow(magic, block, { weapon: id("Tumeken's shadow") }, idx)!;
  assert.deepEqual(now.rows.map((r) => r.monster.n), BROTHERS.slice(1), 'the setup is for five brothers');
  // Ahrim comes back as the blowpipe setup's target.
  const setups = [{ key: 'magic', setup: magic }, { key: 'pipe', setup: pipe }];
  assert.deepEqual(otherTargets(setups[0], setups, block), [{ name: 'Ahrim the Blighted', setup: 'pipe', setupName: 'Toxic blowpipe' }]);
  assert.deepEqual(otherTargets(setups[0], setups.slice(0, 1), block), [{ name: 'Ahrim the Blighted', setup: null, setupName: null }], 'no setup for him: a row all the same');
  assert.deepEqual(otherTargets(setups[1], setups, block).map((o) => o.setup), ['magic', 'magic', 'magic', 'magic', 'magic']);
  const ui = guidePanelUi({ ...PANEL, gearNow: { rows: now.rows.map((r) => ({ name: r.monster.n.split(' the ')[0], you: r.you, guide: r.guide })), others: [{ name: 'Ahrim', setup: 'pipe', setupName: 'Toxic blowpipe' }] } });
  const t = texts(fold(ui)!.open);
  assert.ok(t.includes('Ahrim') && t.includes('own setup ›'));
});
