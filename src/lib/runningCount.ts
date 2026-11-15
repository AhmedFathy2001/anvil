// "How much is running": ONE definition for every surface that says a number.
//
// Events (boards) and weekly competitions both count, and the words always say which is which. The
// owner dashboard said "4 running" over a list of 2, the clan home said "2 running now" over 4 live
// things, and the signed-in home said "4 things running" above "3 running": each counted something
// different and none said what. Pure (no `@/` imports).

export interface RunningCount {
  events: number;
  /** Weekly competitions (skill, boss and efficiency weeks). */
  competitions: number;
}

export function runningTotal(c: RunningCount): number {
  return c.events + c.competitions;
}

function n(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** "2 events and 2 competitions", "1 event", "3 competitions"; '' when nothing is running. */
export function runningParts(c: RunningCount): string {
  return [c.events > 0 ? n(c.events, 'event', 'events') : null, c.competitions > 0 ? n(c.competitions, 'competition', 'competitions') : null]
    .filter(Boolean)
    .join(' and ');
}

/** "2 events and 2 competitions running", or "nothing running". */
export function runningLabel(c: RunningCount): string {
  const parts = runningParts(c);
  return parts ? `${parts} running` : 'nothing running';
}

/** Count a list of live things by kind (`weekly` is a competition, anything else an event). */
export function countRunning(items: readonly { kind: string }[]): RunningCount {
  const competitions = items.filter((i) => i.kind === 'weekly').length;
  return { events: items.length - competitions, competitions };
}
