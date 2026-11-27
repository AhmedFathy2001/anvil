// The pre-trip check's setup from the loadout engine (lib/loadout), for a trip with a boss profile
// (Vorkath, Zulrah, ToA, ToB, CoX): the player's bank and a plan (Learner / Experienced / Max DPS) → a setup the
// check reads like a guide's: the worn loadout on the doll, the switches and supplies laid out as the
// 28-slot inventory, the rune pouch and spellbook. Trips without a profile keep the calc. PURE.
//
// Static and pre-trip only: which kit a phase uses is said once, before the trip, never followed live.

import type { GearIndex } from './dps/summary';
import type { GearSetup, InvItem } from './guideTiers';
import { caChangeLine, caName, caRule } from './loadout/caRules';
import { buildLoadout } from './loadout/engine';
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
  /** The card's "Avoid Defence XP" (lib/tripRaidLevel): no style that trains Defence. */
  avoidDefenceXp?: boolean;
}

const BOOKS = { standard: 0, ancient: 1, lunar: 2, arceuus: 3 } as const;
const KIT_LABEL: Record<string, string> = { melee: 'Melee', ranged: 'Ranged', magic: 'Magic' };
/** A plain rune pouch, drawn when none is owned. */
const RUNE_POUCH = 12791;

/** Whether the trip has an engine profile (else the calc works it out). */
export const hasProfile = (contentKey: string): boolean => !!profileFor(contentKey);

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
  const run = (withCa: boolean) =>
    buildLoadout({
      profile,
      preset: withCa && rule?.preset ? rule.preset : preset,
      idx: inp.idx,
      player: {
        levels: { attack: lv('attack'), strength: lv('strength'), defence: lv('defence'), ranged: lv('ranged'), magic: lv('magic'), prayer: lv('prayer'), hitpoints: lv('hitpoints', 99) },
        // The plugin reads Rigour and Augury; Piety is a quest's, so the level decides it.
        ...(inp.state?.pray ? { prayers: [...inp.state.pray, 'piety'] } : {}),
        owned,
        supplies: [...supplies.values()],
        ...(inp.avoidDefenceXp ? { avoidDefenceXp: true } : {}),
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
  return { setup, plan: planOf(loadout, preset), loadout, caLine, sourceLine: `Worked out from your bank for ${profile.name}: the ${PLAN_PRESETS.find((p) => p.key === loadout.preset)!.label} plan${rule ? ` with ${caName(rule.id)}` : ''}` };
}

/** The plan's static lines: which kit each part of the fight uses, the slots, the engine's warnings. */
function planOf(l: Loadout, preset: Preset): TripPlan {
  const byKit = new Map<string, string[]>();
  for (const p of l.phases) {
    if (!p.kit) continue;
    const k = p.kit.startsWith('cast:') ? p.kit.slice(5) : (KIT_LABEL[p.kit] ?? p.kit);
    byKit.set(k, [...(byKit.get(k) ?? []), p.name]);
  }
  const kits = [...byKit].map(([k, names]) => `${k}: ${names.join(', ')}`);
  const switches = l.inventory.filter((s) => s?.kind === 'switch' || s?.kind === 'spec').length;
  const supplies = l.inventory.filter((s) => s?.kind === 'supply').length;
  const reserved = l.inventory.filter((s) => s?.kind === 'reserved').length;
  return {
    preset,
    presets: PLAN_PRESETS.map((p) => ({ key: p.key, label: p.label })),
    blurb: PLAN_PRESETS.find((p) => p.key === preset)!.blurb,
    unmet: l.requirementsUnmet.map((u) => u.message),
    info: [
      ...kits,
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
