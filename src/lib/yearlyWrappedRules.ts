// Yearly Wrapped, the pure half: the year card's extras on top of the month rules
// (lib/monthlyWrappedRules). lib/yearlyWrapped loads the inputs.

import { ordinal } from '@/lib/eventWrappedRules';
import type { MonthlyWrapped } from '@/lib/monthlyWrappedRules';

export interface YearEvent {
  eventId: number;
  name: string;
  clanSlug: string;
  clanKind?: string | null;
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
  /** Weekly activity streaks inside the year (lib/activityStreaks yearStreak). */
  streak?: { best: number; activeWeeks: number; milestone: string | null } | null;
  /** Their Supporter star, when this character wears it publicly: tier and tenure step now. */
  supporter?: { tier: import('@/lib/supporterTiers').SupporterTierId; tierName: string; tenure: import('@/lib/supporterTiers').TenureStepId; tenureName: string; months: number } | null;
  /** Months of Supporter they bought for other people this year, when they're on the wall. */
  gifted?: { months: number; rank: string | null } | null;
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

/** Pills: the best finish of the year first, then a streak milestone, then 99s and milestones. */
export function yearlyHighlights(y: YearlyWrapped, base: string[]): string[] {
  const best = bestFinish(y.events);
  const finish = best?.team ? `${ordinal(best.team.rank)} in ${best.name}` : null;
  const streak = y.streak?.milestone ? `${y.streak.best}-week streak` : null;
  return [...(finish ? [finish] : []), ...(streak ? [streak] : []), ...base].slice(0, 3);
}
