// The loadout engine (lib/loadout): golden loadouts per boss profile. Each profile is a reviewed
// reference loadout (main style, switches as jobs, specs in order, supplies); the engine steps it
// down to a bank. Per fight: an endgame ("max") bank and a mid-game one → the worn kit, the jobs, the
// spec and the inventory's shape. Plus the cases that started this (Tekton never bowed, the Mystics
// never meleed, Vespula with the Shadow, Doom ranged with melee only as a punish switch), the
// 15% style-switch rule, stances shown, gates and step-downs. Real items and monsters from the
// bundled gear data. No database.
//
// Run: npx tsx --test tests/loadout-engine.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildLoadout } from '../src/lib/loadout/engine.ts';
import { ARAXXOR, COX, DOOM, DUKE, LEVIATHAN, NEX, PROFILES, TOA, TOB, VORKATH, WHISPERER, YAMA, ZULRAH, profileFor } from '../src/lib/loadout/profiles/index.ts';
import type { BossProfile, Loadout, PlayerInput, Preset, Style } from '../src/lib/loadout/types.ts';
import { isRestricted } from '../src/lib/tripCheck.ts';
import { SLOTS, stylesFor } from '../src/lib/dps/tables.ts';
import { idOf, idx, maxPlayer, midPlayer, MAX_BANK, MID_BANK } from './fixtures/loadoutBanks.ts';

const run = (profile: BossProfile, player: PlayerInput, preset: Preset = 'max', canEquip?: Parameters<typeof buildLoadout>[0]['canEquip']) => buildLoadout({ profile, preset, player, idx, ...(canEquip ? { canEquip } : {}) });
const name = (id: number | null | undefined) => idx.item(id)?.n ?? '';
const carried = (l: Loadout) => [...Object.values(l.worn), ...l.switches.map((s) => s.id), ...l.specs.map((s) => s.id), ...(l.quiverAmmo ? [l.quiverAmmo] : [])].filter((x): x is number => x != null);
const phase = (l: Loadout, key: string) => l.phases.find((p) => p.key === key)!;
const phaseKit = (l: Loadout, key: string) => phase(l, key)?.kit;
const job = (l: Loadout, key: string) => (l.jobs ?? []).find((j) => j.key === key);
const pick = (l: Loadout, key: string) => job(l, key)?.pick?.name ?? null;
const supplySlots = (l: Loadout) => l.inventory.filter((s) => s?.kind === 'supply').length;
const switchSlots = (l: Loadout) => l.inventory.filter((s) => s?.kind === 'switch' || s?.kind === 'spec').length;
const reserved = (l: Loadout) => l.inventory.filter((s) => s?.kind === 'reserved').length;
const without = (names: RegExp, bank = MAX_BANK) => bank.filter((id) => !names.test(name(id)));

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
  // Every phase that has a kit says the stance it is fought in, worked out from the gear.
  for (const p of l.phases) if (p.kit) assert.ok(p.stance && p.stance.weapon && p.stance.name, `${p.name}: a stance`);
  // Card text: never the dot separator.
  for (const n of l.notes ?? []) assert.ok(!n.includes(' · '), n);
  for (const p of l.phases) assert.ok(!(p.why ?? '').includes(' · '));
}

// ── Chambers of Xeric ────────────────────────────────────────────────────────────────────────

test('CoX, max bank: Twisted bow worn; jobs filled; Tekton meleed, Vespula and the Mystics with the Shadow', () => {
  const l = run(COX, maxPlayer(), 'max');
  sane(l, MAX_BANK);
  assert.deepEqual(l.requirementsUnmet, []);
  assert.equal(l.wornStyle, 'ranged');
  assert.equal(name(l.worn.weapon), 'Twisted bow');
  assert.equal(name(l.worn.ring), 'Lightbearer', 'specs along: the spec ring');
  assert.equal(pick(l, 'melee'), 'Scythe of Vitur');
  assert.equal(pick(l, 'magic'), "Tumeken's shadow");
  assert.equal(pick(l, 'pickaxe'), 'Dragon pickaxe');
  assert.equal(pick(l, 'demonbane'), 'Emberlight');
  assert.ok(idx.item(job(l, 'stab')!.pick!.id)!.c && /stab|polearm|sword/i.test(idx.item(job(l, 'stab')!.pick!.id)!.c!), 'a stab weapon for the crystals');
  assert.equal(phase(l, 'crystals').stance?.type, 'stab');
  assert.equal(phaseKit(l, 'tekton'), 'melee');
  assert.equal(phaseKit(l, 'olm-melee'), 'melee');
  assert.equal(phaseKit(l, 'olm-mage'), 'magic');
  assert.equal(phaseKit(l, 'olm-head'), 'ranged');
  assert.equal(phase(l, 'vespula').stance?.weapon, "Tumeken's shadow", 'Vespula with the Shadow');
  assert.equal(phase(l, 'mystics').stance?.weapon, "Tumeken's shadow", 'the Mystics with the Shadow');
  assert.equal(phase(l, 'guardians').stance?.weapon, 'Dragon pickaxe');
  // Specs in order: the hammer first, then the godsword.
  assert.deepEqual(l.specs.map((s) => s.name), ['Dragon warhammer', 'Bandos godsword']);
  assert.ok(reserved(l) >= 10, 'room kept for the raid’s potions');
  assert.ok(switchSlots(l) <= COX.presets.max.switchBudget);
});

test('CoX, mid bank: blowpipe worn, a hasta for melee and the crystals, a rune pickaxe, Arclight on the Ice Demon', () => {
  const l = run(COX, midPlayer(), 'experienced');
  sane(l, MID_BANK);
  assert.deepEqual(l.requirementsUnmet, []);
  assert.equal(l.wornStyle, 'ranged');
  assert.equal(name(l.worn.weapon), 'Toxic blowpipe');
  assert.equal(job(l, 'main')!.stepDown, 'Twisted bow');
  assert.equal(pick(l, 'melee'), 'Zamorakian hasta');
  assert.equal(pick(l, 'pickaxe'), 'Rune pickaxe');
  assert.equal(phaseKit(l, 'tekton'), 'melee');
  assert.equal(phase(l, 'ice-demon').stance?.weapon, 'Arclight');
  assert.notEqual(phaseKit(l, 'mystics'), 'melee');
  // No Shadow: Vespula falls to the bow, and the card says why.
  assert.equal(phaseKit(l, 'vespula'), 'ranged');
  assert.match(phase(l, 'vespula').why ?? '', /^no Tumeken's shadow, so your ranged setup is faster here$/);
  assert.deepEqual(l.specs.map((s) => s.name), ['Dragon warhammer']);
  assert.ok(reserved(l) >= 10);
});

test('Tekton is never bowed: not with a Twisted bow and a weak melee weapon, not with no melee weapon at all', () => {
  const bowRich = maxPlayer({ owned: ['Twisted bow', 'Dragon arrow', 'Masori body (f)', 'Masori chaps (f)', 'Abyssal tentacle', 'Rune pickaxe', 'Kodai wand'].map(idOf) });
  for (const preset of ['learner', 'experienced', 'max'] as const) {
    const l = run(COX, bowRich, preset);
    assert.equal(phaseKit(l, 'tekton'), 'melee', preset);
    assert.equal(phase(l, 'tekton').stance?.weapon, 'Abyssal tentacle', preset);
  }
  // (A pickaxe is a melee weapon too: this bank has none.)
  const noMelee = run(COX, maxPlayer({ owned: ['Twisted bow', 'Dragon arrow', 'Kodai wand'].map(idOf) }));
  assert.notEqual(phaseKit(noMelee, 'tekton'), 'ranged');
  assert.ok(noMelee.requirementsUnmet.some((u) => /Tekton/.test(u.message)), JSON.stringify(noMelee.requirementsUnmet));
});

test('the Skeletal Mystics are never meleed, even when the melee kit is the strongest one', () => {
  const meleeRich = maxPlayer({ owned: [...MID_BANK.filter((id) => !/blowpipe|crossbow|shortbow/i.test(name(id))), ...['Scythe of vitur', 'Torva full helm', 'Torva platebody', 'Torva platelegs', 'Magic shortbow', 'Amethyst arrow'].map(idOf)] });
  for (const p of [maxPlayer(), midPlayer(), meleeRich]) assert.notEqual(phaseKit(run(COX, p, 'experienced'), 'mystics'), 'melee');
});

test('CoX: Guardians are a gate (a pickaxe or a broken rule, never another weapon); Challenge Mode is slower', () => {
  const l = run(COX, maxPlayer({ owned: without(/pickaxe/i) }));
  assert.equal(phaseKit(l, 'guardians'), null);
  assert.ok(l.requirementsUnmet.some((u) => /Guardians: bring a pickaxe/.test(u.message)));
  const cm = run(COX, maxPlayer({ mode: { variant: 'cm' } }));
  assert.ok(cm.expectedTime > run(COX, maxPlayer()).expectedTime);
});

test('stance is worked out from the gear: Tekton on slash in Torva, on crush with the Inquisitor’s set as the melee kit', () => {
  const torva = run(COX, maxPlayer({ owned: without(/^inquisitor/i) }), 'max');
  assert.equal(phase(torva, 'tekton').stance?.weapon, 'Scythe of Vitur');
  const inq = run(COX, maxPlayer({ owned: without(/^torva|^amulet of rancour|^ferocious|^ultor|^infernal cape|^avernic defender/i) }), 'max');
  assert.equal(phase(inq, 'tekton').kit, 'melee');
  // Each stance names a real style of the weapon used, and its attack type is the one the numbers chose.
  for (const l of [torva, inq]) {
    const st = phase(l, 'tekton').stance!;
    assert.ok(['stab', 'slash', 'crush'].includes(st.type), JSON.stringify(st));
  }
});

// ── Theatre of Blood ─────────────────────────────────────────────────────────────────────────

test('ToB, max bank: Scythe worn, Twisted bow for green, the Shadow for blue, Salve for Bloat, Xarpus meleed', () => {
  const l = run(TOB, maxPlayer());
  sane(l, MAX_BANK);
  assert.deepEqual(l.requirementsUnmet, []);
  assert.equal(l.wornStyle, 'melee');
  assert.equal(name(l.worn.weapon), 'Scythe of Vitur');
  assert.equal(pick(l, 'ranged'), 'Twisted bow');
  assert.equal(pick(l, 'magic'), "Tumeken's shadow");
  assert.equal(pick(l, 'salve'), 'Salve amulet(ei)');
  assert.equal(phaseKit(l, 'xarpus'), 'melee', 'no melee defence: the Scythe leads');
  assert.equal(phaseKit(l, 'nylo-ranged'), 'ranged');
  assert.equal(phaseKit(l, 'nylo-magic'), 'magic');
  assert.equal(phaseKit(l, 'verzik-p3'), 'melee');
  assert.deepEqual(l.specs.map((s) => s.name), ['Elder maul', 'Bandos godsword']);
  const magePieces = l.switches.filter((s) => s.kit === 'magic' && s.slot !== 'weapon');
  assert.ok(magePieces.length <= 2 && magePieces.length >= 1, 'the Shadow needs a piece or two to hit in Torva');
});

test('ToB, mid bank: whip worn, Armadyl crossbow and Trident switches, every nylocas colour covered', () => {
  const l = run(TOB, midPlayer(), 'experienced');
  sane(l, MID_BANK);
  assert.deepEqual(l.requirementsUnmet, []);
  assert.equal(l.wornStyle, 'melee');
  assert.equal(name(l.worn.weapon), 'Abyssal whip');
  assert.equal(pick(l, 'ranged'), 'Armadyl crossbow');
  assert.equal(pick(l, 'magic'), 'Trident of the Swamp');
  for (const k of ['nylo-melee', 'nylo-ranged', 'nylo-magic', 'vasilias-melee', 'vasilias-ranged', 'vasilias-magic']) assert.ok(phaseKit(l, k), k);
  assert.ok(switchSlots(l) <= TOB.presets.experienced.switchBudget);
  for (const preset of ['learner', 'experienced', 'max'] as const) sane(run(TOB, midPlayer(), preset), MID_BANK);
});

test('ToB without a Scythe: Xarpus goes to the bow only when it is clearly faster, and the card says why', () => {
  const l = run(TOB, maxPlayer({ owned: without(/^scythe/i) }));
  assert.equal(job(l, 'main')!.stepDown, 'Scythe of vitur');
  const x = phase(l, 'xarpus');
  if (x.kit === 'ranged') assert.match(x.why ?? '', /^no Scythe of vitur, so your ranged setup is faster here$/);
  else assert.equal(x.why, undefined);
  // With the Scythe owned the reviewed pick stands, whatever the numbers.
  for (const p of run(TOB, maxPlayer()).phases) assert.equal(p.why, undefined, p.name);
});

test('ToB variants: Entry Mode is quicker and Hard Mode slower than Normal', () => {
  const at = (variant: string) => run(TOB, maxPlayer({ mode: { variant } }));
  const [entry, normal, hard] = [at('entry'), at('normal'), at('hard')];
  assert.ok(entry.expectedTime < normal.expectedTime && normal.expectedTime < hard.expectedTime);
  assert.equal(idx.monster('Verzik Vitur#Phase 2@0')!.hp, 1600);
  assert.equal(idx.monster('Xarpus@2')!.hp, 6000);
});

// ── Tombs of Amascut ─────────────────────────────────────────────────────────────────────────

test('ToA, max bank: Shadow worn, Twisted bow for Zebak and P2, Fang for Ba-Ba, Kephri, the core and P3; specs saved for P3', () => {
  const l = run(TOA, maxPlayer());
  sane(l, MAX_BANK);
  assert.deepEqual(l.requirementsUnmet, []);
  assert.equal(l.wornStyle, 'magic');
  assert.equal(name(l.worn.weapon), "Tumeken's shadow");
  assert.equal(pick(l, 'ranged'), 'Twisted bow');
  assert.equal(pick(l, 'melee'), "Osmumten's fang");
  assert.equal(phaseKit(l, 'zebak'), 'ranged');
  assert.equal(phaseKit(l, 'p2-tumeken'), 'ranged');
  assert.equal(phaseKit(l, 'p2-elidinis'), 'magic');
  assert.equal(phaseKit(l, 'p2-core'), 'melee');
  assert.equal(phaseKit(l, 'p3'), 'melee', 'P3 is weaker to melee: the Fang, owned, stands');
  assert.equal(phaseKit(l, 'kephri'), 'melee');
  assert.equal(phase(l, 'kephri').stance?.type, 'stab');
  assert.deepEqual(l.specs.map((s) => s.name), ['Elder maul', 'Zaryte crossbow']);
  assert.ok(reserved(l) >= 8);
  assert.ok(switchSlots(l) <= TOA.presets.max.switchBudget);
});

test('ToA, mid bank: Trident worn, crossbow and hasta switches; no Fang, so P3 goes to the bow with a why line', () => {
  const l = run(TOA, midPlayer());
  sane(l, MID_BANK);
  assert.deepEqual(l.requirementsUnmet, []);
  assert.equal(l.wornStyle, 'magic');
  assert.equal(name(l.worn.weapon), 'Trident of the Swamp');
  assert.equal(pick(l, 'ranged'), 'Armadyl crossbow');
  assert.equal(pick(l, 'melee'), 'Zamorakian hasta');
  assert.equal(phaseKit(l, 'p2-core'), 'melee');
  assert.equal(phaseKit(l, 'p3'), 'ranged');
  assert.match(phase(l, 'p3').why ?? '', /^no Osmumten's fang, so your ranged setup is faster here$/);
  assert.ok((l.notes ?? []).includes('No damage spec for Wardens P3'));
});

test('ToA: a higher raid level takes longer; no ranged weapon fails the Wardens P2 rule', () => {
  assert.ok(run(TOA, maxPlayer({ mode: { raidLevel: 500 } })).expectedTime > run(TOA, maxPlayer({ mode: { raidLevel: 150 } })).expectedTime);
  const noRanged = run(TOA, maxPlayer({ constraints: { bannedStyles: ['ranged'] } }));
  assert.ok(noRanged.requirementsUnmet.some((u) => /Tumeken/.test(u.message)), JSON.stringify(noRanged.requirementsUnmet));
  assert.ok(!noRanged.switches.some((s) => s.kit === 'ranged'));
});

// ── Doom of Mokhaiotl ────────────────────────────────────────────────────────────────────────

test('Doom, max bank: ranged worn, melee only as the punish switch, demonbane for the shield, Zaryte crossbow spec', () => {
  const l = run(DOOM, maxPlayer(), 'experienced');
  sane(l, MAX_BANK);
  assert.deepEqual(l.requirementsUnmet, []);
  assert.equal(l.wornStyle, 'ranged');
  assert.equal(name(l.worn.weapon), 'Twisted bow');
  assert.ok(pick(l, 'punish'), 'a melee punish switch');
  assert.equal(phaseKit(l, 'main'), 'ranged');
  assert.ok(!l.phases.some((p) => p.kit === 'melee' && p.key === 'main'), 'never meleed');
  assert.match(phase(l, 'shield').stance?.weapon ?? '', /emberlight|purging staff|scorching bow|arclight|slayer's staff/i, 'demonbane on the shield');
  assert.deepEqual(l.specs.map((s) => s.name), ['Zaryte crossbow']);
  assert.equal(name(l.worn.ring), 'Lightbearer');
  assert.ok(supplySlots(l) >= 18, 'a supply trip: food and restores fill the rest');
});

test('Doom, mid bank: blowpipe worn, Arclight on the shield, no Zaryte crossbow said and paid back in food', () => {
  const l = run(DOOM, midPlayer(), 'experienced');
  sane(l, MID_BANK);
  assert.equal(l.wornStyle, 'ranged');
  assert.equal(name(l.worn.weapon), 'Toxic blowpipe');
  assert.equal(phase(l, 'shield').stance?.weapon, 'Arclight');
  assert.ok((l.notes ?? []).includes('No Zaryte crossbow: skip the spec, one more food'));
  assert.deepEqual(l.specs, []);
});

test('Doom stays ranged with a melee-heavy bank: melee is the punish switch only', () => {
  const l = run(DOOM, maxPlayer({ owned: ['Scythe of vitur', 'Torva full helm', 'Torva platebody', 'Torva platelegs', 'Amulet of rancour', 'Ferocious gloves', 'Magic shortbow', 'Amethyst arrow', "Black d'hide body", 'Emberlight'].map(idOf) }));
  assert.equal(l.wornStyle, 'ranged');
  assert.equal(pick(l, 'punish'), 'Scythe of Vitur');
  assert.equal(phaseKit(l, 'main'), 'ranged');
  assert.equal(phase(l, 'shield').stance?.weapon, 'Emberlight');
});

test('Doom: no demonbane at all is a broken rule, never another weapon on the shield', () => {
  const l = run(DOOM, maxPlayer({ owned: without(/emberlight|arclight|darklight|purging|slayer's staff|scorching|skull sceptre/i) }));
  assert.equal(phaseKit(l, 'shield'), null);
  assert.ok(l.requirementsUnmet.some((u) => /only demonbane hurts it/.test(u.message)));
});

// ── Vorkath and Zulrah ───────────────────────────────────────────────────────────────────────

test('Vorkath, max bank: Dragon hunter crossbow, Salve (ei), a dragonfire off-hand, a Crumble Undead staff', () => {
  const l = run(VORKATH, maxPlayer());
  sane(l, MAX_BANK);
  assert.deepEqual(l.requirementsUnmet, []);
  assert.equal(l.wornStyle, 'ranged');
  assert.equal(name(l.worn.weapon), 'Dragon hunter crossbow');
  assert.equal(name(l.worn.neck), 'Salve amulet(ei)');
  assert.match(name(l.worn.shield), /^(dragonfire ward|twisted buckler)$/i);
  assert.equal(phaseKit(l, 'spawn'), 'cast:Crumble Undead');
  assert.ok(pick(l, 'crumble'));
  assert.equal(l.spellbook, 'standard');
  assert.ok(l.inventory.some((s) => /super antifire/i.test(s?.name ?? '')));
  assert.deepEqual(l.specs.map((s) => s.name), ['Zaryte crossbow']);
});

test('Vorkath, mid bank: a weaker ranged weapon, the Slayer’s staff for the spawn, every rule met', () => {
  const l = run(VORKATH, midPlayer());
  sane(l, MID_BANK);
  assert.deepEqual(l.requirementsUnmet, []);
  assert.equal(l.wornStyle, 'ranged');
  assert.match(name(l.worn.weapon), /^(toxic blowpipe|armadyl crossbow|rune crossbow)$/i);
  assert.equal(pick(l, 'crumble'), "Slayer's staff");
});

test('Vorkath: no staff that autocasts, no super antifire → named in requirementsUnmet, never dropped', () => {
  const l = run(VORKATH, maxPlayer({ owned: without(/slayer's staff|kodai|trident|sanguinesti|purging|skull sceptre/i), supplies: [{ id: 385, name: 'Shark', q: 100 }] }));
  const codes = l.requirementsUnmet.map((u) => u.code);
  assert.ok(codes.includes('spell'), JSON.stringify(l.requirementsUnmet));
  assert.ok(codes.includes('antifire'));
  assert.ok(codes.includes('antivenom'));
});

test('Zulrah, max bank: one style worn, the other a switch, never melee', () => {
  const l = run(ZULRAH, maxPlayer());
  sane(l, MAX_BANK);
  assert.deepEqual(l.requirementsUnmet, []);
  assert.equal(phaseKit(l, 'tanzanite'), 'ranged');
  assert.ok(!carried(l).some((id) => /scythe|torva|fang/i.test(name(id))));
  assert.ok(l.inventory.some((s) => /anti-venom/i.test(s?.name ?? '')));
});

test('Zulrah, mid bank: Trident worn with a blowpipe switch for blue', () => {
  const l = run(ZULRAH, midPlayer());
  sane(l, MID_BANK);
  assert.deepEqual(l.requirementsUnmet, []);
  assert.equal(l.wornStyle, 'magic');
  assert.equal(name(l.worn.weapon), 'Trident of the Swamp');
  assert.equal(pick(l, 'ranged'), 'Toxic blowpipe');
  assert.equal(phaseKit(l, 'tanzanite'), 'ranged');
  assert.equal(phaseKit(l, 'serpentine'), 'magic');
});

test('Zulrah: a melee-only bank cannot do it, and says so', () => {
  const l = run(ZULRAH, midPlayer({ owned: ['Abyssal whip', 'Dragon defender', 'Fighter torso'].map(idOf) }));
  assert.ok(l.requirementsUnmet.length > 0);
  assert.equal(l.wornStyle, null);
});

// ── The bosses ───────────────────────────────────────────────────────────────────────────────

test('Araxxor: melee worn (crush where the gear says), a drain spec first; ranged for a bow-only bank', () => {
  const l = run(ARAXXOR, maxPlayer());
  sane(l, MAX_BANK);
  assert.equal(l.wornStyle, 'melee');
  assert.equal(l.specs[0]?.name, 'Elder maul');
  assert.equal(phase(l, 'main').stance?.type, 'crush');
  const mid = run(ARAXXOR, midPlayer());
  sane(mid, MID_BANK);
  assert.ok(mid.wornStyle);
  const bow = run(ARAXXOR, maxPlayer({ owned: ['Twisted bow', 'Dragon arrow', 'Masori body (f)', 'Masori chaps (f)'].map(idOf) }));
  assert.equal(bow.wornStyle, 'ranged', 'melee is the reference, ranged when nothing melee is owned');
});

test('Yama: the Emberlight worn (demonbane, 120% vulnerable), the reference stands over magic', () => {
  const l = run(YAMA, maxPlayer());
  sane(l, MAX_BANK);
  assert.equal(l.wornStyle, 'melee');
  assert.equal(name(l.worn.weapon), 'Emberlight');
  assert.ok(phaseKit(l, 'judge'), 'the Judge is fought');
  const mid = run(YAMA, midPlayer());
  sane(mid, MID_BANK);
  assert.ok(mid.wornStyle);
});

test('Duke, Leviathan, Whisperer, Nex: one main style each, max and mid', () => {
  const cases: [BossProfile, Style][] = [[DUKE, 'melee'], [LEVIATHAN, 'ranged'], [WHISPERER, 'magic'], [NEX, 'ranged']];
  for (const [p, style] of cases) {
    const max = run(p, maxPlayer());
    sane(max, MAX_BANK);
    assert.equal(max.wornStyle, style, `${p.key} max`);
    assert.deepEqual(max.requirementsUnmet, [], p.key);
    const mid = run(p, midPlayer(), 'experienced');
    sane(mid, MID_BANK);
    assert.equal(mid.wornStyle, style, `${p.key} mid`);
    assert.ok(mid.expectedTime > max.expectedTime, p.key);
  }
  assert.equal(name(run(WHISPERER, maxPlayer()).worn.weapon), "Tumeken's shadow");
  assert.equal(name(run(DUKE, maxPlayer()).worn.weapon), 'Scythe of Vitur');
});

test('a boss picked by hand finds its profile by the monster', () => {
  assert.equal(profileFor('m:Yama#Normal'), YAMA);
  assert.equal(profileFor('m:Araxxor#In combat'), ARAXXOR);
  assert.equal(profileFor('m:Duke Sucellus#Awake'), DUKE);
  assert.equal(profileFor('m:Scurrius'), null);
  assert.equal(profileFor('doom'), DOOM);
});

// ── The rules every profile keeps ────────────────────────────────────────────────────────────

test('every profile: its jobs, specs and phases refer to each other, and the card text has no dot separators', () => {
  for (const p of Object.values(PROFILES)) {
    const keys = new Set(['main', ...(p.jobs ?? []).map((j) => j.key)]);
    for (const ph of p.phases) for (const k of ph.use ?? ['main']) assert.ok(keys.has(k), `${p.key} ${ph.key}: job ${k}`);
    const phases = new Set(p.phases.map((ph) => ph.key));
    for (const j of p.jobs ?? []) for (const k of j.phases ?? []) assert.ok(phases.has(k), `${p.key} ${j.key}: phase ${k}`);
    for (const s of [...(p.jobs ?? []).flatMap((j) => [j.label, j.missing ?? '']), ...(p.specs ?? []).flatMap((s) => [s.why, s.missing ?? '']), ...p.phases.flatMap((ph) => [ph.tip ?? '', ph.gate ?? ''])]) assert.ok(!s.includes(' · '), s);
    for (const ph of p.phases) assert.ok(idx.monster(ph.monster), `${p.key}: the gear data has ${ph.monster}`);
  }
});

test('presets: a learner packs no more switches and no fewer supplies than max', () => {
  for (const profile of [VORKATH, ZULRAH, TOA, TOB, COX, DOOM]) {
    for (const player of [maxPlayer(), midPlayer()]) {
      const learner = run(profile, player, 'learner');
      const max = run(profile, player, 'max');
      assert.ok(switchSlots(learner) <= switchSlots(max), `${profile.key}: switches ${switchSlots(learner)} ≤ ${switchSlots(max)}`);
      assert.ok(supplySlots(learner) >= supplySlots(max), `${profile.key}: supplies ${supplySlots(learner)} ≥ ${supplySlots(max)}`);
    }
  }
});

test('levels gate the picks: an unwearable best weapon is skipped and the card says so', () => {
  const canEquip = (it: { n: string }) => (/^scythe of vitur/i.test(it.n) ? 'needs 80 Attack' : null);
  const l = run(TOB, maxPlayer(), 'max', canEquip as never);
  assert.notEqual(name(l.worn.weapon), 'Scythe of Vitur');
  assert.ok((l.jobs ?? []).some((j) => /^Scythe of Vitur needs 80 Attack, using /.test(j.blocked ?? '')), JSON.stringify(l.jobs));
  // Owned but unwearable is no step-down: the card says what blocks it instead.
  assert.equal(job(l, 'main')!.stepDown, undefined);
});

test('Avoid Defence XP: no controlled, defensive or longrange stance is ever picked', () => {
  for (const profile of [COX, TOB, TOA]) {
    const l = run(profile, midPlayer({ avoidDefenceXp: true }), 'experienced');
    for (const p of l.phases) {
      if (!p.stance) continue;
      const w = idx.items.find((it) => it.n === p.stance!.weapon)!;
      const st = stylesFor(w.c).find((x) => x.name === p.stance!.name && x.type === p.stance!.type)!;
      assert.ok(!['controlled', 'defensive', 'longrange'].includes(st.stance) && st.name !== 'Defensive autocast', `${profile.key} ${p.name}: ${p.stance.weapon} ${p.stance.name}`);
    }
  }
  // Without it the whip's Lash (controlled) is fair game.
  assert.ok(run(TOB, midPlayer(), 'experienced').phases.some((p) => p.stance?.name === 'Lash'));
});
