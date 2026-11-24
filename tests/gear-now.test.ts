// "Your gear now vs this setup" (lib/gearNow + the guide panel's card): worn gear to slots, one row
// per target, the change's sign, the biggest single-slot gap, and no card without a worn reading.
// Real items and monsters from the bundled gear data. No database.
//
// Run: npx tsx --test tests/gear-now.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gearNow, withSlot, wornGear } from '../src/lib/gearNow.ts';
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

test('the card: hidden without a worn reading, one row per target, the change ▲ or ▼, the gap and the note', () => {
  assert.ok(!texts(guidePanelUi(PANEL)).includes('Your gear now vs this setup'), 'no reading, no card');
  assert.ok(!texts(guidePanelUi({ ...PANEL, gearNow: null })).includes('Your gear now vs this setup'));
  const rows = [
    { name: 'Ahrim', you: 3.1, guide: 4.2 },
    { name: 'Dharok', you: 6.6, guide: 6.0 },
    { name: 'Karil', you: 5.0, guide: 5.0 },
  ];
  const ui = guidePanelUi({ ...PANEL, gearNow: { rows, ttk: null, gap: { slot: 'weapon', guide: 'Toxic blowpipe', worn: 'Trident of the Swamp' } } });
  const t = texts(ui);
  assert.ok(t.includes('Your gear now vs this setup'));
  for (const r of rows) assert.ok(t.includes(r.name), r.name);
  // Behind on Ahrim (▼ 26%), ahead on Dharok (▲ 10%), even on Karil.
  assert.ok(t.includes('26%') && t.includes('10%') && t.includes('even'));
  assert.deepEqual(glyphs(ui), ['down', 'up']);
  assert.ok(t.includes('Biggest gap: weapon (Toxic blowpipe vs your Trident of the Swamp)'));
  assert.ok(t.some((s) => s.startsWith("Assumes the guide's prayers, boosts")));
  assert.ok(!t.includes('Per kill'), 'kill times only for one target');
  // ↻ loads this guide again, on this setup.
  let again: Record<string, unknown> | null = null;
  walk(ui, (o) => {
    if (o.t === 'text' && o.s === '↻') again = o.on as Record<string, unknown>;
  });
  assert.deepEqual(again, { a: 'load', v: 'guide', args: { id: '3', tier: 'beginner', setup: 'beginner-magic' } });
  const one = guidePanelUi({ ...PANEL, gearNow: { rows: rows.slice(0, 1), ttk: { you: '0:32', guide: '0:24' }, gap: null } });
  assert.ok(texts(one).includes('Per kill') && texts(one).includes('0:32'));
});
