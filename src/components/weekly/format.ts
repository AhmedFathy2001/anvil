import { EFFICIENCY_SCALE } from '@/lib/constants';
import type { CompetitionType } from '@/lib/competitionInsights';

/**
 * One place that decides how a competition number reads, because the three types are three
 * different magnitudes: a week of XP is millions, a week of KC is hundreds, and a week of
 * efficiency is single-digit hours stored as milli-hours.
 */

/** Compact — for headlines and chart axes, where the shape matters more than the digits. */
export function shortValue(value: number, type: CompetitionType): string {
  if (type === 'efficiency') return `${(value / EFFICIENCY_SCALE).toFixed(1)}h`;
  if (type === 'boss') return value.toLocaleString();
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

/** Exact — for the leaderboard and anywhere a member compares themselves to someone else. */
export function exactValue(value: number, type: CompetitionType): string {
  if (type === 'efficiency') return `${(value / EFFICIENCY_SCALE).toFixed(2)}h`;
  return value.toLocaleString();
}

/** "1.2M XP" / "45 KC" / "3.40h" — a value with its unit, for prose. */
export function withUnit(value: number, type: CompetitionType, unit: string): string {
  return type === 'efficiency' ? exactValue(value, type) : `${shortValue(value, type)} ${unit}`;
}

/** 'Mon' — the column label for a 'YYYY-MM-DD' day key. */
export function weekdayLabel(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  return Number.isNaN(d.getTime())
    ? day.slice(5)
    : d.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
}

/** 'Aug 12' — the longer form, for tooltips and milestone rows. */
export function dateLabel(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  return Number.isNaN(d.getTime())
    ? day
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
