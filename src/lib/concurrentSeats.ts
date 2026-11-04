// Seats at once across overlapping events — the sweep line behind a host's player cap.
//
// A plan's player cap is not per event: it is the most players a host may have ENROLLED AT THE SAME
// TIME across every event of theirs that is running. Two events Oct 7–10 and Oct 8–11 on a 1,000 cap
// share 1,000; Oct 1–3 and Oct 7–10 get 1,000 each; one event alone gets 1,000. What matters is the
// PEAK — the most seats live at any one moment — not pairs: A overlapping B and B overlapping C, with
// A and C apart, is limited by A+B and by B+C, never by A+B+C.
//
// SEATS, NOT PEOPLE. A count here is an event's enrolments (its on-board sign-ups). Somebody playing
// two overlapping events holds two seats and counts twice; nothing is de-duplicated across events.
//
// THE WINDOW of an event (eventWindow):
//   - an undated draft has none — it is not running, so it overlaps nothing (a caller checks a
//     draft's own seats on their own, see roomVerdict);
//   - it opens at startDate and closes at endDate, or at forceEndedAt when that is earlier;
//   - a start with no end is OPEN-ENDED: it runs until somebody ends it (force-end), so until then
//     it overlaps every later event;
//   - windows are half-open, [start, end): one event ending at the instant another starts does not
//     overlap it.
// Only time from `from` on (the caller passes "now") is looked at: a moment already past cannot be
// over-filled any more, so an event that has ended frees its seats.
//
// Pure and dependency-free (no `@/` imports): plan rules live in lib/creatorPlans, the reads in
// lib/creatorPlansDb. Any other capped "seats at once" rule can reuse this as it is.

/** A span of time in ms since the epoch, [start, end). `end` may be Infinity (open-ended). */
export interface SeatInterval {
  start: number;
  end: number;
}

/** One event: its window and how many seats it holds. */
export interface SeatWindow extends SeatInterval {
  id: number;
  seats: number;
}

export interface DatedEvent {
  startDate: string | null;
  endDate: string | null;
  forceEndedAt: string | null;
}

const parse = (s: string | null | undefined): number | null => {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
};

/** The span an event runs for, or null when it never runs (undated, or ended before it began). */
export function eventWindow(e: DatedEvent): SeatInterval | null {
  const start = parse(e.startDate);
  if (start == null) return null;
  let end = parse(e.endDate) ?? Infinity;
  const forced = parse(e.forceEndedAt);
  if (forced != null) end = Math.min(end, forced);
  return end > start ? { start, end } : null;
}

/** `w` cut to begin no earlier than `from`; null when nothing is left. */
export function clipInterval(w: SeatInterval, from: number): SeatInterval | null {
  const start = Math.max(w.start, from);
  return w.end > start ? { start, end: w.end } : null;
}

/** The parts of `after` that `before` did not cover (0, 1 or 2 spans). */
export function newlyCovered(after: SeatInterval | null, before: SeatInterval | null): SeatInterval[] {
  if (!after) return [];
  if (!before || before.end <= after.start || before.start >= after.end) return [after];
  const out: SeatInterval[] = [];
  if (after.start < before.start) out.push({ start: after.start, end: before.start });
  if (after.end > before.end) out.push({ start: before.end, end: after.end });
  return out;
}

const contains = (w: SeatInterval, t: number) => w.start <= t && t < w.end;

export interface Peak {
  /** The most seats live at one moment (0 when nothing is). */
  peak: number;
  /** When that peak begins (ms), or null when nothing is live in the range looked at. */
  at: number | null;
  /** The events live at that moment, biggest first. */
  ids: number[];
}

/**
 * The most seats live at once across these windows. Optionally only inside `within` (any of these
 * spans) and only from `from` on.
 *
 * A sweep over every boundary: between two consecutive boundaries nothing starts or ends, so the
 * total is constant there and the segment's first instant stands for all of it. A window that is
 * empty or holds no seats changes nothing.
 */
export function peakConcurrentSeats(
  windows: readonly SeatWindow[],
  opts: { within?: readonly SeatInterval[]; from?: number } = {},
): Peak {
  const from = opts.from ?? -Infinity;
  const ranges = (opts.within ?? [{ start: -Infinity, end: Infinity }])
    .map((r) => clipInterval(r, from))
    .filter((r): r is SeatInterval => r != null);
  const live = windows.filter((w) => w.end > w.start && w.seats > 0);
  if (ranges.length === 0) return { peak: 0, at: null, ids: [] };

  const points = new Set<number>();
  for (const r of ranges) points.add(r.start);
  for (const w of live) {
    points.add(w.start);
    points.add(w.end);
  }
  let best: Peak = { peak: 0, at: null, ids: [] };
  for (const t of [...points].sort((a, b) => a - b)) {
    if (!Number.isFinite(t) && t > 0) continue; // +Infinity is only ever an end
    if (!ranges.some((r) => contains(r, t))) continue;
    const here = live.filter((w) => contains(w, t));
    const total = here.reduce((n, w) => n + w.seats, 0);
    if (total > best.peak) {
      best = { peak: total, at: t, ids: [...here].sort((a, b) => b.seats - a.seats || a.id - b.id).map((w) => w.id) };
    }
  }
  return best;
}

export type SeatVerdict =
  | { ok: true; peak: number }
  /** `total` = the peak with the change in it; `at` = when; `others` = the other events live then. */
  | { ok: false; peak: number; total: number; at: number | null; others: number[] };

/**
 * May `adding` more seats go on one event (`target`) under a cap of `cap` seats at once?
 *
 * Refused when, at any moment of the target's window (from `from` on), the seats live then plus
 * `adding` would pass the cap. An undated (or already-ended) target overlaps nothing, so only its own
 * seats count. `adding` ≤ 0 (an edit, a swap) and a null cap are never refused, and a host already
 * over the cap keeps everyone — only new seats are turned away.
 */
export function roomVerdict(opts: {
  cap: number | null;
  target: { id: number; window: SeatInterval | null; seats: number };
  /** The host's other events (the target, if listed, is ignored). */
  others: readonly SeatWindow[];
  adding: number;
  from?: number;
}): SeatVerdict {
  const { target, adding, cap } = opts;
  const others = opts.others.filter((w) => w.id !== target.id);
  const windows = target.window ? [...others, { id: target.id, ...target.window, seats: target.seats }] : others;
  const sweep = target.window
    ? peakConcurrentSeats(windows, { within: [target.window], from: opts.from })
    : { peak: 0, at: null, ids: [] as number[] };
  // The target's own seats always count, even where its window is past or absent.
  const peak = Math.max(sweep.peak, target.seats);
  if (cap == null || adding <= 0 || peak + adding <= cap) return { ok: true, peak };
  const atPeak = sweep.peak >= target.seats ? sweep : { peak: target.seats, at: null, ids: [target.id] };
  return { ok: false, peak, total: peak + adding, at: atPeak.at, others: atPeak.ids.filter((id) => id !== target.id) };
}

/**
 * May an event holding `seats` move from window `before` to `after` (new dates, Start now, resume,
 * an extended end) under a cap of `cap` seats at once?
 *
 * Only the time the event did NOT cover before is checked: where it was already running nothing
 * changes, so shortening an event, ending it, or moving it away from the others is always allowed —
 * and a host over the cap after a downgrade can still tidy their dates. Refused when, somewhere in the
 * newly covered time (from `from` on), the others live then plus this event's seats pass the cap.
 */
export function windowChangeVerdict(opts: {
  cap: number | null;
  eventId: number;
  seats: number;
  before: SeatInterval | null;
  after: SeatInterval | null;
  others: readonly SeatWindow[];
  from?: number;
}): SeatVerdict {
  const others = opts.others.filter((w) => w.id !== opts.eventId);
  const fresh = newlyCovered(opts.after, opts.before);
  if (opts.cap == null || opts.seats <= 0 || fresh.length === 0 || !opts.after) return { ok: true, peak: 0 };
  const withMe = [...others, { id: opts.eventId, ...opts.after, seats: opts.seats }];
  const sweep = peakConcurrentSeats(withMe, { within: fresh, from: opts.from });
  if (sweep.peak <= opts.cap) return { ok: true, peak: sweep.peak };
  return { ok: false, peak: sweep.peak, total: sweep.peak, at: sweep.at, others: sweep.ids.filter((id) => id !== opts.eventId) };
}
