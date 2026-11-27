// The pre-trip check's setup from the loadout engine (lib/loadout), for a trip with a boss profile
// (the raids, Doom, Vorkath, Zulrah, the bosses in lib/loadout/profiles): the player's bank and a
// plan (Learner / Experienced / Max DPS) → a setup the check reads like a guide's: the worn loadout
// on the doll, the switches and supplies laid out as the 28-slot inventory, the rune pouch and
// spellbook. Trips without a profile keep the calc. PURE.
//
// The card's lines: the attack style for each part of the fight (worked out from the gear), each
// switch's job and what fills it (and the better item it stands in for), the spec order, what is
// missing and why a part of the fight uses another style.
//
// Static and pre-trip only: which kit a phase uses is said once, before the trip, never followed live.

import type { GearIndex } from './dps/summary';
import type { GearSetup, InvItem } from './guideTiers';
import { caChangeLine, caName, caRule } from './loadout/caRules';
import { buildLoadout } from './loadout/engine';
import { equipCheck } from './loadout/equip';
import { profileFor } from './loadout/profiles';
import type { Loadout, OwnedSupply, Preset } from './loadout/types';
import { RUNE, type TripCheck, type TripRow } from './tripCheck';
import type { TripState } from './tripState';

export const PLAN_PRESETS: readonly { key: Preset; label: string; blurb: string }[] = [
  { key: 'learner', label: 'Learner', blurb: 'One weapon per style, your armour stays on. Fewer clicks between hits, more food for mistakes.' },
  { key: 'experienced', label: 'Experienced', blurb: 'The weapons, the spec and the pieces that pay for their slot. The default for a clean kill.' },
  { key: 'max', label: 'Max DPS', blurb: 'Armour swaps for each style. The fastest kills if you can swap and dodge at once.' },
];
export const DEFAULT_PLAN: Preset = 'experienced';
export const cleanPlan = (v: unknown): Preset | null => (PLAN_PRESETS.some((p) => p.key === v) ? (v as Preset) : null);

/** What the card shows about the plan: the chooser and a few static lines. */
export interface TripPlan {
  preset: Preset;
  presets: { key: Preset; label: string }[];
  blurb: string;
  /** Hard rules the loadout breaks (no ranged weapon for the Wardens…): failing rows. */
  unmet: string[];
  /** Static lines: the kit each part of the fight uses, switch and supply slots, warnings. */
  info: string[];
}

export interface TripLoadoutInput {
  contentKey: string;
  preset: Preset | null;
  idx: GearIndex;
  worn: readonly InvItem[];
  inventory: readonly InvItem[];
  bank: readonly InvItem[];
  lootingBag?: readonly InvItem[];
  state: TripState | null;
  levels: Record<string, number> | null;
  raidLevel: number | null;
  nameOf: (id: number) => string;
  /** What holding an id counts as (its forms and upgrades). */
  holds: (id: number) => number[];
  /** A game id for a supply named but not held ("Saradomin brew(4)"), for its picture. */
  idOfName?: (name: string) => number | null;
  isRunePouch: (id: number) => boolean;
  /** A Combat Achievement picked on the card (lib/loadout/caRules): its limits applied. */
  ca?: number | null;
  /** The character's "Avoid Defence XP" switch; unset: on at Defence 1, off otherwise. */
  avoidDefenceXp?: boolean | null;
}

const BOOKS = { standard: 0, ancient: 1, lunar: 2, arceuus: 3 } as const;
const KIT_LABEL: Record<string, string> = { melee: 'Melee', ranged: 'Ranged', magic: 'Magic' };
/** A plain rune pouch, drawn when none is owned. */
const RUNE_POUCH = 12791;

/** Whether the trip has an engine profile (else the calc works it out). */
export const hasProfile = (contentKey: string): boolean => !!profileFor(contentKey);

const ATTACK_TYPE: Record<string, string> = { stab: 'stab', slash: 'slash', crush: 'crush' };

/** The engine's loadout for the player's bank, as a setup the check reads; null without a profile. */
export function loadoutFor(inp: TripLoadoutInput): { setup: GearSetup; plan: TripPlan; loadout: Loadout; sourceLine: string; caLine: string | null } | null {
  const profile = profileFor(inp.contentKey);
  if (!profile) return null;
  const preset = inp.preset ?? DEFAULT_PLAN;
  const held = [...inp.worn, ...inp.inventory, ...inp.bank, ...(inp.lootingBag ?? [])];
  // Gear by the id the gear data knows it as (an uncharged Shadow is the Shadow; a kit counts as the piece).
  const known = (id: number) => (inp.idx.item(id) ? id : (inp.holds(id).find((x) => inp.idx.item(x)) ?? null));
  const owned = [...new Set(held.map((it) => known(it.id)).filter((x): x is number => x != null))];
  const supplies = new Map<number, OwnedSupply>();
  for (const it of held) {
    if (inp.idx.item(it.id)) continue;
    const s = supplies.get(it.id);
    if (s) s.q += Math.max(1, it.q ?? 1);
    else supplies.set(it.id, { id: it.id, name: inp.nameOf(it.id), q: Math.max(1, it.q ?? 1) });
  }
  const lv = (k: string, d = 80) => (typeof inp.levels?.[k] === 'number' ? inp.levels[k] : d);
  const rule = caRule(profile.key, inp.ca);
  const levels = { attack: lv('attack'), strength: lv('strength'), defence: lv('defence'), ranged: lv('ranged'), magic: lv('magic'), prayer: lv('prayer'), hitpoints: lv('hitpoints', 99) };
  const avoidDefenceXp = inp.avoidDefenceXp ?? levels.defence <= 1;
  const canEquip = equipCheck(inp.levels ?? null);
  const run = (withCa: boolean) =>
    buildLoadout({
      profile,
      preset: withCa && rule?.preset ? rule.preset : preset,
      idx: inp.idx,
      ...(canEquip ? { canEquip } : {}),
      player: {
        levels,
        avoidDefenceXp,
        // The plugin reads Rigour and Augury; Piety is a quest's, so the level decides it.
        ...(inp.state?.pray ? { prayers: [...inp.state.pray, 'piety'] } : {}),
        owned,
        supplies: [...supplies.values()],
        ...(withCa && rule?.constraints ? { constraints: rule.constraints } : {}),
        ...(inp.raidLevel != null || (withCa && rule?.variant) ? { mode: { ...(inp.raidLevel != null ? { raidLevel: inp.raidLevel } : {}), ...(withCa && rule?.variant ? { variant: rule.variant } : {}) } } : {}),
      },
    });
  // With a CA picked, the loadout without it too: the card says in one line what the CA changed.
  const loadout = run(!!rule);
  const caLine = rule ? caChangeLine(caName(rule.id) ?? 'This task', run(false), loadout, inp.nameOf) : null;
  const pouchId = held.find((it) => inp.isRunePouch(it.id))?.id ?? RUNE_POUCH;
  // The engine's order (switches, spec, pouch, supplies), with the room kept for the raid's own
  // supplies left as empty slots at the end.
  const packed: InvItem[] = [];
  for (const s of loadout.inventory) {
    if (!s || s.kind === 'reserved') continue;
    const id = s.kind === 'pouch' ? pouchId : (s.id ?? inp.idOfName?.(s.name) ?? null);
    if (id != null) packed.push({ id });
  }
  const inventory: (InvItem | null)[] = Array.from({ length: 28 }, (_, i) => packed[i] ?? null);
  const gear: Record<string, number> = {};
  for (const [slot, id] of Object.entries(loadout.worn)) if (typeof id === 'number') gear[slot] = id;
  const runePouch: InvItem[] = (loadout.runePouch ?? []).map((r): number | undefined => (RUNE as Record<string, number>)[r.rune.toLowerCase()]).filter((x): x is number => x != null).map((id) => ({ id }));
  const setup: GearSetup = {
    tier: 'advanced',
    name: `${PLAN_PRESETS.find((p) => p.key === preset)!.label} ${profile.name}`,
    style: 0,
    stats: { attack: lv('attack'), strength: lv('strength'), ranged: lv('ranged'), magic: lv('magic') },
    gear,
    inventory,
    ...(runePouch.length ? { runePouch } : {}),
    ...(loadout.spells.length ? { spells: loadout.spells, spellbook: BOOKS[loadout.spellbook] } : {}),
    ...(loadout.quiverAmmo != null ? { quiver: loadout.quiverAmmo } : {}),
  };
  return { setup, plan: planOf(loadout, preset, inp.nameOf), loadout, caLine, sourceLine: `Worked out from your bank for ${profile.name}: the ${PLAN_PRESETS.find((p) => p.key === loadout.preset)!.label} plan${rule ? ` with ${caName(rule.id)}` : ''}` };
}

/**
 * The plan's static lines: the attack style per part of the fight, each switch's job, the specs, what
 * is missing, the slots, the engine's warnings. Plain sentences, no dot separators.
 */
export function planOf(l: Loadout, preset: Preset, nameOf: (id: number) => string = (id) => `Item ${id}`): TripPlan {
  const pick = (j: { id: number; name: string }) => nameOf(j.id) || j.name;
  // The gear data's name → the name of the item the player holds ("Osmumten's fang (or)").
  const held = new Map<string, string>();
  for (const j of l.jobs ?? []) if (j.pick) held.set(j.pick.name, pick(j.pick));
  // "Tekton: Scythe of vitur on crush (Jab)": phases with one weapon and stance share a line.
  const byStance = new Map<string, string[]>();
  const phaseWhy: string[] = [];
  for (const p of l.phases) {
    if (!p.kit) continue;
    let how: string;
    if (p.stance) {
      const w = held.get(p.stance.weapon) ?? p.stance.weapon;
      how = ATTACK_TYPE[p.stance.type] ? `${w} on ${p.stance.type} (${p.stance.name})` : `${w} (${p.stance.name})`;
    } else how = p.kit.startsWith('cast:') ? p.kit.slice(5) : (KIT_LABEL[p.kit] ?? p.kit);
    if (p.kit.startsWith('cast:')) how = `${how}, ${p.kit.slice(5)}`;
    byStance.set(how, [...(byStance.get(how) ?? []), p.name]);
    if (p.why) phaseWhy.push(`${p.name}: ${p.why}`);
  }
  const stances = [...byStance].map(([how, names]) => `${names.join(', ')}: ${how}`);
  // Each switch by its job: what fills it, and the better item it stands in for.
  const jobs: string[] = [];
  const usedJobs = new Set(l.phases.map((p) => p.job));
  for (const j of l.jobs ?? []) {
    if (j.key === 'main' || !j.pick || j.byWorn) continue;
    // A job no part of the fight ended up using (the Shadow when the bow is faster) says nothing,
    // unless it packs something (a piece swap, a punish weapon used by hand).
    if (!usedJobs.has(j.key) && !l.switches.some((s) => s.job === j.key)) continue;
    // The same weapon doing a second job (the Shadow on the Mystics too): the stance lines say it.
    if (!j.pieces.length && !j.stepDown && (l.jobs ?? []).some((o) => o !== j && o.pick?.id === j.pick!.id && (l.jobs ?? []).indexOf(o) < (l.jobs ?? []).indexOf(j))) continue;
    const pieces = j.pieces.length ? ` and ${j.pieces.length} piece${j.pieces.length === 1 ? '' : 's'}` : '';
    jobs.push(`${j.label}: ${pick(j.pick)}${pieces}${j.stepDown ? ` (best is ${j.stepDown})` : ''}`);
  }
  const main = (l.jobs ?? []).find((j) => j.key === 'main');
  if (main?.stepDown && main.pick) jobs.unshift(`${main.label}: ${pick(main.pick)} (best is ${main.stepDown})`);
  const blocked = (l.jobs ?? []).filter((j) => j.blocked).map((j) => j.blocked!);
  const specs = l.specs.length ? [`Spec: ${l.specs.map((s) => `${nameOf(s.id) || s.name}${s.stepDown ? ` (best is ${s.stepDown})` : ''}`).join(', then ')}`] : [];
  const switches = l.inventory.filter((s) => s?.kind === 'switch' || s?.kind === 'spec').length;
  const supplies = l.inventory.filter((s) => s?.kind === 'supply').length;
  const reserved = l.inventory.filter((s) => s?.kind === 'reserved').length;
  return {
    preset,
    presets: PLAN_PRESETS.map((p) => ({ key: p.key, label: p.label })),
    blurb: PLAN_PRESETS.find((p) => p.key === preset)!.blurb,
    unmet: l.requirementsUnmet.map((u) => u.message),
    info: [
      ...stances,
      ...phaseWhy,
      ...jobs,
      ...specs,
      ...blocked,
      // A missing gate is a failing row already.
      ...(l.notes ?? []).filter((n) => !l.requirementsUnmet.some((u) => u.message === n)),
      `${switches} switch slot${switches === 1 ? '' : 's'}, ${supplies} for supplies${reserved ? `, ${reserved} free for the raid's supplies` : ''}`,
      // "assumed" only matters when the bank is unknown, which a check never is.
      ...l.warnings.filter((w) => !/^Supplies not known/.test(w)),
    ],
  };
}

/** The check with the plan's broken rules as failing rows and its lines as info. */
export function withPlan(check: TripCheck, plan: TripPlan): TripCheck {
  const rows: TripRow[] = plan.unmet.map((line) => ({ group: 'gear', ok: false, line }));
  // The check's own "N switch slots packed, M free" counts what is packed now: the plan's line says it.
  return { ...check, rows: [...check.rows, ...rows], info: [...plan.info, ...check.info.filter((l) => !/^\d+ switch slots? packed/.test(l))] };
}
