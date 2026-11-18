// A character that lives on a game-mode world (Hardcore Worlds) is a separate save on its own
// hiscores table. The main table has nothing for the name, so its card showed level 1 in everything.
// When a card has no main-game numbers, the mode table's are shown instead, and labelled.
//
// Pure: the lookup (lib/pluginUi/load) does the reading.

import type { PlayerCard } from '@/lib/playerCardShape';

/** The tables tried, in order, for a name with nothing on the main one. */
export const FALLBACK_TABLES: readonly { table: string; label: string }[] = [{ table: 'hardcore_mains', label: 'Hardcore Worlds' }];

/** A fresh character is 32 skills at 1 and Hitpoints at 10: nothing to show. */
const FRESH_TOTAL = 33;

/** Does this card have no main-game stats worth showing? */
export function lacksMainStats(card: PlayerCard): boolean {
  return card.totalLevel <= FRESH_TOTAL && card.bosses.length === 0 && card.topBosses.length === 0 && !(card.overallXp && card.overallXp > 1154);
}

/** `card` with its numbers taken from `mode` (a card read off a mode table); everything else is kept. */
export function withModeStats(card: PlayerCard, mode: PlayerCard, from: { table: string; label: string }): PlayerCard {
  return {
    ...card,
    totalLevel: mode.totalLevel,
    combatLevel: mode.combatLevel,
    overallXp: mode.overallXp,
    ehp: mode.ehp,
    ehb: mode.ehb,
    statsAt: mode.statsAt,
    skills: mode.skills,
    bosses: mode.bosses,
    topBosses: mode.topBosses,
    activities: mode.activities,
    statsFrom: { ...from, at: mode.fetchedAt ?? mode.statsAt ?? '' },
  };
}
