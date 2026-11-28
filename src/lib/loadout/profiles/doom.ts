// Doom of Mokhaiotl, the deep delves. Facts from the OSRS Wiki, our own wording:
//   https://oldschool.runescape.wiki/w/Doom_of_Mokhaiotl and /Strategies
//
// - Ranged at every tier: its Magic level (275) suits the Twisted bow; the Scorching bow in elite
//   void is the step down. Not a melee boss (the mechanics make melee unwise) and magic is not a
//   main-fight style. Defence drains are near worthless (a floor of 60, reset each delve).
// - Melee punish: only a melee hit interrupts its charged melee attack. A switch for that moment
//   only, never the main style: its value is the Strength bonus times the hitsplats (multi-hit
//   weapons stack it), not DPS.
// - From delve 3, at three quarters of its hitpoints it raises a shield that only demonbane hurts:
//   Emberlight, Arclight or Darklight, else the Scorching bow, else demonbane spells.
// - Larvae: demonbane magic one-shots them (a Purging staff, a skull sceptre or Slayer's staff with
//   a demonbane spell).
// - Spec: the Zaryte crossbow (a blowpipe or Crystal halberd on a budget); all at once on delves 1
//   to 4, held for the burrow from delve 5. Lightbearer.
// Delve 8 stands for the deep delves (every delve has the same stats but its hitpoints).

import type { BossProfile, PresetPlan } from '../types';

const plan = (switchBudget: number, specs: number, restores: number, brews: number): PresetPlan => ({
  switchBudget,
  specs,
  lightbearer: specs > 0,
  kitPieces: { melee: 0, magic: 0, ranged: 0 },
  supplies: [
    { kind: 'ranging', count: 1 },
    { kind: 'restore', count: restores },
    { kind: 'brew', count: brews },
    { kind: 'food', count: 28, fill: true },
  ],
});

export const DOOM: BossProfile = {
  key: 'doom',
  name: 'Doom of Mokhaiotl',
  sources: ['https://oldschool.runescape.wiki/w/Doom_of_Mokhaiotl', 'https://oldschool.runescape.wiki/w/Doom_of_Mokhaiotl/Strategies'],
  monsters: ['Doom of Mokhaiotl'],
  phases: [
    { key: 'main', name: 'Doom', monster: 'Doom of Mokhaiotl#Delve 8', share: 1, allowed: ['ranged', 'melee'], use: ['main'] },
    {
      key: 'shield',
      name: 'Doom’s shield',
      monster: 'Doom of Mokhaiotl#Delve 8',
      share: 0.75,
      allowed: ['melee', 'ranged', 'magic'],
      alwaysHits: true,
      use: ['demonbane', 'demonbane-bow', 'demonbane-magic'],
      gate: 'Doom’s shield (delve 3 on): only demonbane hurts it, and you carry none',
      tip: 'From delve 3 its shield takes only demonbane',
    },
  ],
  main: ['ranged'],
  jobs: [
    { key: 'main', label: 'Ranged', style: 'main', ref: 'Twisted bow' },
    { key: 'punish', label: 'Melee punish', style: 'melee', rank: 'punish', phases: ['main'], missing: 'No melee weapon: no punish on its charged melee attack' },
    { key: 'demonbane', label: 'Demonbane for the shield', style: 'melee', weapons: ['^emberlight', '^arclight', '^darklight', '^silverlight'], phases: ['shield'], optional: true },
    { key: 'demonbane-bow', label: 'Demonbane for the shield', style: 'ranged', weapons: ['^scorching bow'], phases: ['shield'], optional: true },
    { key: 'demonbane-magic', label: 'Demonbane for the shield', style: 'magic', weapons: ['^purging staff', "^slayer's staff", '^skull sceptre'], spells: ['Dark Demonbane', 'Superior Demonbane', 'Inferior Demonbane'], phases: ['shield'], optional: true },
    {
      key: 'larvae',
      label: 'Demonbane magic for the larvae',
      style: 'magic',
      rank: 'order',
      weapons: ['^purging staff', '^skull sceptre', "^slayer's staff"],
      spells: ['Dark Demonbane', 'Superior Demonbane', 'Inferior Demonbane'],
      missing: 'No demonbane staff: two bow hits per larva instead',
    },
  ],
  rules: [],
  specs: [
    {
      weapons: ['^zaryte crossbow', 'blowpipe$', '^crystal halberd'],
      ref: 'Zaryte crossbow',
      why: 'spec: all at once on delves 1 to 4, held for the burrow from delve 5',
      missing: 'No Zaryte crossbow: skip the spec, one more food',
      instead: { kind: 'food', count: 1 },
    },
  ],
  boosts: { ranged: 'ranging', melee: 'super_combat', magic: 'magic' },
  presets: { learner: plan(3, 1, 6, 4), experienced: plan(5, 1, 5, 3), max: plan(6, 1, 4, 2) },
  notes: ['The burrow phase, the acid and the beams are mechanics: only the damage and the shield are modelled.'],
};
