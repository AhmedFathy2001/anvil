// Vorkath (post-quest). Facts from the OSRS Wiki, our own wording:
//   https://oldschool.runescape.wiki/w/Vorkath/Strategies
//   https://oldschool.runescape.wiki/w/Vorkath
//
// - Ranged with a dragon-bane crossbow and a dragonfire shield is the usual way; melee with a
//   Dragon hunter lance also works. Magic is poor (high magic defence).
// - The zombified spawn has to die to Crumble Undead (standard spellbook), autocast from a staff;
//   Vorkath takes no damage until it does.
// - Dragonfire: a super antifire always; a dragonfire shield on top cuts it further.
// - Venom: anti-venom, unless a Serpentine helm is worn.
// - Acid phase: walk, don't attack (downtime, no damage dealt).

import type { BossProfile } from '../types';

export const VORKATH: BossProfile = {
  key: 'vorkath',
  name: 'Vorkath',
  sources: ['https://oldschool.runescape.wiki/w/Vorkath/Strategies'],
  phases: [
    { key: 'main', name: 'Vorkath', monster: 'Vorkath#Post-quest', share: 1, allowed: ['ranged', 'melee', 'magic'], tags: ['dragon', 'undead'], downtime: 30, use: ['main'] },
    {
      key: 'spawn',
      name: 'Zombified spawn',
      monster: 'Zombified Spawn#Post-quest',
      share: 1,
      allowed: ['magic'],
      required: ['magic'],
      cast: 'Crumble Undead',
      entries: 1,
      use: ['crumble'],
    },
  ],
  // Ranged is the reference (Dragon hunter crossbow, Salve (ei), dragonfire off-hand); the Dragon
  // hunter lance is the melee one, worn only when clearly faster with what is owned.
  main: ['ranged', 'melee'],
  jobs: [
    { key: 'main', label: 'Main', style: 'main' },
    { key: 'crumble', label: 'Crumble Undead for the spawn', style: 'magic', cast: 'Crumble Undead', phases: ['spawn'], required: true, missing: 'No staff that autocasts Crumble Undead: the spawn dies to nothing else' },
  ],
  rules: [
    { kind: 'antifire', level: 'super', shield: 'recommended' },
    { kind: 'antivenom', coveredBy: ['^serpentine helm', '^tanzanite helm', '^magma helm'] },
    { kind: 'spell', spell: 'Crumble Undead', book: 'standard', magic: 39 },
  ],
  specs: [{ weapons: ['^zaryte crossbow', '^bandos godsword', '^dragon warhammer', '^elder maul'], why: 'spec: Zaryte crossbow big hits, else a defence drain', missing: 'No spec weapon: one more food' , instead: { kind: 'food', count: 1 } }],
  boosts: { ranged: 'ranging', melee: 'super_combat', magic: 'magic' },
  // Rough: a clean kill with the right prayers still loses about 120 HP to chip and acid (our estimate).
  incomingPerKill: 120,
  presets: {
    learner: {
      switchBudget: 1,
      specs: 0,
      supplies: [
        { kind: 'antifire-super', count: 2 },
        { kind: 'antivenom', count: 1 },
        { kind: 'restore', count: 4 },
        { kind: 'ranging', count: 1 },
        { kind: 'food', count: 20, fill: true },
      ],
    },
    experienced: {
      switchBudget: 2,
      specs: 1,
      supplies: [
        { kind: 'antifire-super', count: 1 },
        { kind: 'antivenom', count: 1 },
        { kind: 'restore', count: 3 },
        { kind: 'ranging', count: 1 },
        { kind: 'food', count: 20, fill: true },
      ],
    },
    max: {
      switchBudget: 3,
      specs: 1,
      supplies: [
        { kind: 'antifire-super', count: 1 },
        { kind: 'antivenom', count: 1 },
        { kind: 'restore', count: 2 },
        { kind: 'ranging', count: 1 },
        { kind: 'food', count: 20, fill: true },
      ],
    },
  },
  notes: ['Switch from ruby to diamond bolts near a third of its health: not modelled, ruby is averaged over the kill.'],
};
