import type { HiscoresSnapshot } from '@/lib/hiscores';
import { isActivityKey, readActivityScore } from '@/lib/hiscoresActivities';
import { parseStamp } from '@/lib/dbTime';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// The single definition of a hiscores-backed stat gain, shared by every consumer: the unified stat
// sweep (cron/stats), the gains API, admin stat standings, the plugin config side-panel, and the
// real-time plugin-stats ingest. A gain = max(0, effectiveCurrent − baseline) summed over a tile's
// (possibly composite) keys, where effectiveCurrent = max(hiscores, live-plugin-push). Boss KC reads
// `score` (−1 "unranked" → 0); skill reads `xp`. `statType` is 'skill' | 'boss' | 'kc' ('kc' is an
// accepted alias for a boss the plugin ingest uses). Anything not 'skill' is treated as a boss.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Tracking mode. The tile editor's "Solo" button historically saved the string 'solo', but every
// completion path only ever checked 'individual' — so a "solo" tile silently fell through to the
// team-sum branch (easier than intended, and no per-finisher credit). Both spellings now mean the
// same thing here; new writes normalize to 'individual', and the 0027 data migration flips old rows.
export function isIndividualMode(trackingMode: string | null | undefined): boolean {
  return trackingMode === 'individual' || trackingMode === 'solo';
}

// A single member's frozen contribution to a completed stat tile (their XP/KC gain at completion).
export interface StatContribution {
  playerId: number;
  gained: number;
}

// The frozen "who got what" snapshot stored on completions.statContributions for stat tiles. `goal`
// and `total` are snapshotted too so the display ("512 / 500") stays stable even if the tile's
// statGoal is edited later. `split` holds only positive contributors, sorted biggest-first.
export interface StatContributionSnapshot {
  goal: number;
  total: number;
  split: StatContribution[];
}

// Build the frozen split from each team member's gain at the moment the tile completed. Drops
// zero/negative contributors and sorts descending so the top contributor reads first.
export function buildContributionSnapshot(
  goal: number,
  rows: { playerId: number; gained: number }[],
): StatContributionSnapshot {
  const split = rows
    .filter((r) => r.gained > 0)
    .map((r) => ({ playerId: r.playerId, gained: r.gained }))
    .sort((a, b) => b.gained - a.gained);
  const total = split.reduce((sum, r) => sum + r.gained, 0);
  return { goal, total, split };
}

// Parse a stored completions.statContributions blob. Returns null on null/malformed/legacy shape so
// callers fall back to the live gain for that (older) completion.
export function parseContributionSnapshot(
  json: string | null | undefined,
): StatContributionSnapshot | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as StatContributionSnapshot;
    if (!parsed || !Array.isArray(parsed.split)) return null;
    return parsed;
  } catch {
    return null;
  }
}

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
  // Non-boss hiscores entries (GOTR rifts, clue tiers, Bounty Hunter, LMS, Soul Wars, clog slots)
  // live outside the `bosses` map, each at its own path. Checked before the boss lookup because a
  // miss there returns a silent 0 — which is how "close 100 rifts" would look like a tile that
  // simply never progresses. Keys can't collide: activity keys are distinct from every boss key.
  if (isActivityKey(key)) return readActivityScore(snap, key);
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

/**
 * MILESTONE tiles — "get your first Quiver", "your first Inferno cape", "reach 500 Zulrah".
 *
 * A gain tile asks how far you moved during the event. A milestone tile asks whether you CROSSED a
 * lifetime threshold while it was running, which is a different question and needs the baseline as a
 * gate rather than a subtraction:
 *
 *     gain       complete when   current − baseline  >=  goal
 *     milestone  complete when   baseline < goal  AND  current >= goal
 *
 * That gate is the whole feature. Without it, `TzKal-Zuk >= 1` completes instantly for anyone who
 * ever finished the Inferno, which is the opposite of "first". With it, a member who already has the
 * cape is permanently ineligible for that tile and a teammate who hasn't can still win it — so the
 * tile means "someone here goes and does it", which is what a board is for.
 *
 * ALWAYS evaluate this per member. Summing lifetime totals across a team is meaningless: three
 * members at 0, 5 and 200 Zuk KC sum to 205, clearing a goal of 1 the instant the event starts. The
 * callers pass one member at a time and the tile editor hides the Team/Solo control to match.
 *
 * Composite keys sum on both sides, exactly as gains do — a CoX + CoX:CM tile counts a member's
 * lifetime across both, and gates on their combined baseline.
 */
export interface MilestoneState {
  /** Absolute lifetime total across the tile's keys — max(hiscores, live push), unranked floored to 0. */
  lifetime: number;
  /** False once the member was already at or above the goal when the event started. Never recovers. */
  eligible: boolean;
  /** Eligible AND now at or above the goal — the tile may credit. */
  reached: boolean;
}

export function milestoneState(
  baseline: HiscoresSnapshot | null | undefined,
  current: HiscoresSnapshot | null | undefined,
  liveMap: Record<string, number>,
  keys: string[],
  statType: string,
  goal: number,
): MilestoneState {
  let lifetime = 0;
  let baselineTotal = 0;
  for (const key of keys) {
    baselineTotal += snapshotValue(baseline, statType, key);
    lifetime += effectiveValue(snapshotValue(current, statType, key), liveMap, key);
  }
  const eligible = baselineTotal < goal;
  return { lifetime, eligible, reached: eligible && lifetime >= goal };
}

/** Milestone state from stored JSON blobs — the sibling of computeGainFromJson. */
export function milestoneStateFromJson(
  baselineJson: string | null | undefined,
  currentJson: string | null | undefined,
  liveMap: Record<string, number>,
  keys: string[],
  statType: string,
  goal: number,
): MilestoneState {
  return milestoneState(parseSnapshot(baselineJson), parseSnapshot(currentJson), liveMap, keys, statType, goal);
}

/** True for a tile whose statGoal is a lifetime threshold rather than an in-event gain. */
export function isMilestoneBasis(statBasis: string | null | undefined): boolean {
  return statBasis === 'milestone';
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
 * Bake a member's live plugin overlay into a stored snapshot, raising each overlay key to
 * max(snapshot, overlay). Used when FREEZING (subbing out) a player so their locked `frozenStats`
 * captures the effective current (hiscores ∪ un-synced live pushes), not just the last 15-min
 * hiscores sweep — otherwise subbing out a member mid-grind silently drops the overlay portion of
 * their gain, and the team total falls the instant they're benched. Merges into `cachedJson` for
 * structure + latest values, falling back to `baselineJson` when the player was never hiscores-
 * fetched (so we still know skill-vs-boss per key; a key absent from both is skipped, unclassifiable).
 * Returns a JSON string to store, or null if neither snapshot exists (gain then stays 0).
 */
export function effectiveSnapshotJson(
  cachedJson: string | null | undefined,
  baselineJson: string | null | undefined,
  liveMap: Record<string, number>,
): string | null {
  const snap = parseSnapshot(cachedJson) ?? parseSnapshot(baselineJson);
  if (!snap) return null;
  const skills = { ...(snap.skills ?? {}) };
  const bosses = { ...(snap.bosses ?? {}) };
  for (const [key, raw] of Object.entries(liveMap)) {
    const v = typeof raw === 'number' ? raw : 0;
    if (v <= 0) continue;
    if (skills[key] != null) {
      if ((skills[key].xp ?? 0) < v) skills[key] = { ...skills[key], xp: v };
    } else if (bosses[key] != null) {
      if ((bosses[key].score ?? 0) < v) bosses[key] = { ...bosses[key], score: v };
    }
  }
  return JSON.stringify({ ...snap, skills, bosses });
}

/**
 * The stat-tile baseline that keeps PRE-EVENT gains out.
 *
 * A gain is `effectiveCurrent − baseline`, so the baseline is the start line: it MUST be the player's
 * stats at (or after) the event's start, and it must already absorb any session in progress at that
 * moment. Two things break that on their own:
 *
 *   1. A baseline captured BEFORE the event started — an admin pulling stats early, or a start moved
 *      forward — is trusted forever otherwise, and every gain since counts. So a baseline whose
 *      `snapshotAt` predates `startDate` is treated as absent and RE-CAPTURED on the first active
 *      tick, re-anchoring it at >= start. (`parseStamp` reads either stored time format; a null
 *      `snapshotAt` alongside a present snapshot is unknown-timing → recapture to be safe.)
 *
 *   2. Hiscores only flush on logout, so a player mid-session at the start has a stale hiscores
 *      baseline while the live overlay already shows the session. Folding the overlay INTO the
 *      baseline at capture (via effectiveSnapshotJson) bakes the pre-start portion in, so the gain
 *      starts at 0. Residual: a plugin that hasn't pushed by the capture tick — the opt-in starting
 *      shot's forced relog (lib/startProof) covers that, because hiscores lag is a client-trust
 *      problem the server can't settle alone.
 *
 * With no `startDate` there is nothing to anchor to, so only the absent-baseline case recaptures.
 */
export function needsBaselineRecapture(
  statsSnapshot: string | null | undefined,
  snapshotAt: string | null | undefined,
  eventStartDate: string | null | undefined,
): boolean {
  if (!statsSnapshot) return true;
  const startMs = parseStamp(eventStartDate);
  if (startMs == null) return false;
  const baseMs = parseStamp(snapshotAt);
  return baseMs == null || baseMs < startMs;
}

/** The baseline to persist at capture: the fetched hiscores with the live overlay folded in (case 2
 * above). Falls back to the raw snapshot JSON if there is nothing to parse. */
export function baselineWithOverlay(snapshotJson: string, liveMap: Record<string, number>): string {
  return effectiveSnapshotJson(snapshotJson, snapshotJson, liveMap) ?? snapshotJson;
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

// OSRS force-logs-out at ~6 hours, so hiscores MUST reflect a player's real XP/KC within that window.
// reconcileLive only drops overlay entries hiscores has caught up to (h >= v) — an entry sitting ABOVE
// hiscores (a bogus/doubled push) is never pruned and stays stuck forever. This is the backstop: any
// overlay key not refreshed (its value last rose) within maxAgeMs is provably stale — a real session
// would have flushed to hiscores by now — so drop it and fall back to hiscores. `keyTimes` maps key ->
// last-rose ISO (stamped by the plugin ingest on every increase); a missing stamp counts as stale, which
// also heals legacy stuck overlays written before per-key stamping. Legit in-flight gains are unaffected:
// a plateaued legit value is caught by reconcileLive (h >= v) within a sweep or two, long before 6h.
export function pruneStaleOverlay(
  liveMap: Record<string, number>,
  keyTimes: Record<string, string> | null | undefined,
  nowMs: number,
  maxAgeMs: number,
): { pruned: Record<string, number>; changed: boolean } {
  const pruned: Record<string, number> = {};
  for (const [k, v] of Object.entries(liveMap)) {
    const iso = keyTimes?.[k];
    const at = iso ? Date.parse(iso) : NaN;
    // Keep only entries with a recent (< maxAge) stamp; missing/old stamp → stale, drop it.
    if (Number.isFinite(at) && nowMs - at < maxAgeMs) pruned[k] = v;
  }
  const changed = Object.keys(liveMap).length !== Object.keys(pruned).length;
  return { pruned, changed };
}
