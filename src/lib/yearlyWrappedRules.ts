// Yearly Wrapped, the pure half: the year card's extras on top of the month rules
// (lib/monthlyWrappedRules). lib/yearlyWrapped loads the inputs.

import { ordinal } from '@/lib/eventWrappedRules';
import type { MonthlyWrapped } from '@/lib/monthlyWrappedRules';

export interface YearEvent {
  eventId: number;
  name: string;
  clanSlug: string;
  /** Their card in that event's Wrapped. */
  cardKey: number | null;
  team: { name: string; rank: number; of: number } | null;
  placeInTeam: { rank: number; of: number } | null;
  points: number;
  awards: string[];
}

export interface YearlyWrapped extends MonthlyWrapped {
  /** The first tracked day this year, when it isn't 1 January: "since 12 Aug". */
  trackedSince: string | null;
  busiestMonth: { key: string; xp: number } | null;
  events: YearEvent[];
}

/** The best team finish of the year, for the card: lowest rank, then most teams beaten. */
export function bestFinish(events: YearEvent[]): YearEvent | null {
  return (
    events
      .filter((e) => e.team)
      .sort((a, b) => a.team!.rank - b.team!.rank || b.team!.of - a.team!.of)[0] ?? null
  );
}

/** The year card's stat boxes: the month card's, with events played in place of the last. */
export function yearlyCardStats(y: YearlyWrapped, base: { label: string; value: string }[]): { label: string; value: string }[] {
  if (y.events.length === 0) return base;
  return [...base.slice(0, 3), { label: 'Events', value: y.events.length.toLocaleString('en-US') }];
}

/** Pills: the best finish of the year first, then 99s and milestones. */
export function yearlyHighlights(y: YearlyWrapped, base: string[]): string[] {
  const best = bestFinish(y.events);
  const finish = best?.team ? `${ordinal(best.team.rank)} in ${best.name}` : null;
  return [...(finish ? [finish] : []), ...base].slice(0, 3);
}
