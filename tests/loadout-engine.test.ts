// The loadout engine (lib/loadout): golden loadouts per boss profile against the OSRS Wiki strategy
// pages' reference setups (a "max" bank), sensible degrading with a mid bank, the presets, and the
// hard rules. Real items and monsters from the bundled gear data. No database.
//
// Run: npx tsx --test tests/loadout-engine.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildLoadout } from '../src/lib/loadout/engine.ts';
import { TOA, VORKATH, ZULRAH } from '../src/lib/loadout/profiles/index.ts';
import type { BossProfile, Loadout, PlayerInput, Preset, Style } from '../src/lib/loadout/types.ts';
import { isRestricted } from '../src/lib/tripCheck.ts';
import { SLOTS } from '../src/lib/dps/tables.ts';
import { idOf, idx, maxPlayer, midPlayer, MAX_BANK, MID_BANK } from './fixtures/loadoutBanks.ts';

const run = (profile: BossProfile, player: PlayerInput, preset: Preset = 'max') => buildLoadout({ profile, preset, player, idx });
const name = (id: number | null | undefined) => idx.item(id)?.n ?? '';
const carried = (l: Loadout) => [...Object.values(l.worn), ...l.switches.map((s) => s.id), ...l.specs.map((s) => s.id), ...(l.quiverAmmo ? [l.quiverAmmo] : [])].filter((x): x is number => x != null);
const carriedNames = (l: Loadout) => carried(l).map(name);
const switchWeapons = (l: Loadout, kit: string) => l.switches.filter((s) => s.kit === kit && s.slot === 'weapon').map((s) => s.name);
const phaseKit = (l: Loadout, key: string) => l.phases.find((p) => p.key === key)?.kit;
const supplySlots = (l: Loadout) => l.inventory.filter((s) => s?.kind === 'supply').length;
const switchSlots = (l: Loadout) => l.inventory.filter((s) => s?.kind === 'switch' || s?.kind === 'spec').length;

/** What a style reads off a piece (as the engine's shortlist does). */
const score = (b: number[], k: Style) => (k === 'melee' ? Math.max(b[0], b[1], b[2]) + 1.5 * b[5] : k === 'ranged' ? b[4] + 1.5 * b[6] : b[3] + 3 * b[7]);
const offStyle = (id: number, k: Style) => {
  const b = idx.item(id)!.b;
  const own = Math.max(0, score(b, k));
  return (['melee', 'ranged', 'magic'] as const).some((o) => o !== k && score(b, o) > 3 * own + 3);
};

/** The checks every loadout must pass, golden or not. */
function sane(l: Loadout, bank: number[]) {
  assert.equal(l.inventory.length, 28, 'a 28-slot inventory');
  for (const id of carried(l)) assert.ok(!isRestricted(name(id)), `no restricted item: ${name(id)}`);
  // No piece carried twice, nor two forms of one piece.
  const fam = carried(l).map((id) => name(id).toLowerCase().replace(/\s*\([^()]*\)$/, ''));
  assert.equal(new Set(fam).size, fam.length, `no duplicate family: ${fam.join(', ')}`);
  // No off-style pieces: worn ones for the worn style, each switch for its own kit.
  for (const s of SLOTS) {
    const id = l.worn[s];
    if (id != null && s !== 'weapon' && s !== 'ammo' && l.wornStyle) assert.ok(!offStyle(id, l.wornStyle) || /^lightbearer$/i.test(name(id)), `worn ${name(id)} fits ${l.wornStyle}`);
  }
  for (const sw of l.switches) {
    const k = sw.kit.startsWith('cast:') ? 'magic' : (sw.kit as Style);
    if (sw.slot !== 'weapon' && sw.slot !== 'ammo') assert.ok(!offStyle(sw.id, k), `${sw.name} is no off-style piece in the ${sw.kit} switch`);
  }
  // No empty worn slot when the bank has an on-style piece for it.
  const weapon = idx.item(l.worn.weapon);
  for (const s of SLOTS) {
    if (s === 'weapon' || s === 'ammo' || l.worn[s] != null || (s === 'shield' && weapon?.h2)) continue;
    const owned = bank.map((id) => idx.item(id)!).filter((it) => it.s === s && !isRestricted(it.n) && l.wornStyle && !offStyle(it.id, l.wornStyle) && score(it.b, l.wornStyle) > 0);
    assert.equal(owned.length, 0, `${s} left empty though ${owned.map((x) => x.n).join(', ')} is owned`);
  }
}

// ── Vorkath ──────────────────────────────────────────────────────────────────────────────────

test('Vorkath, max bank: the wiki ranged setup (DHCB, dragon bolts, Salve (ei), dragonfire off-hand) + a Crumble Undead staff', () => {
  const l = run(VORKATH, maxPlayer());
  sane(l, MAX_BANK);
  assert.deepEqual(l.requirementsUnmet, []);
  assert.equal(l.wornStyle, 'ranged');
  assert.equal(name(l.worn.weapon), 'Dragon hunter crossbow');
  assert.match(name(l.worn.ammo), /^(ruby|diamond) dragon bolts \(e\)$/i);
  assert.equal(name(l.worn.neck), 'Salve amulet(ei)');
  assert.match(name(l.worn.body), /^(masori body \(f\)|elite void top)$/i);
  assert.match(name(l.worn.shield), /^(dragonfire ward|twisted buckler)$/i, 'an off-hand that blocks dragonfire');
  assert.match(name(l.worn.cape), /dizana's quiver/i);
  // The spawn: a staff that autocasts Crumble Undead, standard book, the runes in the pouch.
  assert.equal(phaseKit(l, 'spawn'), 'cast:Crumble Undead');
  assert.equal(l.spellbook, 'standard');
  assert.ok(l.runePouch?.some((r) => r.rune === 'Chaos'));
  assert.ok(l.inventory.some((s) => /super antifire/i.test(s?.name ?? '')));
  assert.ok(l.inventory.some((s) => /anti-venom/i.test(s?.name ?? '')));
  assert.ok(!l.switches.some((s) => s.kit === 'melee'), 'no melee switch on a ranged kill');
  for (const w of l.why) assert.ok(w.why.length > 0 && w.why.length < 140, `short reason for ${w.pick}`);
});

test('Vorkath, mid bank: a weaker ranged weapon, still every rule met', () => {
  const max = run(VORKATH, maxPlayer());
  const l = run(VORKATH, midPlayer());
  sane(l, MID_BANK);
  assert.deepEqual(l.requirementsUnmet, []);
  assert.equal(l.wornStyle, 'ranged');
  assert.match(name(l.worn.weapon), /^(toxic blowpipe|armadyl crossbow|rune crossbow)$/i);
  assert.equal(name(l.worn.neck), 'Salve amulet(ei)', 'undead: the salve still beats any amulet');
  assert.ok(l.expectedTime > max.expectedTime);
  assert.equal(phaseKit(l, 'spawn'), 'cast:Crumble Undead');
  assert.ok(switchWeapons(l, 'cast:Crumble Undead').includes("Slayer's staff"));
});

test('Vorkath: no staff that autocasts, no super antifire → named in requirementsUnmet, never dropped', () => {
  const staffs = new Set(["Slayer's staff", 'Kodai wand', 'Trident of the swamp'].map((n) => idOf(n)));
  const l = run(VORKATH, maxPlayer({ owned: MAX_BANK.filter((id) => !staffs.has(id)), supplies: [{ id: 385, name: 'Shark', q: 100 }] }));
  const codes = l.requirementsUnmet.map((u) => u.code);
  assert.ok(codes.includes('spell'), JSON.stringify(l.requirementsUnmet));
  assert.ok(codes.includes('antifire'));
  assert.ok(codes.includes('antivenom'));
  assert.ok(codes.includes('nothing'), 'the spawn phase has nothing that can kill it');
});

test('Vorkath: a Serpentine helm covers venom, so no anti-venom is packed', () => {
  // A melee-only bank where the Serpentine helm is the best head: venom is covered.
  const bank = ['Dragon hunter lance', 'Serpentine helm', 'Bandos chestplate', 'Bandos tassets', 'Amulet of torture', 'Ferocious gloves', 'Primordial boots', 'Infernal cape', 'Ultor ring', 'Avernic defender', "Slayer's staff"].map(idOf);
  const l = run(VORKATH, maxPlayer({ owned: bank }));
  assert.equal(name(l.worn.weapon), 'Dragon hunter lance');
  assert.equal(name(l.worn.head), 'Serpentine helm');
  assert.ok(!l.inventory.some((s) => /anti-venom/i.test(s?.name ?? '')));
  assert.ok(!l.requirementsUnmet.some((u) => u.code === 'antivenom'));
  assert.ok(l.warnings.some((w) => /dragonfire shield/i.test(w)), 'no dragonfire shield: said');
});

// ── Zulrah ───────────────────────────────────────────────────────────────────────────────────

test('Zulrah, max bank: magic worn (Shadow) with a ranged switch (Tbow) for Tanzanite, never melee', () => {
  const l = run(ZULRAH, maxPlayer());
  sane(l, MAX_BANK);
  assert.deepEqual(l.requirementsUnmet, []);
  assert.equal(l.wornStyle, 'magic');
  assert.equal(name(l.worn.weapon), "Tumeken's shadow");
  assert.deepEqual(switchWeapons(l, 'ranged'), ['Twisted bow']);
  assert.ok(l.switches.some((s) => s.kit === 'ranged' && /masori/i.test(s.name)), 'Masori comes along with the bow');
  assert.ok(!l.switches.some((s) => s.kit === 'melee'));
  assert.equal(phaseKit(l, 'tanzanite'), 'ranged');
  assert.equal(phaseKit(l, 'serpentine'), 'magic');
  assert.equal(phaseKit(l, 'magma'), 'magic');
  assert.ok(l.inventory.some((s) => /anti-venom/i.test(s?.name ?? '')));
  assert.ok(l.switches.length <= ZULRAH.presets.max.switchBudget);
});

test('Zulrah, mid bank: Trident and a blowpipe, no melee, slower than max', () => {
  const max = run(ZULRAH, maxPlayer());
  const l = run(ZULRAH, midPlayer());
  sane(l, MID_BANK);
  assert.deepEqual(l.requirementsUnmet, []);
  assert.ok(carriedNames(l).includes('Trident of the Swamp'));
  assert.ok(carriedNames(l).some((n) => /blowpipe|crossbow/i.test(n)));
  assert.ok(!carried(l).some((id) => /whip|defender/i.test(name(id))), 'no melee piece at Zulrah');
  assert.ok(l.expectedTime > max.expectedTime);
});

test('Zulrah: a melee-only bank cannot do it, and says so', () => {
  const l = run(ZULRAH, midPlayer({ owned: ['Abyssal whip', 'Dragon defender', 'Fighter torso'].map(idOf) }));
  assert.ok(l.requirementsUnmet.some((u) => u.code === 'nothing'));
  assert.equal(l.wornStyle, null);
});

// ── Tombs of Amascut ─────────────────────────────────────────────────────────────────────────

test('ToA, max bank: Shadow worn, Tbow ranged switch for P2, Fang melee switch, specs with Lightbearer, within budget', () => {
  const l = run(TOA, maxPlayer());
  sane(l, MAX_BANK);
  assert.deepEqual(l.requirementsUnmet, []);
  assert.equal(l.wornStyle, 'magic');
  assert.equal(name(l.worn.weapon), "Tumeken's shadow");
  assert.deepEqual(switchWeapons(l, 'ranged'), ['Twisted bow']);
  assert.deepEqual(switchWeapons(l, 'melee'), ["Osmumten's fang"]);
  assert.equal(phaseKit(l, 'p2-tumeken'), 'ranged');
  assert.equal(phaseKit(l, 'p2-elidinis'), 'magic');
  assert.equal(phaseKit(l, 'p2-core'), 'melee');
  assert.equal(phaseKit(l, 'kephri'), 'melee', 'Kephri in melee (stab), as the wiki says');
  assert.ok(l.specs.some((s) => s.name === 'Zaryte crossbow'));
  assert.equal(name(l.worn.ring), 'Lightbearer', 'specs along: the spec ring is worn');
  assert.ok(switchSlots(l) <= TOA.presets.max.switchBudget);
  assert.ok(l.inventory.filter((s) => s?.kind === 'reserved').length >= 8, 'room kept for the raid’s supplies');
});

test('ToA, mid bank: all three styles carried for the Wardens, slower than max', () => {
  const max = run(TOA, maxPlayer());
  const l = run(TOA, midPlayer());
  sane(l, MID_BANK);
  assert.deepEqual(l.requirementsUnmet, []);
  const styles = new Set([l.wornStyle, ...l.switches.map((s) => s.kit)]);
  for (const s of ['melee', 'ranged', 'magic']) assert.ok(styles.has(s as Style), `${s} carried`);
  assert.ok(l.expectedTime > max.expectedTime * 1.5);
  assert.ok(!carriedNames(l).includes("Slayer's staff") || !l.switches.some((s) => s.kit === 'melee' && s.name === "Slayer's staff"), 'a staff is no melee weapon');
});

test('ToA: a higher raid level takes longer; no ranged weapon fails the Wardens P2 rule', () => {
  const low = run(TOA, maxPlayer({ mode: { raidLevel: 150 } }));
  const high = run(TOA, maxPlayer({ mode: { raidLevel: 500 } }));
  assert.ok(high.expectedTime > low.expectedTime);
  const noRanged = run(TOA, maxPlayer({ constraints: { bannedStyles: ['ranged'] } }));
  assert.ok(noRanged.requirementsUnmet.some((u) => u.code === 'style' && /Tumeken/.test(u.message)), JSON.stringify(noRanged.requirementsUnmet));
  assert.ok(!noRanged.switches.some((s) => s.kit === 'ranged'));
});

// ── Presets ──────────────────────────────────────────────────────────────────────────────────

test('presets: a learner packs fewer switches and more supplies than max', () => {
  for (const profile of [VORKATH, ZULRAH, TOA]) {
    for (const player of [maxPlayer(), midPlayer()]) {
      const learner = run(profile, player, 'learner');
      const max = run(profile, player, 'max');
      assert.ok(switchSlots(learner) <= switchSlots(max), `${profile.key}: switches ${switchSlots(learner)} ≤ ${switchSlots(max)}`);
      assert.ok(supplySlots(learner) >= supplySlots(max), `${profile.key}: supplies ${supplySlots(learner)} ≥ ${supplySlots(max)}`);
      assert.ok(switchSlots(learner) <= profile.presets.learner.switchBudget + (profile.phases.some((p) => p.required?.length) ? 3 : 0));
    }
    const l = run(profile, maxPlayer(), 'learner');
    const m = run(profile, maxPlayer(), 'max');
    assert.ok(switchSlots(l) < switchSlots(m) || supplySlots(l) > supplySlots(m), `${profile.key}: the presets differ`);
  }
});

test('a no-switch constraint still brings what the fight requires, and says it is over budget', () => {
  const l = run(TOA, maxPlayer({ constraints: { maxSwitches: 0 } }));
  assert.ok(switchWeapons(l, 'ranged').length === 1 && switchWeapons(l, 'melee').length === 1, 'required styles get their weapon');
  assert.ok(l.warnings.some((w) => /over the max budget/.test(w)));
});
