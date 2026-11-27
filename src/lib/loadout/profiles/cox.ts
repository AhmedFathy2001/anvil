// Chambers of Xeric: the combat rooms and the Great Olm. Facts from the OSRS Wiki, our own wording:
//   https://oldschool.runescape.wiki/w/Chambers_of_Xeric/Strategies
//   https://oldschool.runescape.wiki/w/Great_Olm/Strategies
//
// - The rooms are drawn at random: each combat room is weighted as turning up in about half the
//   raids (our estimate). Puzzle rooms (Thieving, Ice Demon, Guardians' pickaxes) are left out.
// - Tekton is a melee room (a defence-drain spec first); Vasa and Vespula are ranged (Vespula flies
//   out of melee reach), as are the shamans and Muttadile; the Skeletal Mystics are meleed.
// - The Great Olm: its head is out of melee reach (ranged or magic), the left claw is the melee hand
//   and the right claw the mage hand (each weak to that style). A Twisted bow does most of the raid.
// - Potions (overloads, brews, revitalisations) and food are made inside: the inventory keeps room.
// - Challenge Mode swaps in the stronger versions (variant). Party size scales every room alike, so
//   solo and team raids share the split.

import type { BossProfile } from '../types';

const CM: Record<string, string> = {
  tekton: 'Tekton#Normal (Challenge Mode)',
  vasa: 'Vasa Nistirio#Challenge Mode',
  vespula: 'Vespula#Challenge Mode',
  shamans: 'Lizardman shaman (Chambers of Xeric)#Challenge Mode',
  muttadile: 'Muttadile#Large (Challenge Mode)',
  mystics: 'Skeletal Mystic#Challenge Mode',
  'olm-head': 'Great Olm#Head (Challenge Mode)',
  'olm-melee': 'Great Olm#Left claw (Challenge Mode)',
  'olm-mage': 'Great Olm#Right claw (Challenge Mode)',
};

export const COX: BossProfile = {
  key: 'cox',
  name: 'Chambers of Xeric',
  sources: ['https://oldschool.runescape.wiki/w/Chambers_of_Xeric/Strategies', 'https://oldschool.runescape.wiki/w/Great_Olm/Strategies'],
  variants: [
    { key: 'normal', label: 'Normal', monsters: {} },
    { key: 'cm', label: 'Challenge Mode', monsters: CM },
  ],
  phases: [
    // Tekton is meleed: the bow's numbers look fine on paper, but the room is played in melee (spec, then hits under the anvil).
    { key: 'tekton', name: 'Tekton', monster: 'Tekton#Normal', share: 0.5, allowed: ['melee'], required: ['melee'], prefer: ['melee'] },
    { key: 'vasa', name: 'Vasa Nistirio', monster: 'Vasa Nistirio#Normal', share: 0.5, allowed: ['melee', 'ranged', 'magic'], prefer: ['ranged'] },
    { key: 'vespula', name: 'Vespula', monster: 'Vespula#Normal', share: 0.5, allowed: ['ranged', 'magic'], immune: ['melee'], prefer: ['ranged'] },
    { key: 'shamans', name: 'Lizardman shamans', monster: 'Lizardman shaman (Chambers of Xeric)#Normal', share: 1.5, allowed: ['melee', 'ranged', 'magic'], prefer: ['ranged'] },
    { key: 'muttadile', name: 'Muttadile', monster: 'Muttadile#Large', share: 0.5, allowed: ['melee', 'ranged', 'magic'], prefer: ['ranged'] },
    { key: 'mystics', name: 'Skeletal Mystics', monster: 'Skeletal Mystic#Normal', share: 1.5, allowed: ['melee', 'ranged', 'magic'], prefer: ['melee'] },
    { key: 'olm-head', name: 'Great Olm (head)', monster: 'Great Olm#Head (Normal)', share: 1, allowed: ['ranged', 'magic'], immune: ['melee'], prefer: ['ranged'] },
    // Each hand is fought once per Olm phase (three in a small raid).
    { key: 'olm-melee', name: 'Great Olm (melee hand)', monster: 'Great Olm#Left claw (Normal)', share: 3, allowed: ['melee', 'ranged', 'magic'], required: ['melee'], prefer: ['melee'], entries: 3 },
    { key: 'olm-mage', name: 'Great Olm (mage hand)', monster: 'Great Olm#Right claw (Normal)', share: 3, allowed: ['melee', 'ranged', 'magic'], prefer: ['magic'], entries: 3 },
  ],
  worn: 'ranged',
  rules: [],
  spec: { prefer: ['^dragon warhammer', '^bandos godsword', '^elder maul'], why: 'spec: defence drain on Tekton and the Olm’s melee hand' },
  boosts: { melee: 'overload', ranged: 'overload_ranged', magic: 'overload_magic' },
  presets: {
    learner: {
      switchBudget: 4,
      specs: 1,
      kitPieces: { melee: 1, magic: 0, ranged: 0 },
      supplies: [
        { kind: 'restore', count: 2 },
        { kind: 'raid-supplies', count: 12, reserve: true },
        { kind: 'food', count: 6, fill: true },
      ],
    },
    experienced: {
      switchBudget: 9,
      specs: 1,
      lightbearer: true,
      kitPieces: { melee: 4, magic: 2, ranged: 3 },
      supplies: [
        { kind: 'restore', count: 1 },
        { kind: 'raid-supplies', count: 12, reserve: true },
        { kind: 'food', count: 3, fill: true },
      ],
    },
    max: {
      switchBudget: 12,
      specs: 2,
      lightbearer: true,
      kitPieces: { melee: 6, magic: 3, ranged: 4 },
      supplies: [
        { kind: 'raid-supplies', count: 12, reserve: true },
        { kind: 'food', count: 2, fill: true },
      ],
    },
  },
  notes: ['Puzzle rooms, Olm’s crystals and the Vanguards are not modelled; the room mix is an average.'],
};
