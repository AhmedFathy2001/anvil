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

import { parseStamp } from './dbTime.ts';

export type EventStage = 'build' | 'run' | 'wrap';

export interface StageEvent {
  startDate: string | null;
  endDate: string | null;
  forceEndedAt: string | null;
  /** The start was due but is waiting on teams (the hold latch the lifecycle tick sets). */
  startHoldNotified?: number | null;
  startNotified?: number | null;
}

/** One wording for a start that is waiting on teams — the hero, the lists, cards, link previews and the stage line all say this. */
export const START_WAITING_WORDS = 'Starts once teams are ready';

/**
 * The start time came but the event has not started: the lifecycle tick is holding it for teams.
 * The one derivation every "when does it start" line uses (the date is not a promise while held).
 */
export function startIsHeld(e: Pick<StageEvent, 'startHoldNotified' | 'startNotified'>, live = false): boolean {
  return !live && e.startHoldNotified === 1 && !e.startNotified;
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
  const end = parseStamp(event.endDate);
  if (end !== null && end <= now) return 'wrap';
  const start = parseStamp(event.startDate);
  if (start === null) return 'build';
  return start <= now ? 'run' : 'build';
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
  /** Team placement (lib/teamPlacement); 'auto' and 'solo' make teams from sign-ups. */
  placement?: string | null;
  surveyResponses: number;
  /** True once the event has any survey question authored. */
  hasSurvey: boolean;
  /** Blocking reasons from lib/eventReadiness, already turned into sentences. */
  blockers: string[];
}

/**
 * The three setup facts every surface asks about an event before it starts. One definition, read by
 * the lifecycle steps below, the event home's checklist and the guide strip (lib/guidedFlows/runEvent),
 * so they cannot tick differently.
 */
export function setupFacts(
  counts: Pick<StageCounts, 'tileCount' | 'expectedTiles' | 'teamCount' | 'assignedPlayers'>,
  event: { startDate: string | null },
): { tilesDone: boolean; teamsDone: boolean; datesDone: boolean } {
  return {
    tilesDone: counts.expectedTiles > 0 && counts.tileCount >= counts.expectedTiles,
    teamsDone: counts.teamCount > 0 && counts.assignedPlayers > 0,
    // A start date is what schedules it. No end date is a legitimate open-ended board.
    datesDone: !!event.startDate,
  };
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
  // taskNounPlural: what this board calls its entries (lib/tileAuthoring). A ladder's are Tasks,
  // and a lifecycle bar that says "Tiles" over a ladder is the bingo assumption leaking again.
  event: StageEvent & { name?: string; taskNounPlural?: string },
  counts: StageCounts,
  now: number = Date.now(),
): LifecycleStep[] {
  const stage = eventStage(event, now);
  const { tilesDone, teamsDone } = setupFacts(counts, event);
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
      label: event.taskNounPlural ?? 'Tiles',
      detail: tilesDone
        ? `${counts.tileCount} authored`
        : `${counts.tileCount} of ${counts.expectedTiles || '—'}`,
      state: tilesDone ? 'done' : 'todo',
    },
    {
      key: 'teams',
      // Teams can be drafted, selected during sign-up, or assigned directly by staff.
      label: 'Teams',
      detail: teamsDone
        ? `${counts.teamCount} ready`
        : counts.teamCount > 0
          ? 'nobody assigned'
          : counts.placement === 'auto' || counts.placement === 'solo'
            ? 'form from sign-ups'
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
      label: 'Prizes',
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
  if (startIsHeld(event)) return START_WAITING_WORDS.toLowerCase();
  const ms = (parseStamp(event.startDate) ?? now) - now;
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
