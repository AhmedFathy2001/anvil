// Theatre of Blood: each room's boss and the Nylocas waves. Facts from the OSRS Wiki, our own wording:
//   https://oldschool.runescape.wiki/w/Theatre_of_Blood/Strategies
//   https://oldschool.runescape.wiki/w/Theatre_of_Blood:_Hard_Mode (and each monster's page)
//
// The reference: melee worn (the Scythe rooms), with switches by job:
// - ranged for the green nylocas and Nylocas Vasilias in green (immune to the rest), and the
//   stand-in on the Maiden, Sotetseg, Xarpus and Verzik P2 when the melee kit is weak (the wiki's
//   learner picks there are ranged).
// - magic for the blue nylocas and Vasilias in blue (immune to the rest). The Maiden's mages freeze
//   her crabs with Ice Barrage: crowd control, not damage, said as a tip.
// - Bloat is meleed (slash) during his sleeps: undead, so a Salve (e) or (ei) goes on for him.
// - Xarpus has no melee defence: the wiki now ranks the Scythe first there (ranged in elite void
//   behind it). Verzik P3 is meleed (its gear table is melee only).
// - Specs: the hammer or maul drains first (the Maiden and Xarpus), then the godsword.
// Verzik P1 is fought with the Dawnbringer handed out in the room: not modelled.

import type { BossProfile } from '../types';

export const TOB: BossProfile = {
  key: 'tob',
  name: 'Theatre of Blood',
  sources: ['https://oldschool.runescape.wiki/w/Theatre_of_Blood/Strategies'],
  variants: [
    { key: 'normal', label: 'Normal', monsters: {} },
    {
      key: 'entry',
      label: 'Entry Mode',
      monsters: {
        maiden: 'The Maiden of Sugadinti#Entry Mode',
        bloat: 'Pestilent Bloat#Entry',
        'nylo-melee': 'Nylocas Ischyros#Big (Entry Mode)',
        'nylo-ranged': 'Nylocas Toxobolos#Big (Entry Mode)',
        'nylo-magic': 'Nylocas Hagios#Big (Entry Mode)',
        'vasilias-melee': 'Nylocas Vasilias#Entry',
        'vasilias-ranged': 'Nylocas Vasilias#Entry',
        'vasilias-magic': 'Nylocas Vasilias#Entry',
        sotetseg: 'Sotetseg#Entry',
        xarpus: 'Xarpus@0',
        'verzik-p2': 'Verzik Vitur#Phase 2@0',
        'verzik-p3': 'Verzik Vitur#Phase 3@0',
      },
    },
    {
      key: 'hard',
      label: 'Hard Mode',
      monsters: {
        maiden: 'The Maiden of Sugadinti#Hard Mode',
        bloat: 'Pestilent Bloat#Hard',
        'vasilias-melee': 'Nylocas Vasilias#Hard',
        'vasilias-ranged': 'Nylocas Vasilias#Hard',
        'vasilias-magic': 'Nylocas Vasilias#Hard',
        sotetseg: 'Sotetseg#Hard',
        xarpus: 'Xarpus@2',
        'verzik-p2': 'Verzik Vitur#Phase 2@2',
        'verzik-p3': 'Verzik Vitur#Phase 3@2',
      },
    },
  ],
  phases: [
    { key: 'maiden', name: 'The Maiden', monster: 'The Maiden of Sugadinti#Normal', share: 1, allowed: ['melee', 'ranged'], use: ['main', 'ranged'], tip: 'The Maiden: the mages freeze her crabs with Ice Barrage' },
    { key: 'bloat', name: 'Bloat', monster: 'Pestilent Bloat#Normal', share: 1, allowed: ['melee', 'ranged', 'magic'], use: ['main'] },
    // Each wave's nylocas: only their own colour's style hurts them.
    { key: 'nylo-melee', name: 'Nylocas (grey)', monster: 'Nylocas Ischyros#Big', share: 30, allowed: ['melee'], immune: ['ranged', 'magic'], required: ['melee'], entries: 10, use: ['main'] },
    { key: 'nylo-ranged', name: 'Nylocas (green)', monster: 'Nylocas Toxobolos#Big', share: 30, allowed: ['ranged'], immune: ['melee', 'magic'], required: ['ranged'], entries: 10, use: ['ranged'] },
    { key: 'nylo-magic', name: 'Nylocas (blue)', monster: 'Nylocas Hagios#Big', share: 30, allowed: ['magic'], immune: ['melee', 'ranged'], required: ['magic'], entries: 10, use: ['magic'] },
    // Nylocas Vasilias changes colour: a third of its hitpoints in each, two entries each.
    { key: 'vasilias-melee', name: 'Nylocas Vasilias (grey)', monster: 'Nylocas Vasilias#Normal', share: 1 / 3, allowed: ['melee'], immune: ['ranged', 'magic'], required: ['melee'], entries: 2, use: ['main'] },
    { key: 'vasilias-ranged', name: 'Nylocas Vasilias (green)', monster: 'Nylocas Vasilias#Normal', share: 1 / 3, allowed: ['ranged'], immune: ['melee', 'magic'], required: ['ranged'], entries: 2, use: ['ranged'] },
    { key: 'vasilias-magic', name: 'Nylocas Vasilias (blue)', monster: 'Nylocas Vasilias#Normal', share: 1 / 3, allowed: ['magic'], immune: ['melee', 'ranged'], required: ['magic'], entries: 2, use: ['magic'] },
    { key: 'sotetseg', name: 'Sotetseg', monster: 'Sotetseg#Normal', share: 1, allowed: ['melee', 'ranged', 'magic'], use: ['main', 'ranged'] },
    { key: 'xarpus', name: 'Xarpus', monster: 'Xarpus@1', share: 1, allowed: ['melee', 'ranged', 'magic'], use: ['main', 'ranged'] },
    { key: 'verzik-p2', name: 'Verzik P2', monster: 'Verzik Vitur#Phase 2@1', share: 1, allowed: ['melee', 'ranged', 'magic'], entries: 2, use: ['main', 'ranged'] },
    { key: 'verzik-p3', name: 'Verzik P3', monster: 'Verzik Vitur#Phase 3@1', share: 1, allowed: ['melee', 'ranged', 'magic'], entries: 2, use: ['main'] },
  ],
  main: ['melee'],
  jobs: [
    { key: 'main', label: 'Melee', style: 'main', ref: 'Scythe of vitur' },
    { key: 'ranged', label: 'Ranged', style: 'ranged', phases: ['nylo-ranged', 'vasilias-ranged', 'xarpus', 'maiden', 'sotetseg', 'verzik-p2'], ref: 'Twisted bow', required: true, missing: 'No ranged weapon: the green nylocas take nothing else' },
    { key: 'magic', label: 'Magic', style: 'magic', phases: ['nylo-magic', 'vasilias-magic'], required: true, missing: 'No magic weapon: the blue nylocas take nothing else' },
    { key: 'salve', label: 'Salve for Bloat', style: 'main', piece: { slot: 'neck', items: ['^salve amulet ?\\(ei\\)', '^salve amulet ?\\(e\\)'] }, phases: ['bloat'], optional: true },
  ],
  rules: [],
  specs: [
    { weapons: ['^elder maul', '^dragon warhammer'], why: 'spec first on the Maiden and Xarpus: a defence drain', missing: 'No Elder maul or Dragon warhammer: no hammer drain on the Maiden and Xarpus' },
    { weapons: ['^bandos godsword'], why: 'spec after the hammer: drains even when it misses', missing: 'No Bandos godsword: the hammer drains alone' },
  ],
  boosts: { melee: 'super_combat', ranged: 'ranging', magic: 'magic' },
  presets: {
    learner: {
      switchBudget: 6,
      specs: 1,
      // A magic weapon in full melee armour barely lands a hit: one robe piece goes with it.
      kitPieces: { ranged: 1, magic: 1, melee: 0 },
      supplies: [
        { kind: 'combat', count: 1 },
        { kind: 'ranging', count: 1 },
        { kind: 'brew', count: 6 },
        { kind: 'restore', count: 6 },
        { kind: 'food', count: 8, fill: true },
      ],
    },
    experienced: {
      switchBudget: 8,
      specs: 1,
      kitPieces: { ranged: 4, magic: 1, melee: 2 },
      supplies: [
        { kind: 'combat', count: 1 },
        { kind: 'ranging', count: 1 },
        { kind: 'brew', count: 5 },
        { kind: 'restore', count: 5 },
        { kind: 'food', count: 6, fill: true },
      ],
    },
    max: {
      switchBudget: 11,
      specs: 2,
      kitPieces: { ranged: 5, magic: 2, melee: 2 },
      supplies: [
        { kind: 'combat', count: 1 },
        { kind: 'ranging', count: 1 },
        { kind: 'brew', count: 4 },
        { kind: 'restore', count: 4 },
        { kind: 'food', count: 4, fill: true },
      ],
    },
  },
  notes: [
    'Xarpus is no longer melee-immune: he has no melee defence, so the Scythe leads there.',
    'Verzik P1 is fought with the Dawnbringer from the room: not modelled.',
    'Xarpus is no longer melee-immune: he has no melee defence, so the Scythe leads there.',
    'Ice Barrage on the Maiden’s and Nylocas’ crowds is not modelled; each nylocas is hit on its own.',
  ],
};
