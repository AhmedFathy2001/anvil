import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts } from '@/db/schema';
import type { HiscoresSnapshot } from '@/lib/hiscores';
import { isActivityKey } from '@/lib/hiscoresActivities';
import { overlaySnapshot } from '@/lib/liveHistory';
import { parseStatKeyTimes } from '@/lib/liveStats';
import { log } from '@/lib/logger';
import { bossKeyForName, parsePluginStats, skillKeyForName } from '@/lib/pluginStats';
import { statSnapshotOf, updateAccount } from '@/lib/roster';
import { computeDeltas, detectMilestones, recordDailyStats, recordMilestones } from '@/lib/statHistory';

// The ACCOUNT half of a plugin stat push: fold the values into the account's live overlay and write
// the history they imply. Shared by the clan path (which then credits bingo and weekly off the seat)
// and the account-only path a person with no clan takes — their stats are theirs either way.

// Absolute sanity ceilings — reject obviously bogus pushes. No legit boss KC / skill XP approaches these.
const MAX_KC = 1_000_000;
const MAX_XP = 200_000_000;
// Activity counters (clue tiers, Soul Wars zeal, Colosseum glory, collection-log slots) are all
// small next to boss KC — the largest real value is a five-figure clue count — so MAX_KC is a
// generous ceiling that still rejects a garbage varbit read.
const MAX_ACTIVITY = MAX_KC;

// How long a per-key "rose just now" stamp is retained. Must outlast the stats sweep's stale-overlay
// window (~6h, the OSRS logout backstop) so that check can tell a still-active grind from a stuck push;
// "Active now" reads its own 5-min window and is unaffected by the longer retention. 7h > 6.5h sweep
// threshold so a legit entry's stamp is still present when the sweep decides whether to keep it.
const KEY_TIME_TTL_MS = 7 * 60 * 60_000;

export interface PushBody {
  stats?: Array<{ name?: string; kc?: number }>;
  skills?: Array<{ name?: string; xp?: number }>;
  activities?: Array<{ key?: string; value?: number }>;
}

/** True when the body carries nothing at all — logged by the caller, since silence looks like a bug. */
export function isEmptyPush(body: PushBody): boolean {
  return (
    !(Array.isArray(body?.stats) && body.stats.length) &&
    !(Array.isArray(body?.skills) && body.skills.length) &&
    !(Array.isArray(body?.activities) && body.activities.length)
  );
}

/**
 * Map each pushed in-game name -> hiscores/skill key, keeping the max absolute value per key. Boss
 * KC and skill XP share the flat live_stats map (boss keys and skill names never collide).
 */
export function readPushed(body: PushBody): Record<string, number> {
  const pushed: Record<string, number> = {};
  for (const s of Array.isArray(body?.stats) ? body.stats : []) {
    if (!s || typeof s.name !== 'string' || typeof s.kc !== 'number') continue;
    if (!Number.isFinite(s.kc) || s.kc < 0 || s.kc > MAX_KC) continue;
    const key = bossKeyForName(s.name);
    if (!key) continue;
    pushed[key] = Math.max(pushed[key] ?? 0, Math.floor(s.kc));
  }
  for (const s of Array.isArray(body?.skills) ? body.skills : []) {
    if (!s || typeof s.name !== 'string' || typeof s.xp !== 'number') continue;
    if (!Number.isFinite(s.xp) || s.xp < 0 || s.xp > MAX_XP) continue;
    const key = skillKeyForName(s.name);
    if (!key) continue;
    pushed[key] = Math.max(pushed[key] ?? 0, Math.floor(s.xp));
  }
  // Activities arrive already keyed — the plugin reads them from named varbits, so it knows exactly
  // which counter it holds and there's no in-game name to map. Unknown keys are dropped rather than
  // stored: live_stats is read by key, so a typo'd entry would sit there forever matching nothing.
  for (const a of Array.isArray(body?.activities) ? body.activities : []) {
    if (!a || typeof a.key !== 'string' || typeof a.value !== 'number') continue;
    if (!Number.isFinite(a.value) || a.value < 0 || a.value > MAX_ACTIVITY) continue;
    if (!isActivityKey(a.key)) continue;
    const key = a.key.trim();
    pushed[key] = Math.max(pushed[key] ?? 0, Math.floor(a.value));
  }
  return pushed;
}

/**
 * Merge `pushed` into the account's overlay (max per key, only ever rising) and record the history
 * that implies. Returns the merged overlay (what weekly credit reads) and whether anything rose.
 *
 * Does NOT touch the sweep's schedule. A push used to null statsNextDueAt so the next tick fetched
 * the account, which spent Jagex budget re-reading what the client had just sent. Plugin-first: while
 * pushes keep coming the sweep only reconciles every few hours, and polls once as soon as they stop
 * (lib/pollLadder sweepDue, keyed on liveStatsAt).
 */
export async function applyAccountPush(
  accountId: number,
  pushed: Record<string, number>,
  nowIso: string,
): Promise<{ live: Record<string, number>; changed: boolean }> {
  // clan-scope: global -- an OSRS account is one account however many clans roster it.
  const row = await db.query.accounts.findFirst({
    where: eq(accounts.id, accountId),
    columns: { liveStats: true, liveStatKeyTimes: true },
  });
  const before = parsePluginStats(row?.liveStats);
  const live = { ...before };
  const keyTimes = parseStatKeyTimes(row?.liveStatKeyTimes);
  let changed = false;
  for (const [key, val] of Object.entries(pushed)) {
    if (val > (live[key] ?? 0)) {
      live[key] = val;
      // Stamp per-key recency ONLY on a real increase — this is the "grinding THIS stat right now"
      // signal "Active now" reads, so one fishing push no longer lights up every tile they've touched.
      keyTimes[key] = nowIso;
      changed = true;
    }
  }
  if (!changed) return { live, changed };

  // Drop stale stamps so the map stays small and an old grind doesn't linger as "active".
  const nowMs = Date.parse(nowIso);
  for (const [k, iso] of Object.entries(keyTimes)) {
    const at = Date.parse(iso);
    if (!Number.isFinite(at) || nowMs - at > KEY_TIME_TTL_MS) delete keyTimes[k];
  }
  await updateAccount(accountId, {
    liveStats: JSON.stringify(live),
    liveStatsAt: nowIso,
    liveStatKeyTimes: JSON.stringify(keyTimes),
  });

  await recordPushHistory(accountId, before, live);
  return { live, changed };
}

/**
 * History straight from the push, so a plugin user's day, records and milestones are current to the
 * minute instead of waiting for the next hiscores reconcile. Between EFFECTIVE snapshots (hiscores
 * raised by the overlay) — the same basis the sweep now uses, so the two never count a gain twice
 * (lib/liveHistory). Needs one hiscores reading to sit on; an account never polled has no history
 * yet, and its first poll starts it. Best-effort: history must never cost the push its credit.
 */
async function recordPushHistory(accountId: number, before: Record<string, number>, after: Record<string, number>) {
  try {
    const raw = await statSnapshotOf(accountId);
    if (!raw) return;
    const snapshot = JSON.parse(raw) as HiscoresSnapshot;
    const prevEff = overlaySnapshot(snapshot, before);
    const curEff = overlaySnapshot(snapshot, after);
    await recordDailyStats({ accountId, snapshot: curEff, previous: prevEff });
    const found = detectMilestones(prevEff, curEff, computeDeltas(prevEff, curEff));
    if (found.length > 0) await recordMilestones(accountId, found);
  } catch (e) {
    log.warn('plugin-stats.history-failed', { accountId, error: (e as Error).message });
  }
}
