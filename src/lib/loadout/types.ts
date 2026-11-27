// The loadout engine's data shapes: a boss PROFILE (what the fight is, from game mechanics) and the
// LOADOUT the engine builds from it for one player. PURE, import-free apart from types.
//
// A profile is data, not code, so it can later be edited as a guide piece: every field is plain
// JSON (regexes are written as strings). Facts in the seeded profiles come from the OSRS Wiki's
// strategy pages (cited in each file); the wording is ours.

import type { Slot } from '../dps/tables';

export type Style = 'melee' | 'ranged' | 'magic';
export type Preset = 'learner' | 'experienced' | 'max';
export const PRESETS: readonly Preset[] = ['learner', 'experienced', 'max'];
export const STYLES: readonly Style[] = ['melee', 'ranged', 'magic'];

/** One stretch of the fight against one target. */
export interface PhaseProfile {
  key: string;
  /** "Wardens P2 (Elidinis')" */
  name: string;
  /** A DPS dataset monster key, "Name#Version". */
  monster: string;
  /**
   * How much of that monster's hitpoints is dealt in this phase: Zulrah's three forms split one
   * 500 HP pool (0.4 / 0.3 / 0.3), a raid boss killed once is 1, a phase fought twice is 2. The
   * engine turns it into each phase's real share of the time (`LoadoutPhase.timeShare`).
   */
  share: number;
  /** Styles that can damage it here. */
  allowed: Style[];
  /** Styles the phase cannot be done without: each gets at least a weapon switch. */
  required?: Style[];
  /** Styles that cannot reach or hurt it (Zulrah in its pool: no melee). Never used here. */
  immune?: Style[];
  /** The phase needs this many different good styles carried (Akkha prays against his current one). */
  minStyles?: number;
  /** A spell the phase must be done with (Vorkath's spawn: Crumble Undead), from a staff that autocasts it. */
  cast?: string;
  /** Extra monster attributes the item effects read (dragon, demon, undead, kalphite…). */
  tags?: string[];
  /** A per-hit damage cap (Zulrah: 50). */
  maxHitCap?: number;
  /** Every hit that lands is a max hit (the Wardens' core): accuracy and the roll don't matter. */
  alwaysMaxHit?: boolean;
  /** The target's size for multi-hit weapons, when the phase's target isn't the dataset monster's. */
  size?: number;
  /** The name the DPS engine should see (its ToA rules match names: "Obelisk"). */
  asName?: string;
  /**
   * The style the strategy pages say to use, for mechanics the DPS calc can't see (Kephri's shield
   * swarms, Ba-Ba's boulders): any other style's time there is multiplied by `offStyle`.
   */
  prefer?: Style[];
  /** Default 1.5. */
  offStyle?: number;
  /** Seconds of the phase nobody deals damage in (Vorkath's acid walk). Doesn't change picks. */
  downtime?: number;
  /** How many times a kill enters the phase: each entry with a switch costs a tick. */
  entries?: number;
  notes?: string[];
}

export type SupplyKind =
  | 'food'
  | 'karambwan'
  | 'brew'
  | 'restore'
  | 'prayer'
  | 'antifire-super'
  | 'antifire'
  | 'antivenom'
  | 'antipoison'
  | 'ranging'
  | 'magic-boost'
  | 'combat'
  | 'teleport-zulrah'
  | 'raid-supplies';

export interface SupplyLine {
  kind: SupplyKind;
  /** Inventory slots for it. */
  count: number;
  /** Takes whatever room is left, up to `count` (food, last). */
  fill?: true;
  /** Slots kept empty for something picked up inside (ToA's supply chests). */
  reserve?: true;
}

export interface PresetPlan {
  /** Inventory slots for gear switches, spec weapons included. */
  switchBudget: number;
  /** Spec weapons to bring (best owned first, from the profile's `spec.prefer`). 0 = none. */
  specs: number;
  /** Wear Lightbearer when a spec weapon comes along (owned). */
  lightbearer?: boolean;
  /**
   * The most armour pieces (weapon and ammo aside) a style's switch may carry: a ToB mage switch
   * is its weapon and a piece or two, never a full robe set. Unset: no cap beyond the budget.
   */
  kitPieces?: Partial<Record<Style, number>>;
  supplies: SupplyLine[];
}

export type BossRule =
  /** Dragonfire: a super antifire always, or `level: 'any'` plus a dragonfire shield worn. */
  | { kind: 'antifire'; level: 'super' | 'any'; shield: 'recommended' | 'optional' }
  /** Venom: an anti-venom unless a piece that blocks it is worn (Serpentine helm). */
  | { kind: 'antivenom'; coveredBy: string[] }
  /** A spell that has to be cast, from this spellbook. */
  | { kind: 'spell'; spell: string; book: 'standard' | 'ancient' | 'arceuus' | 'lunar'; magic: number }
  | { kind: 'spellbook'; book: 'standard' | 'ancient' | 'arceuus' | 'lunar' };

/** A setting the fight has (ToA's raid level). */
export interface ProfileMode {
  key: 'raidLevel';
  label: string;
  default: number;
  values: readonly number[];
}

/**
 * A version of the fight with other monsters (ToB's Entry and Hard Mode, CoX's Challenge Mode): each
 * phase's monster key swapped. The first variant is the default.
 */
export interface ProfileVariant {
  key: string;
  label: string;
  /** Phase key → the DPS dataset monster key for this variant (phases not named keep theirs). */
  monsters: Record<string, string>;
}

export interface BossProfile {
  /** The trip content key (lib/tripContent). */
  key: string;
  name: string;
  /** The wiki pages the facts came from. */
  sources: string[];
  modes?: ProfileMode[];
  variants?: ProfileVariant[];
  phases: PhaseProfile[];
  /**
   * The style the strategy pages wear between switches (ToB: melee, the Scythe rooms; CoX: ranged,
   * the Twisted bow). Worn whenever the player owns a kit of it; unset, the fastest style is.
   */
  worn?: Style;
  rules: BossRule[];
  /** Spec weapons in the order the fight wants them (case-insensitive name patterns). */
  spec?: { prefer: string[]; why: string };
  /** The potion each style's numbers assume (lib/dps/tables BOOSTS keys). */
  boosts?: Partial<Record<Style, string>>;
  /** Rough hitpoints lost per kill with the right prayers, for the kills-per-trip estimate. */
  incomingPerKill?: number;
  presets: Record<Preset, PresetPlan>;
  notes?: string[];
}

// ── The player ───────────────────────────────────────────────────────────────────────────────

export interface PlayerLevels {
  attack: number;
  strength: number;
  defence: number;
  ranged: number;
  magic: number;
  prayer: number;
  hitpoints: number;
}

export interface OwnedSupply {
  id: number;
  name: string;
  q: number;
}

/** Combat Achievement limits ("melee only", "no prayer potions"…), optional (lib/loadout/caRules). */
export interface LoadoutConstraints {
  bannedItems?: number[];
  bannedStyles?: Style[];
  maxSwitches?: number;
  noSpec?: boolean;
  /** Phase key → the only styles used there (Zebak with melee only): replaces the phase's own. */
  phaseStyles?: Record<string, Style[]>;
  /** Item name patterns (case-insensitive) never picked: "^scythe of vitur". */
  bannedNames?: string[];
  /** Weapons are only these (name patterns): Barrows weapons only. */
  weaponsOnly?: string[];
  /** No prayer potions or restores packed. */
  noPrayerPots?: boolean;
  /** No food, karambwans or brews packed. */
  noFood?: boolean;
  /** Nothing from the supply plan but the room kept for supplies picked up inside. */
  noSupplies?: boolean;
  /** No room kept for supplies picked up inside: the player brings their own. */
  ownSupplies?: boolean;
  /** Extra supply slots, packed before the food fills what is left. */
  moreSupplies?: { kind: SupplyKind; count: number }[];
}

export interface PlayerInput {
  levels: PlayerLevels;
  /** Unlocked prayer keys ('rigour', 'augury'); unset: any the Prayer level allows. */
  prayers?: string[];
  /** Gear ids the player holds (bank, worn, inventory). */
  owned: number[];
  /** Consumables the player holds; unset: assumed (named in `warnings`). */
  supplies?: OwnedSupply[];
  /** An id's family key: two ids with one key are the same piece (cosmetic kits, (f)/(i) upgrades). */
  familyOf?: (id: number) => number | string;
  constraints?: LoadoutConstraints;
  /** The fight's settings (ToA raid level). */
  mode?: { raidLevel?: number; variant?: string };
}

// ── The answer ───────────────────────────────────────────────────────────────────────────────

export interface InvSlot {
  /** The game id when the player holds it (supplies not held are named, without an id). */
  id: number | null;
  name: string;
  kind: 'switch' | 'spec' | 'supply' | 'pouch' | 'reserved';
}

export interface Why {
  pick: string;
  why: string;
}

export interface LoadoutPhase {
  key: string;
  name: string;
  /** The kit used: 'magic', 'ranged', 'melee' or 'cast:<spell>'; null: nothing carried can do it. */
  kit: string | null;
  dps: number;
  seconds: number;
  timeShare: number;
}

export interface Unmet {
  code: 'style' | 'immune' | 'antifire' | 'antivenom' | 'spell' | 'spellbook' | 'nothing' | 'budget' | 'constraint';
  message: string;
}

export interface Loadout {
  profile: string;
  preset: Preset;
  /** The style worn between switches. */
  wornStyle: Style | null;
  worn: Partial<Record<Slot, number>>;
  switches: { id: number; name: string; slot: Slot; kit: string }[];
  specs: { id: number; name: string }[];
  inventory: (InvSlot | null)[];
  runePouch: { rune: string; perCast: number }[] | null;
  /** The spells the carried staves autocast ("Fire Surge"). */
  spells: string[];
  spellbook: 'standard' | 'ancient' | 'arceuus' | 'lunar';
  /** A second ammo held in a worn Dizana's quiver. */
  quiverAmmo: number | null;
  phases: LoadoutPhase[];
  /** Seconds per kill (or per raid's bosses), downtime included. */
  expectedTime: number;
  /** From the inventory's healing and the profile's rough incoming damage. */
  killsPerTrip: number | null;
  why: Why[];
  /** Hard rules this loadout breaks: never dropped silently. */
  requirementsUnmet: Unmet[];
  warnings: string[];
}
