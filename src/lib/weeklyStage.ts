// A weekly competition, described in the same terms as a board event.
//
// A weekly has a name, a window, a roster, a leaderboard and a winner — everything a bingo has
// except tiles and teams. It just never had a workspace: it lived as one row in a long list, so
// "which weekly needs me" was a question you answered by expanding accordions. This gives it the
// same three stages and the same lifecycle strip the boards use (lib/eventStage), with the steps
// that actually apply to a competition.
//
// Pure and dependency-free so tests/weekly-stage.test.ts can run it with Node type-stripping.

import type { EventStage, LifecycleStep } from '@/lib/eventStage';

export interface StageWeekly {
  startDate: string;
  endDate: string;
  /** 'upcoming' | 'active' | 'completed' — maintained by the weekly lifecycle cron. */
  status: string;
}

export interface WeeklyCounts {
  participants: number;
  /** Participants with a baseline captured — until then a gain can't be measured. */
  withBaseline: number;
  /** Participants who have gained anything at all. */
  moving: number;
  /** Implausible-gain flags (lib/gainsValidation) waiting for an admin call. */
  flagged: number;
  /** Enrolled but no longer in the clan, and not kept by an override. */
  leavers: number;
}

/**
 * The recorded status wins over the clock.
 *
 * The cron flips a competition to 'completed' when its window closes and that's what the public
 * pages read, so a stage derived purely from dates could disagree with the badge next to it.
 */
export function weeklyStage(comp: StageWeekly, now: number = Date.now()): EventStage {
  if (comp.status === 'completed') return 'wrap';
  if (comp.status === 'upcoming') return 'build';
  if (Date.parse(comp.endDate) <= now) return 'wrap';
  if (Date.parse(comp.startDate) > now) return 'build';
  return 'run';
}

/**
 * Four steps rather than a board's six: nobody drafts a weekly and nothing is authored — the whole
 * setup is "is everyone in, and do they have a starting line".
 */
export function weeklyLifecycleSteps(
  comp: StageWeekly,
  counts: WeeklyCounts,
  now: number = Date.now(),
): LifecycleStep[] {
  const stage = weeklyStage(comp, now);
  const enrolled = counts.participants > 0;
  const baselined = enrolled && counts.withBaseline >= counts.participants;
  const ended = stage === 'wrap';

  const steps: LifecycleStep[] = [
    {
      key: 'enrolled',
      label: 'Enrolled',
      detail: enrolled ? `${counts.participants} in` : 'nobody yet',
      state: enrolled ? 'done' : 'now',
    },
    {
      key: 'baselines',
      label: 'Baselines',
      detail: baselined
        ? 'all taken'
        : enrolled
          ? `${counts.withBaseline} of ${counts.participants}`
          : 'not taken',
      state: baselined ? 'done' : 'todo',
    },
    {
      key: 'running',
      label: 'Running',
      detail: ended ? 'finished' : stage === 'run' ? `${counts.moving} scoring` : startsIn(comp, now),
      state: ended ? 'done' : stage === 'run' ? 'now' : 'todo',
    },
    {
      key: 'results',
      label: 'Results',
      detail: ended ? 'in' : 'when it ends',
      state: ended ? 'now' : 'todo',
    },
  ];

  if (stage === 'build') {
    for (const s of steps) if (s.state === 'now') s.state = 'todo';
    const first = steps.find((s) => s.state !== 'done' && (s.key === 'enrolled' || s.key === 'baselines'));
    if (first) first.state = 'now';
    else steps[2].state = 'now';
  } else if (stage === 'run') {
    for (const s of steps) if (s.key !== 'running' && s.state === 'now') s.state = 'todo';
  } else {
    for (const s of steps) s.state = s.key === 'results' ? 'now' : 'done';
  }

  return steps;
}

function startsIn(comp: StageWeekly, now: number): string {
  const ms = Date.parse(comp.startDate) - now;
  if (ms <= 0) return 'due to start';
  const days = Math.floor(ms / 86_400_000);
  return days >= 1 ? `starts in ${days}d` : `starts in ${Math.max(1, Math.floor(ms / 3_600_000))}h`;
}

/** What a weekly ranks by, in words — 'Agility xp', 'Zulrah kills', 'EHP'. */
export function weeklyUnit(type: string): string {
  if (type === 'boss') return 'kills';
  if (type === 'efficiency') return 'hours';
  return 'xp';
}

export const WEEKLY_BADGE: Record<string, string> = {
  skill: 'SOTW',
  boss: 'BOTW',
  efficiency: 'Efficiency',
};
