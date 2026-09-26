// Static combat tables: weapon categories → attack styles, spells, prayers, boosts.
//
// PURE and import-free, like the rest of lib/dps, so the calculator runs identically in the browser
// (the reader's own gear) and on the server (a guide's tiers summarised for Discord).
//
// Written from the game's published mechanics (the OSRS Wiki's combat pages), not from any existing
// calculator's code.

export type AttackType = 'stab' | 'slash' | 'crush' | 'ranged' | 'magic';
export type Stance = 'accurate' | 'aggressive' | 'controlled' | 'defensive' | 'rapid' | 'longrange' | 'autocast';

export interface AttackStyle {
  name: string;
  type: AttackType;
  stance: Stance;
}

const s = (name: string, type: AttackType, stance: Stance): AttackStyle => ({ name, type, stance });

const RANGED_STYLES = [s('Accurate', 'ranged', 'accurate'), s('Rapid', 'ranged', 'rapid'), s('Longrange', 'ranged', 'longrange')];
const POWERED_STYLES = [s('Accurate', 'magic', 'accurate'), s('Longrange', 'magic', 'longrange')];
const AUTOCAST = s('Autocast', 'magic', 'autocast');

/** Weapon category (the wiki's combat_style) → the styles its interface offers. */
export const WEAPON_STYLES: Record<string, AttackStyle[]> = {
  '2h Sword': [s('Chop', 'slash', 'accurate'), s('Slash', 'slash', 'aggressive'), s('Smash', 'crush', 'aggressive'), s('Block', 'slash', 'defensive')],
  Axe: [s('Chop', 'slash', 'accurate'), s('Hack', 'slash', 'aggressive'), s('Smash', 'crush', 'aggressive'), s('Block', 'slash', 'defensive')],
  Banner: [s('Lunge', 'stab', 'accurate'), s('Swipe', 'slash', 'aggressive'), s('Pound', 'crush', 'controlled'), s('Block', 'stab', 'defensive')],
  Blunt: [s('Pound', 'crush', 'accurate'), s('Pummel', 'crush', 'aggressive'), s('Block', 'crush', 'defensive')],
  Bludgeon: [s('Pound', 'crush', 'aggressive'), s('Pummel', 'crush', 'aggressive'), s('Smash', 'crush', 'aggressive')],
  Bulwark: [s('Pummel', 'crush', 'accurate'), s('Block', 'crush', 'defensive')],
  Claw: [s('Chop', 'slash', 'accurate'), s('Slash', 'slash', 'aggressive'), s('Lunge', 'stab', 'controlled'), s('Block', 'slash', 'defensive')],
  Flail: [s('Pound', 'crush', 'accurate'), s('Pummel', 'crush', 'aggressive'), s('Block', 'crush', 'defensive')],
  Partisan: [s('Stab', 'stab', 'accurate'), s('Lunge', 'stab', 'aggressive'), s('Pound', 'crush', 'aggressive'), s('Block', 'stab', 'defensive')],
  Pickaxe: [s('Spike', 'stab', 'accurate'), s('Impale', 'stab', 'aggressive'), s('Smash', 'crush', 'aggressive'), s('Block', 'stab', 'defensive')],
  Polearm: [s('Jab', 'stab', 'controlled'), s('Swipe', 'slash', 'aggressive'), s('Fend', 'stab', 'defensive')],
  Polestaff: [s('Bash', 'crush', 'accurate'), s('Pound', 'crush', 'aggressive'), s('Block', 'crush', 'defensive')],
  Scythe: [s('Reap', 'slash', 'accurate'), s('Chop', 'slash', 'aggressive'), s('Jab', 'crush', 'aggressive'), s('Block', 'slash', 'defensive')],
  'Slash Sword': [s('Chop', 'slash', 'accurate'), s('Slash', 'slash', 'aggressive'), s('Lunge', 'stab', 'controlled'), s('Block', 'slash', 'defensive')],
  Spear: [s('Lunge', 'stab', 'controlled'), s('Swipe', 'slash', 'controlled'), s('Pound', 'crush', 'controlled'), s('Block', 'stab', 'defensive')],
  Spiked: [s('Pound', 'crush', 'accurate'), s('Pummel', 'crush', 'aggressive'), s('Spike', 'stab', 'controlled'), s('Block', 'crush', 'defensive')],
  'Stab Sword': [s('Stab', 'stab', 'accurate'), s('Lunge', 'stab', 'aggressive'), s('Slash', 'slash', 'aggressive'), s('Block', 'stab', 'defensive')],
  'Multi-Melee': [s('Stab', 'stab', 'accurate'), s('Lunge', 'stab', 'aggressive'), s('Slash', 'slash', 'aggressive'), s('Block', 'stab', 'defensive')],
  Unarmed: [s('Punch', 'crush', 'accurate'), s('Kick', 'crush', 'aggressive'), s('Block', 'crush', 'defensive')],
  Whip: [s('Flick', 'slash', 'accurate'), s('Lash', 'slash', 'controlled'), s('Deflect', 'slash', 'defensive')],
  Staff: [s('Bash', 'crush', 'accurate'), s('Pound', 'crush', 'aggressive'), s('Focus', 'crush', 'defensive'), AUTOCAST],
  'Bladed Staff': [s('Jab', 'stab', 'accurate'), s('Swipe', 'slash', 'aggressive'), s('Fend', 'crush', 'defensive'), AUTOCAST],
  Salamander: [s('Scorch', 'slash', 'aggressive'), s('Flare', 'ranged', 'accurate'), s('Blaze', 'magic', 'accurate')],
  Bow: RANGED_STYLES,
  Crossbow: RANGED_STYLES,
  Thrown: RANGED_STYLES,
  Chinchompas: [s('Short fuse', 'ranged', 'accurate'), s('Medium fuse', 'ranged', 'rapid'), s('Long fuse', 'ranged', 'longrange')],
  'Powered Staff': POWERED_STYLES,
  'Powered Wand': POWERED_STYLES,
};

export function stylesFor(category: string | undefined | null): AttackStyle[] {
  return WEAPON_STYLES[category ?? 'Unarmed'] ?? WEAPON_STYLES.Unarmed;
}

export type Element = 'air' | 'water' | 'earth' | 'fire' | null;

export interface Spell {
  name: string;
  /** Base max hit. For spells whose max scales with Magic, a function of the Magic level. */
  max: number | ((magic: number) => number);
  element: Element;
  book: 'standard' | 'ancient' | 'arceuus';
}

const std = (name: string, max: number, element: Element): Spell => ({ name, max, element, book: 'standard' });
const anc = (name: string, max: number): Spell => ({ name, max, element: null, book: 'ancient' });

export const SPELLS: Spell[] = [
  std('Wind Strike', 2, 'air'), std('Water Strike', 4, 'water'), std('Earth Strike', 6, 'earth'), std('Fire Strike', 8, 'fire'),
  std('Wind Bolt', 9, 'air'), std('Water Bolt', 10, 'water'), std('Earth Bolt', 11, 'earth'), std('Fire Bolt', 12, 'fire'),
  std('Wind Blast', 13, 'air'), std('Water Blast', 14, 'water'), std('Earth Blast', 15, 'earth'), std('Fire Blast', 16, 'fire'),
  std('Wind Wave', 17, 'air'), std('Water Wave', 18, 'water'), std('Earth Wave', 19, 'earth'), std('Fire Wave', 20, 'fire'),
  std('Wind Surge', 21, 'air'), std('Water Surge', 22, 'water'), std('Earth Surge', 23, 'earth'), std('Fire Surge', 24, 'fire'),
  std('Crumble Undead', 15, null),
  std('Iban Blast', 25, null),
  std('Saradomin Strike', 20, null), std('Claws of Guthix', 20, null), std('Flames of Zamorak', 20, null),
  { name: 'Magic Dart', max: (m) => 10 + Math.floor(m / 10), element: null, book: 'standard' },
  anc('Smoke Rush', 13), anc('Shadow Rush', 14), anc('Blood Rush', 15), anc('Ice Rush', 16),
  anc('Smoke Burst', 17), anc('Shadow Burst', 18), anc('Blood Burst', 21), anc('Ice Burst', 22),
  anc('Smoke Blitz', 23), anc('Shadow Blitz', 24), anc('Blood Blitz', 25), anc('Ice Blitz', 26),
  anc('Smoke Barrage', 27), anc('Shadow Barrage', 28), anc('Blood Barrage', 29), anc('Ice Barrage', 30),
];

export function spellByName(name: string | undefined | null): Spell | null {
  return SPELLS.find((sp) => sp.name.toLowerCase() === (name ?? '').toLowerCase()) ?? null;
}

/** Powered staves carry their own spell; its max hit scales with the Magic level. */
export const POWERED_MAX: { match: RegExp; max: (magic: number) => number }[] = [
  { match: /^tumeken's shadow/i, max: (m) => Math.floor(m / 3) + 1 },
  { match: /sanguinesti staff/i, max: (m) => Math.floor(m / 3) - 1 },
  { match: /trident of the swamp/i, max: (m) => Math.floor(m / 3) - 2 },
  { match: /trident of the seas/i, max: (m) => Math.floor(m / 3) - 5 },
  { match: /^accursed sceptre/i, max: (m) => Math.floor(m / 3) - 6 },
  { match: /^thammaron's sceptre/i, max: (m) => Math.floor(m / 3) - 8 },
  { match: /^warped sceptre/i, max: (m) => Math.floor((8 * m + 96) / 37) },
  { match: /^starter staff/i, max: () => 8 },
];

// ── Prayers ──────────────────────────────────────────────────────────────────────────────────
// Multipliers on the (boosted) level: [accuracy, strength/damage]. Magic prayers boost accuracy.

export interface Prayer {
  key: string;
  label: string;
  style: 'melee' | 'ranged' | 'magic';
  acc: number;
  str: number;
}

export const PRAYERS: Prayer[] = [
  { key: 'piety', label: 'Piety', style: 'melee', acc: 1.2, str: 1.23 },
  { key: 'chivalry', label: 'Chivalry', style: 'melee', acc: 1.15, str: 1.18 },
  { key: 'melee15', label: 'Ultimate Strength + Incredible Reflexes', style: 'melee', acc: 1.15, str: 1.15 },
  { key: 'rigour', label: 'Rigour', style: 'ranged', acc: 1.2, str: 1.23 },
  { key: 'eagle_eye', label: 'Eagle Eye', style: 'ranged', acc: 1.15, str: 1.15 },
  { key: 'augury', label: 'Augury', style: 'magic', acc: 1.25, str: 1 },
  { key: 'mystic_might', label: 'Mystic Might', style: 'magic', acc: 1.15, str: 1 },
];

// ── Boosts ───────────────────────────────────────────────────────────────────────────────────
// level → boosted level. Keyed by what a player actually drinks.

export interface Boost {
  key: string;
  label: string;
  style: 'melee' | 'ranged' | 'magic';
  boost: (lvl: number) => number;
}

const pct = (flat: number, frac: number) => (lvl: number) => lvl + flat + Math.floor(lvl * frac);

export const BOOSTS: Boost[] = [
  { key: 'super_combat', label: 'Super combat potion', style: 'melee', boost: pct(5, 0.15) },
  { key: 'combat', label: 'Combat potion', style: 'melee', boost: pct(3, 0.1) },
  { key: 'overload', label: 'Overload (raids)', style: 'melee', boost: pct(6, 0.16) },
  { key: 'salts_melee', label: 'Smelling salts (ToA)', style: 'melee', boost: pct(11, 0.16) },
  { key: 'ranging', label: 'Ranging potion', style: 'ranged', boost: pct(4, 0.1) },
  { key: 'overload_ranged', label: 'Overload (raids)', style: 'ranged', boost: pct(6, 0.16) },
  { key: 'salts_ranged', label: 'Smelling salts (ToA)', style: 'ranged', boost: pct(11, 0.16) },
  { key: 'magic', label: 'Magic potion', style: 'magic', boost: pct(4, 0) },
  { key: 'imbued_heart', label: 'Imbued heart', style: 'magic', boost: pct(1, 0.1) },
  { key: 'saturated_heart', label: 'Saturated heart', style: 'magic', boost: pct(4, 0.1) },
  { key: 'overload_magic', label: 'Overload (raids)', style: 'magic', boost: pct(6, 0.16) },
  { key: 'salts_magic', label: 'Smelling salts (ToA)', style: 'magic', boost: pct(11, 0.16) },
];

export const SLOTS = ['head', 'cape', 'neck', 'ammo', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring'] as const;
export type Slot = (typeof SLOTS)[number];
