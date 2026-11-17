// The XP check's running attempt, as the person sees it when they come back to it.
//
// The attempt is a `verification_attempts` row (start route): its start, its 30-minute expiry and
// the skill picked for it are all stored, so leaving the page loses nothing: only the polling is on
// the page, and the page resumes it. Pure (no `@/` imports): tests/xp-check.test.ts.

import { parseStamp } from './dbTime.ts';

export interface AttemptRow {
  id: number;
  rsn: string;
  expiresAt: string;
  completedAt: string | null;
  minDelta: number;
  /** JSON; the picked skill rides in `_target`. */
  baselineSnapshot: string;
}

export interface PendingXpCheck {
  attemptId: number;
  rsn: string;
  expiresAt: string;
  minDelta: number;
  targetSkill: string;
  /** Whole minutes left, rounded up, at least 1. */
  minutesLeft: number;
}

/** The newest attempt that is still open and unexpired, or null. */
export function pendingXpCheck(rows: AttemptRow[], now: number): PendingXpCheck | null {
  const open = rows
    .filter((r) => !r.completedAt && (parseStamp(r.expiresAt) ?? 0) > now)
    .sort((a, b) => b.id - a.id)[0];
  if (!open) return null;
  let target = '';
  try {
    const t = (JSON.parse(open.baselineSnapshot) as { _target?: unknown })._target;
    if (typeof t === 'string') target = t;
  } catch {
    /* an unreadable baseline still leaves a running timer worth showing */
  }
  const ms = (parseStamp(open.expiresAt) ?? now) - now;
  return {
    attemptId: open.id,
    rsn: open.rsn,
    expiresAt: open.expiresAt,
    minDelta: open.minDelta,
    targetSkill: target,
    minutesLeft: Math.max(1, Math.ceil(ms / 60_000)),
  };
}

/** "Your XP check for Zezima is running: 12 min left." */
export function xpCheckLine(p: Pick<PendingXpCheck, 'rsn' | 'minutesLeft'>): string {
  return `Your XP check for ${p.rsn} is running: ${p.minutesLeft} min left.`;
}
