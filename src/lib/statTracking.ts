import type { HiscoresSnapshot } from '@/lib/hiscores';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// The single definition of a hiscores-backed stat gain, shared by every consumer: the unified stat
// sweep (cron/stats), the gains API, admin stat standings, the plugin config side-panel, and the
// real-time plugin-stats ingest. A gain = max(0, effectiveCurrent − baseline) summed over a tile's
// (possibly composite) keys, where effectiveCurrent = max(hiscores, live-plugin-push). Boss KC reads
// `score` (−1 "unranked" → 0); skill reads `xp`. `statType` is 'skill' | 'boss' | 'kc' ('kc' is an
// accepted alias for a boss the plugin ingest uses). Anything not 'skill' is treated as a boss.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Read one hiscores key's raw value out of a parsed snapshot. Missing / unranked → 0. */
export function snapshotValue(
  snap: HiscoresSnapshot | null | undefined,
  statType: string,
  key: string,
): number {
  if (!snap) return 0;
  if (statType === 'skill') {
    const xp = snap.skills?.[key]?.xp ?? 0;
    return xp < 0 ? 0 : xp;
  }
  const score = snap.bosses?.[key]?.score ?? 0;
  return score < 0 ? 0 : score;
}

function parseSnapshot(json: string | null | undefined): HiscoresSnapshot | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as HiscoresSnapshot;
  } catch {
    return null;
  }
}

/** Same as snapshotValue but from a stored JSON blob string. Returns 0 on null / malformed. */
export function jsonStatValue(json: string | null | undefined, statType: string, key: string): number {
  return snapshotValue(parseSnapshot(json), statType, key);
}

/**
 * Effective current value for one key = max(hiscores, live-pushed). Hiscores −1 (unranked) floors to
 * 0. Generalizes the old boss-only `effectiveKc`: skills never appear in the live map, so this is a
 * harmless no-op for XP when there's no push.
 */
export function effectiveValue(
  hiscoresVal: number,
  liveMap: Record<string, number>,
  key: string,
): number {
  const h = hiscoresVal < 0 ? 0 : hiscoresVal;
  return Math.max(h, liveMap[key] ?? 0);
}

/**
 * A (possibly composite) stat's gain from parsed snapshots. `keys` are the expanded `statKeys` of a
 * tile's / metric's trackedStat; their gains sum (e.g. CoX + CoX:CM count toward one tile).
 */
export function computeGain(
  baseline: HiscoresSnapshot | null | undefined,
  current: HiscoresSnapshot | null | undefined,
  liveMap: Record<string, number>,
  keys: string[],
  statType: string,
): number {
  let gained = 0;
  for (const key of keys) {
    const base = snapshotValue(baseline, statType, key);
    const cur = effectiveValue(snapshotValue(current, statType, key), liveMap, key);
    gained += Math.max(0, cur - base);
  }
  return gained;
}

/** Gain from stored JSON blobs — parse each once, then delegate to computeGain. */
export function computeGainFromJson(
  baselineJson: string | null | undefined,
  currentJson: string | null | undefined,
  liveMap: Record<string, number>,
  keys: string[],
  statType: string,
): number {
  return computeGain(parseSnapshot(baselineJson), parseSnapshot(currentJson), liveMap, keys, statType);
}

/**
 * Reconcile the live overlay against a fresh hiscores read: drop any key hiscores has caught up to
 * (its value now IS the truth), keep only entries still ahead. This is what makes a stale / over-
 * reported push self-heal — the stored live blob shrinks back to nothing once hiscores confirms it.
 * Boss keys and skill names never collide, so a key resolves to at most one of the two. Returns the
 * pruned map (which is ALSO the correct live overlay to use for this tick's gain) plus whether it
 * changed, so callers persist only on a real change.
 */
export function reconcileLive(
  liveMap: Record<string, number>,
  hiscores: HiscoresSnapshot | null | undefined,
): { pruned: Record<string, number>; changed: boolean } {
  const pruned: Record<string, number> = {};
  for (const [k, v] of Object.entries(liveMap)) {
    const xp = hiscores?.skills?.[k]?.xp ?? 0;
    const kc = hiscores?.bosses?.[k]?.score ?? 0;
    const h = Math.max(xp < 0 ? 0 : xp, kc < 0 ? 0 : kc);
    if (h < v) pruned[k] = v;
  }
  const changed =
    Object.keys(liveMap).length !== Object.keys(pruned).length ||
    Object.entries(pruned).some(([k, v]) => liveMap[k] !== v);
  return { pruned, changed };
}
