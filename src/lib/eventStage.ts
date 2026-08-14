// Which of an event's three jobs you're doing right now.
//
// The seven admin tabs looked identical the night a board was being written, the week it ran, and
// the day after it ended — but almost none of them apply in more than one of those. Tiles and
// Teams are done before anyone plays; Payouts and Survey only mean anything once it's over. So the
// workspace has a STAGE, derived from the event's own dates, and the rail plus the home panel
// follow it.
//
// Pure and dependency-free (no `@/` imports) so tests/event-stage.test.ts can run it directly with
// Node type-stripping, the same way lib/eventReadiness and lib/eventRules do. Callers pass the
// counts in.

export type EventStage = 'build' | 'run' | 'wrap';

export interface StageEvent {
  startDate: string | null;
  endDate: string | null;
  forceEndedAt: string | null;
}

/**
 * build = hasn't opened yet (no start date, or a start still in the future).
 * run   = open and not finished.
 * wrap  = force-ended, or past its end date.
 *
 * A board with no end date never reaches wrap on its own — it runs until someone ends it, which is
 * a legitimate setup (a rolling ladder) and exactly what force-end is for.
 */
export function eventStage(event: StageEvent, now: number = Date.now()): EventStage {
  if (event.forceEndedAt) return 'wrap';
  if (event.endDate && Date.parse(event.endDate) <= now) return 'wrap';
  if (!event.startDate) return 'build';
  return Date.parse(event.startDate) <= now ? 'run' : 'build';
}

export interface StageCounts {
  tileCount: number;
  /** N² for a square grid, N otherwise — how many tiles this board says it should have. */
  expectedTiles: number;
  teamCount: number;
  assignedPlayers: number;
  signupCount: number;
  pendingSignups: number;
  unpaidPayouts: number;
  payoutCount: number;
  surveyResponses: number;
  /** True once the event has any survey question authored. */
  hasSurvey: boolean;
  /** Blocking reasons from lib/eventReadiness, already turned into sentences. */
  blockers: string[];
}

export type StepState = 'done' | 'now' | 'todo';

export interface LifecycleStep {
  /** Stable id for the step — also what the bar looks up to find where the step links. */
  key: string;
  label: string;
  /** One short line under the label — a count, a date, or what's missing. */
  detail: string;
  state: StepState;
}

/**
 * The event's whole life as six steps, with exactly one marked `now`.
 *
 * The `now` step is the one that would move things forward: inside build that's the first unmet
 * requirement, inside run it's Running, and after the end it's whichever of results/payouts is
 * still outstanding.
 */
export function lifecycleSteps(
  event: StageEvent & { name?: string },
  counts: StageCounts,
  now: number = Date.now(),
): LifecycleStep[] {
  const stage = eventStage(event, now);
  const tilesDone = counts.expectedTiles > 0 && counts.tileCount >= counts.expectedTiles;
  const teamsDone = counts.teamCount > 0 && counts.assignedPlayers > 0;
  const ended = stage === 'wrap';
  const paidUp = counts.payoutCount > 0 && counts.unpaidPayouts === 0;

  const steps: LifecycleStep[] = [
    {
      key: 'built',
      label: 'Built',
      detail: event.startDate ? 'scheduled' : 'no dates yet',
      state: event.startDate ? 'done' : 'now',
    },
    {
      key: 'tiles',
      label: 'Tiles',
      detail: tilesDone
        ? `${counts.tileCount} authored`
        : `${counts.tileCount} of ${counts.expectedTiles || '—'}`,
      state: tilesDone ? 'done' : 'todo',
    },
    {
      key: 'teams',
      label: 'Drafted',
      detail: teamsDone
        ? `${counts.teamCount} teams`
        : counts.teamCount > 0
          ? 'nobody assigned'
          : 'no teams',
      state: teamsDone ? 'done' : 'todo',
    },
    {
      key: 'running',
      label: 'Running',
      detail: stage === 'run' ? 'live now' : ended ? 'finished' : startsLabel(event, now),
      state: ended ? 'done' : stage === 'run' ? 'now' : 'todo',
    },
    {
      key: 'results',
      label: 'Results',
      detail: ended ? 'in' : endsLabel(event),
      state: ended ? 'done' : 'todo',
    },
    {
      key: 'payouts',
      label: 'Payouts',
      detail: counts.payoutCount === 0 ? 'none set' : paidUp ? 'all paid' : `${counts.unpaidPayouts} unpaid`,
      state: paidUp ? 'done' : 'todo',
    },
  ];

  // Exactly one 'now'. Before the start it's the first thing that isn't done; after the end it's
  // whatever still owes someone an action.
  if (stage === 'build') {
    const first = steps.find((s) => s.state !== 'done' && s.key !== 'running' && s.key !== 'results' && s.key !== 'payouts');
    for (const s of steps) if (s.state === 'now') s.state = 'todo';
    if (first) first.state = 'now';
    else steps[3].state = 'now';
  } else if (stage === 'wrap') {
    // The event happened. Whatever the setup steps looked like at the time, they're history now —
    // reading "tiles: todo" under a finished board is noise, and the detail line still says what it
    // actually was. Only payouts can still want something.
    for (const s of steps) if (s.key !== 'payouts') s.state = 'done';
    steps[5].state = paidUp ? 'done' : 'now';
  }

  return steps;
}

function startsLabel(event: StageEvent, now: number): string {
  if (!event.startDate) return 'not scheduled';
  const ms = Date.parse(event.startDate) - now;
  if (ms <= 0) return 'due to start';
  return `starts in ${humanDays(ms)}`;
}

function endsLabel(event: StageEvent): string {
  if (!event.endDate) return 'open-ended';
  return 'when it ends';
}

function humanDays(ms: number): string {
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d`;
  const hours = Math.max(1, Math.floor(ms / 3_600_000));
  return `${hours}h`;
}

/** Wording for the stage switch and empty states — one place, so the three surfaces agree. */
export const STAGE_LABEL: Record<EventStage, string> = {
  build: 'Build',
  run: 'Run',
  wrap: 'Wrap',
};

export const STAGE_BLURB: Record<EventStage, string> = {
  build: 'Getting it to the start line — tiles, teams, dates.',
  run: "What's happening, and what needs a decision.",
  wrap: 'Settle up, tell the story, file it away.',
};
