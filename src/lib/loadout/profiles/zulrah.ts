// Zulrah. Facts from the OSRS Wiki, our own wording:
//   https://oldschool.runescape.wiki/w/Zulrah/Strategies
//
// - Three forms. Serpentine (green) and Magma (red) are weakest to magic; Tanzanite (blue) is
//   weakest to ranged and badly resists magic.
// - It sits in its pool: melee can't reach it (halberds aside, and poison clouds block those
//   too; we leave melee out).
// - A hit does at most 50.
// - Anti-venom is needed unless a Serpentine helm is worn.
// - A rotation is about three minutes; the time split between forms is our estimate.

import type { BossProfile } from '../types';

export const ZULRAH: BossProfile = {
  key: 'zulrah',
  name: 'Zulrah',
  sources: ['https://oldschool.runescape.wiki/w/Zulrah/Strategies'],
  phases: [
    // Magic on the green and red forms, ranged on the blue (its magic defence is +300).
    { key: 'serpentine', name: 'Serpentine (green)', monster: 'Zulrah#Serpentine', share: 0.4, allowed: ['magic', 'ranged'], immune: ['melee'], maxHitCap: 50, entries: 2, use: ['magic', 'ranged'] },
    { key: 'magma', name: 'Magma (red)', monster: 'Zulrah#Magma', share: 0.3, allowed: ['magic', 'ranged'], immune: ['melee'], maxHitCap: 50, entries: 2, use: ['magic', 'ranged'] },
    { key: 'tanzanite', name: 'Tanzanite (blue)', monster: 'Zulrah#Tanzanite', share: 0.3, allowed: ['magic', 'ranged'], immune: ['melee'], maxHitCap: 50, entries: 2, use: ['ranged', 'magic'] },
  ],
  // Magic worn with a ranged switch is the reference; a Twisted bow (or Bow of Faerdhinen) covers
  // every form, so ranged worn wins when it is clearly faster.
  main: ['magic', 'ranged'],
  jobs: [
    { key: 'main', label: 'Main', style: 'main' },
    { key: 'magic', label: 'Magic for green and red', style: 'magic', phases: ['serpentine', 'magma'] },
    { key: 'ranged', label: 'Ranged for blue', style: 'ranged', phases: ['tanzanite'], required: true, missing: 'No ranged weapon: the blue form shrugs off magic' },
  ],
  rules: [{ kind: 'antivenom', coveredBy: ['^serpentine helm', '^tanzanite helm', '^magma helm'] }],
  boosts: { ranged: 'ranging', magic: 'magic' },
  // Rough, with the right prayers (our estimate).
  incomingPerKill: 70,
  presets: {
    learner: {
      switchBudget: 3,
      specs: 0,
      kitPieces: { ranged: 1, magic: 1 },
      supplies: [
        { kind: 'antivenom', count: 2 },
        { kind: 'restore', count: 3 },
        { kind: 'ranging', count: 1 },
        { kind: 'magic-boost', count: 1 },
        { kind: 'teleport-zulrah', count: 1 },
        { kind: 'karambwan', count: 4 },
        { kind: 'food', count: 20, fill: true },
      ],
    },
    experienced: {
      switchBudget: 6,
      specs: 0,
      kitPieces: { ranged: 4, magic: 4 },
      supplies: [
        { kind: 'antivenom', count: 1 },
        { kind: 'restore', count: 2 },
        { kind: 'ranging', count: 1 },
        { kind: 'magic-boost', count: 1 },
        { kind: 'teleport-zulrah', count: 1 },
        { kind: 'karambwan', count: 4 },
        { kind: 'food', count: 20, fill: true },
      ],
    },
    max: {
      switchBudget: 8,
      specs: 0,
      kitPieces: { ranged: 6, magic: 6 },
      supplies: [
        { kind: 'antivenom', count: 1 },
        { kind: 'restore', count: 2 },
        { kind: 'ranging', count: 1 },
        { kind: 'magic-boost', count: 1 },
        { kind: 'teleport-zulrah', count: 1 },
        { kind: 'karambwan', count: 4 },
        { kind: 'food', count: 20, fill: true },
      ],
    },
  },
  notes: ['A Noxious halberd can reach it from the pool edge: not modelled, melee is left out.'],
};
