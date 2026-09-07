// Reading one competition metric out of a hiscores snapshot.
//
// PURE — no `@/db`, deliberately, the same split `lib/clanVisibility` is to `lib/clanAccess` and
// `lib/errorFingerprint` is to `lib/errorEvents`. `lib/weekly` re-exports all three names, so no
// call site moved.
//
// It had to come out to be testable. The rule below is a convention of the OSRS hiscores that is
// invisible in the types (`xp` is just a number) and wrong in a way nothing would notice until a
// competition sat at zero — exactly the kind of thing that should be pinned by a test rather than
// by everybody downstream remembering to floor it.

import { computeEhpEhb } from '@/lib/efficiency';
import { EFFICIENCY_SCALE } from '@/lib/constants';
import type { HiscoresSnapshot } from '@/lib/hiscores';
import { log } from '@/lib/logger';

/** What a weekly competition ranks by. 'efficiency' pairs with metric 'ehp' | 'ehb'. */
export type CompetitionType = 'skill' | 'boss' | 'efficiency';

export type FetchResult =
  | { kind: 'value'; value: number; snapshot: HiscoresSnapshot }
  | { kind: 'unranked' }            // 404 from hiscores OR validator rejected the RSN string outright
  | { kind: 'transient' };          // network / timeout / parse error — try again later

/**
 * Extract a single competition metric out of an already-fetched hiscores snapshot. Split from the
 * fetch so the unified stat sweep — which fetches each member's snapshot ONCE for both bingo tiles
 * and every weekly metric — can reuse it without a second network call.
 *
 * TWO DIFFERENT KINDS OF ABSENCE, and telling them apart is the whole job:
 *
 *   the key is MISSING   our parser does not know this skill or boss at all. Nothing can be
 *                        concluded, so no value and no baseline is written — the competition waits
 *                        rather than freezing at a number we invented.
 *   the value is -1      the player IS on the hiscores and is unranked for this one thing. That is
 *                        a real answer meaning "none", and it floors to 0.
 *
 * Reading -1 as a value is the failure this guards. It is the hiscores' own convention for unranked
 * and it is just a number, so it passes every type check and lands in the database as if it were an
 * XP total — where it becomes a frozen baseline of -1 and quietly adds one to every gain measured
 * against it.
 */
export function readMetricFromSnapshot(
  snapshot: HiscoresSnapshot,
  type: CompetitionType,
  metric: string,
): FetchResult {
  // Efficiency comps read a DERIVED value: the whole snapshot condensed to hours by our own engine
  // (lib/efficiency.ts), not a single field. Stored in milli-hours so the integer columns and the
  // atomic-MAX update keep working — see EFFICIENCY_SCALE.
  if (type === 'efficiency') {
    if (!snapshot.skills || !snapshot.bosses) return { kind: 'transient' };
    const { ehp, ehb } = computeEhpEhb(snapshot);
    const hours = metric === 'ehb' ? ehb : ehp;
    if (!Number.isFinite(hours)) return { kind: 'transient' };
    return { kind: 'value', value: Math.round(hours * EFFICIENCY_SCALE), snapshot };
  }

  if (type === 'skill') {
    const skill = snapshot.skills?.[metric];
    // Unknown to the parser. Same reasoning as the boss branch below, and it is not hypothetical for
    // skills either: Sailing was a metric an admin could pick before anything downstream had heard
    // of it. Warn, because "the competition is stuck" and "we cannot read this metric" are the same
    // incident and only one of them is visible from outside.
    if (!skill || typeof skill.xp !== 'number') {
      log.warn('weekly.metric-unknown', { type, metric });
      return { kind: 'transient' };
    }
    // Unranked in this skill. A real "no XP", not a failed read — the same floor
    // `lib/statTracking.effectiveValue` applies, so the two engines agree about what -1 means.
    if (skill.xp < 0) return { kind: 'value', value: 0, snapshot };
    return { kind: 'value', value: skill.xp, snapshot };
  }

  const boss = snapshot.bosses?.[metric];
  // A missing key means our parser doesn't know this boss AT ALL (hiscores lists every
  // activity for a ranked player, unranked ones with score -1) — writing 0 here is what
  // froze whole competitions at baseline 0 when Maggot King predated the parser's boss
  // list. Treat it as a failed read so no value (and no baseline) is ever written.
  if (!boss) {
    log.warn('weekly.metric-unknown', { type, metric });
    return { kind: 'transient' };
  }
  // boss.score < 0 means the player is on hiscores but unranked for this boss — that's
  // a real "0 KC" value, not a fetch failure.
  if (boss.score < 0) return { kind: 'value', value: 0, snapshot };
  return { kind: 'value', value: boss.score, snapshot };
}
