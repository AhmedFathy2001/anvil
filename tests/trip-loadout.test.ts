// The pre-trip check built from the loadout engine (lib/tripLoadout): a trip with a boss profile gets
// the engine's setup for the plan picked (worn loadout on the doll, switches and supplies as the
// 28-slot inventory), checked like a guide's; other trips keep the calc. Real gear data, no database.
//
// Run: npx tsx --test tests/trip-loadout.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkTrip, isSpecWeapon, raidScaled } from '../src/lib/tripCheck.ts';
import { tripContent } from '../src/lib/tripContent.ts';
import { tripLayout } from '../src/lib/tripLayout.ts';
import { DEFAULT_PLAN, cleanPlan, hasProfile, loadoutFor, withPlan } from '../src/lib/tripLoadout.ts';
import { tripPanelUi } from '../src/lib/pluginUi/tripUi.ts';
import { equivalentsFor } from '../src/lib/itemFamilies.ts';
import type { InvItem } from '../src/lib/guideTiers.ts';
import { idOf, idx, MAX_BANK, SUPPLIES } from './fixtures/loadoutBanks.ts';

const NAMES = new Map(SUPPLIES.map((s) => [s.id, s.name]));
const nameOf = (x: number) => idx.item(x)?.n ?? NAMES.get(x) ?? `Item ${x}`;
const LEVELS = { attack: 99, strength: 99, defence: 99, ranged: 99, magic: 99, prayer: 99, hitpoints: 99 };

/** The trip in the ToA lobby: a magic kit worn, everything else banked with supplies. */
function toa(preset: 'learner' | 'experienced' | 'max' | null) {
  const wornNames = ["Tumeken's shadow", 'Ancestral hat', 'Ancestral robe top', 'Ancestral robe bottom', 'Occult necklace'];
  const worn: InvItem[] = wornNames.map((n) => ({ id: idOf(n) }));
  const bank: InvItem[] = [...MAX_BANK.filter((id) => !worn.some((w) => w.id === id)).map((id) => ({ id })), ...SUPPLIES.map((s) => ({ id: s.id, q: s.q }))];
  const holds = equivalentsFor([...worn, ...bank].map((x) => x.id), 'holds');
  const got = loadoutFor({ contentKey: 'toa', preset, idx, worn, inventory: [], bank, state: null, levels: LEVELS, raidLevel: 300, nameOf, holds, isRunePouch: () => false });
  return { worn, bank, holds, got };
}

test('only trips with a boss profile use the engine; the plan is learner / experienced / max', () => {
  assert.ok(hasProfile('toa') && hasProfile('vorkath') && hasProfile('zulrah'));
  assert.ok(!hasProfile('tob') && !hasProfile('doom'));
  assert.equal(loadoutFor({ contentKey: 'tob', preset: null, idx, worn: [], inventory: [], bank: [], state: null, levels: null, raidLevel: null, nameOf, holds: () => [], isRunePouch: () => false }), null);
  assert.equal(cleanPlan('max'), 'max');
  assert.equal(cleanPlan('junk'), null);
  assert.equal(toa(null).got!.plan.preset, DEFAULT_PLAN);
});

test('ToA: the worn loadout fills the doll, the switches come first in a 28-slot inventory, the raid supply room is left empty', () => {
  const { worn, bank, holds, got } = toa('experienced');
  assert.ok(got);
  const { setup, plan, loadout } = got!;
  assert.equal(setup.gear.weapon, idOf("Tumeken's shadow"), 'the Shadow is worn');
  for (const s of ['head', 'body', 'legs', 'neck']) assert.ok(setup.gear[s] != null, `${s} worn`);
  assert.equal(setup.inventory!.length, 28);
  const switches = loadout.inventory.filter((s) => s?.kind === 'switch' || s?.kind === 'spec').length;
  assert.ok(setup.inventory!.slice(0, switches).every((x) => x && idx.item(x.id)), 'switches first');
  const empty = setup.inventory!.filter((x) => !x).length;
  assert.ok(empty >= 10, `${empty} empty slots: room for the raid's supplies`);
  assert.ok(setup.inventory!.slice(28 - empty).every((x) => !x), 'the empty room at the end');
  assert.ok(plan.info.some((l) => /^Switches: \d+ slots · supplies \d+ · 10 free for the raid's supplies$/.test(l)), plan.info.join(' | '));
  assert.ok(plan.info.some((l) => /^Ranged: .*Wardens P2/.test(l)), plan.info.join(' | '));

  // Checked like a guide's setup: every worn piece has its slot, so the doll is drawn.
  const toaC = tripContent('toa')!;
  const ids = [...worn, ...bank].map((x) => x.id);
  const needs = equivalentsFor([...ids, ...Object.values(setup.gear), ...setup.inventory!.filter(Boolean).map((x) => x!.id)], 'needs');
  const monsters = toaC.targets.map((t) => idx.monster(t)!).map((m) => raidScaled(m, 300));
  const check = withPlan(checkTrip({ content: toaC, setup, source: 'calc', monsters, worn, inventory: [], bank, state: null, levels: LEVELS, idx, needs, holds, nameOf, isRunePouch: () => false, raidLevel: 300 }), plan);
  const has = (list: InvItem[]) => (x: number) => list.some((i) => i.id === x);
  const l = tripLayout({ setup, rows: check.rows, worn, inventory: [], bank, state: null, carries: has(worn), owns: has([...worn, ...bank]), slotOf: (x) => (idx.item(x) ? (idx.item(x)!.s === '2h' ? 'weapon' : idx.item(x)!.s) : null), nameOf, isRunePouch: () => false, isSpec: (x) => isSpecWeapon(nameOf(x)) });
  assert.equal(l.worn.weapon.have, 'here');
  assert.equal(l.worn.head.have, 'here');
  assert.ok(l.inventory.filter(Boolean).every((x) => x!.have === 'bank'), 'nothing packed yet: every switch and supply is in the bank');
  assert.ok(!check.info.some((x) => /^Switches \d+ slots? ·/.test(x)), 'the plan says the switch slots, not the packed count');
});

test('the plans differ: Learner packs fewer switches and more supplies than Max DPS', () => {
  const learner = toa('learner').got!.loadout;
  const max = toa('max').got!.loadout;
  const sw = (l: typeof learner) => l.inventory.filter((s) => s?.kind === 'switch' || s?.kind === 'spec').length;
  const sup = (l: typeof learner) => l.inventory.filter((s) => s?.kind === 'supply').length;
  assert.ok(sw(learner) < sw(max), `${sw(learner)} < ${sw(max)}`);
  assert.ok(sup(learner) > sup(max), `${sup(learner)} > ${sup(max)}`);
});

test('a rule the bank breaks is a failing row', () => {
  const plan = { preset: 'experienced' as const, presets: [], blurb: '', unmet: ["Wardens P2 (Tumeken's) needs ranged: you own no ranged weapon that works here"], info: ['Magic: Ba-Ba'] };
  const c = withPlan({ rows: [], info: ['Switches 3 slots · 25 free for supplies'], unknown: [] }, plan);
  assert.deepEqual(c.rows.map((r) => [r.ok, r.line]), [[false, plan.unmet[0]]]);
  assert.deepEqual(c.info, ['Magic: Ba-Ba']);
});

test('panel: the plan chooser posts trip-plan with the trip, the picked plan lifted', () => {
  const ui = JSON.stringify(
    tripPanelUi({
      region: '13454', regionName: 'the ToA lobby', content: { key: 'toa', name: 'Tombs of Amascut', short: 'ToA' }, fromRegion: true, source: 'calc', sourceLine: 'x', guide: null,
      check: { rows: [], info: [], unknown: [] }, status: 'ready', checkedAt: '05:27', hasOwn: false, canSave: true, options: [], monsters: [],
      plan: { preset: 'max', presets: [{ key: 'learner', label: 'Learner' }, { key: 'experienced', label: 'Experienced' }, { key: 'max', label: 'Max DPS' }], blurb: 'Armour swaps for each style.' },
    }),
  );
  assert.ok(ui.includes('"act":"trip-plan"'));
  assert.ok(ui.includes('"plan":"learner"') && ui.includes('"plan":"max"'));
  assert.ok(ui.includes('Armour swaps for each style.'));
  assert.ok(/"s":"Max DPS","color":"white"/.test(ui), 'the picked plan is lifted');
});
