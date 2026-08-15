// Laying events out on a calendar without drawing the same one seven times.
//
// The schedule used to render a pill per event PER DAY, so a week-long competition appeared once
// in every cell it touched and a normal August read as ~40 pills for 6 events. What people
// actually read off a calendar is a BAR: one per event, spanning its days, with the title written
// once at the start.
//
// That needs two things this module provides: a lane for every event (a row no overlapping event
// is using), and the stretches where nothing runs at all — which turn out to be the most useful
// thing on the page, because an empty fortnight is invisible when you're looking at pills.
//
// Pure and dependency-free (no `@/` imports) so tests/schedule-lanes.test.ts can run it directly
// with Node type-stripping, the same way lib/eventStage and lib/eventReadiness do.

export interface Span {
  /** Midnight-local of the first day the thing covers. */
  start: Date;
  /** Midnight-local of the last day it covers — inclusive, so a one-day event has start === end. */
  end: Date;
}

export interface Laid<T> extends Span {
  item: T;
  /** Row index. Stable across the whole range, so a bar doesn't jump rows mid-event. */
  lane: number;
}

export interface Gap {
  start: Date;
  end: Date;
  days: number;
  /**
   * True when the gap runs off the end of the window rather than stopping at the next event.
   *
   * Its `days` is then an artifact of how far we happened to look, not a fact about the schedule:
   * the same empty calendar reads "33 days" over six weeks and "47 days" over eight. Callers must
   * say "nothing after the 24th" for these, and only quote a length for a gap with an event on
   * both sides of it.
   */
  openEnded: boolean;
}

/**
 * The calendar day a stored timestamp belongs on.
 *
 * Two shapes live in these columns and they want opposite treatment:
 *
 *   boards    `2026-07-10T00:00:00.000Z` — a calendar DATE wearing a timestamp. Whoever picked it
 *             typed "10 July"; midnight UTC is just how the date input serialised.
 *   weeklies  `2026-06-14T19:00:00.000Z` — a real INSTANT, the moment the cron closes the week.
 *
 * Read every column as local time (what the page used to do) and the second kind is right while
 * the first drifts: at UTC-5, midnight-UTC on the 10th is 7pm on the 9th, so every board on the
 * calendar started a day early for anyone in the Americas. Read every column as UTC instead and
 * the first is right while a competition closing at 9pm UTC lands on the wrong side of midnight
 * for anyone far enough east.
 *
 * So: exactly midnight UTC is treated as a date and kept on that date; anything else is a real
 * moment and resolves in the reader's own timezone.
 */
export function dayOf(iso: string | Date): Date {
  const d = iso instanceof Date ? iso : new Date(iso);
  const isDateOnly =
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0;
  return isDateOnly
    ? new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/**
 * Whole days between two midnights.
 *
 * Rounded, not floored: across a DST boundary the raw difference is 23 or 25 hours, and flooring
 * that turns a 7-day competition into a 6-day one twice a year.
 */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** A stable key for a local day — used to mark coverage without any timezone round-trip. */
export function isoDay(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function overlaps(a: Span, b: Span): boolean {
  return a.start.getTime() <= b.end.getTime() && b.start.getTime() <= a.end.getTime();
}

/**
 * Give every item a lane no overlapping item is using.
 *
 * Lanes are assigned once across the WHOLE range rather than per week, which is what keeps a bar
 * on the same row as it crosses a Saturday — per-week packing makes long events hop rows for no
 * reason the reader can see.
 *
 * Earliest first, and among equal starts the longest first, so the bar most likely to collide with
 * everything else claims the top lane and the short ones fill in beneath it.
 */
export function packLanes<T>(items: T[], toSpan: (item: T) => Span): Laid<T>[] {
  const laid: Laid<T>[] = [];
  const sorted = items
    .map((item) => ({ item, ...toSpan(item) }))
    .sort((a, b) => {
      const byStart = a.start.getTime() - b.start.getTime();
      if (byStart !== 0) return byStart;
      const lenA = a.end.getTime() - a.start.getTime();
      const lenB = b.end.getTime() - b.start.getTime();
      return lenB - lenA;
    });

  for (const entry of sorted) {
    let lane = 0;
    while (laid.some((p) => p.lane === lane && overlaps(p, entry))) lane++;
    laid.push({ ...entry, lane });
  }
  return laid;
}

/**
 * The stretches inside [from, to] where nothing at all is running.
 *
 * `minDays` exists because a one-day seam between a competition ending Sunday and the next opening
 * Tuesday isn't a hole anybody needs to hear about; a fortnight with nothing in it is.
 */
export function findGaps(spans: Span[], from: Date, to: Date, minDays = 1): Gap[] {
  const covered = new Set<string>();
  for (const s of spans) {
    // Clamp to the window so a year-long board doesn't cost a year of iterations.
    const start = s.start < from ? from : s.start;
    const end = s.end > to ? to : s.end;
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) covered.add(isoDay(d));
  }

  const gaps: Gap[] = [];
  let run: Date | null = null;
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
    if (covered.has(isoDay(d))) {
      if (run) {
        const end = addDays(d, -1);
        gaps.push({ start: run, end, days: daysBetween(run, end) + 1, openEnded: false });
        run = null;
      }
    } else if (!run) {
      run = new Date(d);
    }
  }
  // A run still open at the window edge doesn't end there — we simply stopped looking.
  if (run) gaps.push({ start: run, end: to, days: daysBetween(run, to) + 1, openEnded: true });

  return gaps.filter((g) => g.days >= minDays);
}

/**
 * The lanes a given week actually uses, compacted.
 *
 * Global lanes keep bars from hopping rows, but they leave holes: a week whose only events sit in
 * lanes 0 and 5 would otherwise render four blank rows. Compacting preserves the ORDER of the
 * lanes, so bars still never cross each other — they just close up.
 */
export function laneRowsFor<T>(inWeek: Laid<T>[], max: number): Map<number, number> {
  const used = [...new Set(inWeek.map((p) => p.lane))].sort((a, b) => a - b);
  return new Map(used.slice(0, max).map((lane, row) => [lane, row]));
}
