// The pre-trip check: what the character carries (worn + inventory) and its spellbook, rune pouch and
// prayers, against the setup for the trip it is about to start. PURE — the gear data, the item
// equivalences and the names come in, so the plugin view (pluginUi/tripView) and the tests share it.
//
// THE SETUP is, in order: the player's own saved one for the content (lib/tripSetups), the guide's
// (its best tier that fits them), else Anvil's calc from their bank (source 'calc'). Checks:
//
//   gear       each slot's item (the player's own version of the setup: lib/gearOwnership) worn or
//              packed, when leaving it costs DPS; each switch in the setup's inventory packed. The
//              calc instead builds the best loadout per target from the bank and from what is
//              carried: "No stab weapon: Kephri (Fang in bank)".
//   spec       the setup's spec weapon packed (or, for bossing that wants one, any owned one)
//   book       the spellbook the setup's spells need
//   pouch      the runes those spells take: rune pouch, loose runes, an elemental staff or tome
//   supplies   the setup's supplies by kind (doses and food types alike): "Brews 4 · setup has 6";
//              for content with `basics` (Doom), some food and a prayer restore whatever the setup
//   prayer     Rigour / Augury the setup prays, unlocked (Piety is never read: unknown, not locked)
//
// Only what can be told is checked. Something it can't tell (no state from an older plugin, a rune
// pouch left in the bank) is named in `unknown`, never failed. No combat cues of any kind: this runs
// at the bank, before the trip, and says nothing about the fight itself.

import type { DpsResult, GearItem, Monster } from './dps/engine';
import { bestStyle, TOA_MONSTER } from './dps/engine';
import { SLOTS, stylesFor, type Slot } from './dps/tables';
import { setupLoadout, type GearIndex } from './dps/summary';
import { ownStats, withSlot } from './gearNow';
import { personalSetup, resolveSetup, type Equivalents, type Prefs, type Snapshot } from './gearOwnership';
import type { GearSetup, InvItem } from './guideTiers';
import type { TripContent } from './tripContent';
import { DEFAULT_SUPPLIES, ownedSupply, SUPPLY_ITEMS } from './tripSupplies';
import type { TripState } from './tripState';

export type TripSource = 'own' | 'guide' | 'calc';
export type TripGroup = 'gear' | 'spec' | 'book' | 'pouch' | 'supplies' | 'prayer';

export interface TripRow {
  group: TripGroup;
  ok: boolean;
  /** One short line (the overlay is 200px wide): "No stab weapon: Kephri (Fang in bank)". */
  line: string;
  /** A second, longer line for the panel. */
  detail?: string;
  /** The item it is about, for the panel's picture. */
  item?: number;
  /** The items to take from the bank (the calc's swaps), drawn as pictures under the line. */
  swaps?: number[];
  /** The bank's own ids for what is missing (forms and upgrades included): the bank filter shows them. */
  bank?: number[];
  /** The equipment slot a worn piece goes in: its place in the bank layout's paper doll. */
  slot?: string;
  /** A supply the calc packs: how many (doses of a potion count as one each). */
  need?: number;
  /** A rune the calc puts in the rune pouch (else in the inventory). */
  inPouch?: boolean;
}

export interface TripCheck {
  rows: TripRow[];
  /** "5 switch slots packed, 19 free for supplies". */
  info: string[];
  /** What couldn't be checked, and why. */
  unknown: string[];
  /** Every bank id the failing rows name: "Show missing in bank". */
  bank?: number[];
  /** Bank tag layouts (positions in the 8-wide bank grid, -1 empty): what is missing, the whole setup. */
  layouts?: { missing: BankLayout; setup: BankLayout };
}

export interface BankLayout {
  ids: number[];
  layout: number[];
}

/** The paper doll in the bank's first three columns (8 per row); the spec weapon left of the legs. */
const DOLL: Record<string, number> = { head: 1, quiver: 2, cape: 8, neck: 9, ammo: 10, weapon: 16, body: 17, shield: 18, spec: 24, legs: 25, hands: 32, feet: 33, ring: 34 };
const dose = (n: string) => Number(/\((\d)\)\s*$/.exec(n)?.[1] ?? 0);

/**
 * The one bank id a gear row shows: the exact item when it is in the bank, else the held form whose
 * name is closest to it ("Infernal cape (l)" for an Infernal cape, not the Infernal max cape), else the
 * first held. Null with none in the bank.
 */
export function heldOne(r: Pick<TripRow, 'item' | 'bank'>, nameOf: (id: number) => string): number | null {
  const b = r.bank ?? [];
  if (!b.length) return null;
  if (r.item != null && b.includes(r.item)) return r.item;
  if (r.item == null) return b[0];
  const want = nameOf(r.item).toLowerCase().replace(/\s*\([^()]*\)\s*$/, '');
  return b.find((x) => nameOf(x).toLowerCase().replace(/\s*\([^()]*\)\s*$/, '') === want) ?? b.find((x) => nameOf(x).toLowerCase().startsWith(want)) ?? b[0];
}

/**
 * A bank tag layout for these rows, the way a player lays a setup out: worn pieces as a paper doll on
 * the left, switches to its right (four a row), then each kind of supply on rows of its own, doses
 * 4 → 1. Only what is in the bank (each row's `bank` ids). Display only: the plugin moves nothing.
 */
export function bankLayout(rows: readonly TripRow[], nameOf: (id: number) => string): BankLayout {
  const place = new Map<number, number>();
  const used = new Set<number>();
  const side: number[][] = [];
  const loose: number[] = [];
  for (const r of rows) {
    // A supply is its kind (every dose); a piece of gear is ONE bank slot, never every form owned.
    const b = (r.group === 'supplies' ? r.bank ?? [] : [heldOne(r, nameOf)].filter((x): x is number => x != null)).filter((x) => !used.has(x));
    if (!b.length) continue;
    b.forEach((x) => used.add(x));
    const at = r.group === 'spec' ? DOLL.spec : r.slot ? DOLL[r.slot] : undefined;
    if (at != null && !place.has(at)) place.set(at, b[0]);
    else if (r.group === 'supplies') side.push([...b].sort((x, y) => dose(nameOf(y)) - dose(nameOf(x))));
    else loose.push(...b);
  }
  let line = 0;
  for (const list of [loose, ...side]) {
    list.forEach((id, i) => place.set((line + Math.floor(i / 4)) * 8 + 4 + (i % 4), id));
    line += Math.ceil(list.length / 4);
  }
  const layout = Array<number>(Math.max(-1, ...place.keys()) + 1).fill(-1);
  place.forEach((id, pos) => (layout[pos] = id));
  return { ids: [...used], layout };
}

export interface TripInput {
  content: TripContent;
  /** The own or guide setup; null for the calc. */
  setup: GearSetup | null;
  source: TripSource;
  monsters: Monster[];
  worn: readonly InvItem[];
  inventory: readonly InvItem[];
  bank: readonly InvItem[];
  lootingBag?: readonly InvItem[];
  state: TripState | null;
  levels: Record<string, number> | null;
  idx: GearIndex;
  /** X → every id that counts as having X (its forms and upgrades): lib/itemFamilies 'needs'. */
  needs: Equivalents;
  /** A held id → the ids it counts as: lib/itemFamilies 'holds'. */
  holds: Equivalents;
  nameOf: (id: number) => string;
  isRunePouch: (id: number) => boolean;
  prefs?: Prefs;
  /** The Tombs of Amascut raid level to scale its bosses by (lib/tripRaidLevel); none: unscaled. */
  raidLevel?: number | null;
}

// ── Item kinds ───────────────────────────────────────────────────────────────────────────────

/** Weapons carried for their special attack, not to fight with. */
const SPEC_RE = /^(dragon claws|burning claws|dragon warhammer|elder maul|(bandos|armadyl|saradomin|zamorak|ancient) godsword|crystal halberd|voidwaker|dragon dagger|abyssal dagger|zaryte crossbow|dawnbringer|eldritch nightmare staff|volatile nightmare staff|granite maul|tonalztics of ralos|dragon crossbow)\b/i;
export const isSpecWeapon = (name: string | null | undefined): boolean => !!name && SPEC_RE.test(name.trim());
const LIGHTBEARER = /^lightbearer\b/i;
/**
 * The spec weapons a PvM trip would rather bring, best first: defence drain, then the big hits, then
 * the rest. The old order (whatever the bank listed first) put a Dragon dagger over an Elder maul.
 */
const SPEC_ORDER = [/^elder maul/i, /^dragon warhammer/i, /^bandos godsword/i, /^(burning|dragon) claws/i, /^voidwaker/i, /^zaryte crossbow/i, /^eldritch nightmare staff/i, /^volatile nightmare staff/i, /^ancient godsword/i, /^armadyl godsword/i, /^crystal halberd/i, /^tonalztics of ralos/i, /^dawnbringer/i, /^saradomin godsword/i, /^zamorak godsword/i, /^abyssal dagger/i, /^granite maul/i, /^dragon crossbow/i, /^dragon dagger/i];
export const specRank = (name: string): number => {
  const i = SPEC_ORDER.findIndex((re) => re.test(name.trim()));
  return i < 0 ? SPEC_ORDER.length : i;
};

export const RUNE = { air: 556, water: 555, earth: 557, fire: 554, mind: 558, body: 559, death: 560, nature: 561, chaos: 562, law: 563, cosmic: 564, blood: 565, soul: 566, astral: 9075, wrath: 21880 } as const;
type Rune = keyof typeof RUNE;
/** Combination runes (and Sunfire) count as each rune they stand for. */
const COMBO: Record<number, Rune[]> = { 4694: ['water', 'fire'], 4695: ['air', 'water'], 4696: ['air', 'earth'], 4697: ['air', 'fire'], 4698: ['water', 'earth'], 4699: ['earth', 'fire'], 28929: ['fire'] };
const RUNE_NAME: Record<Rune, string> = Object.fromEntries(Object.keys(RUNE).map((k) => [k, `${k[0].toUpperCase()}${k.slice(1)}`])) as Record<Rune, string>;

/** What each spell a setup casts takes (the OSRS Wiki's rune costs). Spells not here aren't rune-checked. */
export const SPELL_RUNES: Record<string, Partial<Record<Rune, number>>> = {
  'ice barrage': { death: 4, blood: 2, water: 6 },
  'ice blitz': { death: 2, blood: 2, water: 3 },
  'blood blitz': { death: 2, blood: 4 },
  'ice burst': { death: 2, chaos: 4, water: 4 },
  'blood burst': { death: 2, chaos: 4, blood: 2 },
  'ice rush': { death: 2, chaos: 2, water: 2 },
  'blood rush': { death: 2, chaos: 2, blood: 1 },
  'smoke barrage': { fire: 4, air: 4, blood: 2, death: 4 },
  'water surge': { water: 10, air: 7, wrath: 1 },
  'earth surge': { earth: 10, air: 7, wrath: 1 },
  'wind surge': { air: 7, wrath: 1 },
  'water wave': { water: 7, air: 5, blood: 1 },
  'earth wave': { earth: 7, air: 5, blood: 1 },
  'wind wave': { air: 5, blood: 1 },
  'inferior demonbane': { fire: 4, chaos: 2 },
  'superior demonbane': { fire: 5, soul: 2 },
  'dark demonbane': { fire: 6, soul: 2 },
  'blood barrage': { death: 4, blood: 4, soul: 1 },
  'shadow barrage': { air: 4, soul: 3, blood: 2, death: 4 },
  vengeance: { astral: 4, earth: 10, death: 2 },
  'crumble undead': { earth: 2, air: 2, chaos: 1 },
  'fire surge': { fire: 10, air: 7, wrath: 1 },
  'fire wave': { fire: 7, air: 5, blood: 1 },
  charge: { fire: 3, blood: 3, air: 3 },
  'death charge': { death: 1, blood: 1, soul: 1 },
  'resurrect greater ghost': { fire: 10, blood: 5, cosmic: 1 },
  'resurrect greater skeleton': { fire: 10, blood: 5, cosmic: 1 },
  'resurrect greater zombie': { fire: 10, blood: 5, cosmic: 1 },
  'mark of darkness': { cosmic: 1, soul: 1 },
  'demonic offering': { soul: 1, wrath: 1 },
  'sinister offering': { blood: 1, wrath: 1 },
};

/** The elemental runes a worn staff, wand or tome gives without end. */
export function staffRunes(name: string): Rune[] {
  const n = name.toLowerCase();
  if (!/staff|wand|tome of/.test(n)) return [];
  if (/kodai wand/.test(n)) return ['water'];
  if (/twinflame staff/.test(n)) return ['fire', 'water'];
  const out = new Set<Rune>();
  const combos: Record<string, Rune[]> = { smoke: ['air', 'fire'], steam: ['water', 'fire'], mud: ['water', 'earth'], lava: ['earth', 'fire'], dust: ['air', 'earth'], mist: ['air', 'water'] };
  for (const [w, rs] of Object.entries(combos)) if (new RegExp(`\\b${w}\\b`).test(n)) rs.forEach((r) => out.add(r));
  for (const r of ['air', 'water', 'earth', 'fire'] as Rune[]) if (new RegExp(`\\b${r}\\b`).test(n)) out.add(r);
  return [...out];
}

/** Supplies by kind: any dose of a potion, any of the common foods. */
const SUPPLY_KIND: [RegExp, string][] = [
  [/^saradomin brew\b/i, 'Brews'],
  [/^(super restore|sanfew serum)\b/i, 'Restores'],
  [/^prayer potion\b/i, 'Prayer potions'],
  [/^(divine )?(ranging|bastion) potion\b/i, 'Ranging potions'],
  [/^(divine )?super combat potion\b/i, 'Combat potions'],
  [/^(divine )?(magic|battlemage) potion\b|^imbued heart|^saturated heart/i, 'Magic boost'],
  [/antifire/i, 'Antifires'],
  [/^(anti-venom|antidote\+\+)/i, 'Anti-venoms'],
  [/^(shark|manta ray|anglerfish|dark crab|monkfish|cooked karambwan|sea turtle|tuna potato|lobster|swordfish|cooked moonlight antelope|cooked sunlight antelope)$/i, 'Food'],
];
/** "Saradomin brew(4)" → "Brews"; anything else by its name less the dose. */
export function supplyKind(name: string): string {
  for (const [re, k] of SUPPLY_KIND) if (re.test(name)) return k;
  return name.replace(/\s*\(\d\)\s*$/, '').trim();
}

/** What players call a few long names; anything else keeps its own. */
const NICKNAMES: Record<string, string> = { "osmumten's fang": 'Fang', "tumeken's shadow": 'Shadow', 'dragon hunter crossbow': 'DHCB', 'dragon hunter lance': 'DHL', 'toxic blowpipe': 'Blowpipe', 'scythe of vitur': 'Scythe' };
/** "Osmumten's fang" → "Fang", "Ruby dragon bolts (e)" → "Ruby dragon bolts": a name for a 200px line. */
export function shortName(name: string): string {
  const plain = name.replace(/\s*\([^()]*\)\s*$/, '').trim() || name;
  return NICKNAMES[plain.toLowerCase()] ?? plain[0].toUpperCase() + plain.slice(1);
}
const TARGET_NICK: Record<string, string> = { 'the maiden of sugadinti': 'Maiden', 'pestilent bloat': 'Bloat', 'nylocas vasilias': 'Nylo boss', 'verzik vitur': 'Verzik', "tumeken's warden": 'Warden', "elidinis' warden": 'Warden', 'vasa nistirio': 'Vasa', 'great olm': 'Olm' };
/** "Ahrim the Blighted" → "Ahrim", "Great Olm (Head)" → "Olm", "The Maiden of Sugadinti" → "Maiden". */
export const shortTarget = (name: string): string => {
  const n = name.replace(/\s*\(.*\)\s*$/, '').trim();
  return TARGET_NICK[n.toLowerCase()] ?? (n.split(' the ')[0].trim() || name);
};
/** "Kephri, Akkha" — past two, "Kephri, Akkha +2": the overlay's line is 200px. */
const targetList = (ts: string[]) => (ts.length <= 2 ? ts.join(', ') : `${ts.slice(0, 2).join(', ')} +${ts.length - 2}`);

export const SLOT_LABEL: Record<string, string> = { head: 'Head', cape: 'Cape', neck: 'Neck', ammo: 'Ammo', weapon: 'Weapon', body: 'Body', shield: 'Shield', legs: 'Legs', hands: 'Hands', feet: 'Feet', ring: 'Ring', quiver: 'Quiver' };

/** Anything eaten or drunk for hitpoints, and anything drunk for prayer: the `basics` check. */
const HEALS = /^(saradomin brew|shark|manta ray|anglerfish|dark crab|monkfish|sea turtle|lobster|swordfish|tuna potato|potato with |cooked |.* pie$|.*pizza$|.*cake$)/i;
const RESTORES = /^(prayer potion|super restore|sanfew serum|blighted super restore|moonlight potion|prayer regeneration potion)\b/i;

// ── Holding ──────────────────────────────────────────────────────────────────────────────────

const qty = (it: InvItem) => Math.max(1, Math.floor(it.q ?? 1));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0);

interface Held {
  /** Raw ids → count. */
  carried: Map<number, number>;
  owned: Map<number, number>;
  carries: (id: number) => boolean;
  wears: (id: number) => boolean;
  owns: (id: number) => boolean;
  /** The bank's ids that count as `id`: what the bank filter shows for it. */
  inBank: (id: number) => number[];
}

function held(inp: TripInput): Held {
  const count = (lists: (readonly InvItem[] | undefined)[]) => {
    const m = new Map<number, number>();
    for (const l of lists) for (const it of l ?? []) if (it && it.id > 0) m.set(it.id, (m.get(it.id) ?? 0) + qty(it));
    return m;
  };
  const carried = count([inp.worn, inp.inventory]);
  const owned = count([inp.worn, inp.inventory, inp.bank, inp.lootingBag]);
  // Holding X counts as X's forms and what it was upgraded from; X's forms and upgrades count as X.
  const wide = (m: Map<number, number>) => {
    const s = new Set<number>();
    for (const id of m.keys()) for (const x of [id, ...inp.holds(id)]) s.add(x);
    return s;
  };
  const cw = wide(carried);
  const ow = wide(owned);
  const worn = count([inp.worn]);
  const ww = wide(worn);
  return {
    carried,
    owned,
    carries: (id) => cw.has(id) || inp.needs(id).some((x) => carried.has(x)),
    wears: (id) => ww.has(id) || inp.needs(id).some((x) => worn.has(x)),
    owns: (id) => ow.has(id) || inp.needs(id).some((x) => owned.has(x)),
    inBank: (id) => [...new Set(inp.bank.map((it) => it.id).filter((b) => b === id || inp.needs(id).includes(b) || inp.holds(b).includes(id)))],
  };
}

/**
 * Uncharged forms the item families don't tie to the charged one, → the charged id the gear data knows.
 * A player brings these charged: the calc counts the charged form and says to charge it.
 */
const UNCHARGED: Record<number, number> = {
  11908: 11905, // Uncharged trident → Trident of the seas
  12900: 12899, // Uncharged toxic trident → Trident of the swamp
  22294: 22292, // Uncharged toxic trident (e) → Trident of the swamp (e)
  12902: 12904, // Toxic staff (uncharged) → Toxic staff of the dead
  22547: 22550, // Craw's bow (u)
  22542: 22545, // Viggora's chainmace (u)
  22552: 22555, // Thammaron's sceptre (u)
  27652: 27655, // Webweaver bow (u)
  27657: 27660, // Ursine chainmace (u)
  27662: 27665, // Accursed sceptre (u)
};
const UNCHARGED_NAME = /\b(uncharged|inactive|empty)\b|\(u\)\s*$/i;

/**
 * The id the gear data knows `id` by: itself, or a form of it it holds (a charged form, a kit). A
 * form usable in the main game is preferred over a Bounty Hunter / Deadman / Leagues twin.
 */
const knownAs = (id: number, inp: TripInput): number | null => {
  if (inp.idx.item(id)) return id;
  if (UNCHARGED[id] != null && inp.idx.item(UNCHARGED[id])) return UNCHARGED[id];
  const forms = inp.holds(id).filter((x) => inp.idx.item(x));
  return forms.find((x) => !isRestricted(inp.idx.item(x)!.n)) ?? forms[0] ?? null;
};
/** Is the bank's `id` an uncharged form (charge it before the trip)? */
const isUncharged = (id: number, inp: TripInput): boolean => !inp.idx.item(id) && (UNCHARGED[id] != null || UNCHARGED_NAME.test(inp.nameOf(id)));

/** The gear data's slot for an item ('2h' is worn in the weapon slot). */
const slotOf = (it: GearItem | null): Slot | null => {
  if (!it) return null;
  const s = it.s === '2h' ? 'weapon' : it.s;
  return (SLOTS as readonly string[]).includes(s) ? (s as Slot) : null;
};

// ── The best loadout from a pool of items (the calc) ─────────────────────────────────────────

/**
 * Copies of gear that work only somewhere else, never in main-game PvM: Bounty Hunter (bh) and
 * Deadman copies, Last Man Standing, Pete Kayer's challenges, Leagues (Trailblazer) and historical
 * copies, the Gauntlet's crystal and corrupted gear, Castle Wars ammo, Barbarian Assault's attacker
 * arrows (Barbed arrows: +125 ranged strength, fired only in the minigame). The calc never picks or
 * suggests them. Locked "(l)" items are the real thing and stay.
 */
const RESTRICTED = /\((bh|deadman|deadman mode|dmm|beta|lms|last man standing|pete kayer's challenges|the gauntlet|trailblazer reloaded|historical|basic|attuned|perfected)\)|^corrupted |^castle wars (arrow|bolts)|^(barbed|bullet|field|blunt) arrow$/i;
export const isRestricted = (name: string): boolean => RESTRICTED.test(name);
/**
 * Deadman: Armageddon's "(Deadman)" copies are ornaments Nigel makes from the real item, with its
 * stats: one the player actually holds is the real thing in the main game (a Voidwaker (Deadman),
 * an Imbued god cape (Deadman)). Never suggested when not held.
 */
const DEADMAN_ORNAMENT = /\(deadman\)/i;
export const usableHeld = (name: string): boolean => !isRestricted(name) || (DEADMAN_ORNAMENT.test(name) && !/^corrupted /i.test(name));

export interface Best {
  gear: Record<string, number>;
  result: DpsResult;
  weapon: number;
}

type Kind = 'melee' | 'ranged' | 'magic';
interface CalcCtx {
  idx: GearIndex;
  stats: GearSetup['stats'];
  prayer: string[];
  spell: string | null;
  /** The boost each kind fights with (a raid's own: ToA's smelling salts, CoX's overloads). */
  boosts?: Partial<Record<Kind, string>>;
  /** Only this kind of attack. */
  only?: Kind;
  /** Spells an autocasting weapon may cast (lib/tripCheck calcSpells): the best is taken. */
  spells?: string[];
}

/** What the raid's own supplies boost by: every style alike. */
const RAID_BOOSTS: Record<string, Record<Kind, string>> = {
  toa: { melee: 'salts_melee', ranged: 'salts_ranged', magic: 'salts_magic' },
  cox: { melee: 'overload', ranged: 'overload_ranged', magic: 'overload_magic' },
};

/** The kind of attack a weapon makes (a bow ranged, a powered staff magic). */
function weaponKind(w: GearItem | null): Kind {
  const types = stylesFor(w?.c).map((x) => x.type);
  return types.includes('ranged') ? 'ranged' : types.includes('magic') ? 'magic' : 'melee';
}

const kindOfType = (t: string): 'melee' | 'ranged' | 'magic' => (t === 'ranged' ? 'ranged' : t === 'magic' ? 'magic' : 'melee');
const AMMOLESS = /crystal bow|bow of faerdhinen|craw's bow|webweaver|blowpipe/i;
/** The bows that fire dragon arrows; the crossbows that fire dragon bolts. */
const DRAGON_BOWS = /twisted bow|dark bow|scorching bow|venator bow|3rd age bow|zaryte bow/i;
const DRAGON_XBOWS = /dragon crossbow|dragon hunter crossbow|armadyl crossbow|zaryte crossbow/i;

/** Is `ammo` what `weapon` fires (or, for a weapon that fires nothing, a blessing that sits there)? */
export function ammoFits(weapon: GearItem, ammo: GearItem): boolean {
  const a = ammo.n.toLowerCase();
  const w = weapon.n.toLowerCase();
  const projectile = /arrow|bolt|javelin|dart|brutal|\bshot\b|chinchompa/.test(a);
  if (weapon.c === 'Bow' && !AMMOLESS.test(weapon.n)) {
    if (/ogre bow/.test(w)) return /ogre arrow|brutal/.test(a);
    if (!/arrow/.test(a) || /ogre arrow/.test(a)) return false;
    return /dragon (fire )?arrow/.test(a) ? DRAGON_BOWS.test(w) : true;
  }
  if (weapon.c === 'Crossbow') {
    if (/ballista/.test(w)) return /javelin/.test(a);
    // Hunters' crossbows fire their own bolts only; so do Karil's, the Dorgeshuun and Ascension crossbows.
    if (/hunters' sunlight crossbow/.test(w)) return /antler bolts/.test(a);
    if (/hunters' crossbow/.test(w)) return /kebbit bolts/.test(a);
    if (/karil's crossbow/.test(w)) return /bolt rack/.test(a);
    if (/dorgeshuun crossbow/.test(w)) return /bone bolts/.test(a);
    if (/ascension crossbows/.test(w)) return /ascension bolts/.test(a);
    if (!/bolt/.test(a) || /antler bolts|kebbit bolts|bolt rack|bone bolts|ascension bolts/.test(a)) return false;
    return /dragon bolts/.test(a) ? DRAGON_XBOWS.test(w) : true;
  }
  return !projectile;
}

/** Targets no melee reaches: Zulrah in its pool, Vespula in the air, the Great Olm's head. */
export const meleeReaches = (m: Monster): boolean => !(/^(zulrah|vespula|kraken|cave kraken)$/i.test(m.n) || (/^great olm$/i.test(m.n) && /^head/i.test(m.v ?? '')));

/** What a kind of attack reads off a piece. */
const kindScore = (b: number[], kind: 'melee' | 'ranged' | 'magic') => (kind === 'melee' ? Math.max(b[0], b[1], b[2]) + 1.5 * b[5] : kind === 'ranged' ? b[4] + 1.5 * b[6] : b[3] + 3 * b[7]);

/**
 * Each slot's few likeliest items for one kind of attack, by the bonuses that kind reads. A piece made
 * for another kind (a ranged body for melee) is left out even where it edges a point ahead: nobody
 * tanks a raid in a d'hide top with a melee weapon.
 */
function shortlist(pool: GearItem[], kind: 'melee' | 'ranged' | 'magic'): Map<Slot, GearItem[]> {
  const others = (['melee', 'ranged', 'magic'] as const).filter((k) => k !== kind);
  const by = new Map<Slot, GearItem[]>();
  for (const it of pool) {
    const s = slotOf(it);
    if (!s || s === 'weapon') continue;
    const own = Math.max(0, kindScore(it.b, kind));
    if (others.some((k) => kindScore(it.b, k) > 3 * own + 3)) continue;
    by.set(s, [...(by.get(s) ?? []), it]);
  }
  for (const [s, list] of by) by.set(s, list.sort((a, b) => kindScore(b.b, kind) - kindScore(a.b, kind)).slice(0, 6));
  return by;
}

/**
 * A loadout's DPS against `m`, and the spell it casts (null: a powered staff's own, or no magic). An
 * autocasting weapon tries each of the calc's spells and keeps the best.
 */
function trySpell(gear: Record<string, number>, m: Monster, ctx: CalcCtx, dart: number | null): { r: DpsResult; spell: string | null } | null {
  const kind = weaponKind(ctx.idx.item(gear.weapon));
  const spells = kind === 'magic' && ctx.spells?.length ? ctx.spells : [ctx.spell];
  let best: { r: DpsResult; spell: string | null } | null = null;
  for (const spell of spells) {
    const r = bestStyle({ gear, style: 0, spell, dart, stats: ctx.stats, prayer: ctx.prayer, boost: ctx.boosts?.[kind] ?? null, onTask: false }, m, ctx.idx.item, ctx.idx.rules)?.result ?? null;
    if (r && (!best || r.dps > best.r.dps)) best = { r, spell: r.style.stance === 'autocast' ? spell : null };
    // A powered staff's own spell ignores the pick: no need to try the rest.
    if (/^powered/i.test(ctx.idx.item(gear.weapon)?.c ?? '')) break;
  }
  return best;
}
const tryGear = (gear: Record<string, number>, m: Monster, ctx: CalcCtx, dart: number | null): DpsResult | null => trySpell(gear, m, ctx, dart)?.r ?? null;

/** Each book's combat spells the calc tries, best first, for this Magic level and target. */
export function calcSpells(book: number | null, magic: number, m: Pick<Monster, 'ew' | 'a'>): string[] {
  const attrs = new Set((m.a ?? []).map((x) => x.toLowerCase()));
  if (book === 1) {
    const tiers: [string, number][] = [['Barrage', 94], ['Blitz', 82], ['Burst', 70], ['Rush', 58]];
    const lv: Record<string, [number, number, number, number]> = { Ice: [94, 82, 70, 58], Blood: [92, 80, 68, 56], Shadow: [88, 76, 64, 52], Smoke: [86, 74, 62, 50] };
    const out: string[] = [];
    for (const [i] of tiers.entries()) for (const e of ['Ice', 'Blood']) if (magic >= lv[e][i] && out.length < 2) out.push(`${e} ${tiers[i][0]}`);
    return out;
  }
  if (book === 3) {
    if (!attrs.has('demon')) return [];
    return magic >= 82 ? ['Dark Demonbane'] : magic >= 62 ? ['Superior Demonbane'] : magic >= 44 ? ['Inferior Demonbane'] : [];
  }
  if (book === 2) return [];
  const one = calcSpell(0, magic, m.ew);
  return [...(one ? [one] : []), ...(attrs.has('undead') && magic >= 39 ? ['Crumble Undead'] : [])];
}

/** Sets whose bonus no single swap shows: tried whole, per kind, after the slot-by-slot fill. */
const SETS: { kind: 'melee' | 'ranged' | 'magic'; pieces: [Slot, RegExp][] }[] = [
  ...(['melee', 'ranged', 'magic'] as const).map((kind) => ({
    kind,
    pieces: [
      ['head', kind === 'melee' ? /^void melee helm/i : kind === 'ranged' ? /^void ranger helm/i : /^void mage helm/i],
      ['body', /^elite void top/i],
      ['legs', /^elite void robe/i],
      ['hands', /^void knight gloves/i],
    ] as [Slot, RegExp][],
  })),
  ...(['melee', 'ranged', 'magic'] as const).map((kind) => ({
    kind,
    pieces: [
      ['head', kind === 'melee' ? /^void melee helm/i : kind === 'ranged' ? /^void ranger helm/i : /^void mage helm/i],
      ['body', /^void knight top/i],
      ['legs', /^void knight robe/i],
      ['hands', /^void knight gloves/i],
    ] as [Slot, RegExp][],
  })),
  { kind: 'melee', pieces: [['head', /^inquisitor's great helm/i], ['body', /^inquisitor's hauberk/i], ['legs', /^inquisitor's plateskirt/i]] },
  { kind: 'ranged', pieces: [['head', /^crystal helm/i], ['body', /^crystal body/i], ['legs', /^crystal legs/i]] },
];

/**
 * The best loadout `ids` (what the player holds) can make against one monster: the likeliest weapons
 * of each kind, then each slot filled greedily (twice round) by the DPS engine, then each set whose
 * bonus needs every piece (Void, Inquisitor's, crystal) tried whole. Melee only where melee reaches.
 * Null: nothing in the pool can attack.
 */
export function bestLoadout(m: Monster, ids: readonly number[], ctx: CalcCtx): Best | null {
  const memo = bestMemo(ctx.idx);
  const key = `${m.n}#${m.v ?? ''}|${m.raidLevel ?? 0}|${m.hp}|${JSON.stringify(ctx.stats)}|${ctx.prayer.join()}|${ctx.spell ?? ''}|${(ctx.spells ?? []).join('/')}|${JSON.stringify(ctx.boosts ?? null)}|${ctx.only ?? ''}|${[...new Set(ids)].sort((x, y) => x - y).join()}`;
  if (memo.has(key)) return memo.get(key)!;
  const pool = [...new Set(ids)].map((id) => ctx.idx.item(id)).filter((x): x is GearItem => !!x && !x.hid && usableHeld(x.n));
  const weapons = pool.filter((x) => slotOf(x) === 'weapon');
  const ammo = pool.filter((x) => x.s === 'ammo');
  const darts = pool.filter((x) => /dart$/i.test(x.n) && x.c === 'Thrown').sort((a, b) => b.b[6] - a.b[6]);
  const dartFor = (w: GearItem) => (/blowpipe/i.test(w.n) ? darts[0]?.id ?? null : null);
  const bestAmmo = (w: GearItem): number | null => {
    const fits = ammo.filter((a) => ammoFits(w, a));
    let best: { id: number; dps: number } | null = null;
    for (const a of fits.sort((x, y) => y.b[6] - x.b[6]).slice(0, 4)) {
      const r = tryGear({ weapon: w.id, ammo: a.id }, m, ctx, dartFor(w));
      if (r && (!best || r.dps > best.dps)) best = { id: a.id, dps: r.dps };
    }
    return best?.id ?? null;
  };
  const melee = meleeReaches(m);
  // A staff with no spell to autocast and no built-in one can only bash: still a melee option.
  const quick = weapons
    .map((w) => {
      const gear: Record<string, number> = { weapon: w.id };
      const a = stylesFor(w.c).some((s) => s.type === 'ranged') ? bestAmmo(w) : null;
      if (a) gear.ammo = a;
      const r = tryGear(gear, m, ctx, dartFor(w));
      return r ? { w, gear, r } : null;
    })
    .filter((x): x is { w: GearItem; gear: Record<string, number>; r: DpsResult } => !!x && x.r.dps > 0 && (melee || x.r.kind !== 'melee') && (!ctx.only || x.r.kind === ctx.only));
  const top: typeof quick = [];
  for (const kind of ['melee', 'ranged', 'magic'] as const) top.push(...quick.filter((q) => q.r.kind === kind).sort((a, b) => b.r.dps - a.r.dps).slice(0, 3));
  const lists = { melee: shortlist(pool, 'melee'), ranged: shortlist(pool, 'ranged'), magic: shortlist(pool, 'magic') };
  let best: Best | null = null;
  for (const q of top) {
    const gear = { ...q.gear };
    const dart = dartFor(q.w);
    let cur = q.r;
    const kind = kindOfType(cur.style.type);
    const fill = () => {
      for (let pass = 0; pass < 2; pass++) {
        let changed = false;
        for (const slot of SLOTS) {
          if (slot === 'weapon' || (slot === 'shield' && q.w.h2)) continue;
          const cands = (lists[kind].get(slot) ?? []).filter((c) => slot !== 'ammo' || ammoFits(q.w, c));
          for (const c of cands) {
            if (gear[slot] === c.id) continue;
            const r = tryGear({ ...gear, [slot]: c.id }, m, ctx, dart);
            if (r && r.dps > cur.dps + 1e-9) {
              gear[slot] = c.id;
              cur = r;
              changed = true;
            }
          }
        }
        if (!changed) break;
      }
    };
    fill();
    for (const set of SETS.filter((x) => x.kind === kind)) {
      const pieces = set.pieces.map(([slot, re]) => [slot, pool.find((it) => slotOf(it) === slot && re.test(it.n))] as const);
      if (pieces.some(([, it]) => !it)) continue;
      const trial = { ...gear, ...Object.fromEntries(pieces.map(([slot, it]) => [slot, it!.id])) };
      const r = tryGear(trial, m, ctx, dart);
      if (r && r.dps > cur.dps + 1e-9) {
        Object.assign(gear, trial);
        cur = r;
        fill();
      }
    }
    if (!best || cur.dps > best.result.dps) best = { gear, result: cur, weapon: q.w.id };
  }
  memo.set(key, best);
  if (memo.size > BEST_MAX) memo.delete(memo.keys().next().value!);
  return best;
}

/**
 * bestLoadout's answers per gear index, by monster, stats, prayers, spell and pool: a raid's bank
 * bests are worked out once while the bank stays the same (taking items out of it moves them into
 * the inventory, and the owned pool is unchanged). Callers must not change what comes back.
 */
const BEST = new WeakMap<GearIndex, Map<string, Best | null>>();
const BEST_MAX = 400;
const bestMemo = (idx: GearIndex) => BEST.get(idx) ?? (BEST.set(idx, new Map()), BEST.get(idx)!);

/** The spell a staff would autocast on this spellbook at this Magic level, for the calc. */
export function calcSpell(book: number | null, magic: number, weakness?: string | null): string | null {
  if (book === 1) return magic >= 94 ? 'Ice Barrage' : magic >= 82 ? 'Ice Blitz' : magic >= 70 ? 'Ice Burst' : magic >= 58 ? 'Ice Rush' : null;
  if (book === 2 || book === 3) return null;
  const surge: Record<string, number> = { air: 81, water: 85, earth: 90, fire: 95 };
  const wave: Record<string, number> = { air: 62, water: 65, earth: 70, fire: 75 };
  const order = [...(weakness && surge[weakness] ? [weakness] : []), 'fire', 'earth', 'water', 'air'];
  for (const e of order) if (magic >= surge[e]) return `${e[0].toUpperCase()}${e.slice(1)} Surge`;
  for (const e of order) if (magic >= wave[e]) return `${e[0].toUpperCase()}${e.slice(1)} Wave`;
  return null;
}

/** The prayers the calc assumes: the best of each style the character has, Piety by level alone. */
export function calcPrayers(levels: Record<string, number> | null, state: TripState | null): string[] {
  const pray = levels?.prayer ?? 99;
  const has = (k: string) => (state?.pray ? state.pray.includes(k) : pray >= 74);
  return [
    pray >= 70 && (levels?.defence ?? 99) >= 70 ? 'piety' : pray >= 31 ? 'ultimate_strength' : 'superhuman',
    ...(pray >= 31 ? ['incredible_reflexes'] : []),
    has('rigour') && pray >= 74 ? 'rigour' : pray >= 44 ? 'eagle_eye' : 'hawk_eye',
    has('augury') && pray >= 77 ? 'augury' : pray >= 45 ? 'mystic_might' : 'mystic_lore',
  ];
}

// ── The check ────────────────────────────────────────────────────────────────────────────────

/** Below this share of the bank's best, a target's carried loadout is a problem. */
const CALC_FLOOR = 0.85;
/** A missing slot that costs less than this share of DPS isn't worth a line. */
const SLOT_FLOOR = 0.01;

const KIND_LABEL = { melee: 'Melee', ranged: 'Ranged', magic: 'Magic' } as const;

/** What the calc's rows need to know about one picked piece: along, where in the bank, uncharged. */
interface CalcHeld {
  /** Worn, packed, or (the quiver's ammo) in a quiver that is along. */
  along: (id: number) => boolean;
  bankOf: (id: number) => number[];
  /** Every form of it the player holds is uncharged: the calc counted it charged. */
  needsCharge: (id: number) => boolean;
  /** A worn piece's row ({label, slot}) or a switch's (no slot); a quiver's names the ammo in it. */
  row: (id: number, o: { label?: string; slot?: string; detail: string; ammo?: number }) => TripRow;
  /** The quiver's ammo, when `id` is it. */
  inQuiver: (id: number) => boolean;
  isQuiver: (id: number) => boolean;
}

/** "Seeking dragon arrow" → "Seeking dragon arrows". */
const plural = (n: string) => (/s$/i.test(n) ? n : `${n}s`);

function calcHeld(inp: TripInput, h: Held, qv: { id: number; q: number } | null, quiverIn: boolean): CalcHeld {
  const forms = new Map<number, number[]>();
  for (const r of h.owned.keys()) {
    const k = knownAs(r, inp);
    if (k != null) forms.set(k, [...(forms.get(k) ?? []), r]);
  }
  const inQuiver = (id: number) => !!qv && qv.id === id;
  const quivers = [...new Set(inp.bank.map((it) => it.id).filter((id) => QUIVER_RE.test(inp.nameOf(id))))];
  const along = (id: number) => (inQuiver(id) ? quiverIn : h.carries(id));
  const bankOf = (id: number) => (inQuiver(id) ? quivers : h.inBank(id));
  const needsCharge = (id: number) => {
    const f = forms.get(id);
    return !!f?.length && f.every((r) => isUncharged(r, inp));
  };
  const isQuiver = (id: number) => QUIVER_RE.test(inp.nameOf(id));
  const row = (id: number, o: { label?: string; slot?: string; detail: string; ammo?: number }): TripRow => {
    const slot = o.slot ? { slot: o.slot } : {};
    // A quiver and the arrows in it: one row, "Blessed Dizana's quiver with Seeking dragon arrows".
    if (o.ammo != null) {
      const full = `${inp.nameOf(id).replace(/\s*\((uncharged|empty)\)\s*$/i, '')} with ${plural(shortName(inp.nameOf(o.ammo)))}`;
      const charge = needsCharge(id);
      if (along(id)) return charge ? { group: 'gear', ok: false, line: `${full}: charge the quiver`, detail: o.detail, item: id, ...slot } : { group: 'gear', ok: true, line: `Quiver: ${full}`, item: id, ...slot };
      return { group: 'gear', ok: false, line: `${full}: take the quiver${charge ? ' (charge it)' : ''}`, detail: charge ? `${o.detail}. Uncharged in your bank: charge it before the trip` : o.detail, item: id, bank: bankOf(id), ...slot };
    }
    const n = shortName(inp.nameOf(id));
    if (inQuiver(id)) {
      return quiverIn
        ? { group: 'gear', ok: true, line: `Quiver: ${n}`, item: id, ...slot }
        : { group: 'gear', ok: false, line: `${n} (in your quiver): take the quiver`, detail: o.detail, item: id, bank: bankOf(id), ...slot };
    }
    const charge = needsCharge(id);
    if (along(id)) {
      return charge
        ? { group: 'gear', ok: false, line: `${n} is uncharged: charge it`, detail: o.detail, item: id, ...slot }
        : { group: 'gear', ok: true, line: o.label ? `${o.label}: ${n}` : `Switch: ${n}`, item: id, ...slot };
    }
    const take = o.label ? `${n} is in your bank: take it` : `${n} (switch): in your bank`;
    return { group: 'gear', ok: false, line: charge ? `${take} (charge it)` : take, detail: charge ? `${o.detail}. Uncharged in your bank: charge it before the trip` : o.detail, item: id, bank: bankOf(id), ...slot };
  };
  return { along, bankOf, needsCharge, row, inQuiver, isQuiver };
}

/** What the calc's gear found, for the supplies after it. */
interface CalcOut {
  kinds: Set<Kind>;
  switchSlots: number;
  lightbearerWorn?: boolean;
  /** Combat spells cast, and about how many times a trip. */
  casts: Map<string, number>;
  /** The worn kit and the casting weapon (and shield): what gives runes without end. */
  wornIds: number[];
  castIds: number[];
}

/** Casts to kill `m` with result `r` (a margin for misses and phases), at least 20. */
const castsFor = (m: Monster, r: DpsResult) => Math.max(20, Math.ceil((1.25 * m.hp) / Math.max(0.5, r.dps * r.speed * 0.6)));

/** "Infernal cape (l)" and "Infernal cape" are one piece to a switch list: the name less its tags. */
const family = (n: string) => n.toLowerCase().replace(/\s*\([^()]*\)\s*/g, ' ').trim();
/** A switch piece that adds less than this share of the style's DPS isn't worth its inventory slot. */
const SWITCH_GAIN = 0.02;
/** A damage ring that adds less than this share is worn as Lightbearer instead on a spec trip. */
const RING_GAIN = 0.03;
const KINDS: readonly Kind[] = ['melee', 'ranged', 'magic'];

/**
 * The calc for a raid: ONE setup for every boss, worn plus a few switches, the way it is played.
 *  - Each boss's best loadout from the bank names the style it wants. Per style the kit that does best
 *    across that style's bosses (each boss's share of its own best, summed) is chosen; the style most
 *    bosses want is worn.
 *  - Every other style a boss wants, and every style a phase requires (lib/tripContent `requires`:
 *    the Wardens' P2 rotates styles), is a switch: its weapon first (and the ammo it fires), then the
 *    kit's pieces with the most DPS per inventory slot, while they add SWITCH_GAIN and the trip's
 *    switch slots last. A piece already worn, or the same piece by another name, is never packed.
 *  - On a spec trip a worn ring that adds little gives way to Lightbearer.
 * Rows: each worn piece and each switch, carried or "in your bank: take it". When what is carried
 * already does nearly as well against every boss, one passing row says so.
 */
function raidRows(inp: TripInput, c: CalcHeld & { stats: CalcCtx['stats']; prayer: string[]; ownedIds: number[]; carriedIds: number[] }, info: string[], out: CalcOut): TripRow[] {
  const boosts = RAID_BOOSTS[inp.content.key];
  const per = inp.monsters
    .map((m) => {
      const ctx: CalcCtx = { idx: inp.idx, stats: c.stats, prayer: c.prayer, spell: calcSpell(inp.state?.book ?? 0, c.stats.magic, m.ew), spells: calcSpells(inp.state?.book ?? 0, c.stats.magic, m), ...(boosts ? { boosts } : {}) };
      return { m, ctx, best: bestLoadout(m, c.ownedIds, ctx), carried: bestLoadout(m, c.carriedIds, ctx) };
    })
    .filter((p): p is typeof p & { best: Best } => !!p.best && p.best.result.dps > 0);
  if (!per.length) return [];
  const bosses = per.map((p) => shortTarget(p.m.n));
  const required = inp.content.requires ?? [];
  const requiredKinds = new Set(required.flatMap((r) => r.styles));
  const name = (id: number) => inp.idx.item(id)?.n ?? inp.nameOf(id);
  // A required style the bank can't fight with at all is left out (and said).
  const kindBest = new Map<string, Best | null>();
  const bestOf = (p: (typeof per)[number], kind: Kind) => {
    const k = `${per.indexOf(p)}:${kind}`;
    if (!kindBest.has(k)) kindBest.set(k, kindOfType(p.best.result.style.type) === kind ? p.best : bestLoadout(p.m, c.ownedIds, { ...p.ctx, only: kind }));
    return kindBest.get(k) ?? null;
  };
  if (per.every((p) => p.carried && p.carried.result.dps >= CALC_FLOOR * p.best.result.dps) && [...requiredKinds].every((k) => per.some((p) => p.carried && bestLoadout(p.m, c.carriedIds, { ...p.ctx, only: k })))) {
    return [{ group: 'gear', ok: true, line: `Your setup covers all ${per.length} bosses`, detail: bosses.join(', ') }];
  }
  const wants = new Map<Kind, typeof per>();
  for (const p of per) {
    const k = kindOfType(p.best.result.style.type);
    wants.set(k, [...(wants.get(k) ?? []), p]);
  }
  // Each style's kit: the candidate best across the bosses it is for (a required style: all of them).
  const kitOf = (kind: Kind) => {
    const ps = wants.get(kind) ?? per;
    const cands = ps.map((p) => bestOf(p, kind)).filter((b): b is Best => !!b);
    if (!cands.length) return null;
    const share = (gear: Record<string, number>) => ps.reduce((a, q) => a + (tryGear(gear, q.m, q.ctx, null)?.dps ?? 0) / Math.max(1e-9, bestOf(q, kind)?.result.dps ?? 1), 0);
    let pick = cands[0];
    let top = -1;
    for (const cand of cands) {
      const sc = share(cand.gear);
      if (sc > top) [top, pick] = [sc, cand];
    }
    return { kind, gear: { ...pick.gear }, ps, share };
  };
  const order = KINDS.filter((k) => wants.has(k) || requiredKinds.has(k)).sort((a, b) => (wants.get(b)?.length ?? 0) - (wants.get(a)?.length ?? 0));
  const kits = order.map(kitOf).filter((k): k is NonNullable<ReturnType<typeof kitOf>> => !!k);
  if (!kits.length) return [];
  const [worn, ...others] = kits;
  // Lightbearer on a spec trip, when the worn ring adds little.
  const lb = c.ownedIds.find((id) => LIGHTBEARER.test(name(id)));
  if (inp.content.spec && lb != null && worn.gear.ring != null && worn.gear.ring !== lb) {
    const without = { ...worn.gear, ring: lb };
    if (worn.share(without) >= (1 - RING_GAIN) * worn.share(worn.gear)) {
      worn.gear.ring = lb;
      out.lightbearerWorn = true;
    }
  }
  const rows: TripRow[] = [];
  const quiverOf = (gear: Record<string, number>) => {
    const ammo = gear.ammo != null && c.inQuiver(gear.ammo) ? gear.ammo : null;
    return ammo != null && Object.values(gear).some(c.isQuiver) ? ammo : null;
  };
  const wq = quiverOf(worn.gear);
  for (const [slot, id] of Object.entries(worn.gear)) {
    if (id === wq) continue;
    const label = SLOT_LABEL[slot] ?? slot;
    const detail = LIGHTBEARER.test(name(id)) ? `${label}: spec energy back twice as fast` : `${label}: your ${worn.kind} setup, worn`;
    rows.push(c.row(id, { label, slot, detail, ...(wq != null && c.isQuiver(id) ? { ammo: wq } : {}) }));
  }
  // The switches: weapons first, then the most DPS per slot, within the trip's switch slots.
  const budget = inp.content.switchSlots ?? 8;
  const packed = new Map<number, Kind>();
  const wornFamilies = new Set(Object.values(worn.gear).map((id) => family(name(id))));
  const isPacked = (id: number) => packed.has(id) || [...packed.keys()].some((x) => family(name(x)) === family(name(id)));
  const cost = (id: number) => (wornFamilies.has(family(name(id))) || isPacked(id) || c.inQuiver(id) ? 0 : 1);
  const plans = others.map((k) => {
    const gear: Record<string, number> = { ...worn.gear, weapon: k.gear.weapon };
    const w = inp.idx.item(k.gear.weapon);
    // What the weapon fires comes with it; a two-hander leaves the shield off.
    if (k.gear.ammo != null) gear.ammo = k.gear.ammo;
    else if (gear.ammo != null && w && !ammoFits(w, inp.idx.item(gear.ammo)!)) delete gear.ammo;
    if (w?.h2) delete gear.shield;
    const pieces = [k.gear.weapon, ...(k.gear.ammo != null ? [k.gear.ammo] : [])];
    // Arrows that live in the quiver come only with the quiver.
    if (k.gear.ammo != null && c.inQuiver(k.gear.ammo) && k.gear.cape != null && c.isQuiver(k.gear.cape) && !Object.values(gear).some(c.isQuiver)) {
      gear.cape = k.gear.cape;
      pieces.push(k.gear.cape);
    }
    return { k, gear, pieces };
  });
  for (const pl of plans) for (const id of pl.pieces) if (cost(id)) packed.set(id, pl.k.kind);
  for (;;) {
    let best: { pl: (typeof plans)[number]; slot: string; id: number; gain: number } | null = null;
    for (const pl of plans) {
      const now = pl.k.share(pl.gear);
      for (const [slot, id] of Object.entries(pl.k.gear)) {
        if (slot === 'weapon' || slot === 'ammo' || pl.gear[slot] === id || (slot === 'shield' && inp.idx.item(pl.gear.weapon)?.h2)) continue;
        const n = cost(id);
        if (n && packed.size + n > budget) continue;
        const gain = (pl.k.share({ ...pl.gear, [slot]: id }) - now) / Math.max(1e-9, now);
        if (gain < SWITCH_GAIN) continue;
        const per1 = gain / Math.max(1, n);
        if (!best || per1 > best.gain) best = { pl, slot, id, gain: per1 };
      }
    }
    if (!best) break;
    const n = cost(best.id);
    best.pl.gear[best.slot] = best.id;
    if (n) {
      best.pl.pieces.push(best.id);
      packed.set(best.id, best.pl.k.kind);
    }
  }
  const listed = new Set<number>();
  for (const pl of plans) {
    const q = quiverOf(pl.gear);
    const forPhase = required.filter((r) => r.styles.includes(pl.k.kind)).map((r) => r.phase);
    const why = wants.has(pl.k.kind) ? targetList(pl.k.ps.map((p) => shortTarget(p.m.n))) : forPhase.join(', ');
    for (const id of pl.pieces) {
      if (listed.has(id) || id === q || !packed.has(id)) continue;
      listed.add(id);
      rows.push(c.row(id, { detail: `${KIND_LABEL[pl.k.kind]} switch for ${why}`, ...(q != null && c.isQuiver(id) ? { ammo: q } : {}) }));
    }
  }
  out.switchSlots = packed.size;
  for (const k of kits) out.kinds.add(k.kind);
  out.wornIds = Object.values(worn.gear);
  // The spells the magic kit autocasts, at each boss it is for.
  const magicGear = worn.kind === 'magic' ? worn.gear : plans.find((pl) => pl.k.kind === 'magic')?.gear;
  const magicKit = kits.find((k) => k.kind === 'magic');
  if (magicGear && magicKit) {
    for (const p of wants.has('magic') ? magicKit.ps : per.slice(0, 1)) {
      const t = trySpell(magicGear, p.m, p.ctx, null);
      if (t?.spell) out.casts.set(t.spell, (out.casts.get(t.spell) ?? 0) + castsFor(p.m, t.r));
    }
    out.castIds = [magicGear.weapon, ...(magicGear.shield != null ? [magicGear.shield] : [])].filter((x): x is number => x != null);
  }
  info.push(`One setup for ${per.length} bosses: ${worn.kind} worn${plans.length ? `, ${plans.map((p) => p.k.kind).join(' and ')} switches` : ''}, ${packed.size} switch slot${packed.size === 1 ? '' : 's'}`);
  for (const r of required) {
    const need = r.styles.filter((k) => k !== worn.kind);
    const missing = r.styles.filter((k) => !kits.some((x) => x.kind === k));
    if (need.length) info.push(`${r.phase}: you'll need ${need.filter((k) => !missing.includes(k)).join(' and ')} switches${missing.length ? ` (nothing in your bank fights with ${missing.join(' or ')})` : ''}`);
  }
  // Why every boss is one style, when they are.
  if (wants.size === 1 && per.length > 1) info.push(`${KIND_LABEL[worn.kind]} does the most damage at every boss here with your bank`);
  return rows;
}

/** How the carried loadout's DPS compares with the bank's best, in words: "about half as strong as". */
export function strengthWords(ratio: number): string {
  if (ratio < 0.4) return 'less than half as strong as';
  if (ratio < 0.6) return 'about half as strong as';
  if (ratio < 0.75) return 'about two-thirds as strong as';
  return 'a little weaker than';
}

/** An item with no bonuses at all (Lightbearer, Ring of shadows): worn for what it does, never "will do" without. */
const isUtility = (it: GearItem | null): boolean => !!it && it.b.every((x) => x === 0);

const BOOK_NAME = ['Standard', 'Ancient', 'Lunar', 'Arceuus'];
/** Thralls by the worn style: a ghost for magic, a skeleton for ranged, a zombie for melee. */
const THRALL: Record<Kind, string> = { magic: 'Resurrect Greater Ghost', ranged: 'Resurrect Greater Skeleton', melee: 'Resurrect Greater Zombie' };

/**
 * The calc's spells and rune pouch. The combat spell an autocasting weapon casts (calc.casts) and the
 * utility spells the trip uses on the player's book (lib/tripContent `spells`; thralls and Death
 * Charge on Arceuus at a boss; Vengeance on Lunar where `veng`) are priced in runes (SPELL_RUNES).
 * Runes a worn staff or tome gives without end drop out; a combination rune the player holds takes
 * two runes' place; the most-needed fit the pouch (4 kinds in a divine pouch, 3 in a plain one) and
 * the rest take inventory slots. Each rune is checked against the pouch (state.pouch) and inventory.
 */
function calcRunes(inp: TripInput, h: Held, calc: CalcOut, levels: Record<string, number> | null): { rows: TripRow[]; slots: number } {
  const name = (id: number) => inp.nameOf(id);
  const book = inp.state?.book ?? null;
  const magic = levels?.magic ?? 99;
  const spells = new Map(calc.casts);
  for (const sp of inp.content.spells ?? []) if (book === sp.book && magic >= sp.level) spells.set(sp.name, (spells.get(sp.name) ?? 0) + sp.casts);
  const boss = inp.content.spec || inp.content.instance;
  if (book === 3 && boss && magic >= 76) {
    const worn = [...calc.kinds][0] ?? 'melee';
    spells.set(THRALL[worn], 10);
    if (magic >= 80) spells.set('Death Charge', 4);
  }
  if (book === 2 && inp.content.veng && magic >= 94 && (levels?.defence ?? 99) >= 40) spells.set('Vengeance', 15);
  const priced = [...spells].filter(([sp]) => SPELL_RUNES[sp.toLowerCase()]);
  if (!priced.length) return { rows: [], slots: 0 };
  const rows: TripRow[] = [];
  const names = priced.map(([sp]) => sp);
  rows.push(book == null ? { group: 'book', ok: true, line: `Spells: ${names.join(', ')}` } : { group: 'book', ok: true, line: `${BOOK_NAME[book]} spellbook`, detail: `For ${names.join(', ')}` });
  // Runes for every cast, less what a worn staff or tome gives.
  const free = new Set<Rune>();
  for (const id of [...calc.wornIds, ...calc.castIds]) for (const r of staffRunes(name(id))) free.add(r);
  const need = new Map<Rune, number>();
  for (const [sp, n] of priced) for (const [r, q] of Object.entries(SPELL_RUNES[sp.toLowerCase()]) as [Rune, number][]) if (!free.has(r)) need.set(r, (need.get(r) ?? 0) + q * n);
  // What is held of each rune (and combination rune): the pouch only when it is packed.
  const pouchIn = inp.inventory.some((it) => inp.isRunePouch(it.id));
  const carried = new Map<number, number>();
  const add = (id: number, q: number) => carried.set(id, (carried.get(id) ?? 0) + q);
  for (const it of inp.inventory) add(it.id, qty(it));
  if (pouchIn) for (const p of inp.state?.pouch ?? []) add(p.id, p.q);
  const ownedQ = (id: number) => (h.owned.get(id) ?? 0) + (inp.state?.pouch ?? []).filter((p) => p.id === id).reduce((a, p) => a + p.q, 0);
  // A combination rune the player holds stands for two needed runes: one pouch kind less.
  const slots: { id: number; n: number; runes: Rune[] }[] = [];
  const left = new Map(need);
  const combos = Object.entries(COMBO).map(([id, rs]) => ({ id: Number(id), rs })).filter((c) => c.rs.length === 2 && c.rs.every((r) => left.has(r)) && ownedQ(c.id) > 0);
  for (const c of combos.sort((a, b) => ownedQ(b.id) - ownedQ(a.id))) {
    if (!c.rs.every((r) => left.has(r))) continue;
    slots.push({ id: c.id, n: Math.max(...c.rs.map((r) => left.get(r)!)), runes: c.rs });
    for (const r of c.rs) left.delete(r);
  }
  for (const [r, n] of left) slots.push({ id: RUNE[r], n, runes: [r] });
  // What the pouch already holds stays in it; then the most-needed.
  const inPouchNow = new Set((inp.state?.pouch ?? []).map((p) => p.id));
  slots.sort((a, b) => Number(inPouchNow.has(b.id)) - Number(inPouchNow.has(a.id)) || b.n - a.n);
  // The pouch the player owns: a divine one holds four kinds.
  const pouches = [...h.owned.keys()].filter((id) => inp.isRunePouch(id));
  const divine = pouches.find((id) => /divine/i.test(name(id)));
  const pouch = divine ?? pouches[0] ?? null;
  const cap = pouch == null ? 0 : divine != null ? 4 : 3;
  if (pouch != null) {
    rows.push(pouchIn ? { group: 'pouch', ok: true, line: `${shortName(name(pouch))} packed`, item: pouch, need: 1 } : { group: 'pouch', ok: false, line: `${shortName(name(pouch))}: in your bank`, detail: `For ${names.join(', ')}`, item: pouch, need: 1, bank: h.inBank(pouch) });
  } else rows.push({ group: 'pouch', ok: false, line: 'No rune pouch', detail: 'Runes take a slot each without one' });
  slots.forEach((sl, i) => {
    const inPouch = i < cap;
    const have = carried.get(sl.id) ?? 0;
    const label = `${shortName(name(sl.id))}s`;
    const own = ownedQ(sl.id);
    rows.push(
      have >= sl.n
        ? { group: 'pouch', ok: true, line: `${label} ${have}${inPouch ? ' in the pouch' : ''}`, item: sl.id, need: sl.n, inPouch }
        : { group: 'pouch', ok: false, line: own >= sl.n ? `${label}: have ${have}, take ${sl.n}` : `${label}: ${own ? `only ${own}` : 'none'} owned, need ${sl.n}`, detail: `${inPouch ? 'In the rune pouch' : 'In your inventory'}, for ${names.filter((sp) => sl.runes.some((r) => SPELL_RUNES[sp.toLowerCase()]?.[r])).join(', ')}`, item: sl.id, need: sl.n, inPouch, bank: h.inBank(sl.id) },
    );
  });
  // The pouch takes a slot, and each rune kind it can't hold another.
  return { rows, slots: (pouch != null ? 1 : 0) + Math.max(0, slots.length - cap) };
}

/**
 * The supplies a calc setup packs: the trip's template (lib/tripContent `supplies`, else a default),
 * each kind's best item the player owns (lib/tripSupplies), a style's potion only when that style is
 * used, and food for whatever room the switches and spec leave in 28. A kind the player owns none of
 * is a red row naming the usual item.
 */
function calcSupplies(inp: TripInput, h: Held, gear: readonly TripRow[], calc: CalcOut, runeSlots: number): TripRow[] {
  const name = (id: number) => inp.nameOf(id);
  const owned = [...h.owned.keys()].map((id) => ({ id, name: name(id) }));
  const carried = new Map<string, number>();
  for (const it of inp.inventory) carried.set(supplyKind(name(it.id)), (carried.get(supplyKind(name(it.id))) ?? 0) + qty(it));
  // Inventory slots the gear takes: each switch and the spec weapon (worn pieces take none).
  const used = new Set(gear.filter((r) => r.item != null && ((r.group === 'gear' && !r.slot) || r.group === 'spec')).map((r) => r.item!));
  // The rune pouch and runes that don't fit in it take `runeSlots`; else one slot is kept for a teleport.
  let room = 28 - used.size - Math.max(1, runeSlots);
  // Content with its own food-and-restore check (`basics`) keeps it; the calc adds the rest.
  const template = (inp.content.supplies ?? DEFAULT_SUPPLIES).filter((t) => (!t.style || calc.kinds.has(t.style)) && !(inp.content.basics && ['Food', 'Restores', 'Brews'].includes(t.kind)));
  const rows: TripRow[] = [];
  const fixed = template.reduce((a, t) => a + (t.n === 'fill' ? 0 : t.n), 0);
  const fill = Math.max(0, room - fixed);
  for (const t of template) {
    const n = Math.min(t.n === 'fill' ? fill : t.n, Math.max(0, room));
    if (n <= 0) continue;
    room -= n;
    const own = ownedSupply(t.kind, owned);
    const id = own?.id ?? SUPPLY_ITEMS[t.kind][0].id;
    const kind = supplyKind(name(id));
    const label = t.kind === 'Magic boost' ? shortName(name(id)) : t.kind;
    const have = carried.get(kind) ?? 0;
    const bank = [...new Set(inp.bank.map((it) => it.id).filter((b) => supplyKind(name(b)) === kind))];
    rows.push(
      !own
        ? { group: 'supplies', ok: false, line: `${label}: none in your bank`, detail: `${n} ${shortName(name(id))}, or another of the kind`, item: id, need: n }
        : have >= n
          ? { group: 'supplies', ok: true, line: `${label} ${have}`, item: id, need: n, bank }
          : { group: 'supplies', ok: false, line: `${label}: have ${have}, take ${n}`, detail: shortName(name(id)), item: id, need: n, bank },
    );
  }
  return rows;
}

/**
 * A ToA boss at a raid level: every 5 levels add 2% to its hitpoints and its defence roll (the engine
 * scales the roll off `raidLevel`). Anything else, or no level, as it is.
 */
export function raidScaled(m: Monster, raidLevel: number | null | undefined): Monster {
  // Already scaled (the view scales once, the check again): as it is.
  if (!raidLevel || m.raidLevel != null || !TOA_MONSTER.test(m.n)) return m;
  return { ...m, raidLevel, hp: Math.round(m.hp * (1 + raidLevel / 250)) };
}

export function checkTrip(input: TripInput): TripCheck {
  const inp: TripInput = input.raidLevel ? { ...input, monsters: input.monsters.map((m) => raidScaled(m, input.raidLevel)) } : input;
  const rows: TripRow[] = [];
  const unknown: string[] = [];
  const h = held(inp);
  const name = (id: number) => inp.nameOf(id);
  const wornMap: Record<string, number> = {};
  for (const it of inp.worn) {
    const k = knownAs(it.id, inp);
    const s = k != null ? slotOf(inp.idx.item(k)) : null;
    if (k != null && s && wornMap[s] == null) wornMap[s] = k;
  }
  const levels = inp.levels;
  const state = inp.state;
  const pouchIn = inp.inventory.some((it) => inp.isRunePouch(it.id));
  const packedNotWorn: string[] = [];
  const info0: string[] = [];
  // The calc's gear (no setup): the styles it fights with and the switch slots, for its supplies.
  let calc: CalcOut | null = null;

  // ── Gear ──
  const specIn = (ids: number[]) => ids.filter((id) => isSpecWeapon(inp.idx.item(id)?.n ?? name(id)));
  let setupSpecs: number[] = [];
  if (inp.setup) {
    const s = inp.setup;
    const snap: Snapshot = { equipment: { items: [...inp.worn], readAt: '' }, inventory: { items: [...inp.inventory], readAt: '' }, bank: { items: [...inp.bank], readAt: '' }, ...(inp.lootingBag ? { lootingBag: { items: [...inp.lootingBag], readAt: '' } } : {}) };
    const resolved = resolveSetup(s, snap, inp.needs, inp.prefs ?? {});
    const mine: GearSetup = { ...personalSetup(s, resolved), stats: ownStats(s.stats, levels).stats };
    const dpsOf = (x: GearSetup) => mean(inp.monsters.map((m) => bestStyle(setupLoadout(x), m, inp.idx.item, inp.idx.rules)?.result.dps ?? 0));
    const base = inp.monsters.length ? dpsOf(mine) : 0;
    for (const pick of resolved.slots) {
      // The quiver's own ammo: read off the quiver (state.quiver), only while a quiver is worn or
      // carried. It is in no container, so "missing" from the snapshot says nothing about it.
      if (pick.slot === 'quiver') {
        const use = pick.use ?? pick.guide;
        const qv = quiverAmmo(inp, h);
        const fits = (q: { id: number }) => pick.options.some((o) => q.id === o || inp.needs(o).includes(q.id) || inp.holds(q.id).includes(o));
        if (qv === 'no-quiver' || use == null) continue;
        if (qv === undefined) unknown.push('quiver ammo');
        else if (qv && fits(qv)) {
          rows.push(qv.q >= QUIVER_LOW ? { group: 'gear', ok: true, line: `Quiver: ${shortName(name(qv.id))} ${qv.q}`, item: qv.id } : { group: 'gear', ok: false, line: `Quiver: only ${qv.q} ${shortName(name(qv.id))}`, detail: 'Fill your quiver before the trip', item: qv.id });
        } else if (pick.kind !== 'missing' || h.owns(use)) {
          rows.push({ group: 'gear', ok: false, line: `${shortName(name(use))} (quiver): not in your quiver`, detail: qv ? `Your quiver holds ${name(qv.id)}` : 'Your quiver is empty', item: use, bank: h.inBank(use) });
        }
        continue;
      }
      const label = SLOT_LABEL[pick.slot] ?? pick.slot;
      // Nowhere at all: for a guide's setup an upgrade, not a trip problem; for the player's own setup
      // (what they wore when they saved it) it went somewhere, and the trip is short of it.
      if (pick.kind === 'missing' || pick.use == null) {
        const gone = pick.use ?? pick.guide;
        if (inp.source === 'own' && gone != null) rows.push({ group: 'gear', ok: false, line: `${shortName(name(gone))}: not found`, detail: `${label}: not worn, packed or in your bank`, item: gone, slot: pick.slot });
        continue;
      }
      const use = pick.use;
      if (h.carries(use)) {
        rows.push({ group: 'gear', ok: true, line: `${label}: ${shortName(name(use))}`, item: use, slot: pick.slot });
        // Packed but not worn: fine, a note to put it on.
        if (!h.wears(use)) packedNotWorn.push(shortName(name(use)));
        continue;
      }
      // Not worn or packed: what leaving it costs, with whatever is carried for that slot instead.
      const alt = wornMap[pick.slot] ?? inp.inventory.map((it) => knownAs(it.id, inp)).find((k) => k != null && slotOf(inp.idx.item(k)) === pick.slot) ?? null;
      let loss = 1;
      if (base > 0) {
        const swapped = alt != null ? withSlot(mine, pick.slot, alt, inp.idx) : (() => { const g = { ...mine.gear }; delete g[pick.slot]; return { ...mine, gear: g }; })();
        loss = (base - dpsOf(swapped)) / base;
      }
      if (base > 0 && loss < SLOT_FLOOR && !isUtility(inp.idx.item(knownAs(use, inp) ?? use))) {
        rows.push({ group: 'gear', ok: true, line: `${label}: ${alt != null ? shortName(name(alt)) : 'empty'} will do`, detail: `No DPS lost without ${name(use)}`, item: alt ?? use });
        continue;
      }
      rows.push({
        group: 'gear',
        ok: false,
        slot: pick.slot,
        line: `${shortName(name(use))} is in your bank: take it`,
        detail: `${label}${base > 0 && loss >= SLOT_FLOOR ? `, ${Math.round(loss * 100)}% less damage without it` : ''}`,
        item: use,
        bank: h.inBank(use),
      });
    }
    // The switches the setup packs: anything wearable in its inventory.
    const packed = [...new Set((s.inventory ?? []).filter((x): x is InvItem => !!x && !!inp.idx.item(x.id)).map((x) => x.id))];
    setupSpecs = specIn(packed);
    for (const id of packed.filter((x) => !setupSpecs.includes(x))) {
      if (!h.owns(id)) continue;
      const inv = inp.idx.item(id);
      if (inv?.s === 'ammo' && Object.values(s.gear).includes(id)) continue;
      rows.push(h.carries(id) ? { group: 'gear', ok: true, line: `Switch: ${shortName(name(id))}`, item: id } : { group: 'gear', ok: false, line: `${shortName(name(id))} (switch): in your bank`, item: id, bank: h.inBank(id) });
    }
  } else {
    // The calc: per target, the best the bank makes against the best of what is carried.
    const lv = (k: string, d = 80) => (typeof levels?.[k] === 'number' ? levels[k] : d);
    const stats = { attack: lv('attack'), strength: lv('strength'), ranged: lv('ranged'), magic: lv('magic'), hitpoints: lv('hitpoints', 99) };
    const prayer = calcPrayers(levels, state);
    const ids = (m: Map<number, number>) => [...m.keys()].map((id) => knownAs(id, inp)).filter((x): x is number => x != null);
    // The quiver's own ammo is the player's wherever the quiver is, and along whenever it is.
    const qv = quiverAmmo(inp, h, true);
    const quiverIn = quiverAmmo(inp, h) !== 'no-quiver';
    const ownedIds = [...ids(h.owned), ...(qv && typeof qv === 'object' ? [qv.id] : [])];
    const carriedIds = [...ids(h.carried), ...(qv && typeof qv === 'object' && quiverIn ? [qv.id] : [])];
    const ch = calcHeld(inp, h, qv && typeof qv === 'object' ? qv : null, quiverIn);
    const short = new Map<string, { targets: string[]; row: TripRow }>();
    // A raid (several bosses) is ONE trip with one inventory: one setup, never a list per boss.
    calc = { kinds: new Set(), switchSlots: 0, casts: new Map(), wornIds: [], castIds: [] };
    if (inp.monsters.length > 1) rows.push(...raidRows(inp, { ...ch, stats, prayer, ownedIds, carriedIds }, info0, calc));
    else for (const m of inp.monsters) {
      const ctx: CalcCtx = { idx: inp.idx, stats, prayer, spell: calcSpell(state?.book ?? 0, stats.magic, m.ew), spells: calcSpells(state?.book ?? 0, stats.magic, m) };
      const o = bestLoadout(m, ownedIds, ctx);
      if (!o) continue;
      calc.kinds.add(kindOfType(o.result.style.type));
      calc.wornIds = Object.values(o.gear);
      const cast = trySpell(o.gear, m, ctx, null);
      if (cast?.spell) {
        calc.casts.set(cast.spell, (calc.casts.get(cast.spell) ?? 0) + castsFor(m, cast.r));
        calc.castIds = [o.gear.weapon, ...(o.gear.shield != null ? [o.gear.shield] : [])];
      }
      const c = bestLoadout(m, carriedIds, ctx);
      const target = shortTarget(m.n);
      if (c && c.result.dps >= CALC_FLOOR * o.result.dps) {
        rows.push({ group: 'gear', ok: true, line: `${target}: ${shortName(name(c.weapon))}`, detail: `${Math.round((c.result.dps / o.result.dps) * 100)}% of your bank's best`, item: c.weapon });
        continue;
      }
      const type = o.result.style.type;
      const w = shortName(name(o.weapon));
      const packedWeapon = ch.along(o.weapon);
      const key = packedWeapon ? `gear:${target}` : `w:${o.weapon}:${type}`;
      // What to take: the best loadout's pieces not worn or packed.
      const swaps = [...new Set(Object.values(o.gear))].filter((id) => !ch.along(id));
      const bank = [...new Set(swaps.flatMap((id) => ch.bankOf(id)))];
      const charge = [...new Set(Object.values(o.gear))].filter((id) => ch.needsCharge(id)).map((id) => shortName(name(id)));
      const many = inp.monsters.length > 1;
      const row: TripRow = packedWeapon || !c
        ? { group: 'gear', ok: false, line: c ? `Your gear is ${strengthWords(c.result.dps / o.result.dps)} the best ${type} setup in your bank` : `Nothing you carry can fight ${target}`, detail: `${many ? `For ${target}. ` : ''}Take from your bank:`, item: o.weapon, swaps, bank }
        : { group: 'gear', ok: false, line: `${w} is in your bank: take it`, detail: `Your best ${type} weapon${many ? ` for ${target}` : ''}. With the rest of the setup, take:`, item: o.weapon, swaps, bank };
      // Counted charged: say so ("Charge Tumeken's shadow first").
      if (charge.length) row.detail = `${row.detail} Charge ${charge.join(', ')} first.`;
      const prev = short.get(key);
      if (prev) {
        if (!prev.targets.includes(target)) prev.targets.push(target);
        prev.row.detail = `Your best ${type} weapon for ${targetList(prev.targets)}. With the rest of the setup, take:`;
      } else {
        short.set(key, { targets: [target], row });
        rows.push(row);
      }
    }
  }

  // ── Spec weapon ──
  const specName = (id: number) => inp.idx.item(knownAs(id, inp) ?? id)?.n ?? name(id);
  const ownedSpecs = [...h.owned.keys()]
    .filter((id) => {
      const n = specName(id);
      return isSpecWeapon(n) && usableHeld(n) && usableHeld(name(id));
    })
    .sort((a, b) => specRank(specName(a)) - specRank(specName(b)));
  if (setupSpecs.length) {
    for (const id of setupSpecs) {
      if (!h.owns(id)) continue;
      rows.push(h.carries(id) ? { group: 'spec', ok: true, line: `Spec: ${shortName(name(id))}`, item: id } : { group: 'spec', ok: false, line: `${shortName(name(id))} (spec): in your bank`, item: id, bank: h.inBank(id) });
    }
  } else if (inp.content.spec && ownedSpecs.length) {
    const packed = ownedSpecs.find((id) => h.carried.has(id));
    rows.push(packed ? { group: 'spec', ok: true, line: `Spec: ${shortName(name(packed))}`, item: packed } : { group: 'spec', ok: false, line: `${shortName(name(ownedSpecs[0]))} (spec): in your bank`, item: ownedSpecs[0], bank: h.inBank(ownedSpecs[0]) });
  }
  // Lightbearer beside a spec weapon: spec energy back twice as fast, worn between specs.
  const lightbearer = [...h.owned.keys()].find((id) => LIGHTBEARER.test(inp.idx.item(knownAs(id, inp) ?? id)?.n ?? name(id)));
  const inSetup = !!inp.setup && [...Object.values(inp.setup.gear), ...(inp.setup.inventory ?? []).map((x) => x?.id)].some((id) => id != null && LIGHTBEARER.test(name(id)));
  if (lightbearer != null && !inSetup && rows.some((r) => r.group === 'spec') && !rows.some((r) => r.item === lightbearer)) {
    rows.push(h.carries(lightbearer)
      ? { group: 'spec', ok: true, line: 'Lightbearer: spec energy back twice as fast', item: lightbearer }
      : { group: 'spec', ok: false, line: 'Lightbearer (ring switch): in your bank', detail: 'Spec energy back twice as fast: wear it between specs', item: lightbearer, bank: h.inBank(lightbearer) });
  }

  // ── The calc's supplies: the trip's template, filled from the bank, room left after the switches ──
  if (calc) {
    const runes = calcRunes(inp, h, calc, levels);
    rows.push(...runes.rows);
    rows.push(...calcSupplies(inp, h, rows, calc, runes.slots));
  }

  // ── Spellbook and runes ──
  const s = inp.setup;
  const spells = [...new Set([...(s?.spells ?? []), ...(s?.spell ? [s.spell] : [])].map((x) => x.trim()).filter(Boolean))];
  const BOOK = ['Standard', 'Ancient', 'Lunar', 'Arceuus'];
  if (s && spells.length && s.spellbook != null) {
    if (state?.book == null) unknown.push('spellbook');
    else rows.push(state.book === s.spellbook ? { group: 'book', ok: true, line: `${BOOK[state.book]} spellbook` } : { group: 'book', ok: false, line: `On ${BOOK[state.book]}, the setup needs ${BOOK[s.spellbook] ?? 'another'}`, detail: `For ${spells.join(', ')}` });
  }
  if (s && spells.length) {
    const need = new Map<Rune, number>();
    let unpriced = false;
    for (const sp of spells) {
      const cost = SPELL_RUNES[sp.toLowerCase()];
      // An autocast staff spell the table doesn't price: the setup's own pouch says what it takes.
      if (!cost) {
        unpriced = true;
        continue;
      }
      for (const [r, n] of Object.entries(cost) as [Rune, number][]) need.set(r, Math.max(need.get(r) ?? 0, n));
    }
    if (unpriced && !need.size) for (const p of s.runePouch ?? []) for (const [r, id] of Object.entries(RUNE) as [Rune, number][]) if (id === p.id) need.set(r, 1);
    if (need.size) {
      const free = new Set<Rune>();
      for (const id of Object.values(wornMap)) for (const r of staffRunes(name(id))) free.add(r);
      const have = new Map<Rune, number>();
      const add = (id: number, q: number) => {
        for (const [r, rid] of Object.entries(RUNE) as [Rune, number][]) if (rid === id) have.set(r, (have.get(r) ?? 0) + q);
        for (const r of COMBO[id] ?? []) have.set(r, (have.get(r) ?? 0) + q);
      };
      for (const it of inp.inventory) add(it.id, qty(it));
      const pouchKnown = pouchIn && state?.pouch != null;
      if (pouchKnown) for (const p of state!.pouch!) add(p.id, p.q);
      const short = [...need.keys()].filter((r) => !free.has(r) && (have.get(r) ?? 0) < need.get(r)!);
      if (pouchIn && state?.pouch == null) unknown.push('rune pouch');
      else if (!pouchIn && (s.runePouch?.length ?? 0) > 0 && short.length) rows.push({ group: 'pouch', ok: false, line: 'Rune pouch not packed', detail: `${spells.join(', ')} need ${short.map((r) => RUNE_NAME[r]).join(', ')} runes` });
      else if (short.length) rows.push({ group: 'pouch', ok: false, line: `${pouchIn ? 'Rune pouch' : 'Runes'}: no ${short.slice(0, 2).map((r) => RUNE_NAME[r]).join(' or ')} runes${short.length > 2 ? ' +' : ''}`, detail: `For ${spells.join(', ')}` });
      else rows.push({ group: 'pouch', ok: true, line: `Runes for ${spells.length === 1 ? spells[0] : `${spells.length} spells`}` });
    }
  }

  // ── Supplies ──
  if (s?.inventory?.length) {
    const kindOf = (id: number) => supplyKind(name(id));
    const isSupply = (id: number) => !inp.idx.item(knownAs(id, inp) ?? id) && !inp.isRunePouch(id) && !COMBO[id] && !Object.values(RUNE).includes(id as never);
    const want = new Map<string, { n: number; id: number }>();
    for (const it of s.inventory) if (it && isSupply(it.id)) {
      const k = kindOf(it.id);
      const w = want.get(k);
      want.set(k, { n: (w?.n ?? 0) + qty(it), id: w?.id ?? it.id });
    }
    const got = new Map<string, number>();
    for (const it of inp.inventory) if (isSupply(it.id)) got.set(kindOf(it.id), (got.get(kindOf(it.id)) ?? 0) + qty(it));
    for (const [k, w] of want) {
      const g = got.get(k) ?? 0;
      // Every dose of the kind in the bank, for the layout's supply rows.
      const kindBank = [...new Set(inp.bank.map((it) => it.id).filter((id) => isSupply(id) && kindOf(id) === k))];
      rows.push(g >= w.n ? { group: 'supplies', ok: true, line: `${k} ${g}`, item: w.id, bank: kindBank } : { group: 'supplies', ok: false, line: `${k}: have ${g}, need ${w.n}`, item: w.id, bank: kindBank });
    }
  }

  // ── Food and a prayer restore, for content that always wants them ──
  if (inp.content.basics) {
    const has = (re: RegExp) => inp.inventory.find((it) => re.test(name(it.id).trim()));
    const banked = (re: RegExp) => [...new Set(inp.bank.map((it) => it.id).filter((id) => re.test(name(id).trim())))];
    const food = has(HEALS);
    const pots = has(RESTORES);
    rows.push(food ? { group: 'supplies', ok: true, line: 'Food packed', item: food.id } : { group: 'supplies', ok: false, bank: banked(HEALS), line: 'No food packed', detail: `${inp.content.short} wants food or brews along` });
    rows.push(pots ? { group: 'supplies', ok: true, line: 'Prayer restores packed', item: pots.id } : { group: 'supplies', ok: false, bank: banked(RESTORES), line: 'No prayer restore packed', detail: `${inp.content.short} wants prayer pots or restores along` });
  }

  // ── Prayers ──
  const prays = (s ? [s.prayer ?? []].flat() : []).map((p) => String(p).toLowerCase());
  for (const p of ['rigour', 'augury'] as const) {
    if (!prays.includes(p)) continue;
    const label = p === 'rigour' ? 'Rigour' : 'Augury';
    if (!state?.pray) unknown.push(label);
    else rows.push(state.pray.includes(p) ? { group: 'prayer', ok: true, line: `${label} unlocked` } : { group: 'prayer', ok: false, line: `${label} locked, the setup prays it`, detail: `Read ${p === 'rigour' ? 'a Dexterous' : 'an Arcane'} prayer scroll to unlock it` });
  }

  // ── The inventory's room ──
  const info: string[] = [...info0];
  if (packedNotWorn.length) info.push(`In your inventory: equip ${packedNotWorn.join(', ')} before the fight`);
  // Only with something packed: "0 slots · 28 free" says nothing.
  if (inp.inventory.length) {
    const sw = inp.inventory.filter((it) => inp.idx.item(knownAs(it.id, inp) ?? it.id)).length;
    const pouch = pouchIn ? 1 : 0;
    if (sw) info.push(`${sw} switch slot${sw === 1 ? '' : 's'} packed, ${Math.max(0, 28 - sw - pouch)} free for supplies`);
  }
  // The setup layout: EVERY piece of the setup, worn and packed ones too. A row's bank ids when the
  // bank holds it, else the item itself: a bank tag layout draws an item the bank lacks as a faded
  // placeholder, so the whole setup shows laid out, not just what is missing.
  const all = rows
    .filter((r) => r.item != null || r.bank?.length)
    .map((r) => {
      const b = r.bank?.length ? r.bank : h.inBank(r.item!);
      return { ...r, bank: b.length ? b : [r.item!] };
    });
  const bad = rows.filter((r) => !r.ok);
  return { rows, info, unknown, bank: [...new Set(bad.flatMap((r) => r.bank ?? []))], layouts: { missing: bankLayout(bad, name), setup: bankLayout(all, name) } };
}

/** Below this many, the quiver's ammo is a problem. */
const QUIVER_LOW = 50;
const QUIVER_RE = /dizana's quiver/i;

/**
 * The quiver's ammo when a quiver is worn or carried: {id, q}, null when it is empty, undefined when a
 * plugin that doesn't read it sent the state, 'no-quiver' with none along (the cape check says so).
 */
function quiverAmmo(inp: TripInput, h: Held, anywhere = false): { id: number; q: number } | null | undefined | 'no-quiver' {
  if (![...(anywhere ? h.owned : h.carried).keys()].some((id) => QUIVER_RE.test(inp.nameOf(id)) || inp.holds(id).some((x) => QUIVER_RE.test(inp.idx.item(x)?.n ?? '')))) return 'no-quiver';
  return inp.state?.quiver;
}

/** The overlay's answer: "ToA: 2 problems" with the first lines, or "✓ Ready for ToA". */
export function tripWarn(short: string, check: TripCheck, max = 4): { ok: boolean; title: string; lines: string[]; fight?: number[]; instance?: true } {
  const bad = check.rows.filter((r) => !r.ok);
  if (!bad.length) return { ok: true, title: `✓ Ready for ${short}`, lines: [] };
  const lines = bad.slice(0, max).map((r) => r.line);
  if (bad.length > max) lines[max - 1] = `+${bad.length - max + 1} more in the panel`;
  return { ok: false, title: `${short}: ${bad.length} problem${bad.length === 1 ? '' : 's'}`, lines };
}

/** The setup a player saves: what they wear and pack now, with their spellbook and pouch. */
export function setupFromHeld(nameLabel: string, worn: readonly InvItem[], inventory: readonly InvItem[], state: TripState | null, idx: GearIndex, holds: Equivalents, levels: Record<string, number> | null, isRunePouch: (id: number) => boolean): GearSetup {
  const gear: Record<string, number> = {};
  for (const it of worn) {
    const k = idx.item(it.id) ? it.id : holds(it.id).find((x) => idx.item(x));
    const s = k != null ? slotOf(idx.item(k)) : null;
    if (k != null && s && gear[s] == null) gear[s] = k;
  }
  const inv: (InvItem | null)[] = inventory.slice(0, 28).map((it) => (it ? (it.q && it.q > 1 ? { id: it.id, q: it.q } : { id: it.id }) : null));
  const pouchIn = inventory.some((it) => isRunePouch(it.id));
  const lv = (k: string) => (typeof levels?.[k] === 'number' ? levels[k] : 80);
  return {
    tier: 'advanced',
    name: nameLabel,
    gear,
    style: 0,
    stats: { attack: lv('attack'), strength: lv('strength'), ranged: lv('ranged'), magic: lv('magic') },
    inventory: inv,
    ...(pouchIn && state?.pouch?.length ? { runePouch: state.pouch.map((p) => ({ id: p.id, q: p.q })) } : {}),
    ...(state?.book != null ? { spellbook: state.book } : {}),
    // The quiver's ammo, when a quiver is worn or packed and holds some.
    ...(state?.quiver && [...worn, ...inventory].some((it) => [it.id, ...holds(it.id)].some((x) => QUIVER_RE.test(idx.item(x)?.n ?? ''))) ? { quiver: state.quiver.id } : {}),
  };
}
