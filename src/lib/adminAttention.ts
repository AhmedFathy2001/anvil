// What the admin dashboard should be asking you to do, in the order it should ask.
//
// The old dashboard opened with four counts — active members, active events, pending
// verifications, past events — and none of them was a decision. "Active events 3" was true and
// useless: all three were upcoming, none had a single team, and the board due to open in three
// days looked exactly like the one due in six weeks.
//
// This turns the same facts into a ranked queue of things waiting on a human, each carrying the
// reason it matters and where to go. Cleared work stays in the list as `clear` rather than
// vanishing, because a queue that only ever shows problems can't be trusted when it's empty.
//
// Pure and dependency-free (no `@/` imports) so tests/admin-attention.test.ts can run it directly
// with Node type-stripping, the same way lib/eventStage and lib/scheduleLanes do. Callers pass the
// facts in; every threshold lives here so the wording and the ordering can't drift apart.

export type Severity = 'critical' | 'warn' | 'info' | 'clear';

export interface AttentionItem {
  /** Stable id — used as a React key and to snooze one item without touching the rest. */
  key: string;
  severity: Severity;
  /** The decision, in plain language, as a sentence someone would say out loud. */
  title: string;
  /** Why it matters — the numbers behind the headline. */
  detail: string;
  href: string;
  /** Button label. A verb, matching what happens next. */
  action: string;
}

export interface AttentionEvent {
  id: number;
  kind: 'board' | 'weekly';
  name: string;
  href: string;
  /** ISO, or null for a board nobody has dated yet. */
  startDate: string | null;
  status: 'draft' | 'upcoming' | 'running' | 'ended';
  teamCount: number;
  tileCount: number;
  /** N² for a square grid, N otherwise. 0 when the board's shape doesn't imply a count. */
  expectedTiles: number;
  /** Formats that never draft (a ladder, a solo race) must not be nagged about teams. */
  needsTeams: boolean;
}

export interface AttentionFacts {
  now: number;
  events: AttentionEvent[];
  /** Nobody has the money yet. Chase the player. */
  feesOwed: number;
  /** A mod HAS the money and it needs a second signature. Chase staff. */
  feesToSign: number;
  /** Age in days of the oldest fee still waiting, or null if none are. */
  oldestFeeDays: number | null;
  /**
   * Which events the waiting fees belong to, and whether those events are over.
   *
   * A count alone couldn't tell "someone is holding cash for the board that opens Tuesday" from
   * "a July board nobody has closed out". Both are real, but only the first is urgent, and the
   * second needs the event NAMED or you can't act on it at all.
   */
  feeEvents: { name: string; ended: boolean; count: number; href: string }[];
  pendingVerifications: number;
  /** Days with nothing running at all, starting from the first such day ahead of now. */
  gap: { days: number; startsInDays: number } | null;
  /** Boards that exist but have no dates. */
  unscheduled: { id: number; name: string; href: string }[];
}

const DAY = 86_400_000;

/** Inside this many days, an unprepared event stops being a plan and becomes a problem. */
const IMMINENT_DAYS = 7;

/** A hole this long in the calendar is worth surfacing; a long weekend isn't. */
const GAP_DAYS = 5;

const RANK: Record<Severity, number> = { critical: 0, warn: 1, info: 2, clear: 3 };

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function inDays(ms: number): string {
  const days = Math.floor(ms / DAY);
  if (days >= 1) return `in ${plural(days, 'day')}`;
  const hours = Math.max(1, Math.floor(ms / 3_600_000));
  return `in ${plural(hours, 'hour')}`;
}

/**
 * The queue, most urgent first.
 *
 * Severity decides the order; ties break on how soon the thing bites, so two unprepared boards
 * sort by start date rather than by id. Everything that is genuinely fine collapses into a single
 * `clear` line at the bottom instead of one reassuring card per subsystem.
 */
export function attentionQueue(facts: AttentionFacts): AttentionItem[] {
  const items: (AttentionItem & { at: number })[] = [];

  for (const e of facts.events) {
    if (e.kind !== 'board' || !e.startDate) continue;
    if (e.status === 'ended') continue;

    const startsIn = Date.parse(e.startDate) - facts.now;
    const imminent = startsIn <= IMMINENT_DAYS * DAY;

    // Teams. A board that opens with no teams opens broken, so inside the window this is the
    // loudest thing on the page.
    if (e.needsTeams && e.teamCount === 0 && e.status !== 'running') {
      items.push({
        key: `teams-${e.id}`,
        severity: imminent ? 'critical' : 'info',
        title: imminent
          ? `${e.name} starts ${inDays(startsIn)} with no teams`
          : `${e.name} has no teams yet`,
        detail: `Nobody is drafted. Players can't be scored without a team.`,
        href: `${e.href}/teams`,
        action: 'Build teams',
        at: startsIn,
      });
    }

    // Tiles. A half-drawn board is only a problem once it's about to open — before that it's
    // just work in progress, and saying so every day trains people to ignore the queue.
    if (e.expectedTiles > 0 && e.tileCount < e.expectedTiles && imminent) {
      items.push({
        key: `tiles-${e.id}`,
        severity: e.tileCount === 0 ? 'critical' : 'warn',
        title: `${e.name} is short ${plural(e.expectedTiles - e.tileCount, 'tile')}`,
        detail: `${e.tileCount} of ${e.expectedTiles} drawn · opens ${inDays(startsIn)}`,
        href: `${e.href}/tiles`,
        action: 'Draw tiles',
        at: startsIn,
      });
    }
  }

  // Fees a mod is already holding. Nobody chases these because the money has arrived — which is
  // exactly why they rot.
  if (facts.feesToSign > 0) {
    const live = facts.feeEvents.filter((e) => !e.ended);
    const finished = facts.feeEvents.filter((e) => e.ended);
    // Money moving for an event that hasn't happened yet is a live problem. Money left over from a
    // board that finished weeks ago is bookkeeping — real, but it should not be the loudest thing
    // on the dashboard every morning for the rest of the year.
    const onlyOldEvents = live.length === 0 && finished.length > 0;
    const named = facts.feeEvents.length === 1 ? facts.feeEvents[0] : null;

    items.push({
      key: 'fees-sign',
      severity: onlyOldEvents ? 'info' : facts.oldestFeeDays != null && facts.oldestFeeDays >= 14 ? 'warn' : 'info',
      title: onlyOldEvents
        ? `${plural(facts.feesToSign, 'fee')} left unsigned from ${
            named ? named.name : `${plural(finished.length, 'finished event')}`
          }`
        : `${plural(facts.feesToSign, 'collected fee')} waiting on a second signature`,
      detail: onlyOldEvents
        ? `The event is over and a mod still holds the money${
            facts.oldestFeeDays != null ? `, ${plural(facts.oldestFeeDays, 'day')} ago` : ''
          } — sign them off or write them off.`
        : named
          ? `A mod has the money for ${named.name}; nobody has signed it off.${
              facts.oldestFeeDays != null ? ` Oldest: ${plural(facts.oldestFeeDays, 'day')}.` : ''
            }`
          : `A mod has the money; nobody has signed it off.${
              facts.oldestFeeDays != null ? ` Oldest: ${plural(facts.oldestFeeDays, 'day')}.` : ''
            }`,
      href: named ? named.href : '/admin/fees',
      action: onlyOldEvents ? 'Close them out' : 'Review fees',
      // Stale bookkeeping sorts below anything live, however old it is.
      at: onlyOldEvents ? Number.MAX_SAFE_INTEGER : -(facts.oldestFeeDays ?? 0) * DAY,
    });
  }

  if (facts.feesOwed > 0) {
    items.push({
      key: 'fees-owed',
      severity: 'info',
      title: `${plural(facts.feesOwed, 'fee')} still to collect`,
      detail: 'Nobody has the money yet — these are on the players.',
      href: '/admin/fees',
      action: 'Chase fees',
      at: 0,
    });
  }

  if (facts.pendingVerifications > 0) {
    items.push({
      key: 'verifications',
      severity: 'warn',
      title: `${plural(facts.pendingVerifications, 'person', 'people')} waiting on mod review`,
      detail: 'They self-reported through the plugin and can’t be scored until verified.',
      href: '/admin/clan/needs-review',
      action: 'Review them',
      at: 0,
    });
  }

  // A hole in the schedule. Only worth raising if it's ahead of us and long enough to notice.
  if (facts.gap && facts.gap.days >= GAP_DAYS) {
    const waiting = facts.unscheduled[0];
    items.push({
      key: 'gap',
      severity: 'info',
      title: `Nothing runs for ${plural(facts.gap.days, 'day')}${
        facts.gap.startsInDays > 0 ? `, starting ${inDays(facts.gap.startsInDays * DAY)}` : ''
      }`,
      detail: waiting
        ? `${waiting.name} is written but has no dates — it would fill this.`
        : 'No board or competition covers that stretch.',
      href: waiting ? waiting.href : '/admin/schedule',
      action: waiting ? 'Give it dates' : 'Open schedule',
      at: facts.gap.startsInDays * DAY,
    });
  }

  const open: AttentionItem[] = items
    .sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.at - b.at)
    .map((entry) => {
      const { at, ...item } = entry;
      void at; // ordering only — the view never shows it
      return item;
    });

  // One honest all-clear rather than a card per quiet subsystem.
  if (open.length === 0) {
    return [
      {
        key: 'clear',
        severity: 'clear',
        title: 'Nothing needs you',
        detail: 'No unprepared events, no fees to sign, nobody waiting on review.',
        href: '/admin/schedule',
        action: 'Plan ahead',
      },
    ];
  }

  return open;
}

/** How many of the queue are actually asking for something. */
export function openCount(items: AttentionItem[]): number {
  return items.filter((i) => i.severity !== 'clear').length;
}
