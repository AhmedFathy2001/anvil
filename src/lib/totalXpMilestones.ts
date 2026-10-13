// Total-XP milestones: every 50M of overall XP by default (a clan or person can pick their own step,
// lib/levelRules), announced to the clan's levels channel.
//
// Pure (no database) so it can be tested on its own; lib/statHistory folds it into detectMilestones.
//
// THRESHOLDS ARE STORED IN MILLIONS. member_milestones.threshold is int4 (max ~2.1B) and a maxed
// account holds ~4.6B overall XP, so a raw 2,050,000,000 would overflow the column. Kind 'totalxp'
// with threshold 2050 means 2,050M. Per-skill 'xp' rows stay in raw XP — a skill caps at 200M.

import type { HiscoresSnapshot } from '@/lib/hiscores';

export const TOTAL_XP_STEP_MILLIONS = 50;

/** Overall XP off a snapshot; 0 when it is missing or unranked (-1), which detection treats as unknown. */
export function totalXpOf(snapshot: HiscoresSnapshot | null | undefined): number {
  const xp = snapshot?.skills?.overall?.xp;
  return typeof xp === 'number' && Number.isFinite(xp) && xp > 0 ? xp : 0;
}

/**
 * The steps (default 50M) crossed going from `before` to `after`, in millions. Detection asks at the
 * fine grain (lib/levelRules TOTAL_XP_GRAIN_M) so a clan's custom step can be honoured; recording
 * then keeps only the usual 50M ladder plus whatever a destination of the account asked for. An unknown `before` crosses
 * nothing: an unranked-overall snapshot reads 0, and treating that as a real 0 would announce every
 * step of a 2B account the first time its overall showed up.
 */
export function crossedTotalXpMillions(before: number, after: number, stepMillions = TOTAL_XP_STEP_MILLIONS): number[] {
  if (before <= 0 || after <= before || stepMillions <= 0) return [];
  const step = stepMillions * 1_000_000;
  const out: number[] = [];
  for (let t = (Math.floor(before / step) + 1) * step; t <= after; t += step) {
    out.push(t / 1_000_000);
  }
  return out;
}

/** 50 → "50M", 1050 → "1.05B", 2000 → "2B". */
export function totalXpLabel(millions: number): string {
  if (millions < 1000) return `${millions.toLocaleString('en-US')}M`;
  return `${+(millions / 1000).toFixed(2)}B`;
}
