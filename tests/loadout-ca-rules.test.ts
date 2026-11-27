// Combat Achievements on the trip card (lib/loadout/caRules): the undone tasks that change a loadout
// per boss, their limits applied by the engine, and the one line saying what changed. Real gear data,
// no database.
//
// Run: npx tsx --test tests/loadout-ca-rules.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import caData from '../src/data/combatAchievements.json' with { type: 'json' };
import { CA_RULES, caName, caRule, casFor } from '../src/lib/loadout/caRules.ts';
import { PROFILES } from '../src/lib/loadout/profiles/index.ts';
import { loadoutFor } from '../src/lib/tripLoadout.ts';
import { equivalentsFor } from '../src/lib/itemFamilies.ts';
import type { InvItem } from '../src/lib/guideTiers.ts';
import { idx, MAX_BANK, SUPPLIES } from './fixtures/loadoutBanks.ts';

const NAMES = new Map(SUPPLIES.map((s) => [s.id, s.name]));
const nameOf = (x: number) => idx.item(x)?.n ?? NAMES.get(x) ?? `Item ${x}`;
const LEVELS = { attack: 99, strength: 99, defence: 99, ranged: 99, magic: 99, prayer: 99, hitpoints: 99 };

function trip(contentKey: string, ca: number | null, raidLevel: number | null = null) {
  const bank: InvItem[] = [...MAX_BANK.map((id) => ({ id })), ...SUPPLIES.map((s) => ({ id: s.id, q: s.q }))];
  const holds = equivalentsFor(bank.map((x) => x.id), 'holds');
  return loadoutFor({ contentKey, preset: 'experienced', idx, worn: [], inventory: [], bank, state: null, levels: LEVELS, raidLevel, nameOf, holds, isRunePouch: () => false, ca })!;
}
const kit = (l: ReturnType<typeof trip>['loadout'], key: string) => l.phases.find((p) => p.key === key)?.kit;

test('every rule names a real task of a profiled boss; done tasks drop out; easiest tier first', () => {
  const tasks = new Map((caData as { tasks: { id: number; name: string; tier: string }[] }).tasks.map((t) => [t.id, t]));
  for (const r of CA_RULES) {
    assert.ok(PROFILES[r.boss], `${r.id}: ${r.boss} has a profile`);
    assert.equal(r.name, tasks.get(r.id)?.name, `${r.id}: the game's name`);
    assert.equal(r.tier, tasks.get(r.id)?.tier, `${r.id}: the game's tier`);
    assert.equal(caName(r.id), r.name);
    assert.ok(!r.does.includes(' · '));
  }
  const all = casFor('zulrah', null);
  assert.ok(all.some((o) => o.name === 'Perfect Zulrah'));
  assert.ok(!all.some((o) => /Zulrah (Adept|Veteran|Master)$/.test(o.name)), 'kill counts change nothing: left out');
  const done = casFor('zulrah', new Set(['perfect zulrah']));
  assert.ok(!done.some((o) => o.name === 'Perfect Zulrah'));
  assert.equal(all[0].tier, 'Elite');
  assert.equal(caRule('zulrah', 273), null, 'a Vorkath task is not Zulrah’s');
});

test('Perfect Zulrah: two prayer potions packed, the food makes room, said in one line', () => {
  const base = trip('zulrah', null);
  const got = trip('zulrah', 229);
  const prayer = (l: typeof base) => l.loadout.inventory.filter((s) => s?.kind === 'supply' && /^prayer potion/i.test(s.name)).length;
  assert.equal(prayer(got) - prayer(base), 2);
  assert.equal(base.caLine, null);
  assert.match(got.caLine!, /^Perfect Zulrah: .*food swapped for 2 prayer potions$/);
  assert.ok(!got.caLine!.includes(' · '));
});

test('Vorkath melee only: no ranged or magic kit, Crumble Undead still cast on the spawn', () => {
  const got = trip('vorkath', 273);
  assert.equal(kit(got.loadout, 'main'), 'melee');
  assert.equal(kit(got.loadout, 'spawn'), 'cast:Crumble Undead');
  assert.ok(!got.loadout.requirementsUnmet.some((u) => u.code === 'constraint'), JSON.stringify(got.loadout.requirementsUnmet));
});

test('Vorkath without prayer: no prayer potions or restores', () => {
  const got = trip('vorkath', 274);
  assert.ok(!got.loadout.inventory.some((s) => s?.kind === 'supply' && /prayer potion|super restore|sanfew/i.test(s.name)));
});

test('a speed task builds the Max DPS plan', () => {
  const got = trip('cox', 322);
  assert.equal(got.loadout.preset, 'max');
  assert.match(got.caLine!, /the Max DPS plan/);
});

test('ToA: Zebak with melee only; only the tomb’s supplies leaves every supply slot free', () => {
  const chomp = trip('toa', 428, 300);
  assert.equal(kit(chomp.loadout, 'zebak'), 'melee');
  const bare = trip('toa', 424, 300);
  assert.ok(!bare.loadout.inventory.some((s) => s?.kind === 'supply'));
});

test('ToB without the Scythe: no Scythe of vitur anywhere', () => {
  const got = trip('tob', 253);
  const ids = [...Object.values(got.loadout.worn), ...got.loadout.switches.map((s) => s.id), ...got.loadout.specs.map((s) => s.id)];
  assert.ok(!ids.some((id) => /scythe of vitur/i.test(nameOf(id as number))));
});
