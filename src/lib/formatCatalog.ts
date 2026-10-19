// "What are you running?" — every kind of event, in the words an admin would use.
//
// Each format has its card copy here (how it plays, what it suits) and the EventForm choice it
// opens with. The engine's own blurbs (lib/eventModes) describe mechanics for people who already
// know them; these are written for someone running their first event.
//
// Pure: the picker page and tests read it.

import type { FeatureKey } from '@/lib/features';
import type { EventMode } from '@/lib/eventModes';

export type FormatKey = EventMode | 'sotw' | 'botw' | 'efficiency';

export interface FormatCard {
  key: FormatKey;
  group: 'Team bingo' | 'Surprise tasks' | 'Solo & ongoing';
  name: string;
  how: string;
  goodFor: string;
  sprite: 'fireCape' | 'zenyte' | 'graceful' | 'dagger' | 'casket' | 'emblem' | 'stats' | 'bandos' | 'clue';
  /** Hidden when the clan has this switched off on Admin → Features. */
  feature?: FeatureKey;
  tag?: string;
  /** What EventForm opens on. */
  choice: { mode?: EventMode; weekly?: 'skill' | 'boss' | 'efficiency' };
}

export const FORMAT_GROUP_BLURB: Record<FormatCard['group'], string> = {
  'Team bingo': 'Teams race through a board you write. Every task is visible from the start.',
  'Surprise tasks': 'You write a pool of tasks and Anvil opens them during the event, so nobody can prepare ahead.',
  'Solo & ongoing': 'No teams to build. Everyone who plays is on one leaderboard.',
};

export const FORMAT_CARDS: readonly FormatCard[] = [
  { key: 'classic', group: 'Team bingo', name: 'Classic bingo', how: 'A square grid of tasks. Every tile counts the same, and the team with the most tiles wins.', goodFor: 'your first event, 1–3 weeks', sprite: 'fireCape', tag: 'Start here', choice: { mode: 'classic' } },
  { key: 'leagues', group: 'Team bingo', name: 'Leagues bingo', how: 'A list of tasks worth different points. Harder tasks pay more, and the highest score wins.', goodFor: 'mixed skill levels, longer events', sprite: 'zenyte', choice: { mode: 'leagues' } },
  { key: 'race', group: 'Team bingo', name: 'Tile race', how: 'Tasks in a fixed order. Finish one to unlock the next; the team furthest along wins.', goodFor: 'a short, tense race', sprite: 'graceful', choice: { mode: 'race' } },
  { key: 'showdown', group: 'Surprise tasks', name: 'Showdown', how: 'Tasks open at times you choose, like a new one every evening.', goodFor: 'weekend events with set times', sprite: 'dagger', feature: 'poolFormats', choice: { mode: 'showdown' } },
  { key: 'luckydraw', group: 'Surprise tasks', name: 'Lucky draw', how: 'A random task opens every so often, like a bingo caller.', goodFor: 'keeping people logged in', sprite: 'casket', feature: 'poolFormats', choice: { mode: 'luckydraw' } },
  { key: 'bounty', group: 'Surprise tasks', name: 'Bounty hunt', how: 'One task at a time. The first team to finish it takes the points, then the next appears.', goodFor: 'fast, competitive clans', sprite: 'emblem', feature: 'poolFormats', choice: { mode: 'bounty' } },
  { key: 'ladder', group: 'Solo & ongoing', name: 'Ladder', how: 'A points list ranked as a personal leaderboard. Tasks can rotate through the month.', goodFor: 'a monthly clan ladder', sprite: 'clue', feature: 'poolFormats', choice: { mode: 'ladder' } },
  { key: 'sotw', group: 'Solo & ongoing', name: 'Skill of the Week', how: 'Everyone on the roster is entered. Most XP in one skill wins.', goodFor: 'always having something on', sprite: 'stats', feature: 'weekly', choice: { weekly: 'skill' } },
  { key: 'botw', group: 'Solo & ongoing', name: 'Boss of the Week', how: 'Everyone on the roster is entered. Most kills on one boss wins.', goodFor: 'always having something on', sprite: 'bandos', feature: 'weekly', choice: { weekly: 'boss' } },
  { key: 'efficiency', group: 'Solo & ongoing', name: 'Efficiency race', how: 'Everyone on the roster is entered. Most efficient hours gained wins (EHP for skilling, EHB for bossing — how long the gains would take a fast player).', goodFor: 'fair races between mains and alts', sprite: 'dagger', feature: 'weekly', choice: { weekly: 'efficiency' } },
];

export function findFormat(key: string | null | undefined): FormatCard | null {
  return FORMAT_CARDS.find((f) => f.key === key) ?? null;
}
