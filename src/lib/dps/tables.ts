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
const DEFENSIVE_AUTOCAST = s('Defensive autocast', 'magic', 'autocast');

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
  Staff: [s('Bash', 'crush', 'accurate'), s('Pound', 'crush', 'aggressive'), s('Focus', 'crush', 'defensive'), AUTOCAST, DEFENSIVE_AUTOCAST],
  'Bladed Staff': [s('Jab', 'stab', 'accurate'), s('Swipe', 'slash', 'aggressive'), s('Fend', 'crush', 'defensive'), AUTOCAST, DEFENSIVE_AUTOCAST],
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
  // With Charge active the god spells hit up to 30.
  std('Saradomin Strike (charged)', 30, null), std('Claws of Guthix (charged)', 30, null), std('Flames of Zamorak (charged)', 30, null),
  { name: 'Magic Dart', max: (m) => 10 + Math.floor(m / 10), element: null, book: 'standard' },
  anc('Smoke Rush', 13), anc('Shadow Rush', 14), anc('Blood Rush', 15), anc('Ice Rush', 16),
  anc('Smoke Burst', 17), anc('Shadow Burst', 18), anc('Blood Burst', 21), anc('Ice Burst', 22),
  anc('Smoke Blitz', 23), anc('Shadow Blitz', 24), anc('Blood Blitz', 25), anc('Ice Blitz', 26),
  anc('Smoke Barrage', 27), anc('Shadow Barrage', 28), anc('Blood Barrage', 29), anc('Ice Barrage', 30),
  // Arceuus demonbane spells: demons only (the engine zeroes them on anything else).
  { name: 'Inferior Demonbane', max: 16, element: null, book: 'arceuus' },
  { name: 'Superior Demonbane', max: 23, element: null, book: 'arceuus' },
  { name: 'Dark Demonbane', max: 30, element: null, book: 'arceuus' },
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
// Every combat prayer that changes damage or accuracy, as in game: `acc`/`str` multiply the
// (boosted) level. A prayer AFFECTS the stats it changes; two prayers affecting the same stat can't
// be on together (the game switches the older one off), which is how Clarity + Burst of Strength
// combine while Piety replaces both. Magic prayers boost accuracy only.

export type CombatKind = 'melee' | 'ranged' | 'magic';

export interface Prayer {
  key: string;
  label: string;
  style: CombatKind;
  acc: number;
  str: number;
  /** The wiki's icon file. */
  icon: string;
}

const pr = (key: string, label: string, style: CombatKind, acc: number, str: number): Prayer => ({
  key,
  label,
  style,
  acc,
  str,
  icon: `${label}.png`,
});

export const PRAYERS: Prayer[] = [
  pr('clarity', 'Clarity of Thought', 'melee', 1.05, 1),
  pr('improved_reflexes', 'Improved Reflexes', 'melee', 1.1, 1),
  pr('incredible_reflexes', 'Incredible Reflexes', 'melee', 1.15, 1),
  pr('burst', 'Burst of Strength', 'melee', 1, 1.05),
  pr('superhuman', 'Superhuman Strength', 'melee', 1, 1.1),
  pr('ultimate_strength', 'Ultimate Strength', 'melee', 1, 1.15),
  pr('chivalry', 'Chivalry', 'melee', 1.15, 1.18),
  pr('piety', 'Piety', 'melee', 1.2, 1.23),
  pr('sharp_eye', 'Sharp Eye', 'ranged', 1.05, 1.05),
  pr('hawk_eye', 'Hawk Eye', 'ranged', 1.1, 1.1),
  pr('eagle_eye', 'Eagle Eye', 'ranged', 1.15, 1.15),
  pr('rigour', 'Rigour', 'ranged', 1.2, 1.23),
  pr('mystic_will', 'Mystic Will', 'magic', 1.05, 1),
  pr('mystic_lore', 'Mystic Lore', 'magic', 1.1, 1),
  pr('mystic_might', 'Mystic Might', 'magic', 1.15, 1),
  pr('augury', 'Augury', 'magic', 1.25, 1),
];

/** Older saved setups used one key for "Ultimate Strength + Incredible Reflexes". */
const PRAYER_ALIASES: Record<string, string[]> = { melee15: ['incredible_reflexes', 'ultimate_strength'] };

/** A loadout's prayers, whatever shape they were saved in. */
export function prayerKeys(p: string | string[] | null | undefined): string[] {
  const list = Array.isArray(p) ? p : p ? [p] : [];
  return list.flatMap((k) => PRAYER_ALIASES[k] ?? [k]);
}

const affects = (p: Prayer) => [...(p.acc !== 1 ? ['acc'] : []), ...(p.str !== 1 ? ['str'] : [])];

/** Turn `key` on or off in a prayer set, switching off whatever it overlaps — as in game. */
export function togglePrayer(current: string[], key: string): string[] {
  if (current.includes(key)) return current.filter((k) => k !== key);
  const next = PRAYERS.find((p) => p.key === key);
  if (!next) return current;
  const hits = affects(next);
  return [
    ...current.filter((k) => {
      const p = PRAYERS.find((x) => x.key === k);
      return !p || p.style !== next.style || !affects(p).some((a) => hits.includes(a));
    }),
    key,
  ];
}

/** The combined multipliers of the active prayers for one combat style. */
export function prayerMultipliers(p: string | string[] | null | undefined, kind: CombatKind): { acc: number; str: number } {
  const on = PRAYERS.filter((x) => x.style === kind && prayerKeys(p).includes(x.key));
  return {
    acc: Math.max(1, ...on.map((x) => x.acc)),
    str: Math.max(1, ...on.map((x) => x.str)),
  };
}

// ── Boosts ───────────────────────────────────────────────────────────────────────────────────
// Per stat: a potion boosts the stats it boosts, by its own formula (Zamorak brew raises attack
// and strength by different amounts). Keyed by what a player actually drinks.

export type BoostStat = 'attack' | 'strength' | 'ranged' | 'magic';

export interface Boost {
  key: string;
  label: string;
  style: CombatKind;
  stats: Partial<Record<BoostStat, (lvl: number) => number>>;
}

const pct = (flat: number, frac: number) => (lvl: number) => lvl + flat + Math.floor(lvl * frac);
const melee = (key: string, label: string, att: (l: number) => number, str: (l: number) => number): Boost => ({ key, label, style: 'melee', stats: { attack: att, strength: str } });
const one = (key: string, label: string, style: CombatKind, stat: BoostStat, f: (l: number) => number): Boost => ({ key, label, style, stats: { [stat]: f } });

export const BOOSTS: Boost[] = [
  melee('super_combat', 'Super combat / divine super combat', pct(5, 0.15), pct(5, 0.15)),
  melee('super_att_str', 'Super attack + super strength', pct(5, 0.15), pct(5, 0.15)),
  one('super_strength', 'Super strength only', 'melee', 'strength', pct(5, 0.15)),
  melee('combat', 'Combat potion', pct(3, 0.1), pct(3, 0.1)),
  melee('att_str', 'Attack + strength potion', pct(3, 0.1), pct(3, 0.1)),
  melee('zamorak_brew', 'Zamorak brew', pct(2, 0.2), pct(2, 0.12)),
  melee('overload_nmz', 'Overload (Nightmare Zone)', pct(5, 0.15), pct(5, 0.15)),
  melee('overload', 'Overload (raids)', pct(6, 0.16), pct(6, 0.16)),
  melee('salts_melee', 'Smelling salts (ToA)', pct(11, 0.16), pct(11, 0.16)),
  one('ranging', 'Ranging / divine ranging potion', 'ranged', 'ranged', pct(4, 0.1)),
  one('bastion', 'Bastion potion', 'ranged', 'ranged', pct(4, 0.1)),
  one('super_ranging', 'Super ranging (NMZ)', 'ranged', 'ranged', pct(5, 0.15)),
  one('overload_ranged', 'Overload (raids)', 'ranged', 'ranged', pct(6, 0.16)),
  one('salts_ranged', 'Smelling salts (ToA)', 'ranged', 'ranged', pct(11, 0.16)),
  one('magic', 'Magic / divine magic potion', 'magic', 'magic', pct(4, 0)),
  one('battlemage', 'Battlemage potion', 'magic', 'magic', pct(4, 0)),
  one('imbued_heart', 'Imbued heart', 'magic', 'magic', pct(1, 0.1)),
  one('saturated_heart', 'Saturated heart', 'magic', 'magic', pct(4, 0.1)),
  one('forgotten_brew', 'Forgotten brew', 'magic', 'magic', pct(3, 0.08)),
  one('ancient_brew', 'Ancient brew', 'magic', 'magic', pct(2, 0.05)),
  one('super_magic', 'Super magic (NMZ)', 'magic', 'magic', pct(5, 0.15)),
  one('overload_magic', 'Overload (raids)', 'magic', 'magic', pct(6, 0.16)),
  one('salts_magic', 'Smelling salts (ToA)', 'magic', 'magic', pct(11, 0.16)),
];

/** A level after the loadout's boost, for one stat. */
export function boostedLevel(level: number, boostKey: string | null | undefined, stat: BoostStat): number {
  const f = BOOSTS.find((b) => b.key === boostKey)?.stats[stat];
  return f ? f(level) : level;
}

export const SLOTS = ['head', 'cape', 'neck', 'ammo', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring'] as const;
export type Slot = (typeof SLOTS)[number];
