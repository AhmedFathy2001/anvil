// Bosses with one main style and a short reference: Araxxor, Yama, the Desert Treasure II bosses
// (Vardorvis aside: the gear data has no row for it) and Nex. Facts from the OSRS Wiki (each boss's
// page and its /Strategies), our own wording. Picked on the trip card by hand (a "m:<monster>" trip):
// `monsters` names them.

import type { BossProfile, PresetPlan, SupplyLine } from '../types';

const plan = (switchBudget: number, specs: number, supplies: SupplyLine[], kitPieces: PresetPlan['kitPieces'] = {}): PresetPlan => ({ switchBudget, specs, lightbearer: specs > 0, kitPieces, supplies });
const food: SupplyLine = { kind: 'food', count: 28, fill: true };

// Araxxor: crush melee (its crush defence is +15). Specs: only one defence reduction counts per kill
// (the maul or hammer), then damage specs.
export const ARAXXOR: BossProfile = {
  key: 'araxxor',
  name: 'Araxxor',
  sources: ['https://oldschool.runescape.wiki/w/Araxxor', 'https://oldschool.runescape.wiki/w/Araxxor/Strategies'],
  monsters: ['Araxxor'],
  phases: [
    { key: 'main', name: 'Araxxor', monster: 'Araxxor#In combat', share: 0.75, allowed: ['melee', 'ranged', 'magic'], use: ['main'] },
    { key: 'enrage', name: 'Araxxor (enraged)', monster: 'Araxxor#Enraged', share: 0.25, allowed: ['melee', 'ranged', 'magic'], use: ['main'] },
  ],
  main: ['melee', 'ranged'],
  jobs: [{ key: 'main', label: 'Main', style: 'main' }],
  rules: [],
  specs: [
    { weapons: ['^elder maul', '^dragon warhammer', '^bandos godsword'], why: 'spec: one defence drain a kill counts', missing: 'No drain spec: one more food', instead: { kind: 'food', count: 1 } },
    { weapons: ['^(burning|dragon) claws', '^voidwaker'], why: 'spec: damage after the drain' },
  ],
  boosts: { melee: 'super_combat', ranged: 'ranging' },
  presets: {
    learner: plan(1, 1, [{ kind: 'combat', count: 1 }, { kind: 'restore', count: 5 }, { kind: 'brew', count: 2 }, food]),
    experienced: plan(2, 1, [{ kind: 'combat', count: 1 }, { kind: 'restore', count: 4 }, { kind: 'brew', count: 2 }, food]),
    max: plan(3, 2, [{ kind: 'combat', count: 1 }, { kind: 'restore', count: 4 }, { kind: 'brew', count: 1 }, food]),
  },
  notes: ['The araxytes (mirrorback recoil, acidic pools) are not modelled.'],
};

// Yama: slash melee with demonbane (it is a demon, 120% vulnerable: Emberlight's bonus grows), or
// magic (the Shadow, a Purging staff). The Judge is fought with magic. Specs drain to the cap.
export const YAMA: BossProfile = {
  key: 'yama',
  name: 'Yama',
  sources: ['https://oldschool.runescape.wiki/w/Yama', 'https://oldschool.runescape.wiki/w/Yama/Strategies'],
  monsters: ['Yama'],
  phases: [
    { key: 'main', name: 'Yama', monster: 'Yama#Normal', share: 0.66, allowed: ['melee', 'magic'], use: ['main'] },
    { key: 'judge', name: 'Judge of Yama', monster: 'Judge of Yama', share: 1, allowed: ['magic', 'melee'], alwaysMaxHit: true, use: ['magic', 'main'] },
    { key: 'p3', name: 'Yama P3', monster: 'Yama#Phase 3', share: 0.34, allowed: ['melee', 'magic'], use: ['main'] },
  ],
  main: ['melee', 'magic'],
  jobs: [
    { key: 'main', label: 'Main', style: 'main', ref: 'Emberlight' },
    { key: 'magic', label: 'Magic for the Judge', style: 'magic', phases: ['judge'], optional: true },
  ],
  rules: [],
  specs: [{ weapons: ['^elder maul', '^dragon warhammer', '^emberlight', '^arclight'], why: 'spec: defence drains toward the cap', missing: 'No drain spec: one more food', instead: { kind: 'food', count: 1 } }],
  boosts: { melee: 'super_combat', magic: 'magic' },
  presets: {
    learner: plan(2, 1, [{ kind: 'combat', count: 1 }, { kind: 'restore', count: 6 }, { kind: 'brew', count: 4 }, food], { magic: 0 }),
    experienced: plan(3, 1, [{ kind: 'combat', count: 1 }, { kind: 'restore', count: 5 }, { kind: 'brew', count: 3 }, food], { magic: 1 }),
    max: plan(5, 1, [{ kind: 'combat', count: 1 }, { kind: 'restore', count: 5 }, { kind: 'brew', count: 2 }, food], { magic: 2 }),
  },
  notes: ['Void flares and the shadow phases are mechanics: not modelled.'],
};

// Duke Sucellus: slash melee only (ranged and magic +320/+440, stab and crush poor). A demon at 70%
// vulnerability. Specs dumped at the enrage.
export const DUKE: BossProfile = {
  key: 'duke',
  name: 'Duke Sucellus',
  sources: ['https://oldschool.runescape.wiki/w/Duke_Sucellus', 'https://oldschool.runescape.wiki/w/Duke_Sucellus/Strategies'],
  monsters: ['Duke Sucellus'],
  phases: [{ key: 'main', name: 'Duke Sucellus', monster: 'Duke Sucellus#Awake@0', share: 1, allowed: ['melee'], use: ['main'] }],
  main: ['melee'],
  jobs: [{ key: 'main', label: 'Melee', style: 'main', ref: 'Scythe of vitur' }],
  rules: [],
  specs: [{ weapons: ['^(burning|dragon) claws', '^voidwaker', '^bandos godsword'], why: 'spec: dumped at the enrage, a quarter of its hitpoints left' }],
  boosts: { melee: 'super_combat' },
  presets: {
    learner: plan(1, 1, [{ kind: 'combat', count: 1 }, { kind: 'restore', count: 4 }, { kind: 'brew', count: 2 }, food]),
    experienced: plan(1, 1, [{ kind: 'combat', count: 1 }, { kind: 'restore', count: 4 }, { kind: 'brew', count: 1 }, food]),
    max: plan(1, 1, [{ kind: 'combat', count: 1 }, { kind: 'restore', count: 3 }, { kind: 'brew', count: 1 }, food]),
  },
};

// The Leviathan: ranged (its ranged defence is +50). The Zaryte crossbow's ruby spec is the best
// spec, early while its hitpoints are high.
export const LEVIATHAN: BossProfile = {
  key: 'leviathan',
  name: 'The Leviathan',
  sources: ['https://oldschool.runescape.wiki/w/The_Leviathan', 'https://oldschool.runescape.wiki/w/The_Leviathan/Strategies'],
  monsters: ['The Leviathan'],
  phases: [{ key: 'main', name: 'The Leviathan', monster: 'The Leviathan#Post-quest', share: 1, allowed: ['ranged'], use: ['main'] }],
  main: ['ranged'],
  jobs: [{ key: 'main', label: 'Ranged', style: 'main', ref: 'Twisted bow' }],
  rules: [],
  specs: [{ weapons: ['^zaryte crossbow'], why: 'spec: ruby bolts while its hitpoints are high' }],
  boosts: { ranged: 'ranging' },
  presets: {
    learner: plan(1, 0, [{ kind: 'ranging', count: 1 }, { kind: 'restore', count: 5 }, { kind: 'brew', count: 2 }, food]),
    experienced: plan(1, 1, [{ kind: 'ranging', count: 1 }, { kind: 'restore', count: 4 }, { kind: 'brew', count: 2 }, food]),
    max: plan(1, 1, [{ kind: 'ranging', count: 1 }, { kind: 'restore', count: 4 }, { kind: 'brew', count: 1 }, food]),
  },
};

// The Whisperer: magic only (magic defence +10, 60% earth weakness: a Tome of earth with earth spells).
export const WHISPERER: BossProfile = {
  key: 'whisperer',
  name: 'The Whisperer',
  sources: ['https://oldschool.runescape.wiki/w/The_Whisperer', 'https://oldschool.runescape.wiki/w/The_Whisperer/Strategies'],
  monsters: ['The Whisperer'],
  phases: [{ key: 'main', name: 'The Whisperer', monster: 'The Whisperer#Post-quest', share: 1, allowed: ['magic'], use: ['main'] }],
  main: ['magic'],
  jobs: [{ key: 'main', label: 'Magic', style: 'main', ref: "Tumeken's shadow" }],
  rules: [],
  boosts: { magic: 'magic' },
  presets: {
    learner: plan(0, 0, [{ kind: 'magic-boost', count: 1 }, { kind: 'restore', count: 6 }, { kind: 'brew', count: 2 }, food]),
    experienced: plan(0, 0, [{ kind: 'magic-boost', count: 1 }, { kind: 'restore', count: 5 }, { kind: 'brew', count: 2 }, food]),
    max: plan(0, 0, [{ kind: 'magic-boost', count: 1 }, { kind: 'restore', count: 5 }, { kind: 'brew', count: 1 }, food]),
  },
  notes: ['The shadow realm souls are a mechanic: not modelled.'],
};

// Nex: ranged is the default in a team (magic +300).
export const NEX: BossProfile = {
  key: 'nex',
  name: 'Nex',
  sources: ['https://oldschool.runescape.wiki/w/Nex', 'https://oldschool.runescape.wiki/w/Nex/Strategies'],
  monsters: ['Nex'],
  phases: [{ key: 'main', name: 'Nex', monster: 'Nex', share: 1, allowed: ['ranged', 'melee'], use: ['main'] }],
  main: ['ranged'],
  jobs: [{ key: 'main', label: 'Ranged', style: 'main', ref: 'Twisted bow' }],
  rules: [],
  specs: [{ weapons: ['^zaryte crossbow'], why: 'spec: big bolt hits' }],
  boosts: { ranged: 'ranging' },
  presets: {
    learner: plan(1, 0, [{ kind: 'ranging', count: 1 }, { kind: 'restore', count: 7 }, { kind: 'brew', count: 6 }, food]),
    experienced: plan(1, 1, [{ kind: 'ranging', count: 1 }, { kind: 'restore', count: 6 }, { kind: 'brew', count: 5 }, food]),
    max: plan(1, 1, [{ kind: 'ranging', count: 1 }, { kind: 'restore', count: 6 }, { kind: 'brew', count: 4 }, food]),
  },
  notes: ['Her phases (smoke, shadow, blood, ice, Zaros) and their mechanics are not modelled.'],
};
