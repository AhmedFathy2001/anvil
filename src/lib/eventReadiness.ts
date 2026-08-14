// Event start-readiness — the safeguard between "the clock says start" and "the event actually
// goes live". Historically start was purely time-driven (startDate <= now) and nothing checked
// whether the event was in a startable state, so a bingo could go live — Discord announcement,
// submissions open, plugin tracking — mid-draft or with zero teams assigned. Every start door
// (the lifecycle cron's scheduled start, the admin "start-now" action) now runs these checks.
//
// Pure and dependency-free (no `@/` imports) so tests/event-readiness.test.ts can run it directly
// with Node type-stripping, like lib/eventRules and lib/federationDecisions. Callers fetch the
// counts (see eventLifecycle.getEventStartReadiness) and pass them in.

// 'no-end-date' is a WARNING, not a state check: an event with no end date runs until someone ends
// it, which is a legitimate setup (a rolling monthly ladder) but usually a mistake on a bingo. It is
// never produced by computeStartReadiness — only the admin start-now door raises it, so it prompts
// once and is overridable, and a scheduled start is never held for it.
export type StartBlockerCode = 'draft-in-progress' | 'no-teams' | 'no-assigned-players' | 'no-end-date';

export interface StartReadinessCounts {
  draftStatus: string;
  teamCount: number;
  /** Players with a team (players.teamId != null). */
  assignedPlayerCount: number;
  /** All enrolled players, assigned or not. */
  totalPlayerCount: number;
}

export interface StartReadiness {
  ready: boolean;
  blockers: StartBlockerCode[];
  /** Non-blocking: enrolled players still without a team (a deliberate bench is legitimate). */
  unassignedPlayerCount: number;
}

// A draft that has begun but not been completed (or reset) is the clearest "not ready" signal —
// the team roster is literally mid-assembly. 'none' (no draft used, teams assigned manually) and
// 'completed' are both startable draft states.
export function isDraftInProgress(draftStatus: string): boolean {
  return draftStatus === 'active' || draftStatus === 'paused';
}

export function computeStartReadiness(counts: StartReadinessCounts): StartReadiness {
  const blockers: StartBlockerCode[] = [];
  if (isDraftInProgress(counts.draftStatus)) blockers.push('draft-in-progress');
  if (counts.teamCount === 0) blockers.push('no-teams');
  else if (counts.assignedPlayerCount === 0) blockers.push('no-assigned-players');
  return {
    ready: blockers.length === 0,
    blockers,
    unassignedPlayerCount: Math.max(0, counts.totalPlayerCount - counts.assignedPlayerCount),
  };
}

/** Human-readable, admin-facing label for one blocker (UI banner, start-now error, Discord hold post). */
export function startBlockerLabel(code: StartBlockerCode): string {
  switch (code) {
    case 'draft-in-progress':
      return 'the draft is still in progress — complete it (or reset it) first';
    case 'no-teams':
      return 'no teams have been created yet';
    case 'no-assigned-players':
      return 'no players have been assigned to a team yet';
    case 'no-end-date':
      return 'there is no end date, so it will run until you end it manually';
  }
}

/** One-line summary, e.g. for the start-now 409 error message. */
export function describeStartBlockers(blockers: StartBlockerCode[]): string {
  return blockers.map(startBlockerLabel).join('; ');
}
