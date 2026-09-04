import type { MissionDaily } from '@/lib/eventRules';
import {
  addLocalDays,
  dayKeyFields,
  formatHhMm,
  localDayKey,
  parseHhMm,
  zonedTimeToUtcMs,
} from '@/lib/zonedTime';

// When a daily mission schedule actually fires.
//
// The ask this exists for: "one a day around when the clan is on, two on weekends." Every mode we
// had could only approximate it — an interval in minutes drifts off the hour and knows nothing about
// Saturday, and a per-tile time means hand-stamping sixty dates for a month. So a schedule says the
// two things a clan actually knows: what time of day people are around, and how many drops each day
// of the week gets.
//
// Two ways to name the time, because clans mean different things by it:
//   fixed times  — 20:00 sharp. Predictable; people can plan to be there.
//   a window     — somewhere between 18:00 and 23:00. Nobody can camp the drop, which is the point
//                  when the prize is first-come.
//
// A window is rolled DETERMINISTICALLY from (event, local day, slot index), so the answer is stable
// across every tick of every minute: the cron asks "what should today look like?" and gets the same
// day back each time, without a table of pre-rolled times to keep in sync. The day is also carved
// into one sub-range per drop, so two drops never land within a minute of each other and the second
// is always after the first.

/** How many drops a schedule may fire in one day. A guard on config, not a design limit. */
export const MAX_DAILY_DROPS = 12;

/** The local times a day's drops fire at, as minutes past local midnight, ascending. */
export function slotMinutesForDay(cfg: MissionDaily, dayKey: string, seed: number): number[] {
  const { weekday } = dayKeyFields(dayKey);
  const count = Math.max(0, Math.min(MAX_DAILY_DROPS, cfg.perDay[weekday] ?? 0));
  if (count === 0) return [];

  const fixed = cfg.times.map(parseHhMm).filter((m): m is number => m != null).sort((a, b) => a - b);
  if (!cfg.window) {
    // Fixed times: take the first `count` of them. Fewer times than drops means fewer drops — the
    // host listed the hours they meant, and inventing an extra one is not our call.
    return fixed.slice(0, count);
  }

  const from = parseHhMm(cfg.window.from) ?? 0;
  const to = parseHhMm(cfg.window.to) ?? 24 * 60 - 1;
  // A window that wraps midnight (22:00 → 02:00) is read as running INTO the next day, so the span
  // is measured forward and the minutes can exceed 1440 — the caller converts them from the day's
  // own midnight, which lands them on the following morning, exactly as written.
  const span = to >= from ? to - from : 1440 - from + to;
  if (span <= 0) return Array.from({ length: count }, () => from);

  const step = span / count;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const start = from + i * step;
    // Keep a minute of clearance at the end of each sub-range so consecutive drops can't collide.
    const jitter = rollFraction(`${seed}:${dayKey}:${i}`) * Math.max(0, step - 1);
    out.push(Math.round(start + jitter));
  }
  return out;
}

/** The instants a day's drops fire at, in UTC ms, ascending. */
export function slotsForDay(cfg: MissionDaily, dayKey: string, seed: number): number[] {
  const f = dayKeyFields(dayKey);
  return slotMinutesForDay(cfg, dayKey, seed).map((minutes) =>
    zonedTimeToUtcMs(
      { year: f.year, month: f.month, day: f.day, hour: Math.floor(minutes / 60), minute: minutes % 60 },
      cfg.timezone,
    ),
  );
}

/** Human-readable local times for a day, for the admin preview ("today: 19:42, 22:10"). */
export function slotLabelsForDay(cfg: MissionDaily, dayKey: string, seed: number): string[] {
  return slotMinutesForDay(cfg, dayKey, seed).map(formatHhMm);
}

/**
 * How many drops the schedule says should ALREADY have happened today.
 *
 * Deliberately a count of today's own slots rather than a running total: paired with how many
 * missions were actually announced today, it makes the engine self-healing (a tick missed at 20:00
 * fires at 20:01) without ever catching up on a day that has passed. Nobody wants Monday's missed
 * mission landing on Wednesday.
 */
export function dueSlotCount(args: {
  cfg: MissionDaily;
  nowMs: number;
  /** Event start — slots before it never come due, so a mid-day start doesn't fire the morning. */
  startMs: number | null;
  seed: number;
}): number {
  const { cfg, nowMs, startMs, seed } = args;
  const dayKey = localDayKey(nowMs, cfg.timezone);
  return slotsForDay(cfg, dayKey, seed).filter((at) => at <= nowMs && (startMs == null || at >= startMs)).length;
}

/**
 * The next drop after `nowMs`, or null when the schedule never fires again in the next week (every
 * weekday set to zero drops — a schedule that is off rather than late).
 */
export function nextSlotAfter(args: { cfg: MissionDaily; nowMs: number; seed: number }): number | null {
  const { cfg, nowMs, seed } = args;
  let dayKey = localDayKey(nowMs, cfg.timezone);
  // 8 days: a full week of weekday patterns, plus the current partial day.
  for (let i = 0; i < 8; i++) {
    const next = slotsForDay(cfg, dayKey, seed).find((at) => at > nowMs);
    if (next != null) return next;
    dayKey = addLocalDays(dayKey, 1);
  }
  return null;
}

/**
 * A stable fraction in [0, 1) from a string. FNV-1a — not for anything that needs to be
 * unguessable, only for a roll that must come out the same on every tick of the same minute.
 */
function rollFraction(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 100000) / 100000;
}
