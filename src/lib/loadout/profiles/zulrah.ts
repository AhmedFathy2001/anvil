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
    { key: 'serpentine', name: 'Serpentine (green)', monster: 'Zulrah#Serpentine', share: 0.4, allowed: ['magic', 'ranged'], immune: ['melee'], maxHitCap: 50, entries: 2 },
    { key: 'magma', name: 'Magma (red)', monster: 'Zulrah#Magma', share: 0.3, allowed: ['magic', 'ranged'], immune: ['melee'], maxHitCap: 50, entries: 2 },
    { key: 'tanzanite', name: 'Tanzanite (blue)', monster: 'Zulrah#Tanzanite', share: 0.3, allowed: ['magic', 'ranged'], immune: ['melee'], maxHitCap: 50, entries: 2 },
  ],
  rules: [{ kind: 'antivenom', coveredBy: ['^serpentine helm', '^tanzanite helm', '^magma helm'] }],
  boosts: { ranged: 'ranging', magic: 'magic' },
  // Rough, with the right prayers (our estimate).
  incomingPerKill: 70,
  presets: {
    learner: {
      switchBudget: 3,
      specs: 0,
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
