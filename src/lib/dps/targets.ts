// What a TARGET does to the player's damage, beyond its stats: a per-style cut (Tekton takes no
// ranged damage and a fifth of magic), what escapes the cut (demonbane at the Ice Demon, corpbane
// spears at Corp), its demonbane vulnerability (Duke 70%, Yama 120%), Awakened rules (no Slayer
// helm, no stat drains) and how far its Defence can be drained.
//
// PURE and import-free (types aside). Facts from the OSRS Wiki's monster pages, in our own words;
// what the wiki leaves unclear is left out rather than guessed (the Tormented Demon's shield, Doom's
// shield, Yama's magic defence by the player's style).

import type { AttackType } from './tables';

export type DamageKey = 'melee' | 'ranged' | 'magic' | 'stab' | 'slash' | 'crush';

/** What escapes a target's `styleDamage` cut. */
export type Exemption =
  /** A demonbane weapon or spell hitting a demon. */
  | 'demonbane'
  /** A standard-spellbook fire spell (Fire Strike to Fire Surge). */
  | 'fire'
  /** A corpbane weapon (a stab spear or halberd) on a stab style. */
  | 'corpbane'
  /** An abyssal weapon (whip, tentacle, dagger, bludgeon). */
  | 'abyssal';

export interface TargetMods {
  /**
   * The share of damage each style deals: 0 = immune, 0.2 = a fifth. An attack type (stab, slash,
   * crush) wins over its kind (melee). Unset styles deal full damage.
   */
  styleDamage?: Partial<Record<DamageKey, number>>;
  /** Attacks that ignore `styleDamage` here. */
  exempt?: Exemption[];
  /** Demonbane vulnerability: 1 = normal, 0.7 = Duke Sucellus, 1.2 = Yama, 2 = a Void Flare. */
  demonbane?: number;
  /** An Awakened Desert Treasure II boss: the Slayer helm's on-task boost and stat drains don't work. */
  awakened?: boolean;
  /** Stat drains do nothing. */
  noDrain?: boolean;
  /** The most Defence levels drains can take off in all. */
  drainLevels?: number;
  /** The lowest drains can take its Defence. */
  drainFloor?: number;
  /** The Twisted bow's magic cap: 250, or 350 inside the Chambers of Xeric. */
  tbowCap?: number;
}

/** Weapons that deal full damage to the Corporeal Beast on a stab style (the wiki's corpbane list). */
export const CORPBANE = /^((bronze|iron|steel|black|mithril|adamant|rune|dragon) spear|(bronze|iron|steel|black|white|mithril|adamant|rune|dragon) halberd|bone spear|gilded spear|leaf-bladed spear|guthan's warspear|zamorakian spear|sunspear|vesta's spear|crystal halberd|noxious halberd|osmumten's fang|thunder khopesh|king's barrage)/i;

/** Abyssal weapons (the Tormented Demon's shield doesn't stop them). */
export const ABYSSAL = /^(abyssal (whip|tentacle|dagger|bludgeon)|volcanic abyssal whip|frozen abyssal whip)/i;

type Default = { name: RegExp; version?: RegExp; mods: TargetMods };

/**
 * Monster-level facts, matched by name (and version where the dataset splits the fight). A profile
 * phase can add to or override these (lib/loadout PhaseProfile.mods).
 */
export const TARGET_DEFAULTS: Default[] = [
  // Chambers of Xeric. Tekton: immune to ranged, 80% less magic damage.
  { name: /^tekton$/i, mods: { styleDamage: { ranged: 0, magic: 0.2 } } },
  // The Great Olm: the head and each claw take 66% less from every style but their own.
  { name: /^great olm$/i, version: /^head/i, mods: { styleDamage: { melee: 0.34, magic: 0.34 } } },
  { name: /^great olm$/i, version: /^left claw/i, mods: { styleDamage: { ranged: 0.34, magic: 0.34 } } },
  { name: /^great olm$/i, version: /^right claw/i, mods: { styleDamage: { melee: 0.34, ranged: 0.34 } } },
  // The Ice Demon: everything deals 67% less, except fire spells and demonbane (115% vulnerable).
  { name: /^ice demon$/i, mods: { styleDamage: { melee: 0.33, ranged: 0.33, magic: 0.33 }, exempt: ['demonbane', 'fire'], demonbane: 1.15 } },
  // Vasa's glowing crystals: immune to ranged, a third of magic damage.
  { name: /^glowing crystal$/i, mods: { styleDamage: { ranged: 0, magic: 1 / 3 } } },
  // The Corporeal Beast: half damage from everything but magic and corpbane weapons on stab.
  { name: /^corporeal beast$/i, mods: { styleDamage: { melee: 0.5, ranged: 0.5 }, exempt: ['corpbane'] } },
  // Demonbane vulnerability other than 100% (the wiki's list).
  { name: /^duke sucellus$/i, mods: { demonbane: 0.7 } },
  { name: /^yama$/i, mods: { demonbane: 1.2, drainFloor: 145 } },
  { name: /^void ?flare$/i, mods: { demonbane: 2 } },
  { name: /^(ocellus|xarth)$/i, mods: { demonbane: 0.8 } },
  { name: /^dreadnoth the jellied$/i, mods: { demonbane: 0.25 } },
  // Awakened Desert Treasure II bosses (the dataset marks some by version).
  { name: /^(the leviathan|the whisperer|vardorvis|duke sucellus)$/i, version: /awakened/i, mods: { awakened: true } },
  // Defence drain limits.
  { name: /^(kephri|zebak|ba-ba)$/i, mods: { drainLevels: 20 } },
  { name: /^akkha$/i, mods: { drainLevels: 10 } },
  { name: /^obelisk/i, mods: { drainLevels: 40 } },
  { name: /^nex$/i, mods: { drainLevels: 10 } },
  { name: /^phantom muspah$/i, mods: { drainFloor: 125 } },
  { name: /^doom of mokhaiotl$/i, mods: { drainFloor: 60 } },
  { name: /^the nightmare$/i, mods: { drainFloor: 120 } },
  { name: /^verzik vitur$/i, version: /phase 1|p1/i, mods: { noDrain: true } },
];

/** Two sets of mods, the second winning field by field (style shares merged). */
export function mergeMods(a: TargetMods | undefined, b: TargetMods | undefined): TargetMods {
  if (!a) return { ...(b ?? {}) };
  if (!b) return { ...a };
  return {
    ...a,
    ...b,
    ...(a.styleDamage || b.styleDamage ? { styleDamage: { ...a.styleDamage, ...b.styleDamage } } : {}),
    ...(a.exempt || b.exempt ? { exempt: [...new Set([...(a.exempt ?? []), ...(b.exempt ?? [])])] } : {}),
  };
}

/** The defaults for a monster, then whatever the caller set on it. */
export function targetMods(monster: { n: string; v?: string; a?: string[]; mods?: TargetMods }): TargetMods {
  let out: TargetMods = {};
  for (const d of TARGET_DEFAULTS) if (d.name.test(monster.n) && (!d.version || d.version.test(monster.v ?? ''))) out = mergeMods(out, d.mods);
  // Inside the Chambers of Xeric the Twisted bow reads up to 350 Magic.
  if ((monster.a ?? []).some((x) => x.toLowerCase() === 'xerician')) out.tbowCap ??= 350;
  return mergeMods(out, monster.mods);
}

/** The share of damage an attack deals after the target's cut (1 when nothing applies). */
export function styleShare(mods: TargetMods, kind: 'melee' | 'ranged' | 'magic', type: AttackType, escapes: Exemption[]): number {
  const sd = mods.styleDamage;
  if (!sd) return 1;
  const key = type === 'stab' || type === 'slash' || type === 'crush' ? type : null;
  const share = (key != null ? sd[key] : undefined) ?? sd[kind];
  if (share == null) return 1;
  if (escapes.some((e) => mods.exempt?.includes(e))) return 1;
  return Math.max(0, share);
}
