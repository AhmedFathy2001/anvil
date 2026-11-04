import { SKILLS } from '@/lib/constants';
import { computeGainFromJson, type MilestoneState } from '@/lib/statTracking';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// KC / XP from a GAME-MODE world (Leagues, Deadman, hardcore, … — lib/worldModes) on a board that
// counts that mode (rules.worldModes).
//
// A mode world is a separate save, so its numbers can never go where the main game's live: not the
// account's live overlay (read by weekly SOTW/BOTW, the profile and every other board), not stat
// history, not the hiscores snapshots. They're kept on the BOARD ROW instead —
// event_participants.mode_stats, written only for boards that opted in — as, per mode,
//
//   { "hardcore": { "first": { "zulrah": 3 }, "cur": { "zulrah": 9 } } }
//
// `first` is the first reading that mode sent for the key after the board started, `cur` the
// highest since. The mode's gain is measured from its OWN first reading, never from the row's
// hiscores baseline: that snapshot is the main game's numbers (a Leagues save shares the main
// account's name, so a lookup reads the main hiscores), and the mode save starts somewhere else
// entirely.
//
// A kill count, clue count or other counter is only pushed when it moves — the push IS the kill —
// so its first reading already includes one gain: that one is counted back in (KC_SLACK). XP is sent
// at login before any gain, so it isn't.
//
// Main and mode progress combine PER KEY as the larger of the two, never the sum: for a hardcore
// character enrolled under its own name, its hiscores and its pushes are the same kills, and summing
// would count them twice. Taking the larger can only ever under-count.
//
// Pure (no db).
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface ModeStatEntry {
  first: Record<string, number>;
  cur: Record<string, number>;
}
export type ModeStats = Record<string, ModeStatEntry>;

/** A counter's first push is the gain that triggered it. */
const KC_SLACK = 1;
const MAX_MODES = 8;
const SKILL_KEYS: ReadonlySet<string> = new Set(SKILLS.filter((s) => s !== 'overall'));

function cleanMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = Math.floor(v);
  }
  return out;
}

/** event_participants.mode_stats → per-mode readings. Garbage reads as nothing. */
export function parseModeStats(json: string | null | undefined): ModeStats {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: ModeStats = {};
    for (const [mode, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as { first?: unknown; cur?: unknown };
      out[mode] = { first: cleanMap(e.first), cur: cleanMap(e.cur) };
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Fold one push from `mode` into a row's readings: `cur` only rises, `first` is set once per key.
 * Returns the JSON to store, or null when nothing changed (skip the write).
 */
export function mergeModePush(json: string | null | undefined, mode: string, pushed: Record<string, number>): string | null {
  const all = parseModeStats(json);
  if (!all[mode] && Object.keys(all).length >= MAX_MODES) return null;
  const entry = all[mode] ?? { first: {}, cur: {} };
  let changed = false;
  for (const [key, raw] of Object.entries(pushed)) {
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) continue;
    const v = Math.floor(raw);
    if (entry.first[key] == null) {
      entry.first[key] = v;
      changed = true;
    }
    if (v > (entry.cur[key] ?? -1)) {
      entry.cur[key] = v;
      changed = true;
    }
  }
  if (!changed) return null;
  all[mode] = entry;
  return JSON.stringify(all);
}

/** One key's gain on one mode save since the board started. */
function keyGain(entry: ModeStatEntry, key: string, statType: string): number {
  const first = entry.first[key];
  const cur = entry.cur[key];
  if (first == null || cur == null) return 0;
  const slack = statType === 'skill' ? 0 : KC_SLACK;
  return Math.max(0, cur - first + (first > 0 ? slack : 0));
}

/** Total XP on a mode save: every skill it reported, each from its own first reading. */
function overallGain(entry: ModeStatEntry): number {
  let sum = 0;
  for (const key of Object.keys(entry.cur)) if (SKILL_KEYS.has(key)) sum += keyGain(entry, key, 'skill');
  return sum;
}

/** The best gain any counted mode shows for one key. */
function bestModeGain(modes: ModeStats, counted: readonly string[], key: string, statType: string): number {
  let best = 0;
  for (const mode of counted) {
    const entry = modes[mode];
    if (!entry) continue;
    const g = statType === 'skill' && key === 'overall' ? overallGain(entry) : keyGain(entry, key, statType);
    if (g > best) best = g;
  }
  return best;
}

/**
 * A board row's gain for a stat tile: the main-game gain (lib/statTracking computeGain — hiscores and
 * the live overlay over the row's baseline), raised per key by any mode the board counts.
 * With no counted modes, or no mode readings, it is exactly computeGainFromJson.
 */
export function statGainWithModes(
  baselineJson: string | null | undefined,
  currentJson: string | null | undefined,
  liveMap: Record<string, number>,
  keys: string[],
  statType: string,
  modeStatsJson: string | null | undefined,
  counted: readonly string[],
): number {
  const modes = counted.length > 0 ? parseModeStats(modeStatsJson) : {};
  if (!counted.some((m) => modes[m])) return computeGainFromJson(baselineJson, currentJson, liveMap, keys, statType);
  let total = 0;
  for (const key of keys) {
    const main = computeGainFromJson(baselineJson, currentJson, liveMap, [key], statType);
    total += Math.max(main, bestModeGain(modes, counted, key, statType));
  }
  return total;
}

/**
 * A lifetime-threshold (milestone) tile on a mode save: eligible only when every key's first reading
 * this event was below the goal, reached once the save's own lifetime total gets there. The main
 * game's state wins when it has already reached; otherwise a counted mode that has does.
 */
export function milestoneWithModes(
  main: MilestoneState,
  modeStatsJson: string | null | undefined,
  counted: readonly string[],
  keys: string[],
  statType: string,
  goal: number,
): MilestoneState {
  if (main.reached || counted.length === 0) return main;
  const modes = parseModeStats(modeStatsJson);
  for (const mode of counted) {
    const entry = modes[mode];
    if (!entry || !keys.every((k) => entry.first[k] != null)) continue;
    const slack = statType === 'skill' ? 0 : KC_SLACK;
    const start = keys.reduce((n, k) => n + Math.max(0, entry.first[k] - (entry.first[k] > 0 ? slack : 0)), 0);
    const lifetime = keys.reduce((n, k) => n + (entry.cur[k] ?? 0), 0);
    if (start < goal && lifetime >= goal) return { lifetime, eligible: true, reached: true };
  }
  return main;
}

/** The modes a board counts, from its parsed rules (empty = main game only). */
export function countedModes(rules: { worldModes?: readonly string[] } | null | undefined): string[] {
  return Array.isArray(rules?.worldModes) ? [...rules.worldModes] : [];
}
