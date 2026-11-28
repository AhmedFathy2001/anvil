// Tombs of Amascut: each path's boss and the Wardens. Facts from the OSRS Wiki, our own wording:
//   https://oldschool.runescape.wiki/w/Tombs_of_Amascut/Strategies (and each boss's page)
//
// The reference: magic worn (Tumeken's shadow is far stronger inside the raid: the DPS engine applies
// ×4), with switches by job:
// - ranged: Zebak (the Twisted bow leads, magic only with the Shadow; his melee hits hardest and
//   bleeds), Tumeken's Warden in P2 (it prays melee and magic) and the obelisk's stand-in.
// - melee: Ba-Ba and Kephri (stab is their lowest; meleeing Ba-Ba stops her boulders early, Kephri
//   resists ranged and magic), the core in P2 (every hit is a max hit) and Wardens P3 (weaker to
//   melee and ranged; its energy siphons are melee-only).
// - Akkha: magic (his magic defence is +10), and a second style since he prays against the one he
//   uses. The obelisk: magic or ranged (it resists melee).
// - Specs: a drain on the obelisk (maul or hammer before the godsword), the damage specs saved for P3.
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
    { key: 'baba', name: 'Ba-Ba', monster: 'Ba-Ba', share: 1, allowed: ['melee', 'ranged', 'magic'], use: ['melee'] },
    { key: 'kephri', name: 'Kephri', monster: 'Kephri#Shielded', share: 1, allowed: ['melee', 'ranged', 'magic'], tags: ['kalphite'], use: ['melee'] },
    { key: 'zebak', name: 'Zebak', monster: 'Zebak#Normal', share: 1, allowed: ['ranged', 'magic'], use: ['ranged', 'main'] },
    { key: 'akkha', name: 'Akkha', monster: 'Akkha', share: 1, allowed: ['melee', 'ranged', 'magic'], minStyles: 2, entries: 4, use: ['main', 'ranged', 'melee'] },
    { key: 'p1', name: 'Wardens P1 (obelisk)', monster: 'Obelisk (Tombs of Amascut)', asName: 'Obelisk', share: 1, allowed: ['ranged', 'magic'], use: ['main', 'ranged'] },
    { key: 'p2-tumeken', name: "Wardens P2 (Tumeken's)", monster: "Tumeken's Warden#Active", share: 1.5, allowed: ['ranged'], immune: ['melee', 'magic'], required: ['ranged'], entries: 3, use: ['ranged'] },
    { key: 'p2-elidinis', name: "Wardens P2 (Elidinis')", monster: "Elidinis' Warden#Active", share: 1.5, allowed: ['magic'], immune: ['melee', 'ranged'], required: ['magic'], entries: 3, use: ['main'] },
    { key: 'p2-core', name: 'Wardens P2 (core)', monster: "Tumeken's Warden#Active", share: 0.5, allowed: ['melee'], required: ['melee'], alwaysMaxHit: true, size: 1, entries: 3, use: ['melee'] },
    { key: 'p3', name: 'Wardens P3', monster: "Tumeken's Warden#Damaged", share: 1, allowed: ['melee', 'ranged', 'magic'], use: ['melee', 'ranged', 'main'] },
  ],
  main: ['magic'],
  jobs: [
    { key: 'main', label: 'Magic', style: 'main', ref: "Tumeken's shadow" },
    { key: 'ranged', label: 'Ranged', style: 'ranged', phases: ['p2-tumeken', 'zebak'], ref: 'Twisted bow', required: true, missing: "No ranged weapon: Tumeken's Warden in P2 takes nothing else" },
    { key: 'melee', label: 'Melee', style: 'melee', phases: ['p2-core', 'kephri', 'baba', 'p3'], ref: "Osmumten's fang", required: true, missing: 'No melee weapon: the Wardens’ core takes nothing else' },
  ],
  rules: [],
  specs: [
    { weapons: ['^elder maul', '^dragon warhammer', '^bandos godsword'], why: 'spec: a drain on the obelisk, the rest saved for P3', missing: 'No Elder maul, Dragon warhammer or Bandos godsword: no drain on the obelisk' },
    { weapons: ['^zaryte crossbow', '^(burning|dragon) claws', '^voidwaker'], why: 'spec: big hits, saved for Wardens P3', missing: 'No damage spec for Wardens P3' },
  ],
  boosts: { melee: 'salts_melee', ranged: 'salts_ranged', magic: 'salts_magic' },
  presets: {
    learner: {
      switchBudget: 4,
      specs: 1,
      kitPieces: { ranged: 0, melee: 0, magic: 0 },
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
      kitPieces: { ranged: 4, melee: 4, magic: 0 },
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
      kitPieces: { ranged: 5, melee: 6, magic: 0 },
      supplies: [
        { kind: 'raid-supplies', count: 10, reserve: true },
        { kind: 'food', count: 2, fill: true },
      ],
    },
  },
  notes: ['Path puzzles, Akkha’s shadows, Kephri’s swarms and the P3 energy siphons are not modelled; only the bosses are.'],
};
