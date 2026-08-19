// Adaptive polling + the daily history the profile pages read.
//
// Two jobs, kept together because they're two halves of one idea: learn as much as possible from each
// hiscores fetch, and then don't make the next one until it can tell us something new.
//
// WHY IT MATTERS AT SCALE. Every clan container polls Jagex from the same box IP, so a per-clan rate
// limit composes into a per-box one: 2.5 req/s looks safe until the fiftieth clan makes it 125. The
// sweep used to poll every participating member every tick regardless of whether they'd played — a
// 200-member clan spending ~19,000 requests a day to discover that 160 people were offline. Backing
// idle members off to a two-hour interval cuts that by roughly 80% without making an active player
// any less live, because any plugin push (which means they're online right now) snaps them back.
//
// The history side adds ZERO requests: it's computed from the snapshot the sweep already holds.

import { db } from '@/db';
import { memberDailyStats, memberMilestones } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import type { HiscoresSnapshot } from '@/lib/hiscores';
import { computeEhpEhb } from '@/lib/efficiency';
import { EFFICIENCY_SCALE } from '@/lib/constants';

// ── Adaptive polling ─────────────────────────────────────────────────────────────────────────────

const MINUTE = 60_000;

/**
 * How long until this member is worth fetching again, given how many consecutive fetches found
 * nothing new. Capped at two hours on purpose: everyone in the sweep's queue is enrolled in
 * something, so the cost of being late is a leaderboard that lags. A plugin push resets the streak,
 * so members running the plugin never sit on this ladder while they're playing.
 */
export function nextDueAfterMiss(missStreak: number): number {
  if (missStreak <= 0) return 0;          // just gained something — keep them hot
  if (missStreak === 1) return 30 * MINUTE;
  if (missStreak === 2) return 60 * MINUTE;
  return 120 * MINUTE;
}

/** ISO timestamp for the member's next eligible fetch, or null for "due now". */
export function nextDueAt(missStreak: number, from: Date = new Date()): string | null {
  const ms = nextDueAfterMiss(missStreak);
  return ms === 0 ? null : new Date(from.getTime() + ms).toISOString();
}

/** Whether a member is eligible this tick. Missing/!parseable due date means due. */
export function isDue(nextDueAtIso: string | null | undefined, now: Date = new Date()): boolean {
  if (!nextDueAtIso) return true;
  const due = Date.parse(nextDueAtIso);
  return Number.isNaN(due) || due <= now.getTime();
}

// ── Daily history ────────────────────────────────────────────────────────────────────────────────

/** UTC calendar day key. UTC because every other date in the app is, and a clan spans time zones. */
export function dayKey(when: Date | string = new Date()): string {
  const d = typeof when === 'string' ? new Date(when) : when;
  return (Number.isNaN(d.getTime()) ? new Date() : d).toISOString().slice(0, 10);
}

export interface StatDeltas {
  skills?: Record<string, number>;
  bosses?: Record<string, number>;
}

/**
 * What moved between two snapshots. Only changed metrics appear — that's the difference between a
 * ~150-byte row and a 3 KB one, repeated for every member every day.
 */
export function computeDeltas(before: HiscoresSnapshot | null, after: HiscoresSnapshot): StatDeltas {
  const deltas: StatDeltas = {};
  for (const [key, entry] of Object.entries(after.skills ?? {})) {
    if (key === 'overall') continue; // the total is stored as a column; repeating it here is noise
    const now = Math.max(0, entry?.xp ?? 0);
    const then = Math.max(0, before?.skills?.[key]?.xp ?? 0);
    if (before && now > then) (deltas.skills ??= {})[key] = now - then;
  }
  for (const [key, entry] of Object.entries(after.bosses ?? {})) {
    const now = Math.max(0, entry?.score ?? 0);
    const then = Math.max(0, before?.bosses?.[key]?.score ?? 0);
    if (before && now > then) (deltas.bosses ??= {})[key] = now - then;
  }
  return deltas;
}

/**
 * Add one tick's deltas onto the day's running ones.
 *
 * WHY THIS EXISTS. A day is many ticks, and each one only reports what moved SINCE THE LAST FETCH.
 * The row's numeric columns accumulate in SQL, but this JSON used to be overwritten every tick, so a
 * day's per-metric detail collapsed to whatever happened in its final 15 minutes. That biased the
 * data against exactly the people it was meant to celebrate: an idle member polled once every two
 * hours had a whole session land in one delta and kept it, while someone playing all evening — polled
 * every tick, because gaining XP resets the backoff — kept only their last slice. Their per-skill
 * totals came out SMALLER than a quieter member's, which is how a competition leader ends up drawn
 * underneath the people he's beating.
 */
export function mergeDeltas(before: StatDeltas | null, add: StatDeltas): StatDeltas {
  const out: StatDeltas = {};
  for (const group of ['skills', 'bosses'] as const) {
    const merged = { ...(before?.[group] ?? {}) };
    for (const [key, value] of Object.entries(add[group] ?? {})) {
      merged[key] = (merged[key] ?? 0) + value;
    }
    if (Object.keys(merged).length > 0) out[group] = merged;
  }
  return out;
}

/** A stored deltas blob, or null if it's missing or corrupt (a bad row must not fail the tick). */
function parseStoredDeltas(raw: string | null | undefined): StatDeltas | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StatDeltas;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export interface DailyRollupInput {
  /** The ACCOUNT this day belongs to. One series per account, not one per clan they play in. */
  accountId: number;
  snapshot: HiscoresSnapshot;
  /** The previous snapshot, for the deltas. Null on a member's first-ever fetch (no gains recorded). */
  previous: HiscoresSnapshot | null;
  now?: Date;
}

export interface DailyRollupResult {
  wrote: boolean;
  day: string;
  xpGained: number;
  ehpMilliGained: number;
  ehbMilliGained: number;
}

/**
 * Fold one snapshot into the member's row for today, creating it if this is their first activity of
 * the day and ADDING to it if they've already been seen. Nothing is written when nothing moved,
 * which is the common case — most members are offline most ticks.
 */
export async function recordDailyStats(input: DailyRollupInput): Promise<DailyRollupResult> {
  const now = input.now ?? new Date();
  const day = dayKey(now);
  const deltas = computeDeltas(input.previous, input.snapshot);

  const overallXp = Math.max(0, input.snapshot.skills?.overall?.xp ?? 0);
  const previousXp = Math.max(0, input.previous?.skills?.overall?.xp ?? 0);
  const xpGained = input.previous ? Math.max(0, overallXp - previousXp) : 0;

  const { ehp, ehb } = computeEhpEhb(input.snapshot);
  const ehpMilli = Math.round(ehp * EFFICIENCY_SCALE);
  const ehbMilli = Math.round(ehb * EFFICIENCY_SCALE);

  let ehpMilliGained = 0;
  let ehbMilliGained = 0;
  if (input.previous) {
    const was = computeEhpEhb(input.previous);
    ehpMilliGained = Math.max(0, ehpMilli - Math.round(was.ehp * EFFICIENCY_SCALE));
    ehbMilliGained = Math.max(0, ehbMilli - Math.round(was.ehb * EFFICIENCY_SCALE));
  }

  const nothingMoved = xpGained === 0 && ehbMilliGained === 0 && ehpMilliGained === 0;
  const hasDeltas = !!(deltas.skills || deltas.bosses);

  // The day's row is read when there's per-metric detail to merge into, and when nothing moved (to
  // decide whether a first row is still owed). An idle tick with no gains reads nothing.
  const existing =
    hasDeltas || nothingMoved
      ? await db.query.memberDailyStats.findFirst({
          where: and(eq(memberDailyStats.accountId, input.accountId), eq(memberDailyStats.day, day)),
          columns: { id: true, deltas: true },
        })
      : null;

  // A member with no row yet still gets one the first time we see them with XP, so the chart has a
  // starting point; after that, an idle tick writes nothing.
  if (nothingMoved && (existing || overallXp === 0)) {
    return { wrote: false, day, xpGained: 0, ehpMilliGained: 0, ehbMilliGained: 0 };
  }

  const deltaJson = hasDeltas
    ? JSON.stringify(mergeDeltas(parseStoredDeltas(existing?.deltas), deltas))
    : null;

  // Totals overwrite (they're absolutes) while gains accumulate across the day's ticks. The numeric
  // gains still add in SQL rather than from the row read above, so two overlapping sweeps can't lose
  // one — the merged JSON is the only part that reads first, and losing a merge there is no worse
  // than the unconditional overwrite it replaced.
  await db
    .insert(memberDailyStats)
    .values({
      accountId: input.accountId,
      day,
      overallXp,
      ehpMilli,
      ehbMilli,
      xpGained,
      ehpMilliGained,
      ehbMilliGained,
      deltas: deltaJson,
      updatedAt: now.toISOString(),
    })
    .onConflictDoUpdate({
      target: [memberDailyStats.accountId, memberDailyStats.day],
      set: {
        overallXp,
        ehpMilli,
        ehbMilli,
        xpGained: sql`${memberDailyStats.xpGained} + ${xpGained}`,
        ehpMilliGained: sql`${memberDailyStats.ehpMilliGained} + ${ehpMilliGained}`,
        ehbMilliGained: sql`${memberDailyStats.ehbMilliGained} + ${ehbMilliGained}`,
        // Merging two delta objects in SQL isn't worth a JSON1 dependency; the latest window is the
        // one worth keeping detail for, and the day's totals are already exact in the columns above.
        deltas: deltaJson ?? sql`${memberDailyStats.deltas}`,
        updatedAt: now.toISOString(),
      },
    });

  return { wrote: true, day, xpGained, ehpMilliGained, ehbMilliGained };
}

// ── Milestones ───────────────────────────────────────────────────────────────────────────────────

const XP_THRESHOLDS = [10_000_000, 25_000_000, 50_000_000, 100_000_000, 150_000_000, 200_000_000];
const KC_THRESHOLDS = [100, 500, 1_000, 2_500, 5_000, 10_000, 25_000];
/** Efficient hours, whole numbers — every 100 up to a point where they stop being remarkable. */
const EFFICIENCY_THRESHOLDS = [100, 250, 500, 1_000, 2_000, 5_000];

export interface Milestone {
  kind: 'level' | 'xp' | 'kc' | 'ehp' | 'ehb';
  metric: string | null;
  threshold: number;
}

const crossed = (thresholds: number[], before: number, after: number): number[] =>
  thresholds.filter((t) => before < t && after >= t);

/**
 * Which thresholds this member crossed between two snapshots. Only metrics that actually moved are
 * examined, so an ordinary tick does almost no work — and a member's first-ever snapshot produces
 * nothing, because we'd otherwise announce a decade of someone else's achievements on the day they
 * joined.
 */
export function detectMilestones(
  before: HiscoresSnapshot | null,
  after: HiscoresSnapshot,
  deltas: StatDeltas,
): Milestone[] {
  if (!before) return [];
  const found: Milestone[] = [];

  for (const skill of Object.keys(deltas.skills ?? {})) {
    const wasXp = Math.max(0, before.skills?.[skill]?.xp ?? 0);
    const nowXp = Math.max(0, after.skills?.[skill]?.xp ?? 0);
    for (const threshold of crossed(XP_THRESHOLDS, wasXp, nowXp)) {
      found.push({ kind: 'xp', metric: skill, threshold });
    }
    const wasLevel = before.skills?.[skill]?.level ?? 0;
    const nowLevel = after.skills?.[skill]?.level ?? 0;
    if (wasLevel < 99 && nowLevel >= 99) found.push({ kind: 'level', metric: skill, threshold: 99 });
  }

  for (const boss of Object.keys(deltas.bosses ?? {})) {
    const wasKc = Math.max(0, before.bosses?.[boss]?.score ?? 0);
    const nowKc = Math.max(0, after.bosses?.[boss]?.score ?? 0);
    for (const threshold of crossed(KC_THRESHOLDS, wasKc, nowKc)) {
      found.push({ kind: 'kc', metric: boss, threshold });
    }
  }

  const was = computeEhpEhb(before);
  const now = computeEhpEhb(after);
  for (const threshold of crossed(EFFICIENCY_THRESHOLDS, was.ehp, now.ehp)) {
    found.push({ kind: 'ehp', metric: null, threshold });
  }
  for (const threshold of crossed(EFFICIENCY_THRESHOLDS, was.ehb, now.ehb)) {
    found.push({ kind: 'ehb', metric: null, threshold });
  }

  return found;
}

/** Insert newly crossed milestones. The unique index makes a re-detection a no-op, not a duplicate. */
export async function recordMilestones(accountId: number, milestones: Milestone[]): Promise<number> {
  if (milestones.length === 0) return 0;
  const rows = milestones.map((m) => ({
    accountId,
    kind: m.kind,
    metric: m.metric,
    threshold: m.threshold,
    noticedAt: new Date().toISOString(),
  }));
  await db.insert(memberMilestones).values(rows).onConflictDoNothing();
  return rows.length;
}
