// Theatre of Blood: the six rooms' bosses. Facts from the OSRS Wiki, our own wording:
//   https://oldschool.runescape.wiki/w/Theatre_of_Blood/Strategies
//   https://oldschool.runescape.wiki/w/Theatre_of_Blood
//
// - The Maiden, Bloat, Sotetseg and Verzik's last phase are melee rooms in practice (a Scythe hits
//   the big bosses three times); the worn setup is melee.
// - The Nylocas only take damage from the style their colour shows (grey melee, green ranged, blue
//   magic), the waves and the Vasilias alike, so every player carries all three styles.
// - Xarpus sits out of melee reach: ranged (a Twisted bow, often in Void) or magic.
// - Verzik P1 is fought with the Dawnbringer handed out in the room: no gear of ours. P2 and P3 are
//   fought with what is carried.
// - The magic switch is a weapon (Sanguinesti staff, Tumeken's shadow) and a piece or two, not a
//   robe set: the plans cap it. Food and potions are brought in; the rooms give none.
// - Entry Mode and Hard Mode swap in the rooms' other versions (variants).
//
// The amounts of damage per room are rough team-wide ratios (our estimate): only the split between
// rooms matters, every room scales with the team alike.

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
    { key: 'maiden', name: 'The Maiden', monster: 'The Maiden of Sugadinti#Normal', share: 1, allowed: ['melee', 'ranged', 'magic'], prefer: ['melee'] },
    { key: 'bloat', name: 'Bloat', monster: 'Pestilent Bloat#Normal', share: 1, allowed: ['melee', 'ranged', 'magic'], prefer: ['melee'] },
    // The waves: about a hundred big nylocas a team, a third of each colour (our estimate).
    { key: 'nylo-melee', name: 'Nylocas (grey)', monster: 'Nylocas Ischyros#Big', share: 30, allowed: ['melee'], immune: ['ranged', 'magic'], required: ['melee'], entries: 10 },
    { key: 'nylo-ranged', name: 'Nylocas (green)', monster: 'Nylocas Toxobolos#Big', share: 30, allowed: ['ranged'], immune: ['melee', 'magic'], required: ['ranged'], entries: 10 },
    { key: 'nylo-magic', name: 'Nylocas (blue)', monster: 'Nylocas Hagios#Big', share: 30, allowed: ['magic'], immune: ['melee', 'ranged'], required: ['magic'], entries: 10 },
    // The Vasilias changes colour through the fight: a third of its health in each style.
    { key: 'vasilias-melee', name: 'Nylocas Vasilias (grey)', monster: 'Nylocas Vasilias#Normal', share: 1 / 3, allowed: ['melee'], immune: ['ranged', 'magic'], required: ['melee'], entries: 2 },
    { key: 'vasilias-ranged', name: 'Nylocas Vasilias (green)', monster: 'Nylocas Vasilias#Normal', share: 1 / 3, allowed: ['ranged'], immune: ['melee', 'magic'], required: ['ranged'], entries: 2 },
    { key: 'vasilias-magic', name: 'Nylocas Vasilias (blue)', monster: 'Nylocas Vasilias#Normal', share: 1 / 3, allowed: ['magic'], immune: ['melee', 'ranged'], required: ['magic'], entries: 2 },
    { key: 'sotetseg', name: 'Sotetseg', monster: 'Sotetseg#Normal', share: 1, allowed: ['melee', 'ranged', 'magic'] },
    { key: 'xarpus', name: 'Xarpus', monster: 'Xarpus@1', share: 1, allowed: ['ranged', 'magic'], immune: ['melee'], prefer: ['ranged'] },
    { key: 'verzik-p2', name: 'Verzik P2', monster: 'Verzik Vitur#Phase 2@1', share: 1, allowed: ['melee', 'ranged', 'magic'], entries: 2 },
    { key: 'verzik-p3', name: 'Verzik P3', monster: 'Verzik Vitur#Phase 3@1', share: 1, allowed: ['melee', 'ranged', 'magic'], entries: 2 },
  ],
  worn: 'melee',
  rules: [],
  spec: { prefer: ['^dragon warhammer', '^elder maul', '^bandos godsword', '^zaryte crossbow'], why: 'spec: defence drain on the Maiden and Xarpus' },
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
    'Verzik P1 is fought with the Dawnbringer from the room: not modelled.',
    'Ice Barrage on the Maiden’s and Nylocas’ crowds is not modelled; each nylocas is hit on its own.',
  ],
};
