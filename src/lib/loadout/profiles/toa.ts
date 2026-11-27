// Tombs of Amascut: each path's boss and the Wardens. Facts from the OSRS Wiki, our own wording:
//   https://oldschool.runescape.wiki/w/Tombs_of_Amascut/Strategies
//
// - Ba-Ba and Kephri are melee bosses (Kephri is weakest to stab); Zebak is ranged or magic (his
//   melee hits through prayer); Akkha only protects from the style he is using, so two good styles.
// - Wardens P1: the obelisk. P2: Tumeken's Warden prays melee and magic, Elidinis' prays melee and
//   ranged, so both other styles are needed, and the exposed core takes melee (every hit a max hit).
//   P3: no prayers.
// - Ba-Ba and Kephri are fought in melee for their mechanics (boulders, Kephri's swarms): `prefer`.
// - Tumeken's shadow is far stronger inside the raid (the DPS engine applies ×4).
// - Supplies come from the raid's own chests: the inventory keeps room for them.
// - Raid level: every 5 levels add 2% to the bosses' hitpoints and defence (lib/tripCheck raidScaled).

import type { BossProfile } from '../types';

/** The raid levels offered (copied from lib/tripRaidLevel, which reads the database). */
export const TOA_RAID_LEVELS = [0, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600] as const;

export const TOA: BossProfile = {
  key: 'toa',
  name: 'Tombs of Amascut',
  sources: ['https://oldschool.runescape.wiki/w/Tombs_of_Amascut/Strategies'],
  modes: [{ key: 'raidLevel', label: 'Raid level', default: 300, values: TOA_RAID_LEVELS }],
  phases: [
    { key: 'baba', name: 'Ba-Ba', monster: 'Ba-Ba', share: 1, allowed: ['melee', 'ranged', 'magic'], prefer: ['melee'] },
    { key: 'kephri', name: 'Kephri', monster: 'Kephri#Shielded', share: 1, allowed: ['melee', 'ranged', 'magic'], tags: ['kalphite'], prefer: ['melee'] },
    { key: 'zebak', name: 'Zebak', monster: 'Zebak#Normal', share: 1, allowed: ['ranged', 'magic'] },
    { key: 'akkha', name: 'Akkha', monster: 'Akkha', share: 1, allowed: ['melee', 'ranged', 'magic'], minStyles: 2, entries: 4 },
    { key: 'p1', name: 'Wardens P1 (obelisk)', monster: 'Obelisk (Tombs of Amascut)', asName: 'Obelisk', share: 1, allowed: ['melee', 'ranged', 'magic'] },
    // Three rounds of damage before each core; split between the two wardens' prayers.
    { key: 'p2-tumeken', name: "Wardens P2 (Tumeken's)", monster: "Tumeken's Warden#Active", share: 1.5, allowed: ['ranged'], immune: ['melee', 'magic'], required: ['ranged'], entries: 3 },
    { key: 'p2-elidinis', name: "Wardens P2 (Elidinis')", monster: "Elidinis' Warden#Active", share: 1.5, allowed: ['magic'], immune: ['melee', 'ranged'], required: ['magic'], entries: 3 },
    // The core: small, and every landed hit is a max hit, so the fastest hard hitter wins.
    { key: 'p2-core', name: 'Wardens P2 (core)', monster: "Tumeken's Warden#Active", share: 0.5, allowed: ['melee'], required: ['melee'], alwaysMaxHit: true, size: 1, entries: 3 },
    { key: 'p3', name: 'Wardens P3', monster: "Tumeken's Warden#Damaged", share: 1, allowed: ['melee', 'ranged', 'magic'] },
  ],
  rules: [],
  spec: { prefer: ['^zaryte crossbow', '^elder maul', '^dragon warhammer', '^bandos godsword'], why: 'spec: Zaryte crossbow on the obelisk, else a defence drain' },
  boosts: { melee: 'salts_melee', ranged: 'salts_ranged', magic: 'salts_magic' },
  presets: {
    learner: {
      switchBudget: 4,
      specs: 1,
      supplies: [
        { kind: 'antipoison', count: 1 },
        { kind: 'restore', count: 2 },
        { kind: 'raid-supplies', count: 10, reserve: true },
        { kind: 'food', count: 6, fill: true },
      ],
    },
    experienced: {
      switchBudget: 11,
      specs: 1,
      lightbearer: true,
      supplies: [
        { kind: 'restore', count: 1 },
        { kind: 'raid-supplies', count: 10, reserve: true },
        { kind: 'food', count: 4, fill: true },
      ],
    },
    max: {
      switchBudget: 16,
      specs: 2,
      lightbearer: true,
      supplies: [
        { kind: 'raid-supplies', count: 10, reserve: true },
        { kind: 'food', count: 2, fill: true },
      ],
    },
  },
  notes: ['Path puzzles, Akkha’s shadows and Kephri’s swarms are not modelled; only the bosses are.'],
};
