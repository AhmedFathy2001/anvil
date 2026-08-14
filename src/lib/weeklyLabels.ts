// How a weekly competition's metric and values read on screen.
//
// The old admin page carried these as local functions inside its 770-line client; the workspace
// and the events list both need them, so they live here — one spelling of "Zulrah", one spelling
// of a gain, everywhere.

import { BOSSES, EFFICIENCY_LABELS, SKILL_LABELS, formatEfficiencyHours } from '@/lib/constants';

/** 'Agility', 'Zulrah', 'EHP' — what the competition ranks by. */
export function weeklyMetricLabel(type: string, metric: string): string {
  if (type === 'skill') return SKILL_LABELS[metric] || metric;
  if (type === 'efficiency') return EFFICIENCY_LABELS[metric] || metric.toUpperCase();
  return BOSSES.find((b) => b.key === metric)?.label || metric;
}

/** A raw stat value in the unit its competition uses. Efficiency stores milli-hours. */
export function weeklyStatValue(type: string, value: number | null): string {
  if (value == null) return '—';
  return type === 'efficiency' ? formatEfficiencyHours(value) : value.toLocaleString();
}

/** A gain, with its unit — '4.1m xp', '412 kills', '12.4 hrs'. */
export function weeklyGain(type: string, gained: number): string {
  if (type === 'efficiency') return `${formatEfficiencyHours(gained)} hrs`;
  if (type === 'boss') return `${gained.toLocaleString()} kills`;
  if (gained >= 1_000_000) return `${(gained / 1_000_000).toFixed(1).replace(/\.0$/, '')}m xp`;
  if (gained >= 1_000) return `${Math.round(gained / 1_000)}k xp`;
  return `${gained.toLocaleString()} xp`;
}
