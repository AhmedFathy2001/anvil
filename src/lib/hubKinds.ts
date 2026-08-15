import { EVENT_MODES } from '@/lib/eventModes';
import type { HubKind } from '@/lib/eventsHub';

/**
 * The ten things a clan can run, in one vocabulary.
 *
 * Seven board modes (lib/eventModes) and three weekly types, described the same way so the hub can
 * draw, filter and group them without asking which table they came from. Ten is too many for a row
 * of filter chips — hence `group`, which is what the filter actually offers: Boards, Weeks, or
 * everything.
 *
 * Pure and dependency-light so both server and client components can read it.
 */

export interface HubKindMeta {
  key: HubKind;
  /** What it's called in full. */
  label: string;
  /** What fits on a card or a table row. */
  short: string;
  group: 'boards' | 'weeks';
  /** CSS colour, used for the card's accent and the calendar lane. */
  accent: string;
  /** Fallback glyph where there's no icon to load. */
  emoji: string;
}

const label = (key: string, fallback: string) => EVENT_MODES.find((m) => m.key === key)?.label ?? fallback;

export const HUB_KINDS: HubKindMeta[] = [
  { key: 'classic', label: label('classic', 'Classic bingo'), short: 'Classic', group: 'boards', accent: 'var(--gold)', emoji: '🎯' },
  { key: 'leagues', label: label('leagues', 'Leagues bingo'), short: 'Leagues', group: 'boards', accent: '#f0a93b', emoji: '📜' },
  { key: 'race', label: label('race', 'Tile race'), short: 'Race', group: 'boards', accent: '#46c0b0', emoji: '🏁' },
  { key: 'showdown', label: label('showdown', 'Showdown'), short: 'Showdown', group: 'boards', accent: '#d98cb3', emoji: '⏱' },
  { key: 'luckydraw', label: label('luckydraw', 'Lucky draw'), short: 'Draw', group: 'boards', accent: '#a78bfa', emoji: '🎲' },
  { key: 'bounty', label: label('bounty', 'Bounty hunt'), short: 'Bounty', group: 'boards', accent: 'var(--accent-red)', emoji: '💰' },
  { key: 'ladder', label: label('ladder', 'Ladder'), short: 'Ladder', group: 'boards', accent: '#c39cf5', emoji: '🪜' },
  { key: 'sotw', label: 'Skill of the Week', short: 'SOTW', group: 'weeks', accent: '#4aa3d4', emoji: '📈' },
  { key: 'botw', label: 'Boss of the Week', short: 'BOTW', group: 'weeks', accent: '#d0553f', emoji: '💀' },
  { key: 'eff', label: 'Efficiency race', short: 'EHP', group: 'weeks', accent: 'var(--accent-green-light)', emoji: '⚡' },
];

const BY_KEY = new Map(HUB_KINDS.map((k) => [k.key, k]));

export function hubKind(key: HubKind): HubKindMeta {
  return BY_KEY.get(key) ?? HUB_KINDS[0];
}
