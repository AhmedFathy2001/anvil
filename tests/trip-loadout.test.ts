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
import type { Loadout } from '../src/lib/loadout/types.ts';

const NAMES = new Map(SUPPLIES.map((s) => [s.id, s.name]));
const nameOf = (x: number) => idx.item(x)?.n ?? NAMES.get(x) ?? `Item ${x}`;
const LEVELS = { attack: 99, strength: 99, defence: 99, ranged: 99, magic: 99, prayer: 99, hitpoints: 99 };

type Plan = 'learner' | 'experienced' | 'max' | null;
const MAGIC_WORN = ["Tumeken's shadow", 'Ancestral hat', 'Ancestral robe top', 'Ancestral robe bottom', 'Occult necklace'];

/** A trip at its bank: a kit worn, everything else of the max bank banked with supplies. */
function trip(contentKey: string, preset: Plan, wornNames = MAGIC_WORN, raidLevel: number | null = null) {
  const worn: InvItem[] = wornNames.map((n) => ({ id: idOf(n) }));
  const bank: InvItem[] = [...MAX_BANK.filter((id) => !worn.some((w) => w.id === id)).map((id) => ({ id })), ...SUPPLIES.map((s) => ({ id: s.id, q: s.q }))];
  const holds = equivalentsFor([...worn, ...bank].map((x) => x.id), 'holds');
  const got = loadoutFor({ contentKey, preset, idx, worn, inventory: [], bank, state: null, levels: LEVELS, raidLevel, nameOf, holds, isRunePouch: () => false });
  return { worn, bank, holds, got };
}
/** The trip in the ToA lobby: a magic kit worn. */
const toa = (preset: Plan) => trip('toa', preset, MAGIC_WORN, 300);

test('only trips with a boss profile use the engine; the plan is learner / experienced / max', () => {
  assert.ok(hasProfile('toa') && hasProfile('vorkath') && hasProfile('zulrah') && hasProfile('tob') && hasProfile('cox') && hasProfile('doom') && hasProfile('nex'));
  assert.ok(hasProfile('m:Yama#Normal') && hasProfile('m:Araxxor#In combat'), 'a boss picked by hand');
  assert.ok(!hasProfile('barrows') && !hasProfile('m:Scurrius'));
  assert.equal(loadoutFor({ contentKey: 'barrows', preset: null, idx, worn: [], inventory: [], bank: [], state: null, levels: null, raidLevel: null, nameOf, holds: () => [], isRunePouch: () => false }), null);
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
  assert.ok(plan.info.some((l) => /^\d+ switch slots, \d+ for supplies, 10 free for the raid's supplies$/.test(l)), plan.info.join(' | '));
  assert.ok(plan.info.some((l) => /Wardens P2 \(Tumeken's\).*: Twisted bow \(Rapid\)$/.test(l)), plan.info.join(' | '));
  assert.ok(plan.info.some((l) => /^Ranged: Twisted bow and \d pieces?$/.test(l)), plan.info.join(' | '));

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
  assert.ok(!check.info.some((x) => /^\d+ switch slots? packed/.test(x)), 'the plan says the switch slots, not the packed count');
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
  const c = withPlan({ rows: [], info: ['3 switch slots packed, 25 free for supplies'], unknown: [] }, plan);
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

test('panel: "Avoid Defence XP" is one plain row that flips the setting (trip-defxp)', () => {
  const base = {
    region: '13454', regionName: 'the ToA lobby', content: { key: 'toa', name: 'Tombs of Amascut', short: 'ToA' }, fromRegion: true, source: 'calc' as const, sourceLine: 'x', guide: null,
    check: { rows: [], info: [], unknown: [] }, status: 'ready' as const, checkedAt: '05:27', hasOwn: false, canSave: true, options: [], monsters: [],
    plan: { preset: 'max', presets: [{ key: 'max', label: 'Max DPS' }], blurb: 'b' },
  };
  const on = JSON.stringify(tripPanelUi({ ...base, defXp: { on: true } }));
  assert.ok(on.includes('Avoid Defence XP') && on.includes('"act":"trip-defxp"') && on.includes('"dx":"0"'), 'on: a click turns it off');
  const off = JSON.stringify(tripPanelUi({ ...base, defXp: { on: false } }));
  assert.ok(off.includes('"dx":"1"'));
  assert.ok(!on.includes(' · ') && !off.includes(' · '));
  const own = JSON.stringify(tripPanelUi({ ...base, defXp: { on: true }, setupSel: 3 }));
  assert.ok(!own.includes('Avoid Defence XP'), 'only with Anvil’s loadout');
});

// ── Raids that used to fall to the calc ──────────────────────────────────────────────────────────

const names = (ids: (number | null | undefined)[]) => ids.filter((x): x is number => x != null).map((x) => nameOf(x));
const kitPieces = (l: Loadout, kit: string) => l.switches.filter((s) => s.kit === kit && s.slot !== 'weapon' && s.slot !== 'ammo');

test('ToB, max bank: Scythe worn in melee armour, a Twisted bow switch, and the magic switch is a weapon and at most two pieces', () => {
  for (const preset of ['learner', 'experienced', 'max'] as const) {
    const { got } = trip('tob', preset);
    const l = got!.loadout;
    assert.deepEqual(l.requirementsUnmet, [], `${preset}: ${JSON.stringify(l.requirementsUnmet)}`);
    assert.equal(l.wornStyle, 'melee', preset);
    assert.equal(nameOf(l.worn.weapon!), 'Scythe of Vitur', `${preset}: the Scythe is worn`);
    assert.match(nameOf(l.worn.body!), /torva|bandos|inquisitor/i, `${preset}: melee body worn`);
    assert.ok(l.switches.some((s) => s.kit === 'ranged' && s.slot === 'weapon' && /^twisted bow$/i.test(s.name)), `${preset}: a Twisted bow switch`);
    assert.ok(l.switches.some((s) => s.kit === 'magic' && s.slot === 'weapon'), `${preset}: a magic weapon switch for the blue nylocas`);
    const mage = kitPieces(l, 'magic');
    assert.ok(mage.length <= 2, `${preset}: ${mage.length} magic pieces (${mage.map((s) => s.name).join(', ')})`);
    // The Nylocas each need their own style: every colour has a kit.
    for (const k of ['nylo-melee', 'nylo-ranged', 'nylo-magic']) assert.ok(l.phases.find((p) => p.key === k)?.kit, `${preset}: ${k}`);
    assert.equal(l.phases.find((p) => p.key === 'xarpus')?.kit, 'melee', 'Xarpus has no melee defence: the Scythe leads there');
    // Brews and restores brought in: the rooms give none.
    const inv = l.inventory.map((x) => x?.name ?? '');
    assert.ok(inv.filter((n) => /saradomin brew/i.test(n)).length >= 3, `${preset}: brews (${inv.join(', ')})`);
    assert.ok(inv.filter((n) => /super restore/i.test(n)).length >= 3, `${preset}: restores`);
  }
  const learner = trip('tob', 'learner').got!.loadout;
  const max = trip('tob', 'max').got!.loadout;
  assert.ok(learner.switches.length < max.switches.length, `${learner.switches.length} < ${max.switches.length}`);
  assert.ok(learner.inventory.filter((s) => s?.kind === 'supply').length > max.inventory.filter((s) => s?.kind === 'supply').length);
});

test('CoX, max bank: Twisted bow worn, a melee switch for the Olm melee hand, a magic switch for the mage hand, room for the raid supplies', () => {
  for (const preset of ['learner', 'experienced', 'max'] as const) {
    const l = trip('cox', preset).got!.loadout;
    assert.deepEqual(l.requirementsUnmet, [], preset);
    assert.equal(l.wornStyle, 'ranged', preset);
    assert.equal(nameOf(l.worn.weapon!), 'Twisted bow', preset);
    assert.ok(l.switches.some((s) => s.kit === 'melee' && s.slot === 'weapon'), `${preset}: melee weapon`);
    assert.equal(l.phases.find((p) => p.key === 'olm-melee')?.kit, 'melee', `${preset}: the melee hand is meleed`);
    assert.notEqual(l.phases.find((p) => p.key === 'olm-head')?.kit, 'melee', 'the head is out of melee reach');
    assert.ok(l.inventory.filter((s) => s?.kind === 'reserved').length >= 10, `${preset}: free slots for the raid's potions`);
    assert.ok(kitPieces(l, 'magic').length <= 3, `${preset}: ${names(kitPieces(l, 'magic').map((s) => s.id)).join(', ')}`);
  }
  assert.ok(trip('cox', 'max').got!.loadout.switches.some((s) => s.kit === 'magic' && s.slot === 'weapon'), 'max: a magic weapon for the mage hand');
});

test('setup layout: wearing and packing the whole setup, "Show my setup" still lays out every piece (worn ones on the doll)', () => {
  const first = trip('tob', 'max', []).got!;
  const setup = first.setup;
  const worn: InvItem[] = Object.values(setup.gear).map((id) => ({ id }));
  const inventory: InvItem[] = setup.inventory!.filter((x): x is InvItem => !!x).map((x) => ({ id: x.id, q: 1 }));
  const carried = new Set([...worn, ...inventory].map((x) => x.id));
  const bank: InvItem[] = [...MAX_BANK.filter((id) => !carried.has(id)).map((id) => ({ id })), ...SUPPLIES.filter((s) => !carried.has(s.id)).map((s) => ({ id: s.id, q: s.q }))];
  const holds = equivalentsFor([...worn, ...inventory, ...bank].map((x) => x.id), 'holds');
  const needs = equivalentsFor([...worn, ...inventory, ...bank].map((x) => x.id), 'needs');
  const content = tripContent('tob')!;
  const monsters = content.targets.map((t) => idx.monster(t)!);
  const check = checkTrip({ content, setup, source: 'calc', monsters, worn, inventory, bank, state: null, levels: LEVELS, idx, needs, holds, nameOf, isRunePouch: () => false, raidLevel: null });
  const DOLL: Record<string, number> = { head: 1, cape: 8, neck: 9, ammo: 10, weapon: 16, body: 17, shield: 18, legs: 25, hands: 32, feet: 33, ring: 34 };
  const lay = check.layouts!.setup;
  for (const [slot, id] of Object.entries(setup.gear)) assert.equal(lay.layout[DOLL[slot]], id, `${slot}: ${nameOf(id)} on the doll`);
  for (const it of inventory.filter((x) => idx.item(x.id))) assert.ok(lay.ids.includes(it.id), `switch ${nameOf(it.id)} laid out`);
  // Nothing has to come out of the bank for the gear: "Show missing" holds no worn piece.
  for (const id of Object.values(setup.gear)) assert.ok(!check.layouts!.missing.ids.includes(id), `${nameOf(id)} is not missing`);
});

// ── The card's lines ─────────────────────────────────────────────────────────────────────────────

test('card lines: the stance per part of the fight, each switch by its job, the spec order, no dot separators', () => {
  const cox = trip('cox', 'max').got!.plan.info;
  assert.ok(cox.some((l) => /^Tekton(, [^:]+)?: Scythe of Vitur on (slash|crush|stab) \([A-Z][a-z]+\)$/.test(l)), cox.join(' | '));
  assert.ok(cox.some((l) => /Skeletal Mystics[^:]*: Tumeken's shadow \(Accurate\)$/.test(l)), 'the Mystics with the Shadow');
  assert.ok(cox.some((l) => /^Pickaxe for the Guardians: Dragon pickaxe$/.test(l)));
  assert.ok(cox.includes('Spec: Dragon warhammer, then Bandos godsword'), cox.join(' | '));
  const doom = trip('doom', 'experienced').got!.plan.info;
  assert.ok(doom.some((l) => /^Melee punish: /.test(l)), doom.join(' | '));
  assert.ok(doom.some((l) => /^Doom: Twisted bow \(Rapid\)$/.test(l)));
  for (const l of [...cox, ...doom]) assert.ok(!l.includes(' · '), l);
});

test('card lines: a step-down names the reference, a missing job says what is skipped', () => {
  const noBow = MAX_BANK.filter((id) => !/^twisted bow$|^zaryte crossbow$/i.test(nameOf(id)));
  const worn: InvItem[] = [];
  const bank: InvItem[] = [...noBow.map((id) => ({ id })), ...SUPPLIES.map((s) => ({ id: s.id, q: s.q }))];
  const holds = equivalentsFor(bank.map((x) => x.id), 'holds');
  const got = loadoutFor({ contentKey: 'doom', preset: 'experienced', idx, worn, inventory: [], bank, state: null, levels: LEVELS, raidLevel: null, nameOf, holds, isRunePouch: () => false })!;
  const info = got.plan.info;
  assert.ok(info.some((l) => /^Ranged: .+ \(best is Twisted bow\)$/.test(l)), info.join(' | '));
  assert.ok(info.some((l) => /^Spec: .+ \(best is Zaryte crossbow\)$/.test(l)) || info.includes('No Zaryte crossbow: skip the spec, one more food'), info.join(' | '));
});
