// Chambers of Xeric: the combat rooms and the Great Olm. Facts from the OSRS Wiki, our own wording:
//   https://oldschool.runescape.wiki/w/Chambers_of_Xeric/Strategies
//   https://oldschool.runescape.wiki/w/Chambers_of_Xeric:_Challenge_Mode
//   https://oldschool.runescape.wiki/w/Great_Olm/Strategies (and each monster's page)
//
// The reference: ranged worn (a Twisted bow does most of the raid), with switches by job:
// - melee for Tekton (immune to ranged, a fifth of magic), the Olm's melee hand and the ranged
//   Vanguard. Weakest to crush: the stance is worked out from the gear (Scythe on crush with
//   Inquisitor's, slash otherwise). Specs: the hammer or maul first (its first hit always lands),
//   then the godsword (drains even on a miss); never the godsword first.
// - stab for Vasa's glowing crystals (immune to ranged, a third of magic, slash and crush resisted).
// - magic for the Olm's mage hand (a third from melee and ranged), Vespula (the wiki ranks magic
//   first there: the Shadow, or a staff with fire spells for her fire weakness), the melee Vanguard.
// - the Shadow on the Skeletal Mystics when owned (solo and duo), else the bow; a Salve (ei) on them
//   either way (undead). They are never meleed: they hit hard in melee and react to prayer.
// - a pickaxe for the Guardians: nothing else hurts them.
// - a demonbane weapon for the Ice Demon (it takes a third from everything but fire spells and
//   demonbane): the Emberlight or Arclight, else fire spells, else the bow after the specs.
// - the Olm's head: ranged (a third from melee and magic, and out of melee reach).
// Potions (overloads, brews, revitalisations) and food are made inside: the inventory keeps room.
// Room weights are our estimate of an average raid; the Olm's hands are fought three times.

import type { BossProfile } from '../types';

const CM: Record<string, string> = {
  tekton: 'Tekton#Normal (Challenge Mode)',
  vasa: 'Vasa Nistirio#Challenge Mode',
  crystals: 'Glowing crystal#Challenge Mode',
  vespula: 'Vespula#Challenge Mode',
  shamans: 'Lizardman shaman (Chambers of Xeric)#Challenge Mode',
  muttadile: 'Muttadile#Large (Challenge Mode)',
  mystics: 'Skeletal Mystic#Challenge Mode',
  guardians: 'Guardian (Chambers of Xeric)#Challenge Mode',
  'ice-demon': 'Ice demon#Challenge Mode',
  'vanguard-melee': 'Vanguard#Melee (Challenge Mode)',
  'vanguard-ranged': 'Vanguard#Ranged (Challenge Mode)',
  'vanguard-magic': 'Vanguard#Magic (Challenge Mode)',
  'olm-head': 'Great Olm#Head (Challenge Mode)',
  'olm-melee': 'Great Olm#Left claw (Challenge Mode)',
  'olm-mage': 'Great Olm#Right claw (Challenge Mode)',
};

export const COX: BossProfile = {
  key: 'cox',
  name: 'Chambers of Xeric',
  sources: [
    'https://oldschool.runescape.wiki/w/Chambers_of_Xeric/Strategies',
    'https://oldschool.runescape.wiki/w/Chambers_of_Xeric:_Challenge_Mode',
    'https://oldschool.runescape.wiki/w/Great_Olm/Strategies',
  ],
  variants: [
    { key: 'normal', label: 'Normal', monsters: {} },
    { key: 'cm', label: 'Challenge Mode', monsters: CM },
  ],
  phases: [
    { key: 'tekton', name: 'Tekton', monster: 'Tekton#Normal', share: 0.5, allowed: ['melee'], immune: ['ranged'], required: ['melee'], use: ['melee'] },
    { key: 'vasa', name: 'Vasa Nistirio', monster: 'Vasa Nistirio#Normal', share: 0.5, allowed: ['ranged', 'melee'], use: ['main'] },
    { key: 'crystals', name: "Vasa's crystals", monster: 'Glowing crystal#Normal', share: 2, allowed: ['melee', 'magic'], immune: ['ranged'], taken: { magic: 0.34 }, use: ['stab', 'melee'], entries: 2 },
    { key: 'vespula', name: 'Vespula', monster: 'Vespula#Normal', share: 0.5, allowed: ['ranged', 'magic'], immune: ['melee'], use: ['magic', 'main'] },
    { key: 'shamans', name: 'Lizardman shamans', monster: 'Lizardman shaman (Chambers of Xeric)#Normal', share: 1.5, allowed: ['ranged', 'magic', 'melee'], use: ['main'] },
    { key: 'muttadile', name: 'Muttadile', monster: 'Muttadile#Large', share: 0.5, allowed: ['ranged', 'magic', 'melee'], use: ['main'] },
    { key: 'mystics', name: 'Skeletal Mystics', monster: 'Skeletal Mystic#Normal', share: 1.5, allowed: ['ranged', 'magic'], use: ['shadow', 'main'] },
    { key: 'guardians', name: 'Guardians', monster: 'Guardian (Chambers of Xeric)#Normal', share: 1, allowed: ['melee'], immune: ['ranged', 'magic'], use: ['pickaxe'] },
    { key: 'ice-demon', name: 'Ice Demon', monster: 'Ice demon#Normal', share: 0.5, allowed: ['melee', 'magic', 'ranged'], taken: { ranged: 0.33 }, use: ['demonbane', 'magic', 'main'] },
    { key: 'vanguard-melee', name: 'Vanguards (melee)', monster: 'Vanguard#Melee', share: 0.5, allowed: ['magic', 'ranged', 'melee'], use: ['magic'] },
    { key: 'vanguard-ranged', name: 'Vanguards (ranged)', monster: 'Vanguard#Ranged', share: 0.5, allowed: ['melee', 'ranged', 'magic'], use: ['melee'] },
    { key: 'vanguard-magic', name: 'Vanguards (magic)', monster: 'Vanguard#Magic', share: 0.5, allowed: ['ranged', 'magic', 'melee'], use: ['main'] },
    { key: 'olm-head', name: 'Great Olm (head)', monster: 'Great Olm#Head (Normal)', share: 1, allowed: ['ranged', 'magic'], immune: ['melee'], taken: { magic: 0.34 }, use: ['main'] },
    { key: 'olm-melee', name: 'Great Olm (melee hand)', monster: 'Great Olm#Left claw (Normal)', share: 3, allowed: ['melee', 'ranged', 'magic'], required: ['melee'], taken: { ranged: 0.34, magic: 0.34 }, use: ['melee'], entries: 3 },
    { key: 'olm-mage', name: 'Great Olm (mage hand)', monster: 'Great Olm#Right claw (Normal)', share: 3, allowed: ['magic', 'melee', 'ranged'], taken: { melee: 0.34, ranged: 0.34 }, use: ['magic'], entries: 3 },
  ],
  main: ['ranged'],
  jobs: [
    { key: 'main', label: 'Ranged', style: 'main', ref: 'Twisted bow' },
    { key: 'melee', label: 'Melee', style: 'melee', phases: ['tekton', 'olm-melee', 'vanguard-ranged'], ref: 'Scythe of vitur', required: true, missing: 'No melee weapon: Tekton and the Olm’s melee hand need one' },
    { key: 'stab', label: 'Stab for the crystals', style: 'melee', types: ['stab'], phases: ['crystals'], ref: "Osmumten's fang", pieces: { learner: 0, experienced: 0, max: 0 }, missing: 'No stab weapon: break Vasa’s crystals with your melee weapon' },
    { key: 'magic', label: 'Magic', style: 'magic', phases: ['olm-mage', 'vespula', 'vanguard-melee'], ref: "Tumeken's shadow", missing: 'No magic weapon: the Olm’s mage hand takes a third from anything else' },
    { key: 'shadow', label: 'Shadow on the Mystics', style: 'magic', weapons: ["^tumeken's shadow"], phases: ['mystics'], ref: "Tumeken's shadow", optional: true, pieces: { learner: 0, experienced: 0, max: 0 } },
    { key: 'salve', label: 'Salve on the Mystics', style: 'main', piece: { slot: 'neck', items: ['^salve amulet ?\\(ei\\)', '^salve amulet ?\\(i\\)'] }, phases: ['mystics'], optional: true },
    {
      key: 'pickaxe',
      label: 'Pickaxe for the Guardians',
      style: 'melee',
      rank: 'order',
      weapons: ['^crystal pickaxe', '^(dragon|infernal) pickaxe', '^3rd age pickaxe', '^rune pickaxe', '^adamant pickaxe', '^mithril pickaxe'],
      pieces: { learner: 0, experienced: 0, max: 0 },
      required: true,
      missing: 'Guardians: bring a pickaxe, nothing else hurts them',
    },
    { key: 'demonbane', label: 'Demonbane for the Ice Demon', style: 'melee', weapons: ['^emberlight', '^arclight', '^darklight', '^silverlight'], phases: ['ice-demon'], presets: ['experienced', 'max'], optional: true, pieces: { learner: 0, experienced: 0, max: 0 } },
  ],
  rules: [],
  specs: [
    { weapons: ['^dragon warhammer', '^elder maul'], why: 'spec first on Tekton: its first hit always lands, and drains', missing: 'No Dragon warhammer or Elder maul: Tekton without a first drain' },
    { weapons: ['^bandos godsword'], why: 'spec after the hammer: drains even when it misses', missing: 'No Bandos godsword: the hammer or maul drains alone' },
  ],
  boosts: { melee: 'overload', ranged: 'overload_ranged', magic: 'overload_magic' },
  presets: {
    learner: {
      switchBudget: 6,
      specs: 1,
      kitPieces: { melee: 1, magic: 0, ranged: 0 },
      supplies: [
        { kind: 'restore', count: 2 },
        { kind: 'raid-supplies', count: 12, reserve: true },
        { kind: 'food', count: 6, fill: true },
      ],
    },
    experienced: {
      switchBudget: 11,
      specs: 1,
      lightbearer: true,
      kitPieces: { melee: 4, magic: 2, ranged: 0 },
      supplies: [
        { kind: 'restore', count: 1 },
        { kind: 'raid-supplies', count: 12, reserve: true },
        { kind: 'food', count: 3, fill: true },
      ],
    },
    max: {
      switchBudget: 14,
      specs: 2,
      lightbearer: true,
      kitPieces: { melee: 5, magic: 3, ranged: 0 },
      supplies: [
        { kind: 'raid-supplies', count: 12, reserve: true },
        { kind: 'food', count: 2, fill: true },
      ],
    },
  },
  notes: ['Puzzle rooms (Thieving, crabs, the tightrope) and the Olm’s crystals are not modelled; the room mix is an average.'],
};
